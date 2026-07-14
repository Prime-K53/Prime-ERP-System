import { dbService } from './db';
import { generateId, roundToCurrency } from '../utils/helpers';
import { logger } from './logger';
import type {
  Referral, ReferralCommission, ReferralWallet,
  ReferralTransaction, ReferralSettings, ReferralLog
} from '../types/referral';

const DEFAULT_SETTINGS: ReferralSettings = {
  enableReferralSystem: true,
  enableWallet: true,
  enableReferralCode: true,
  defaultCommissionPercent: 5,
  defaultCommissionFixed: 0,
  approvalRequired: false,
  autoCreditWallet: true,
  minimumWithdrawal: 10,
  commissionExpiryDays: 365,
  maximumReferralDepth: 1,
  allowSelfReferral: false,
  allowEmployeeReferral: false,
  allowDuplicatePhone: false,
  minInvoiceAmount: 0,
  maxCommission: 0,
  commissionValidityDays: 365,
  productSpecificCommission: 0,
  serviceSpecificCommission: 0,
};

export const referralService = {
  async getSettings(): Promise<ReferralSettings> {
    const saved = localStorage.getItem('nexus_referral_settings');
    if (saved) {
      try { return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }; }
      catch { /* fall through */ }
    }
    return { ...DEFAULT_SETTINGS };
  },

  async saveSettings(settings: ReferralSettings): Promise<void> {
    localStorage.setItem('nexus_referral_settings', JSON.stringify(settings));
  },

  async generateReferralCode(customerName: string, customerId: string): Promise<string> {
    const prefix = customerName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const suffix = customerId.slice(-6).toUpperCase();
    return `REF-${prefix}-${suffix}`;
  },

  async getOrCreateReferral(customerId: string): Promise<Referral | null> {
    if (!customerId) return null;
    const all = await dbService.getAll<Referral>('referrals');
    return all.find(r => r.referredCustomerId === customerId && r.status === 'Active') || null;
  },

  async getReferrerForCustomer(customerId: string): Promise<Referral | null> {
    return this.getOrCreateReferral(customerId);
  },

  async getReferredCustomers(referrerId: string): Promise<Referral[]> {
    const all = await dbService.getAll<Referral>('referrals');
    return all.filter(r => r.referrerId === referrerId && r.status === 'Active');
  },

  async getOrCreateWallet(customerId: string): Promise<ReferralWallet> {
    const all = await dbService.getAll<ReferralWallet>('referralWallets');
    let wallet = all.find(w => w.customerId === customerId);
    if (!wallet) {
      wallet = {
        id: generateId('RFW'),
        customerId,
        currentBalance: 0,
        pendingCommission: 0,
        approvedCommission: 0,
        withdrawnAmount: 0,
        lifetimeEarnings: 0,
        updatedAt: new Date().toISOString(),
      };
      await dbService.put('referralWallets', wallet);
    }
    return wallet;
  },

  async assignReferral(
    referrerId: string,
    referredCustomerId: string,
    actorId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!referrerId || !referredCustomerId) {
      return { success: false, error: 'Referrer and referred customer are required' };
    }
    if (referrerId === referredCustomerId) {
      return { success: false, error: 'A customer cannot refer themselves' };
    }

    const settings = await this.getSettings();
    if (!settings.allowSelfReferral && referrerId === referredCustomerId) {
      return { success: false, error: 'Self-referral is not allowed' };
    }

    const existing = await this.getReferrerForCustomer(referredCustomerId);
    if (existing) {
      return { success: false, error: 'This customer already has a referrer' };
    }

    const referrer = await dbService.get('customers', referrerId);
    if (!referrer) return { success: false, error: 'Referrer not found' };

    const referred = await dbService.get('customers', referredCustomerId);
    if (!referred) return { success: false, error: 'Referred customer not found' };

    const referralCode = await this.generateReferralCode(referred.name, referredCustomerId);

    const referral: Referral = {
      id: generateId('REF'),
      referrerId,
      referredCustomerId,
      referralCode,
      status: 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbService.put('referrals', referral);

    await this.logAudit({
      action: 'REFERRAL_CREATED',
      entityType: 'referral',
      entityId: referral.id,
      actorId,
      newValue: JSON.stringify({ referrerId, referredCustomerId, referralCode }),
    });

    return { success: true };
  },

  async deactivateReferral(referralId: string, actorId?: string): Promise<void> {
    const referral = await dbService.get<Referral>('referrals', referralId);
    if (!referral) throw new Error('Referral not found');
    const oldValue = { ...referral };
    referral.status = 'Inactive';
    referral.updatedAt = new Date().toISOString();
    await dbService.put('referrals', referral);
    await this.logAudit({
      action: 'REFERRAL_DEACTIVATED',
      entityType: 'referral',
      entityId: referralId,
      actorId,
      oldValue: JSON.stringify(oldValue),
      newValue: JSON.stringify(referral),
    });
  },

  async processInvoiceCommission(invoice: any): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.enableReferralSystem) return;

    const customerId = invoice.customerId;
    if (!customerId) return;

    if (invoice.status !== 'Paid') return;
    if (invoice.totalAmount <= 0) return;
    if ((invoice.paidAmount || 0) < invoice.totalAmount) return;

    const referral = await this.getReferrerForCustomer(customerId);
    if (!referral) return;
    if (referral.status !== 'Active') return;

    const existingCommissions = await dbService.getAll<ReferralCommission>('referralCommissions');
    const alreadyExists = existingCommissions.find(
      c => c.invoiceId === invoice.id && c.status !== 'Reversed'
    );
    if (alreadyExists) return;

    const invoiceAmount = invoice.totalAmount;
    if (settings.minInvoiceAmount > 0 && invoiceAmount < settings.minInvoiceAmount) return;

    const rate = settings.defaultCommissionPercent / 100;
    let commissionAmount = invoiceAmount * rate;

    const fixedAmount = settings.defaultCommissionFixed;
    if (fixedAmount > 0 && settings.defaultCommissionPercent > 0) {
      commissionAmount = Math.max(commissionAmount, fixedAmount);
    } else if (fixedAmount > 0) {
      commissionAmount = fixedAmount;
    }

    if (settings.maxCommission > 0 && commissionAmount > settings.maxCommission) {
      commissionAmount = settings.maxCommission;
    }

    commissionAmount = roundToCurrency(commissionAmount);
    if (commissionAmount <= 0) return;

    const commission: ReferralCommission = {
      id: generateId('RFC'),
      referralId: referral.id,
      referrerId: referral.referrerId,
      referredCustomerId: customerId,
      invoiceId: invoice.id,
      invoiceAmount,
      commissionRate: settings.defaultCommissionPercent,
      commissionAmount,
      commissionType: settings.defaultCommissionFixed > 0 && settings.defaultCommissionPercent > 0
        ? 'Mixed' : settings.defaultCommissionFixed > 0 ? 'Fixed' : 'Percentage',
      status: settings.approvalRequired ? 'Pending' : 'Approved',
      paymentStatus: 'Unpaid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbService.put('referralCommissions', commission);

    if (!settings.approvalRequired && settings.autoCreditWallet) {
      await this.creditWallet(commission.id, commission.referrerId, commission.commissionAmount);
    }

    await this.logAudit({
      action: 'COMMISSION_GENERATED',
      entityType: 'referralCommission',
      entityId: commission.id,
      newValue: JSON.stringify(commission),
    });
  },

  async approveCommission(commissionId: string, actorId?: string): Promise<void> {
    const commission = await dbService.get<ReferralCommission>('referralCommissions', commissionId);
    if (!commission) throw new Error('Commission not found');
    if (commission.status !== 'Pending') throw new Error('Commission is not in Pending status');

    const oldValue = { ...commission };
    commission.status = 'Approved';
    commission.approvedAt = new Date().toISOString();
    commission.updatedAt = new Date().toISOString();
    await dbService.put('referralCommissions', commission);

    const settings = await this.getSettings();
    if (settings.autoCreditWallet) {
      await this.creditWallet(commissionId, commission.referrerId, commission.commissionAmount);
    }

    await this.logAudit({
      action: 'COMMISSION_APPROVED',
      entityType: 'referralCommission',
      entityId: commissionId,
      actorId,
      oldValue: JSON.stringify(oldValue),
      newValue: JSON.stringify(commission),
    });
  },

  async payCommission(commissionId: string, actorId?: string): Promise<void> {
    const commission = await dbService.get<ReferralCommission>('referralCommissions', commissionId);
    if (!commission) throw new Error('Commission not found');
    if (commission.status !== 'Approved') throw new Error('Commission must be Approved first');

    const oldValue = { ...commission };
    commission.status = 'Paid';
    commission.paymentStatus = 'Paid';
    commission.paidAt = new Date().toISOString();
    commission.updatedAt = new Date().toISOString();
    await dbService.put('referralCommissions', commission);

    await this.logAudit({
      action: 'COMMISSION_PAID',
      entityType: 'referralCommission',
      entityId: commissionId,
      actorId,
      oldValue: JSON.stringify(oldValue),
      newValue: JSON.stringify(commission),
    });
  },

  async reverseCommission(commissionId: string, reason: string, actorId?: string): Promise<void> {
    const commission = await dbService.get<ReferralCommission>('referralCommissions', commissionId);
    if (!commission) throw new Error('Commission not found');
    if (commission.status === 'Reversed') throw new Error('Commission is already reversed');

    const oldValue = { ...commission };
    commission.status = 'Reversed';
    commission.updatedAt = new Date().toISOString();
    commission.notes = reason;
    await dbService.put('referralCommissions', commission);

    if (oldValue.status === 'Approved' || oldValue.status === 'Paid') {
      await this.reverseWalletCredit(commission.referrerId, commission.commissionAmount, commissionId);
    }

    await this.logAudit({
      action: 'COMMISSION_REVERSED',
      entityType: 'referralCommission',
      entityId: commissionId,
      actorId,
      oldValue: JSON.stringify(oldValue),
      newValue: JSON.stringify(commission),
    });
  },

  async creditWallet(customerId: string, amount: number, referenceId?: string): Promise<void> {
    const wallet = await this.getOrCreateWallet(customerId);
    const balanceBefore = wallet.currentBalance;

    wallet.pendingCommission = Math.max(0, wallet.pendingCommission - amount);
    wallet.approvedCommission = Math.max(0, wallet.approvedCommission + amount);
    wallet.currentBalance = roundToCurrency(wallet.currentBalance + amount);
    wallet.lifetimeEarnings = roundToCurrency(wallet.lifetimeEarnings + amount);
    wallet.updatedAt = new Date().toISOString();

    await dbService.put('referralWallets', wallet);

    const tx: ReferralTransaction = {
      id: generateId('RFT'),
      walletId: wallet.id,
      customerId,
      type: 'Commission',
      amount,
      balanceBefore,
      balanceAfter: wallet.currentBalance,
      referenceId,
      referenceType: 'commission',
      description: `Commission credited`,
      status: 'Completed',
      createdAt: new Date().toISOString(),
    };
    await dbService.put('referralTransactions', tx);

    await this.logAudit({
      action: 'WALLET_CREDITED',
      entityType: 'referralWallet',
      entityId: wallet.id,
      newValue: JSON.stringify({ customerId, amount, balanceBefore, balanceAfter: wallet.currentBalance }),
    });
  },

  async reverseWalletCredit(customerId: string, amount: number, referenceId?: string): Promise<void> {
    const wallet = await this.getOrCreateWallet(customerId);
    const balanceBefore = wallet.currentBalance;

    wallet.currentBalance = roundToCurrency(Math.max(0, wallet.currentBalance - amount));
    wallet.approvedCommission = Math.max(0, wallet.approvedCommission - amount);
    wallet.lifetimeEarnings = roundToCurrency(Math.max(0, wallet.lifetimeEarnings - amount));
    wallet.updatedAt = new Date().toISOString();

    await dbService.put('referralWallets', wallet);

    const tx: ReferralTransaction = {
      id: generateId('RFT'),
      walletId: wallet.id,
      customerId,
      type: 'Reversal',
      amount,
      balanceBefore,
      balanceAfter: wallet.currentBalance,
      referenceId,
      referenceType: 'commission_reversal',
      description: `Commission reversed`,
      status: 'Completed',
      createdAt: new Date().toISOString(),
    };
    await dbService.put('referralTransactions', tx);
  },

  async reverseCommissionForInvoice(invoiceId: string, reason: string, actorId?: string): Promise<void> {
    const commissions = await dbService.getAll<ReferralCommission>('referralCommissions');
    const invoiceCommissions = commissions.filter(c => c.invoiceId === invoiceId && c.status !== 'Reversed');
    for (const commission of invoiceCommissions) {
      await this.reverseCommission(commission.id, reason, actorId);
    }
  },

  async withdrawFromWallet(customerId: string, amount: number, actorId?: string): Promise<{ success: boolean; error?: string }> {
    const settings = await this.getSettings();
    if (settings.minimumWithdrawal > 0 && amount < settings.minimumWithdrawal) {
      return { success: false, error: `Minimum withdrawal is ${settings.minimumWithdrawal}` };
    }

    const wallet = await this.getOrCreateWallet(customerId);
    if (wallet.currentBalance < amount) {
      return { success: false, error: 'Insufficient wallet balance' };
    }

    const balanceBefore = wallet.currentBalance;
    wallet.currentBalance = roundToCurrency(wallet.currentBalance - amount);
    wallet.withdrawnAmount = roundToCurrency(wallet.withdrawnAmount + amount);
    wallet.updatedAt = new Date().toISOString();
    await dbService.put('referralWallets', wallet);

    const tx: ReferralTransaction = {
      id: generateId('RFT'),
      walletId: wallet.id,
      customerId,
      type: 'Withdrawal',
      amount,
      balanceBefore,
      balanceAfter: wallet.currentBalance,
      description: 'Withdrawal request',
      status: 'Completed',
      createdAt: new Date().toISOString(),
    };
    await dbService.put('referralTransactions', tx);

    await this.logAudit({
      action: 'WALLET_WITHDRAWAL',
      entityType: 'referralWallet',
      entityId: wallet.id,
      actorId,
      newValue: JSON.stringify({ customerId, amount, balanceBefore, balanceAfter: wallet.currentBalance }),
    });

    return { success: true };
  },

  async getDashboardStats(): Promise<{
    totalReferrals: number;
    activeReferrals: number;
    totalCommissions: number;
    pendingCommission: number;
    paidCommission: number;
    totalCommissionAmount: number;
    totalReferralSales: number;
    topReferrers: { customerId: string; customerName: string; count: number; sales: number }[];
  }> {
    const referrals = await dbService.getAll<Referral>('referrals');
    const commissions = await dbService.getAll<ReferralCommission>('referralCommissions');
    const customers = await dbService.getAll<any>('customers');
    const invoices = await dbService.getAll<any>('invoices');

    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter(r => r.status === 'Active').length;
    const totalCommissions = commissions.length;
    const pendingCommission = commissions.filter(c => c.status === 'Pending').reduce((s, c) => s + c.commissionAmount, 0);
    const paidCommission = commissions.filter(c => c.status === 'Paid').reduce((s, c) => s + c.commissionAmount, 0);
    const totalCommissionAmount = commissions.reduce((s, c) => s + c.commissionAmount, 0);

    const referralInvoiceIds = [...new Set(commissions.map(c => c.invoiceId))];
    const totalReferralSales = invoices
      .filter(inv => referralInvoiceIds.includes(inv.id))
      .reduce((s, inv) => s + (inv.totalAmount || 0), 0);

    const referrerCounts: Record<string, { count: number; sales: number }> = {};
    for (const ref of referrals) {
      if (!referrerCounts[ref.referrerId]) {
        referrerCounts[ref.referrerId] = { count: 0, sales: 0 };
      }
      referrerCounts[ref.referrerId].count++;
      const refCommissions = commissions.filter(c => c.referredCustomerId === ref.referredCustomerId);
      for (const c of refCommissions) {
        const inv = invoices.find(i => i.id === c.invoiceId);
        referrerCounts[ref.referrerId].sales += inv?.totalAmount || 0;
      }
    }

    const topReferrers = Object.entries(referrerCounts)
      .map(([customerId, data]) => {
        const customer = customers.find(c => c.id === customerId);
        return {
          customerId,
          customerName: customer?.name || 'Unknown',
          count: data.count,
          sales: data.sales,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalReferrals, activeReferrals,
      totalCommissions, pendingCommission, paidCommission,
      totalCommissionAmount, totalReferralSales, topReferrers,
    };
  },

  async getReferralTransactions(customerId: string): Promise<ReferralTransaction[]> {
    const all = await dbService.getAll<ReferralTransaction>('referralTransactions');
    return all
      .filter(t => t.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getCommissionHistory(customerId: string): Promise<ReferralCommission[]> {
    const all = await dbService.getAll<ReferralCommission>('referralCommissions');
    return all
      .filter(c => c.referrerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getReferralSalesBreakdown(referrerId: string): Promise<{
    customerName: string;
    invoiceCount: number;
    totalSales: number;
    totalCommission: number;
  }[]> {
    const commissions = await dbService.getAll<ReferralCommission>('referralCommissions');
    const customers = await dbService.getAll<any>('customers');
    const invoices = await dbService.getAll<any>('invoices');

    const refCommissions = commissions.filter(c => c.referrerId === referrerId);
    const breakdown: Record<string, { customerName: string; invoiceIds: Set<string>; totalSales: number; totalCommission: number }> = {};

    for (const c of refCommissions) {
      if (!breakdown[c.referredCustomerId]) {
        const referred = customers.find(cust => cust.id === c.referredCustomerId);
        breakdown[c.referredCustomerId] = {
          customerName: referred?.name || 'Unknown',
          invoiceIds: new Set(),
          totalSales: 0,
          totalCommission: 0,
        };
      }
      breakdown[c.referredCustomerId].invoiceIds.add(c.invoiceId);
      breakdown[c.referredCustomerId].totalCommission += c.commissionAmount;
      const inv = invoices.find(i => i.id === c.invoiceId);
      if (inv) breakdown[c.referredCustomerId].totalSales += inv.totalAmount || 0;
    }

    return Object.entries(breakdown).map(([_, b]) => ({
      customerName: b.customerName,
      invoiceCount: b.invoiceIds.size,
      totalSales: b.totalSales,
      totalCommission: b.totalCommission,
    }));
  },

  async logAudit(entry: Omit<ReferralLog, 'id' | 'createdAt'>): Promise<void> {
    try {
      const log: ReferralLog = {
        id: generateId('RFL'),
        ...entry,
        createdAt: new Date().toISOString(),
      };
      await dbService.put('referralLogs', log);
    } catch (err) {
      logger.error('Failed to write referral audit log', err);
    }
  },
};

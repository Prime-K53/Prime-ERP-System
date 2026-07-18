import { cloudDb } from './cloudDb'
import { Referral, ReferralReward, ReferralSettings, DEFAULT_REFERRAL_SETTINGS } from '../types/referral'
import { generateId } from './transactions/_internal'
import { logger } from './logger'
import { referralRuleEngine } from './referralRuleEngine'
import { referralEventBus } from './referralEventBus'
import { referralTimelineService } from './referralTimelineService'
import { referralAuditService } from './referralAuditService'
import { referralCampaignService } from './referralCampaignService'

const getCompanyConfig = () => {
  const saved = localStorage.getItem('nexus_company_config')
  if (saved) {
    try { return JSON.parse(saved) } catch { }
  }
  return null
}

const getReferralSettings = (): ReferralSettings => {
  const config = getCompanyConfig()
  return { ...DEFAULT_REFERRAL_SETTINGS, ...(config?.referralSettings || {}) }
}

const getGLConfig = () => {
  const saved = localStorage.getItem('nexus_company_config')
  const defaultConfig = {
    defaultSalesAccount: '4000',
    defaultInventoryAccount: '1200',
    defaultCOGSAccount: '5000',
    cashDrawerAccount: '1000',
    customerDepositAccount: '2100',
    marketingExpenseAccount: '6100',
  }
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      return { ...defaultConfig, ...(parsed.glMapping || {}) }
    } catch { }
  }
  return defaultConfig
}

const toMoney = (v: number): number => Math.round(v * 100) / 100

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export const referralService = {
  async registerReferral(customerId: string, referredById: string, referredByName?: string, actorId?: string): Promise<Referral> {
    const settings = getReferralSettings()
    const all = (await cloudDb.getAll<Referral>('referrals')) || []

    const eligibility = await referralRuleEngine.evaluateEligibility({
      customerId,
      referredById,
      paidAmount: 0,
      existingReferrals: all as Array<{ customerId: string; referredById: string; status: string }>,
    })
    if (!eligibility.allowed) {
      throw new Error(eligibility.reason || 'Referral not allowed')
    }

    const referral: Referral = {
      id: generateId('REF'),
      customerId,
      referredById,
      referredByName,
      referralCode: generateReferralCode(),
      status: 'active',
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await cloudDb.put('referrals', referral)

    await referralTimelineService.addEntry({
      referralId: referral.id,
      eventType: 'created',
      title: 'Referral registered',
      description: `${referredByName || 'A customer'} was referred`,
      actorId: actorId || referredById,
      actorName: referredByName,
    })

    await referralAuditService.log({
      entityType: 'referral',
      entityId: referral.id,
      action: 'created',
      actorId: actorId || 'system',
      newValue: referral,
    })

    await referralEventBus.emit('referral.created', {
      source: 'referralService',
      entityType: 'referral',
      entityId: referral.id,
      data: { customerId, referredById, referredByName, referralCode: referral.referralCode },
      actorId: actorId || referredById,
    })

    return referral
  },

  async registerReferralFromInvoice(invoice: {
    id: string
    customerId: string
    customerName?: string
    totalAmount: number
    referredById?: string
    referredByName?: string
  }): Promise<Referral | null> {
    if (!invoice.referredById) return null
    if (invoice.customerId === invoice.referredById) return null

    const settings = getReferralSettings()
    if (!settings.enabled) return null

    const all = (await cloudDb.getAll<Referral>('referrals')) || []
    const existing = all.find(
      r => r.customerId === invoice.customerId && r.referredById === invoice.referredById && r.status === 'active'
    )
    if (existing) {
      if (existing.pendingInvoiceId && existing.pendingInvoiceId !== invoice.id) {
        existing.pendingInvoiceId = invoice.id
        existing.pendingInvoiceAmount = invoice.totalAmount
        existing.updatedAt = new Date().toISOString()
        await cloudDb.put('referrals', existing)
      }
      return existing
    }

    const referral: Referral = {
      id: generateId('REF'),
      customerId: invoice.customerId,
      referredById: invoice.referredById,
      referredByName: invoice.referredByName,
      referralCode: generateReferralCode(),
      status: 'active',
      date: new Date().toISOString(),
      pendingInvoiceId: invoice.id,
      pendingInvoiceAmount: invoice.totalAmount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await cloudDb.put('referrals', referral)

    await referralTimelineService.addEntry({
      referralId: referral.id,
      eventType: 'created',
      title: 'Referral registered from invoice',
      description: `${invoice.referredByName || 'A customer'} was referred — invoice #${invoice.id} (${invoice.totalAmount}) pending`,
      actorId: invoice.referredById,
      actorName: invoice.referredByName,
      metadata: { invoiceId: invoice.id, invoiceAmount: invoice.totalAmount },
    })

    return referral
  },

  async getReferralsByCustomer(customerId: string): Promise<Referral[]> {
    const all = (await cloudDb.getAll<Referral>('referrals')) || []
    return all.filter(r => r.customerId === customerId)
  },

  async getReferralsByReferrer(referredById: string): Promise<Referral[]> {
    const all = (await cloudDb.getAll<Referral>('referrals')) || []
    return all.filter(r => r.referredById === referredById)
  },

  async getReferralByCode(code: string): Promise<Referral | undefined> {
    const all = (await cloudDb.getAll<Referral>('referrals')) || []
    return all.find(r => r.referralCode === code && r.status === 'active')
  },

  async getAllReferrals(): Promise<Referral[]> {
    return (await cloudDb.getAll<Referral>('referrals')) || []
  },

  async getPendingRewards(): Promise<ReferralReward[]> {
    const all = (await cloudDb.getAll<ReferralReward>('referralRewards')) || []
    return all.filter(r => r.status === 'pending')
  },

  async getRewardsByCustomer(customerId: string): Promise<ReferralReward[]> {
    const all = (await cloudDb.getAll<ReferralReward>('referralRewards')) || []
    return all.filter(r => r.customerId === customerId)
  },

  async getRewardsByReferral(referralId: string): Promise<ReferralReward[]> {
    const all = (await cloudDb.getAll<ReferralReward>('referralRewards')) || []
    return all.filter(r => r.referralId === referralId)
  },

  async approveReward(rewardId: string, approvedBy: string): Promise<ReferralReward> {
    const all = (await cloudDb.getAll<ReferralReward>('referralRewards')) || []
    const reward = all.find(r => r.id === rewardId)
    if (!reward) throw new Error('Reward not found')
    if (reward.status !== 'pending') throw new Error('Reward is not in pending status')

    const creditResult = await this.creditWalletForReward(reward)

    const allReferrals = (await cloudDb.getAll<Referral>('referrals')) || []
    const referral = allReferrals.find(r => r.id === reward.referralId)
    if (referral && referral.status === 'active') {
      referral.status = 'converted'
      referral.convertedAt = new Date().toISOString()
      referral.convertedInvoiceId = reward.invoiceId
      referral.pendingInvoiceId = undefined
      referral.pendingInvoiceAmount = undefined
      await cloudDb.put('referrals', referral)
    }

    reward.status = 'approved'
    reward.approvedAt = new Date().toISOString()
    reward.approvedBy = approvedBy
    reward.walletTransactionId = creditResult.walletTransactionId
    reward.updatedAt = new Date().toISOString()
    await cloudDb.put('referralRewards', reward)

    await referralTimelineService.addEntry({
      referralId: reward.referralId,
      eventType: 'reward_approved',
      title: 'Reward approved',
      description: `Reward of ${reward.amount} approved by ${approvedBy}`,
      amount: reward.amount,
      actorId: approvedBy,
    })

    await referralAuditService.log({
      entityType: 'reward',
      entityId: reward.id,
      action: 'approved',
      actorId: approvedBy,
      fieldName: 'status',
      oldValue: 'pending',
      newValue: 'approved',
    })

    await referralEventBus.emit('reward.approved', {
      source: 'referralService',
      entityType: 'reward',
      entityId: reward.id,
      data: { amount: reward.amount, invoiceId: reward.invoiceId, walletTransactionId: creditResult.walletTransactionId },
      actorId: approvedBy,
    })

    return reward
  },

  async rejectReward(rewardId: string, reason: string, rejectedBy?: string): Promise<ReferralReward> {
    const all = (await cloudDb.getAll<ReferralReward>('referralRewards')) || []
    const reward = all.find(r => r.id === rewardId)
    if (!reward) throw new Error('Reward not found')
    if (reward.status !== 'pending') throw new Error('Reward is not in pending status')

    reward.status = 'cancelled'
    reward.cancelledAt = new Date().toISOString()
    reward.cancelReason = reason
    reward.cancelledBy = rejectedBy
    reward.updatedAt = new Date().toISOString()
    await cloudDb.put('referralRewards', reward)

    await referralTimelineService.addEntry({
      referralId: reward.referralId,
      eventType: 'reward_rejected',
      title: 'Reward rejected',
      description: `Reward rejected: ${reason}`,
      amount: reward.amount,
      actorId: rejectedBy,
    })

    await referralAuditService.log({
      entityType: 'reward',
      entityId: reward.id,
      action: 'rejected',
      actorId: rejectedBy || 'system',
      fieldName: 'status',
      oldValue: 'pending',
      newValue: 'cancelled',
      reason,
    })

    await referralEventBus.emit('reward.rejected', {
      source: 'referralService',
      entityType: 'reward',
      entityId: reward.id,
      data: { amount: reward.amount, reason },
      actorId: rejectedBy,
    })

    return reward
  },

  async creditWalletForReward(reward: ReferralReward): Promise<{ walletTransactionId: string }> {
    const allReferrals = (await cloudDb.getAll<Referral>('referrals')) || []
    const referral = allReferrals.find(r => r.id === reward.referralId)
    const referrerCustomerId = referral?.referredById
    if (!referrerCustomerId) throw new Error('Referrer customer not found for this reward')

    const customers = (await cloudDb.getAll<any>('customers')) || []
    const referrer = customers.find((c: any) => c.id === referrerCustomerId)
    if (!referrer) throw new Error('Referrer customer record not found')

    const gl = getGLConfig()
    const walletTxId = generateId('WLT-REF')

    const walletTx = {
      id: walletTxId,
      customerId: referrerCustomerId,
      amount: reward.amount,
      type: 'Deposit',
      date: new Date().toISOString(),
      reference: `Referral reward for invoice #${reward.invoiceId}`,
      description: `Referral reward credit - ${referral?.referredByName || 'Referral'}`,
    }
    referrer.walletBalance = toMoney((referrer.walletBalance || 0) + reward.amount)
    const ledgerEntry = {
      id: generateId('LG-REF'),
      date: new Date().toISOString(),
      description: `Referral reward credit - ${referral?.referredByName || 'Referral'}`,
      debitAccountId: gl.marketingExpenseAccount || gl.cashDrawerAccount,
      creditAccountId: gl.customerDepositAccount,
      amount: reward.amount,
      referenceId: reward.invoiceId,
      customerId: referrerCustomerId,
      customerName: referrer.name || '',
    }
    const idempotencyKey = {
      id: `referral-reward-credit:${reward.id}`,
      scope: 'referral-reward-credit',
      sourceId: reward.id,
      createdAt: new Date().toISOString(),
    }

    await Promise.all([
      cloudDb.put('walletTransactions', walletTx),
      cloudDb.put('customers', referrer),
      cloudDb.put('ledger', ledgerEntry),
      cloudDb.put('idempotencyKeys', idempotencyKey),
    ])

    return { walletTransactionId: walletTxId }
  },

  async processInvoiceReward(invoice: {
    id: string
    customerId: string
    totalAmount: number
    paidAmount: number
    referredBy?: string
    referredByName?: string
    status?: string
  }): Promise<ReferralReward | null> {
    console.log('[REFERRAL_SCAN STEP2] Invoice payload', JSON.stringify(invoice));
    console.log('[REFERRAL_SCAN STEP5] Checking company ID...');
    const _companyIdForScan = await cloudDb.getActiveCompanyId().catch(() => null);
    console.log('[REFERRAL_SCAN STEP5] Company ID resolved:', _companyIdForScan);

    if (!invoice.referredBy) { console.log('[REFERRAL_SCAN STEP3] EXIT_REASON: missing_referredBy'); return null }
    console.log('[REFERRAL_SCAN STEP2] referredBy present:', invoice.referredBy);
    if (invoice.customerId === invoice.referredBy) { console.log('[REFERRAL_SCAN STEP3] EXIT_REASON: self_referral', invoice.customerId, '===', invoice.referredBy); return null }

    const settings = getReferralSettings()
    console.log('[REFERRAL_SCAN STEP3] Settings.enabled:', settings?.enabled, 'settings:', JSON.stringify(settings));
    if (!settings.enabled) { console.log('[REFERRAL_SCAN STEP3] EXIT_REASON: referrals_disabled'); return null }

    const allKeys = (await cloudDb.getAll<any>('idempotencyKeys')) || []
    const idempotencyKeyId = `referral-reward:${invoice.id}`
    const alreadyProcessed = allKeys.find((k: any) => k.id === idempotencyKeyId);
    if (alreadyProcessed) { console.log('[REFERRAL_SCAN STEP3] EXIT_REASON: already_processed (idempotency)', idempotencyKeyId); return null }
    console.log('[REFERRAL_SCAN STEP3] Idempotency check passed');

    const allReferrals = (await cloudDb.getAll<Referral>('referrals')) || []
    console.log('[REFERRAL_SCAN STEP6] READ_BACK referrals count:', allReferrals.length);

    const eligibility = await referralRuleEngine.evaluateEligibility({
      customerId: invoice.customerId,
      referredById: invoice.referredBy,
      paidAmount: invoice.paidAmount,
      existingReferrals: allReferrals as Array<{ customerId: string; referredById: string; status: string }>,
    })
    console.log('[REFERRAL_SCAN STEP4] Eligibility result:', JSON.stringify(eligibility));
    if (!eligibility.allowed) { console.log('[REFERRAL_SCAN STEP3] EXIT_REASON: eligibility_failed', eligibility.reason); return null }

    const activeCampaign = await referralCampaignService.getApplicableCampaign(
      invoice.customerId,
      invoice.paidAmount
    )

    const rewardCalc = await referralRuleEngine.calculateReward({
      paidAmount: invoice.paidAmount,
      campaign: activeCampaign,
    })
    console.log('[REFERRAL_SCAN STEP4] Reward calc result:', JSON.stringify(rewardCalc));
    if (!rewardCalc.allowed || !rewardCalc.rewardAmount) { console.log('[REFERRAL_SCAN STEP3] EXIT_REASON: reward_calc_failed', rewardCalc?.reason || 'no reward amount'); return null }

    const rewardAmount = rewardCalc.rewardAmount
    console.log('[REFERRAL_SCAN STEP4] Reward amount calculated:', rewardAmount);

    let referral = allReferrals.find(
      r => r.customerId === invoice.customerId && r.referredById === invoice.referredBy && r.status === 'active'
    )
    if (!referral) {
      console.log('[REFERRAL_SCAN STEP3] No existing active referral found — auto-registering');
      referral = await this.registerReferral(invoice.customerId, invoice.referredBy, invoice.referredByName)
      console.log('[REFERRAL_SCAN STEP3] Auto-registered referral id:', referral.id);
    } else {
      console.log('[REFERRAL_SCAN STEP3] Found existing active referral:', referral.id);
    }

    const needsApproval = (await referralRuleEngine.evaluateApprovalRequirement({
      rewardAmount,
      campaign: activeCampaign,
    })).needsApproval
    console.log('[REFERRAL_SCAN STEP4] Needs approval:', needsApproval);

    const reward: ReferralReward = {
      id: generateId('REW'),
      referralId: referral.id,
      customerId: invoice.referredBy,
      invoiceId: invoice.id,
      invoiceAmount: invoice.totalAmount,
      amount: rewardAmount,
      status: needsApproval ? 'pending' : 'approved',
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    console.log('[REFERRAL_SCAN STEP6] Attempting PUT referralRewards', reward.id);
    try {
      await cloudDb.put('referralRewards', reward)
      console.log('[REFERRAL_SCAN STEP6] PUT_SUCCESS referralRewards', reward.id);
    } catch (e: any) {
      console.error('[REFERRAL_SCAN STEP6] PUT_FAILED referralRewards', e?.message || e);
      throw e;
    }

    console.log('[REFERRAL_SCAN STEP6] Attempting PUT idempotencyKeys', idempotencyKeyId);
    try {
      await cloudDb.put('idempotencyKeys', {
        id: idempotencyKeyId,
        scope: 'referral-reward',
        sourceId: invoice.id,
        createdAt: new Date().toISOString(),
        metadata: { rewardId: reward.id, amount: rewardAmount, campaignId: activeCampaign?.id },
      })
      console.log('[REFERRAL_SCAN STEP6] PUT_SUCCESS idempotencyKeys');
    } catch (e: any) {
      console.error('[REFERRAL_SCAN STEP6] PUT_FAILED idempotencyKeys', e?.message || e);
    }

    console.log('[REFERRAL_SCAN STEP6] Attempting timeline addEntry for reward_earned');
    try {
      await referralTimelineService.addEntry({
        referralId: referral.id,
        eventType: 'reward_earned',
        title: needsApproval ? 'Reward earned (pending approval)' : 'Reward earned',
        description: `Reward of ${rewardAmount} earned from invoice #${invoice.id}`,
        amount: rewardAmount,
        metadata: { invoiceId: invoice.id, campaignId: activeCampaign?.id, needsApproval },
      })
      console.log('[REFERRAL_SCAN STEP6] Timeline entry added');
    } catch (e: any) {
      console.error('[REFERRAL_SCAN STEP6] Timeline addEntry failed', e?.message || e);
    }

    console.log('[REFERRAL_SCAN STEP6] Attempting audit log');
    try {
      await referralAuditService.log({
        entityType: 'reward',
        entityId: reward.id,
        action: 'created',
        actorId: 'system',
        newValue: reward,
        correlationId: `invoice-${invoice.id}`,
      })
      console.log('[REFERRAL_SCAN STEP6] Audit log added');
    } catch (e: any) {
      console.error('[REFERRAL_SCAN STEP6] Audit log failed', e?.message || e);
    }

    console.log('[REFERRAL_SCAN STEP6] Emitting reward.earned event');
    await referralEventBus.emit('reward.earned', {
      source: 'referralService',
      entityType: 'reward',
      entityId: reward.id,
      data: { amount: rewardAmount, invoiceId: invoice.id, needsApproval, campaignId: activeCampaign?.id },
      correlationId: `invoice-${invoice.id}`,
    })

    if (!needsApproval) {
      console.log('[REFERRAL_SCAN STEP3] Auto-approve path — needsApproval is false, crediting wallet');
      referral.status = 'converted'
      referral.convertedAt = new Date().toISOString()
      referral.convertedInvoiceId = invoice.id
      referral.pendingInvoiceId = undefined
      referral.pendingInvoiceAmount = undefined
      console.log('[REFERRAL_SCAN STEP6] Attempting PUT referral for conversion', referral.id);
      try {
        await cloudDb.put('referrals', referral)
        console.log('[REFERRAL_SCAN STEP6] PUT_SUCCESS referrals', referral.id);
      } catch (e: any) {
        console.error('[REFERRAL_SCAN STEP6] PUT_FAILED referrals', e?.message || e);
      }

      console.log('[REFERRAL_SCAN STEP6] Attempting creditWalletForReward', reward.id);
      try {
        await this.creditWalletForReward(reward)
        console.log('[REFERRAL_SCAN STEP6] creditWalletForReward SUCCESS');
      } catch (e: any) {
        console.error('[REFERRAL_SCAN STEP6] creditWalletForReward FAILED', e?.message || e);
        throw e;
      }
      reward.status = 'paid'
      reward.approvedAt = new Date().toISOString()
      reward.updatedAt = new Date().toISOString()
      console.log('[REFERRAL_SCAN STEP6] Attempting PUT referralRewards for paid status', reward.id);
      try {
        await cloudDb.put('referralRewards', reward)
        console.log('[REFERRAL_SCAN STEP6] PUT_SUCCESS referralRewards paid', reward.id);
      } catch (e: any) {
        console.error('[REFERRAL_SCAN STEP6] PUT_FAILED referralRewards paid', e?.message || e);
      }

      try {
        await referralTimelineService.addEntry({
          referralId: referral.id,
          eventType: 'reward_paid',
          title: 'Reward paid',
          description: `Reward of ${rewardAmount} credited to wallet`,
          amount: rewardAmount,
        })
        console.log('[REFERRAL_SCAN STEP6] Timeline reward_paid entry added');
      } catch (e: any) {
        console.error('[REFERRAL_SCAN STEP6] Timeline reward_paid failed', e?.message || e);
      }

      await referralEventBus.emit('reward.paid', {
        source: 'referralService',
        entityType: 'reward',
        entityId: reward.id,
        data: { amount: rewardAmount, invoiceId: invoice.id },
      })
    }

    if (activeCampaign) {
      console.log('[REFERRAL_SCAN STEP6] Incrementing campaign totalRewardsGiven');
      activeCampaign.totalRewardsGiven += 1
      try {
        await cloudDb.put('referralCampaigns', activeCampaign)
        console.log('[REFERRAL_SCAN STEP6] PUT_SUCCESS referralCampaigns');
      } catch (e: any) {
        console.error('[REFERRAL_SCAN STEP6] PUT_FAILED referralCampaigns', e?.message || e);
      }
    }

    console.log('[REFERRAL_SCAN STEP6] READ_BACK verification — fetching all referralRewards');
    try {
      const readBack = await cloudDb.getAll<any>('referralRewards');
      console.log('[REFERRAL_SCAN STEP6] READ_BACK_COUNT referralRewards:', readBack?.length || 0);
    } catch (e: any) {
      console.error('[REFERRAL_SCAN STEP6] READ_BACK failed', e?.message || e);
    }

    return reward
  },

  async expireReferral(referralId: string): Promise<Referral> {
    const all = (await cloudDb.getAll<Referral>('referrals')) || []
    const referral = all.find(r => r.id === referralId)
    if (!referral) throw new Error('Referral not found')
    if (referral.status !== 'active') throw new Error('Referral is not active')

    referral.status = 'expired'
    referral.updatedAt = new Date().toISOString()
    await cloudDb.put('referrals', referral)

    await referralTimelineService.addEntry({
      referralId: referral.id,
      eventType: 'referral_expired',
      title: 'Referral expired',
      description: 'Referral link has expired',
    })

    await referralEventBus.emit('referral.expired', {
      source: 'referralService',
      entityType: 'referral',
      entityId: referral.id,
    })

    return referral
  },

  async cancelReferral(referralId: string, cancelledBy?: string, reason?: string): Promise<Referral> {
    const all = (await cloudDb.getAll<Referral>('referrals')) || []
    const referral = all.find(r => r.id === referralId)
    if (!referral) throw new Error('Referral not found')
    if (referral.status !== 'active') throw new Error('Referral is not active')

    referral.status = 'cancelled'
    referral.updatedAt = new Date().toISOString()
    await cloudDb.put('referrals', referral)

    await referralTimelineService.addEntry({
      referralId: referral.id,
      eventType: 'referral_cancelled',
      title: 'Referral cancelled',
      description: reason || 'Referral was cancelled',
      actorId: cancelledBy,
    })

    await referralAuditService.log({
      entityType: 'referral',
      entityId: referral.id,
      action: 'cancelled',
      actorId: cancelledBy || 'system',
      fieldName: 'status',
      oldValue: 'active',
      newValue: 'cancelled',
      reason,
    })

    await referralEventBus.emit('referral.cancelled', {
      source: 'referralService',
      entityType: 'referral',
      entityId: referral.id,
      data: { reason },
      actorId: cancelledBy,
    })

    return referral
  },

  async checkAndExpireReferrals(): Promise<number> {
    const all = (await cloudDb.getAll<Referral>('referrals')) || []
    const active = all.filter(r => r.status === 'active')
    let expiredCount = 0

    for (const referral of active) {
      const expired = await referralRuleEngine.evaluateExpiry(referral.date)
      if (expired.expired) {
        await this.expireReferral(referral.id)
        expiredCount++
      }
    }

    return expiredCount
  },
}

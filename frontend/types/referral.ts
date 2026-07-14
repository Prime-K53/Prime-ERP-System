export interface Referral {
  id: string;
  referrerId: string;
  referredCustomerId: string;
  referralCode: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  updatedAt: string;
  company_id?: string;
}

export interface ReferralCommission {
  id: string;
  referralId: string;
  referrerId: string;
  referredCustomerId: string;
  invoiceId: string;
  invoiceAmount: number;
  commissionRate: number;
  commissionAmount: number;
  commissionType: 'Percentage' | 'Fixed' | 'Mixed';
  status: 'Pending' | 'Approved' | 'Paid' | 'Reversed';
  paymentStatus: 'Unpaid' | 'Paid';
  approvedAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  notes?: string;
  company_id?: string;
}

export interface ReferralWallet {
  id: string;
  customerId: string;
  currentBalance: number;
  pendingCommission: number;
  approvedCommission: number;
  withdrawnAmount: number;
  lifetimeEarnings: number;
  updatedAt: string;
  company_id?: string;
}

export interface ReferralTransaction {
  id: string;
  walletId: string;
  customerId: string;
  type: 'Commission' | 'Withdrawal' | 'Adjustment' | 'Reversal';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string;
  referenceType?: string;
  description: string;
  status: 'Pending' | 'Completed' | 'Reversed';
  createdAt: string;
  createdBy?: string;
  company_id?: string;
}

export interface ReferralSettings {
  enableReferralSystem: boolean;
  enableWallet: boolean;
  enableReferralCode: boolean;
  defaultCommissionPercent: number;
  defaultCommissionFixed: number;
  approvalRequired: boolean;
  autoCreditWallet: boolean;
  minimumWithdrawal: number;
  commissionExpiryDays: number;
  maximumReferralDepth: number;
  allowSelfReferral: boolean;
  allowEmployeeReferral: boolean;
  allowDuplicatePhone: boolean;
  minInvoiceAmount: number;
  maxCommission: number;
  commissionValidityDays: number;
  productSpecificCommission: number;
  serviceSpecificCommission: number;
}

export interface ReferralLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  actorName?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  createdAt: string;
  company_id?: string;
}

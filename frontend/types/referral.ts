export interface Referral {
  id: string;
  referrerId: string;
  referredCustomerId: string;
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

export interface ReferralTransaction {
  id: string;
  referralId: string;
  customerId: string;
  type: 'Commission' | 'Reversal' | 'Adjustment';
  amount: number;
  description: string;
  invoiceId?: string;
  createdAt: string;
  company_id?: string;
}

export interface ReferralSettings {
  enableReferralSystem: boolean;
  defaultCommissionPercent: number;
  defaultCommissionFixed: number;
  approvalRequired: boolean;
  autoCreditWallet: boolean;
  minInvoiceAmount: number;
  maxCommission: number;
  commissionValidityDays: number;
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

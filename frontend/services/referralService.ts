import { Referral, ReferralReward, ReferralSettings, DEFAULT_REFERRAL_SETTINGS } from '../types/referral'
import { referralApiClient } from './referralApiClient'

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
    const result = await referralApiClient.register({
      customer_id: customerId,
      referred_by_id: referredById,
      referred_by_name: referredByName,
    })
    return result as Referral
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

    const result = await referralApiClient.register({
      customer_id: invoice.customerId,
      referred_by_id: invoice.referredById,
      referred_by_name: invoice.referredByName,
      pending_invoice_id: invoice.id,
      pending_invoice_amount: invoice.totalAmount,
    } as any)
    return result as Referral
  },

  async getReferralsByCustomer(customerId: string): Promise<Referral[]> {
    const result = await referralApiClient.getAll({ customer_id: customerId })
    return (result.referrals || []) as Referral[]
  },

  async getReferralsByReferrer(referredById: string): Promise<Referral[]> {
    const result = await referralApiClient.getAll({ referred_by_id: referredById })
    return (result.referrals || []) as Referral[]
  },

  async getReferralByCode(code: string): Promise<Referral | undefined> {
    const result = await referralApiClient.getAll({ referral_code: code, status: 'active' })
    return (result.referrals || [])[0]
  },

  async getAllReferrals(params?: { status?: string; search?: string; page?: number; limit?: number }): Promise<Referral[]> {
    const result = await referralApiClient.getAll(params)
    return (result.referrals || []) as Referral[]
  },

  async getPendingRewards(): Promise<ReferralReward[]> {
    const result = await referralApiClient.getPendingRewards()
    return (result || []) as ReferralReward[]
  },

  async getRewardsByCustomer(customerId: string): Promise<ReferralReward[]> {
    const result = await referralApiClient.getRewards()
    return (result.rewards || []).filter((r: any) => r.customerId === customerId) as ReferralReward[]
  },

  async getRewardsByReferral(referralId: string): Promise<ReferralReward[]> {
    const result = await referralApiClient.getRewards({ referral_id: referralId })
    return (result.rewards || []) as ReferralReward[]
  },

  async approveReward(rewardId: string, approvedBy: string): Promise<ReferralReward> {
    const result = await referralApiClient.approveReward(rewardId, approvedBy)
    return result as ReferralReward
  },

  async rejectReward(rewardId: string, reason: string, rejectedBy?: string): Promise<ReferralReward> {
    const result = await referralApiClient.rejectReward(rewardId, reason, rejectedBy)
    return result as ReferralReward
  },

  async getAllRewards(): Promise<ReferralReward[]> {
    const result = await referralApiClient.getRewards()
    return (result.rewards || []) as ReferralReward[]
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
    if (!invoice.referredBy) return null
    if (invoice.customerId === invoice.referredBy) return null

    const settings = getReferralSettings()
    if (!settings.enabled) return null

    const allReferrals = await this.getAllReferrals()
    let referral = allReferrals.find(
      r => r.customerId === invoice.customerId && r.referredById === invoice.referredBy && r.status === 'active'
    )

    if (!referral) {
      referral = await this.registerReferral(invoice.customerId, invoice.referredBy, invoice.referredByName)
    }

    const result = await referralApiClient.createReward({
      referral_id: referral.id,
      invoice_id: invoice.id,
      invoice_amount: invoice.totalAmount,
      customer_id: invoice.referredBy,
    })
    return result as ReferralReward
  },

  async expireReferral(referralId: string): Promise<Referral> {
    const result = await referralApiClient.expire(referralId)
    return result as Referral
  },

  async cancelReferral(referralId: string, cancelledBy?: string, reason?: string): Promise<Referral> {
    const result = await referralApiClient.cancel(referralId, reason)
    return result as Referral
  },

  async checkAndExpireReferrals(): Promise<number> {
    const all = await this.getAllReferrals()
    const active = all.filter(r => r.status === 'active')
    const settings = getReferralSettings()
    const now = new Date()
    let expiredCount = 0
    for (const referral of active) {
      const created = new Date(referral.date)
      const daysSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceCreation >= settings.expiryDays) {
        try {
          await this.expireReferral(referral.id)
          expiredCount++
        } catch (err) {
          console.error(`[Referrals] Failed to expire referral ${referral.id}:`, err)
        }
      }
    }
    return expiredCount
  },

  // Analytics
  async getAnalytics(params?: { period?: string; period_start?: string; period_end?: string }): Promise<any> {
    return referralApiClient.getAnalytics(params);
  },

  async getAnalyticsHistory(params?: { period?: string; period_start?: string; period_end?: string }): Promise<any[]> {
    return referralApiClient.getAnalyticsHistory(params);
  },

  // Campaigns
  async getAllCampaigns(params?: { status?: string }): Promise<any[]> {
    return referralApiClient.getCampaigns(params);
  },

  async createCampaign(data: any): Promise<any> {
    return referralApiClient.createCampaign(data);
  },

  async updateCampaign(id: string, data: any): Promise<any> {
    return referralApiClient.updateCampaign(id, data);
  },

  async updateCampaignStatus(id: string, status: string): Promise<any> {
    return referralApiClient.updateCampaignStatus(id, status);
  },

  // Reversals
  async getAllReversals(params?: { page?: number; limit?: number; status?: string }): Promise<any> {
    return referralApiClient.getReversals(params);
  },

  async createReversal(data: { reward_id: string; reason: string; notes?: string }): Promise<any> {
    return referralApiClient.createReversal(data);
  },

  async approveReversal(id: string, approvedBy: string, notes?: string): Promise<any> {
    return referralApiClient.approveReversal(id, approvedBy, notes);
  },

  async rejectReversal(id: string, reason: string, rejectedBy?: string, notes?: string): Promise<any> {
    return referralApiClient.rejectReversal(id, reason, rejectedBy, notes);
  },

  // Settings
  async getSettings(): Promise<any> {
    return referralApiClient.getSettings();
  },

  async updateSettings(settings: any): Promise<any> {
    return referralApiClient.updateSettings(settings);
  },

  // Audit Logs
  async getAuditLogs(params?: { page?: number; limit?: number; entity_type?: string; entity_id?: string }): Promise<any> {
    return referralApiClient.getAuditLogs(params);
  },
}

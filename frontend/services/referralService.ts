import { cloudDb } from './cloudDb'
import { Referral, ReferralReward, ReferralSettings, DEFAULT_REFERRAL_SETTINGS } from '../types/referral'
import { generateId } from './transactions/_internal'
import { logger } from './logger'
import { referralRuleEngine } from './referralRuleEngine'
import { referralEventBus } from './referralEventBus'
import { referralTimelineService } from './referralTimelineService'
import { referralAuditService } from './referralAuditService'
import { referralCampaignService } from './referralCampaignService'
import { stringToUuid5 } from '../utils/uuid'

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
    console.log('[REFERRAL] registerReferralFromInvoice called with:', { id: invoice.id, customerId: invoice.customerId, referredById: invoice.referredById, totalAmount: invoice.totalAmount });
    if (!invoice.referredById) { console.log('[REFERRAL] referredById is empty — skipping'); return null }
    if (invoice.customerId === invoice.referredById) return null

    const settings = getReferralSettings()
    if (!settings.enabled) { console.log('[REFERRAL] settings.enabled is false — skipping'); return null }

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
    const idempotencyKeyOpId = `referral-reward-credit:${reward.id}`
    const alreadyCredited = await cloudDb.checkIdempotency(idempotencyKeyOpId)
    if (alreadyCredited.alreadyProcessed) {
      return { walletTransactionId: alreadyCredited.result || '' }
    }

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

    try {
      await Promise.all([
        cloudDb.put('walletTransactions', walletTx),
        cloudDb.put('customers', referrer),
        cloudDb.put('ledger', ledgerEntry),
        cloudDb.recordIdempotency(idempotencyKeyOpId, reward.id),
      ])
    } catch {
      // best-effort
    }

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
    if (!invoice.referredBy) return null
    if (invoice.customerId === invoice.referredBy) return null

    const settings = getReferralSettings()
    if (!settings.enabled) return null

    const idempotencyKeyId = `referral-reward:${invoice.id}`
    const uuidKeyId = await stringToUuid5(idempotencyKeyId)
    const allKeys = (await cloudDb.getAll<any>('idempotencyKeys')) || []
    if (allKeys.find((k: any) => k.id === uuidKeyId)) return null

    const allReferrals = (await cloudDb.getAll<Referral>('referrals')) || []

    const eligibility = await referralRuleEngine.evaluateEligibility({
      customerId: invoice.customerId,
      referredById: invoice.referredBy,
      paidAmount: invoice.paidAmount,
      existingReferrals: allReferrals as Array<{ customerId: string; referredById: string; status: string }>,
    })
    if (!eligibility.allowed) return null

    const activeCampaign = await referralCampaignService.getApplicableCampaign(
      invoice.customerId,
      invoice.paidAmount
    )

    const rewardCalc = await referralRuleEngine.calculateReward({
      paidAmount: invoice.paidAmount,
      campaign: activeCampaign,
    })
    if (!rewardCalc.allowed || !rewardCalc.rewardAmount) return null

    const rewardAmount = rewardCalc.rewardAmount

    let referral = allReferrals.find(
      r => r.customerId === invoice.customerId && r.referredById === invoice.referredBy && r.status === 'active'
    )
    if (!referral) {
      referral = await this.registerReferral(invoice.customerId, invoice.referredBy, invoice.referredByName)
    }

    const needsApproval = (await referralRuleEngine.evaluateApprovalRequirement({
      rewardAmount,
      campaign: activeCampaign,
    })).needsApproval

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

    await cloudDb.put('referralRewards', reward)
    await cloudDb.recordIdempotency(idempotencyKeyId, reward.id)

    await referralTimelineService.addEntry({
      referralId: referral.id,
      eventType: 'reward_earned',
      title: needsApproval ? 'Reward earned (pending approval)' : 'Reward earned',
      description: `Reward of ${rewardAmount} earned from invoice #${invoice.id}`,
      amount: rewardAmount,
      metadata: { invoiceId: invoice.id, campaignId: activeCampaign?.id, needsApproval },
    })

    await referralAuditService.log({
      entityType: 'reward',
      entityId: reward.id,
      action: 'created',
      actorId: 'system',
      newValue: reward,
      correlationId: `invoice-${invoice.id}`,
    })

    await referralEventBus.emit('reward.earned', {
      source: 'referralService',
      entityType: 'reward',
      entityId: reward.id,
      data: { amount: rewardAmount, invoiceId: invoice.id, needsApproval, campaignId: activeCampaign?.id },
      correlationId: `invoice-${invoice.id}`,
    })

    if (!needsApproval) {
      referral.status = 'converted'
      referral.convertedAt = new Date().toISOString()
      referral.convertedInvoiceId = invoice.id
      referral.pendingInvoiceId = undefined
      referral.pendingInvoiceAmount = undefined
      await cloudDb.put('referrals', referral)

      await this.creditWalletForReward(reward)
      reward.status = 'paid'
      reward.approvedAt = new Date().toISOString()
      reward.updatedAt = new Date().toISOString()
      await cloudDb.put('referralRewards', reward)

      await referralTimelineService.addEntry({
        referralId: referral.id,
        eventType: 'reward_paid',
        title: 'Reward paid',
        description: `Reward of ${rewardAmount} credited to wallet`,
        amount: rewardAmount,
      })

      await referralEventBus.emit('reward.paid', {
        source: 'referralService',
        entityType: 'reward',
        entityId: reward.id,
        data: { amount: rewardAmount, invoiceId: invoice.id },
      })
    }

    if (activeCampaign) {
      activeCampaign.totalRewardsGiven += 1
      await cloudDb.put('referralCampaigns', activeCampaign)
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

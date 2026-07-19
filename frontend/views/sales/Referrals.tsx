import React, { useMemo, useState, useEffect, useRef } from 'react'
import { Search, Award, TrendingUp, DollarSign, Clock, CheckCircle, XCircle, BarChart3, Percent, Users, RotateCw, AlertTriangle, Mail, Eye, MessageSquare, X, Gem, Trophy, Medal } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { currencyService } from '../../services/currencyService'
import { referralService } from '../../services/referralService'
import { whatsappClient } from '../../services/whatsappClientService'
import type { Referral, ReferralReward } from '../../types/referral'
import { cloudDb } from '../../services/cloudDb'

import type { ReferralAnalytics, ReferralCampaign, ReversalRequest } from '../../types/referral-extended'
const Referrals: React.FC = () => {
  const { companyConfig, user, notify } = useAuth()
  const currency = companyConfig?.currencySymbol || currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || '$'

  const [referrals, setReferrals] = useState<Referral[]>([])
  const [rewards, setRewards] = useState<ReferralReward[]>([])
  const [allRewards, setAllRewards] = useState<ReferralReward[]>([])
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeView, setActiveView] = useState<'referrals' | 'approvals' | 'analytics' | 'campaigns' | 'reversals'>('referrals')
  const [isLoading, setIsLoading] = useState(true)
  const [analytics, setAnalytics] = useState<ReferralAnalytics | null>(null)
  const [analyticsHistory, setAnalyticsHistory] = useState<ReferralAnalytics[]>([])
  const [campaigns, setCampaigns] = useState<ReferralCampaign[]>([])
  const [reversals, setReversals] = useState<ReversalRequest[]>([])
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const [detailReferral, setDetailReferral] = useState<Referral | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCreateCampaign, setShowCreateCampaign] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState<string>('All')
  const [newCampaign, setNewCampaign] = useState({
    name: '', description: '', startDate: '', endDate: '',
    rewardType: 'percentage' as 'fixed' | 'percentage' | 'hybrid',
    rewardValue: 0, rewardPercentage: 5, minPurchaseAmount: 0,
    maxRewardAmount: 0, maxRewardsPerCustomer: 0, maxTotalRewards: 0,
    bonusMultiplier: 1,
  })

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [allCustomers, allReferrals] = await Promise.all([
        cloudDb.getAll<any>('customers').then(c => c || []),
        referralService.getAllReferrals().catch(() => [] as Referral[]),
      ])
      setCustomers(allCustomers)
      setReferrals(allReferrals)
      setIsLoading(false)
      Promise.all([
        referralService.getPendingRewards().catch(() => [] as ReferralReward[]),
        referralService.getAllRewards().catch(() => []),
        referralService.getAllCampaigns().catch(() => []),
        referralService.getAnalytics({ period: 'monthly' }).catch(() => null),
        referralService.getAnalyticsHistory({ period: 'monthly' }).catch(() => []),
        referralService.getAllReversals().catch(() => []),
      ]).then(([pendingRewards, allRewards, allCampaigns, latestAnalytics, analyticsHist, allReversals]) => {
        setRewards(pendingRewards)
        setAllRewards(allRewards)
        setCampaigns(allCampaigns)
        setAnalytics(latestAnalytics)
        setAnalyticsHistory(analyticsHist)
        setReversals(allReversals)
      }).catch(() => {})
    } catch (err: any) {
      const msg = err?.message || 'Failed to load referral data'
      console.error('Failed to load referral data:', err)
      setLoadError(msg)
      notify?.(msg, 'error')
      setIsLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const stats = useMemo(() => ({
    total: referrals.length,
    active: referrals.filter(r => r.status === 'active' && !r.pendingInvoiceId).length,
    pendingInvoices: referrals.filter(r => r.status === 'active' && r.pendingInvoiceId).length,
    pendingInvoiceTotal: referrals.filter(r => r.status === 'active' && r.pendingInvoiceId).reduce((s, r) => s + (r.pendingInvoiceAmount || 0), 0),
    converted: referrals.filter(r => r.status === 'converted').length,
    pendingRewards: rewards.filter(r => r.status === 'pending').length,
    totalPaid: rewards.filter(r => r.status === 'paid' || r.status === 'approved').reduce((s, r) => s + r.amount, 0),
  }), [referrals, rewards])

  const filteredReferrals = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return referrals
    return referrals.filter(r =>
      r.referredByName?.toLowerCase().includes(q) ||
      r.referralCode?.toLowerCase().includes(q) ||
      r.customerId?.toLowerCase().includes(q)
    )
  }, [referrals, searchTerm])

  const handleApprove = async (rewardId: string) => {
    try {
      await referralService.approveReward(rewardId, user?.name || user?.id || 'system')
      notify('Reward approved and wallet credited', 'success')
      loadData()
    } catch (err: any) {
      notify(err.message || 'Failed to approve reward', 'error')
    }
  }

  const handleReject = async (rewardId: string) => {
    const reason = prompt('Reason for rejection:')
    if (!reason) return
    try {
      await referralService.rejectReward(rewardId, reason, user?.name || user?.id)
      notify('Reward rejected', 'info')
      loadData()
    } catch (err: any) {
      notify(err.message || 'Failed to reject reward', 'error')
    }
  }

  const handleGenerateAnalytics = async (period: ReferralAnalytics['period']) => {
    const now = new Date()
    let start: Date
    if (period === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (period === 'weekly') {
      start = new Date(now)
      start.setDate(start.getDate() - start.getDay())
    } else {
      start = new Date(now.getFullYear(), 0, 1)
    }
    try {
      const result = await referralService.getAnalytics({ period, period_start: start.toISOString(), period_end: now.toISOString() })
      setAnalytics(result)
      notify('Analytics generated', 'success')
      loadData()
    } catch (err: any) {
      notify(err.message || 'Failed to generate analytics', 'error')
    }
  }

  const handleCreateCampaign = async () => {
    if (!newCampaign.name || !newCampaign.startDate) {
      notify('Name and start date are required', 'error')
      return
    }
    try {
      await referralService.createCampaign({
        ...newCampaign,
        created_by: user?.name || user?.id,
      })
      notify('Campaign created', 'success')
      setShowCreateCampaign(false)
      setNewCampaign({ name: '', description: '', startDate: '', endDate: '', rewardType: 'percentage', rewardValue: 0, rewardPercentage: 5, minPurchaseAmount: 0, maxRewardAmount: 0, maxRewardsPerCustomer: 0, maxTotalRewards: 0, bonusMultiplier: 1 })
      loadData()
    } catch (err: any) {
      notify(err.message || 'Failed to create campaign', 'error')
    }
  }

  const handleApproveReversal = async (reversalId: string) => {
    if (!confirm('Approve this reversal? The reward amount will be deducted from the referrer\'s wallet.')) return
    try {
      await referralService.approveReversal(reversalId, user?.name || user?.id || 'system')
      notify('Reversal processed', 'success')
      loadData()
    } catch (err: any) {
      notify(err.message || 'Failed to process reversal', 'error')
    }
  }

  const handleRequestReversal = async () => {
    if (!selectedReferral) return
    const reason = prompt('Reason for reversal:')
    if (!reason) return
    try {
      const reward = allRewards.find(r => r.referralId === selectedReferral.id)
      if (!reward) { notify('No reward found for this referral', 'error'); return }
      await referralService.createReversal({
        reward_id: reward.id,
        reason,
      })
      notify('Reversal request submitted', 'success')
      setSelectedReferral(null)
      loadData()
    } catch (err: any) {
      notify(err.message || 'Failed to request reversal', 'error')
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  const handleViewDetails = () => {
    if (!selectedReferral) return
    setDetailReferral(selectedReferral)
    setShowMenu(false)
  }

  const handleSendViaWhatsApp = async () => {
    if (!selectedReferral) return
    const referrer = customers.find(c => c.id === selectedReferral.referredById)
    const phone = referrer?.phone
    if (!phone) { notify('Referrer has no phone number on file', 'error'); setShowMenu(false); return }
    const reward = allRewards.find(r => r.referralId === selectedReferral.id)
    const amount = reward?.amount || selectedReferral.pendingInvoiceAmount || 0
    const msg = `The customer you referred to us has made an order. Based on the order you will have a reward of ${currency}${amount.toLocaleString()} into your account when this invoice is paid.`

    try {
      const account = await whatsappClient.getAccount(user?.id || '')
      if (!account?.phoneNumberId || !account?.accessToken) {
        notify('WhatsApp not configured. Message: ' + msg, 'info')
        setShowMenu(false)
        return
      }
      await whatsappClient.sendMessage(account.phoneNumberId, account.accessToken, phone, msg)
      notify('WhatsApp message sent', 'success')
    } catch (err: any) {
      notify(err.message || 'Failed to send WhatsApp message', 'error')
    }
    setShowMenu(false)
  }

  const handleSendViaEmail = async () => {
    if (!selectedReferral) return
    const referrer = customers.find(c => c.id === selectedReferral.referredById)
    const email = referrer?.email
    if (!email) { notify('Referrer has no email on file', 'error'); setShowMenu(false); return }
    const reward = allRewards.find(r => r.referralId === selectedReferral.id)
    const amount = reward?.amount || selectedReferral.pendingInvoiceAmount || 0
    const subject = encodeURIComponent('Referral Reward Notification')
    const body = encodeURIComponent(
      `Dear ${selectedReferral.referredByName || selectedReferral.referredById},\n\n` +
      `The customer you referred to us has made an order. Based on the order you will have a reward of ${currency}${amount.toLocaleString()} into your account when this invoice is paid.\n\n` +
      `Thank you for your support!\n${companyConfig?.companyName || 'Printing ERP'}`
    )
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank')
    setShowMenu(false)
  }

  const handleRejectReversal = async (reversalId: string) => {
    const reason = prompt('Reason for rejection:')
    if (!reason) return
    try {
      await referralService.rejectReversal(reversalId, reason, user?.name || user?.id || 'system')
      notify('Reversal rejected', 'info')
      loadData()
    } catch (err: any) {
      notify(err.message || 'Failed to reject reversal', 'error')
    }
  }

  const TabButton = ({ view, label, count }: { view: typeof activeView; label: string; count?: number }) => (
    <button
      onClick={() => setActiveView(view)}
      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeView === view ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[9px]">{count}</span>
      )}
    </button>
  )

  return (
    <div className="h-full flex flex-col bg-[#F4F5F8] overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shrink-0">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            <span>Sales Flow</span>
            <span className="text-slate-300">/</span>
            <span className="text-blue-600">Referrals</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Award className="text-amber-500" size={24} />
            Referral Management
          </h1>
        </div>
        <div className="flex gap-3">
          <TabButton view="referrals" label="Referrals" />
          <TabButton view="approvals" label="Approval Queue" count={stats.pendingRewards} />
          <TabButton view="analytics" label="Analytics" />
          <TabButton view="campaigns" label="Campaigns" count={campaigns.filter(c => c.status === 'active').length} />
          <TabButton view="reversals" label="Reversals" count={reversals.filter(r => r.status === 'pending').length} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-6xl mx-auto space-y-4 animate-in fade-in duration-300">
          {/* Error banner */}
          {loadError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-sm text-red-700">
              <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Referral data unavailable</p>
                <p className="text-red-600 mt-1">{loadError}</p>
                <p className="text-red-500 mt-1 text-xs">
                  Check that the Supabase tables exist (run <code className="bg-red-100 px-1 rounded">database/supabase-referral-tables.sql</code> in your Supabase SQL editor).
                </p>
              </div>
            </div>
          )}

          {/* Stats (Referrals tab only) */}
          {activeView === 'referrals' && <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <div
              onClick={() => setSelectedMetric(selectedMetric === 'total' ? 'All' : 'total')}
              className={`cursor-pointer transition-all duration-200 bg-white p-2 md:p-2.5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-2 border-l-4 border-l-blue-500 ${selectedMetric === 'total' ? 'ring-2 ring-blue-500 shadow-md scale-[1.01]' : 'hover:bg-slate-50'}`}
            >
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Award size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-0.5">Total Referrals</p>
                <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{stats.total.toLocaleString()}</p>
              </div>
            </div>
            <div
              onClick={() => setSelectedMetric(selectedMetric === 'active' ? 'All' : 'active')}
              className={`cursor-pointer transition-all duration-200 bg-white p-2 md:p-2.5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-2 border-l-4 border-l-blue-500 ${selectedMetric === 'active' ? 'ring-2 ring-blue-500 shadow-md scale-[1.01]' : 'hover:bg-slate-50'}`}
            >
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-0.5">Active</p>
                <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{stats.active.toLocaleString()}</p>
              </div>
            </div>
            <div
              onClick={() => setSelectedMetric(selectedMetric === 'pendingInvoices' ? 'All' : 'pendingInvoices')}
              className={`cursor-pointer transition-all duration-200 bg-white p-2 md:p-2.5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-2 border-l-4 border-l-amber-500 ${selectedMetric === 'pendingInvoices' ? 'ring-2 ring-amber-500 shadow-md scale-[1.01]' : 'hover:bg-slate-50'}`}
            >
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-0.5">Pending Invoices</p>
                <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{stats.pendingInvoices.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400 font-medium">{currency}{stats.pendingInvoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div
              onClick={() => setSelectedMetric(selectedMetric === 'converted' ? 'All' : 'converted')}
              className={`cursor-pointer transition-all duration-200 bg-white p-2 md:p-2.5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-2 border-l-4 border-l-emerald-500 ${selectedMetric === 'converted' ? 'ring-2 ring-emerald-500 shadow-md scale-[1.01]' : 'hover:bg-slate-50'}`}
            >
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <CheckCircle size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-0.5">Converted</p>
                <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{stats.converted.toLocaleString()}</p>
              </div>
            </div>
            <div
              onClick={() => setSelectedMetric(selectedMetric === 'pending' ? 'All' : 'pending')}
              className={`cursor-pointer transition-all duration-200 bg-white p-2 md:p-2.5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-2 border-l-4 border-l-amber-500 ${selectedMetric === 'pending' ? 'ring-2 ring-amber-500 shadow-md scale-[1.01]' : 'hover:bg-slate-50'}`}
            >
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-0.5">Pending Rewards</p>
                <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{stats.pendingRewards.toLocaleString()}</p>
              </div>
            </div>
            <div
              onClick={() => setSelectedMetric(selectedMetric === 'paid' ? 'All' : 'paid')}
              className={`cursor-pointer transition-all duration-200 bg-white p-2 md:p-2.5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-2 border-l-4 border-l-emerald-500 ${selectedMetric === 'paid' ? 'ring-2 ring-emerald-500 shadow-md scale-[1.01]' : 'hover:bg-slate-50'}`}
            >
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <DollarSign size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-0.5">Total Paid</p>
                <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{currency}{stats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : activeView === 'referrals' ? (
            <>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search referrals by customer name, code..."
                  className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Action Menu Popup */}
              {showMenu && selectedReferral && (
                <div ref={menuRef} className="bg-white border border-slate-200 rounded-xl shadow-xl p-2 fixed z-50 w-56" style={{ left: Math.min(menuPos.x, window.innerWidth - 240), top: Math.min(menuPos.y, window.innerHeight - 220) }}>
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 mb-1">
                    <span className="text-xs font-bold text-slate-500 truncate">{selectedReferral.customerId}</span>
                    <button onClick={() => { setShowMenu(false); setSelectedReferral(null) }} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                  </div>
                  <button onClick={handleViewDetails} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                    <Eye size={16} className="text-blue-500" /> View Details
                  </button>
                  <button onClick={handleSendViaWhatsApp} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                    <MessageSquare size={16} className="text-emerald-500" /> Send via WhatsApp
                  </button>
                  <button onClick={handleSendViaEmail} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                    <Mail size={16} className="text-amber-500" /> Send via Email
                  </button>
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button onClick={handleRequestReversal} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                      <RotateCw size={16} /> Request Reversal
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-900">All Referrals</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Referred Customer</th>
                          <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Referrer</th>
                          <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Invoice</th>
                          <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Amount</th>
                          <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Date</th>
                          <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredReferrals.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-3 py-10 text-center text-slate-400 italic">No referrals found.</td>
                          </tr>
                        ) : (
                          filteredReferrals.map((ref) => {
                            const rewardAmt = allRewards.filter(r => r.referralId === ref.id).reduce((s, r) => s + r.amount, 0)
                            const invoiceLabel = ref.pendingInvoiceId ? `#${ref.pendingInvoiceId.slice(-8)}` : ref.convertedInvoiceId ? `#${ref.convertedInvoiceId.slice(-8)}` : '-'
                            const amountLabel = ref.pendingInvoiceAmount ? `${currency}${ref.pendingInvoiceAmount.toLocaleString()}` : rewardAmt > 0 ? `${currency}${rewardAmt.toLocaleString()}` : '-'
                            const isSelected = selectedReferral?.id === ref.id
                            return (
                              <tr key={ref.id} onClick={e => { setSelectedReferral(ref); setMenuPos({ x: e.clientX, y: e.clientY }); setShowMenu(true) }} className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 ring-2 ring-blue-200' : 'hover:bg-slate-50/50'}`}>
                                <td className="px-3 py-2 font-bold text-slate-900">{customers.find(c => c.id === ref.customerId)?.name || ref.customerId}</td>
                                <td className="px-3 py-2 text-slate-500">{ref.referredByName || ref.referredById || '-'}</td>
                                <td className="px-3 py-2 text-slate-500 font-mono text-xs">{invoiceLabel}</td>
                                <td className="px-3 py-2 font-black text-emerald-600">{amountLabel}</td>
                                <td className="px-3 py-2 text-slate-500">{new Date(ref.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${ref.status === 'active' && ref.pendingInvoiceId ? 'bg-amber-50 text-amber-700 border-amber-100' : ref.status === 'active' ? 'bg-blue-50 text-blue-700 border-blue-100' : ref.status === 'converted' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                    {ref.status === 'active' && ref.pendingInvoiceId ? 'Pending' : ref.status}
                                  </span>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                </div>
              </div>
            </>
          ) : activeView === 'approvals' ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-900">Reward Approval Queue</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Date</th>
                      <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Customer</th>
                      <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Invoice</th>
                      <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Amount</th>
                      <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rewards.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">No pending rewards.</td></tr>
                    ) : (
                      rewards.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-3 py-2 text-slate-500">{new Date(r.date).toLocaleDateString()}</td>
                          <td className="px-3 py-2 font-bold text-slate-900">{customers.find(c => c.id === r.customerId)?.name || r.customerId}</td>
                          <td className="px-3 py-2 text-slate-500 font-mono text-xs">#{r.invoiceId.slice(-8)}</td>
                          <td className="px-3 py-2 font-black text-emerald-600">{currency}{r.amount.toLocaleString()}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleApprove(r.id)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Approve"><CheckCircle size={18} /></button>
                              <button onClick={() => handleReject(r.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors" title="Reject"><XCircle size={18} /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeView === 'analytics' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2"><BarChart3 size={18} className="text-blue-600" /> Referral Analytics</h3>
                <div className="flex gap-2">
                  <button onClick={() => handleGenerateAnalytics('weekly')} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50">Weekly</button>
                  <button onClick={() => handleGenerateAnalytics('monthly')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">Monthly</button>
                  <button onClick={() => handleGenerateAnalytics('yearly')} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50">Yearly</button>
                </div>
              </div>

              {analytics ? (
                <>
                  <div className="grid grid-cols-4 gap-4">
                    <div
                      onClick={() => setSelectedMetric(selectedMetric === 'Conversion Rate' ? 'All' : 'Conversion Rate')}
                      className={`cursor-pointer transition-all duration-200 bg-white p-2 md:p-2.5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-2 border-l-4 border-l-blue-500 ${selectedMetric === 'Conversion Rate' ? 'ring-2 ring-blue-500 shadow-md scale-[1.01]' : 'hover:bg-slate-50'}`}
                    >
                      <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                        <Percent size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Conversion Rate</p>
                        <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{analytics.conversionRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}%</p>
                      </div>
                    </div>
                    <div
                      onClick={() => setSelectedMetric(selectedMetric === 'Total Rewards' ? 'All' : 'Total Rewards')}
                      className={`cursor-pointer transition-all duration-200 bg-white p-2 md:p-2.5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-2 border-l-4 border-l-amber-500 ${selectedMetric === 'Total Rewards' ? 'ring-2 ring-amber-500 shadow-md scale-[1.01]' : 'hover:bg-slate-50'}`}
                    >
                      <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                        <Users size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Total Rewards</p>
                        <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{currency}{analytics.totalRewardsAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                    <div
                      onClick={() => setSelectedMetric(selectedMetric === 'Revenue Attributed' ? 'All' : 'Revenue Attributed')}
                      className={`cursor-pointer transition-all duration-200 bg-white p-2 md:p-2.5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-2 border-l-4 border-l-emerald-500 ${selectedMetric === 'Revenue Attributed' ? 'ring-2 ring-emerald-500 shadow-md scale-[1.01]' : 'hover:bg-slate-50'}`}
                    >
                      <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <DollarSign size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Revenue Attributed</p>
                        <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{currency}{analytics.revenueAttributed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                    <div
                      onClick={() => setSelectedMetric(selectedMetric === 'ROI' ? 'All' : 'ROI')}
                      className={`cursor-pointer transition-all duration-200 bg-white p-2 md:p-2.5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-2 border-l-4 border-l-emerald-500 ${selectedMetric === 'ROI' ? 'ring-2 ring-emerald-500 shadow-md scale-[1.01]' : 'hover:bg-slate-50'}`}
                    >
                      <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <BarChart3 size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">ROI</p>
                        <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{analytics.roi.toLocaleString(undefined, { minimumFractionDigits: 2 })}%</p>
                      </div>
                    </div>
                  </div>

                  {analytics.topReferrers && analytics.topReferrers.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2"><Users size={16} className="text-blue-500" /> Top Referrers</h3>
                      </div>
                      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                        {analytics.topReferrers.map((t, i) => {
                          const rank = i + 1
                          const tier = rank === 1 ? 'diamond' : rank === 2 ? 'gold' : rank === 3 ? 'silver' : rank === 4 ? 'bronze' : null
                          const cardStyle = tier === 'diamond'
                            ? 'bg-gradient-to-br from-[#1a0533] via-[#2d1b69] to-[#0d0a2e] text-white shadow-2xl shadow-purple-900/30 ring-1 ring-purple-400/20'
                            : tier === 'gold'
                            ? 'bg-gradient-to-br from-[#1a1200] via-[#3d2e00] to-[#1a0e00] text-white shadow-2xl shadow-amber-900/30 ring-1 ring-amber-400/20'
                            : tier === 'silver'
                            ? 'bg-gradient-to-br from-[#0f1114] via-[#1e2126] to-[#141619] text-white shadow-2xl shadow-slate-900/30 ring-1 ring-slate-400/20'
                            : tier === 'bronze'
                            ? 'bg-gradient-to-br from-[#1a0a00] via-[#3d1f08] to-[#1a0e00] text-white shadow-2xl shadow-orange-900/30 ring-1 ring-orange-400/20'
                            : 'bg-white border border-slate-200 text-slate-700 shadow-sm'
                          const glow = tier === 'diamond' ? 'shadow-[0_0_30px_-5px_rgba(168,85,247,0.4)]' :
                            tier === 'gold' ? 'shadow-[0_0_30px_-5px_rgba(251,191,36,0.4)]' :
                            tier === 'silver' ? 'shadow-[0_0_30px_-5px_rgba(148,163,184,0.3)]' :
                            tier === 'bronze' ? 'shadow-[0_0_30px_-5px_rgba(251,146,60,0.35)]' : ''
                          const label = tier === 'diamond' ? 'Diamond' : tier === 'gold' ? 'Gold' : tier === 'silver' ? 'Silver' : tier === 'bronze' ? 'Bronze' : ''
                          const labelColor = tier === 'diamond' ? 'text-purple-300' : tier === 'gold' ? 'text-amber-300' : tier === 'silver' ? 'text-slate-300' : tier === 'bronze' ? 'text-orange-300' : ''
                          const Icon = tier === 'diamond' ? Gem : tier === 'gold' ? Trophy : tier === 'silver' ? Medal : tier === 'bronze' ? Medal : Users
                          const iconBg = tier === 'diamond' ? 'bg-gradient-to-br from-purple-400/30 to-pink-400/30' :
                            tier === 'gold' ? 'bg-gradient-to-br from-amber-400/30 to-yellow-400/30' :
                            tier === 'silver' ? 'bg-gradient-to-br from-slate-400/30 to-slate-300/30' :
                            tier === 'bronze' ? 'bg-gradient-to-br from-orange-400/30 to-amber-400/30' :
                            'bg-blue-50'
                          return (
                            <div key={t.customerId || i} className={`${cardStyle} ${glow} rounded-2xl p-5 flex flex-col items-center text-center transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5 relative overflow-hidden`}>
                              <div className={`absolute inset-0 opacity-[0.04] ${tier ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-transparent to-transparent' : ''}`} />
                              {label && (
                                <span className={`absolute top-2.5 right-3 text-[9px] font-black uppercase tracking-[0.2em] ${labelColor} opacity-60`}>#{rank}</span>
                              )}
                              <div className={`p-2.5 rounded-2xl mb-3 ${iconBg} backdrop-blur-sm`}>
                                <Icon size={24} className={tier ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'text-blue-500'} />
                              </div>
                              <p className={`font-bold text-sm leading-tight tracking-tight ${tier ? 'text-white' : 'text-slate-900'}`}>{t.customerName || t.customerId}</p>
                              {label && <p className={`text-[9px] font-black uppercase tracking-[0.25em] mt-0.5 ${labelColor}`}>{label}</p>}
                              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/10 w-full justify-center">
                                <span className={`text-[11px] font-semibold ${tier ? 'text-white/70' : 'text-slate-500'}`}>{t.referralCount} referrals</span>
                                <span className={`w-px h-3 ${tier ? 'bg-white/10' : 'bg-slate-200'}`} />
                                <span className={`text-[11px] font-black ${tier ? 'text-white' : 'text-emerald-600'}`}>{currency}{(t.rewardsAmount || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {analyticsHistory.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-bold text-slate-900">Analytics History</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Period</th>
                              <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Referrals</th>
                              <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Converted</th>
                              <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Rate</th>
                              <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Rewards</th>
                              <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">ROI</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {analyticsHistory.map(a => (
                              <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-3 py-2 font-bold text-slate-900">{new Date(a.periodStart).toLocaleDateString()} - {new Date(a.periodEnd).toLocaleDateString()}</td>
                                <td className="px-3 py-2 text-slate-500">{a.totalReferrals}</td>
                                <td className="px-3 py-2 text-slate-500">{a.convertedReferrals}</td>
                                <td className="px-3 py-2 font-bold text-slate-900">{a.conversionRate}%</td>
                                <td className="px-3 py-2 font-black text-emerald-600">{currency}{a.totalRewardsAmount.toLocaleString()}</td>
                                <td className="px-3 py-2 font-bold text-slate-900">{a.roi}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                  <BarChart3 size={48} className="text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">No analytics data yet. Generate a report to see insights.</p>
                </div>
              )}
            </div>
          ) : activeView === 'campaigns' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2"><Award size={18} className="text-amber-500" /> Referral Campaigns</h3>
                <button onClick={() => setShowCreateCampaign(!showCreateCampaign)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">
                  {showCreateCampaign ? 'Cancel' : 'New Campaign'}
                </button>
              </div>

              {showCreateCampaign && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                  <h4 className="font-bold text-slate-900">New Campaign</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Name *</label>
                      <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={newCampaign.name} onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reward Type</label>
                      <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={newCampaign.rewardType} onChange={e => setNewCampaign({ ...newCampaign, rewardType: e.target.value as any })}>
                        <option value="fixed">Fixed</option>
                        <option value="percentage">Percentage</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Start Date *</label>
                      <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={newCampaign.startDate} onChange={e => setNewCampaign({ ...newCampaign, startDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">End Date</label>
                      <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={newCampaign.endDate} onChange={e => setNewCampaign({ ...newCampaign, endDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reward Value</label>
                      <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={newCampaign.rewardValue} onChange={e => setNewCampaign({ ...newCampaign, rewardValue: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reward %</label>
                      <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={newCampaign.rewardPercentage} onChange={e => setNewCampaign({ ...newCampaign, rewardPercentage: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bonus Multiplier</label>
                      <input type="number" step="0.1" min="1" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={newCampaign.bonusMultiplier} onChange={e => setNewCampaign({ ...newCampaign, bonusMultiplier: parseFloat(e.target.value) || 1 })} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Min Purchase</label>
                      <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={newCampaign.minPurchaseAmount} onChange={e => setNewCampaign({ ...newCampaign, minPurchaseAmount: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Description</label>
                    <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" rows={2} value={newCampaign.description} onChange={e => setNewCampaign({ ...newCampaign, description: e.target.value })} />
                  </div>
                  <button onClick={handleCreateCampaign} className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">Create Campaign</button>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Name</th>
                        <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Status</th>
                        <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Dates</th>
                        <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Reward</th>
                        <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Given / Max</th>
                        <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {campaigns.length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic">No campaigns created yet.</td></tr>
                      ) : (
                        campaigns.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2 font-bold text-slate-900">{c.name}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${c.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : c.status === 'draft' ? 'bg-slate-50 text-slate-500 border-slate-100' : c.status === 'paused' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{c.status}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-500 text-xs">{new Date(c.startDate).toLocaleDateString()}{c.endDate ? ` - ${new Date(c.endDate).toLocaleDateString()}` : ''}</td>
                            <td className="px-3 py-2 font-bold text-slate-900">{c.rewardType === 'fixed' ? currency + c.rewardValue : c.rewardType === 'percentage' ? `${c.rewardPercentage}%` : `${currency + c.rewardValue} + ${c.rewardPercentage}%`}{c.bonusMultiplier && c.bonusMultiplier > 1 ? ` x${c.bonusMultiplier}` : ''}</td>
                            <td className="px-3 py-2 text-slate-500">{c.totalRewardsGiven} / {c.maxTotalRewards || '∞'}</td>
                            <td className="px-6 py-4">
                              <div className="flex gap-1">
                                {c.status === 'draft' && <button onClick={async () => { await referralService.updateCampaignStatus(c.id, 'active'); loadData(); notify('Campaign activated', 'success'); }} className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold hover:bg-emerald-100">Activate</button>}
                                {c.status === 'active' && <button onClick={async () => { await referralService.updateCampaignStatus(c.id, 'paused'); loadData(); }} className="px-2 py-1 bg-amber-50 text-amber-600 rounded text-[10px] font-bold hover:bg-amber-100">Pause</button>}
                                {c.status === 'paused' && <button onClick={async () => { await referralService.updateCampaignStatus(c.id, 'active'); loadData(); }} className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold hover:bg-emerald-100">Resume</button>}
                                {(c.status === 'active' || c.status === 'paused') && <button onClick={async () => { await referralService.updateCampaignStatus(c.id, 'completed'); loadData(); }} className="px-2 py-1 bg-rose-50 text-rose-600 rounded text-[10px] font-bold hover:bg-rose-100">End</button>}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><RotateCw size={18} className="text-rose-500" /> Reward Reversals</h3>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Date</th>
                        <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Reason</th>
                        <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Requested By</th>
                        <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Status</th>
                        <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {reversals.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">No reversals recorded.</td></tr>
                      ) : (
                        reversals.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2 text-slate-500">{new Date(r.requestedAt).toLocaleDateString()}</td>
                            <td className="px-3 py-2 text-slate-900 font-medium">{r.reason}</td>
                            <td className="px-3 py-2 text-slate-500">{r.requestedBy}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${r.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-100' : r.status === 'completed' ? 'bg-rose-50 text-rose-700 border-rose-100' : r.status === 'rejected' ? 'bg-slate-50 text-slate-500 border-slate-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{r.status}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {r.status === 'pending' && (
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => handleApproveReversal(r.id)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Approve"><CheckCircle size={18} /></button>
                                  <button onClick={() => handleRejectReversal(r.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors" title="Reject"><XCircle size={18} /></button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Detail Modal */}
          {detailReferral && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setDetailReferral(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-slate-900">Referral Details</h3>
                  <button onClick={() => setDetailReferral(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} /></button>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Referred Customer</span>
                    <span className="font-bold text-slate-900">{detailReferral.customerId}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Referrer</span>
                    <span className="font-bold text-slate-900">{detailReferral.referredByName || detailReferral.referredById || '-'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Referral Code</span>
                    <span className="font-mono text-xs text-slate-900">{detailReferral.referralCode || '-'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Status</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${detailReferral.status === 'active' && detailReferral.pendingInvoiceId ? 'bg-amber-50 text-amber-700 border-amber-100' : detailReferral.status === 'active' ? 'bg-blue-50 text-blue-700 border-blue-100' : detailReferral.status === 'converted' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                      {detailReferral.status === 'active' && detailReferral.pendingInvoiceId ? 'Pending' : detailReferral.status}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Invoice</span>
                    <span className="font-mono text-xs text-slate-900">#{detailReferral.pendingInvoiceId?.slice(-8) || detailReferral.convertedInvoiceId?.slice(-8) || '-'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Amount</span>
                    <span className="font-bold text-emerald-600">{detailReferral.pendingInvoiceAmount ? currency + detailReferral.pendingInvoiceAmount.toLocaleString() : currency + allRewards.filter(r => r.referralId === detailReferral.id).reduce((s, r) => s + r.amount, 0).toLocaleString() || '-'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Date</span>
                    <span className="text-slate-900">{new Date(detailReferral.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500 font-medium">Reward Amount</span>
                    <span className="font-bold text-emerald-600">{currency}{allRewards.filter(r => r.referralId === detailReferral.id).reduce((s, r) => s + r.amount, 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button onClick={() => setDetailReferral(null)} className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Referrals

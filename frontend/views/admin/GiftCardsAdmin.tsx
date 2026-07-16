import React, { useState, useEffect } from 'react'
import { dbService } from '../../services/db'
import { GiftCard } from '../../types/engagement'
import { Plus, Search, RotateCcw, X } from 'lucide-react'

export const GiftCardsAdmin: React.FC = () => {
  const [cards, setCards] = useState<GiftCard[]>([])
  const [search, setSearch] = useState('')
  const [showIssue, setShowIssue] = useState(false)
  const [issueForm, setIssueForm] = useState({
    code: '', customerId: '', initialBalance: 50, type: 'digital' as const,
    expiresAt: '', rechargeable: true, transferable: false, giftMessage: '',
    designColor: '#10b981',
  })
  const [redeemCode, setRedeemCode] = useState('')

  useEffect(() => { loadCards() }, [])

  const loadCards = async () => {
    const data = await dbService.getAll<GiftCard>('engagementGiftCards')
    setCards(data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')))
  }

  const filteredCards = cards.filter(c =>
    !search || c.code.toLowerCase().includes(search.toLowerCase()) ||
    (c.customerId || '').toLowerCase().includes(search.toLowerCase())
  )

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) code += '-'
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }

  const handleIssue = async () => {
    if (!issueForm.code) return
    await dbService.put('engagementGiftCards', {
      id: `GC_${Date.now()}`,
      code: issueForm.code,
      customerId: issueForm.customerId || null,
      initialBalance: issueForm.initialBalance,
      currentBalance: issueForm.initialBalance,
      status: 'active',
      type: issueForm.type,
      expiresAt: issueForm.expiresAt || null,
      rechargeable: issueForm.rechargeable,
      transferable: issueForm.transferable,
      giftMessage: issueForm.giftMessage || null,
      designColor: issueForm.designColor,
      createdAt: new Date().toISOString(),
    } as GiftCard)
    setShowIssue(false)
    setIssueForm({ code: '', customerId: '', initialBalance: 50, type: 'digital', expiresAt: '', rechargeable: true, transferable: false, giftMessage: '', designColor: '#10b981' })
    await loadCards()
  }

  const handleRedeem = async () => {
    const card = cards.find(c => c.code === redeemCode && c.status === 'active')
    if (!card) { alert('Gift card not found or not active'); return }
    await dbService.put('engagementGiftCards', { ...card, currentBalance: 0, status: 'redeemed' } as GiftCard)
    setRedeemCode('')
    await loadCards()
  }

  const cancelCard = async (id: string) => {
    const card = cards.find(c => c.id === id)
    if (!card) return
    await dbService.put('engagementGiftCards', { ...card, status: 'cancelled' } as GiftCard)
    await loadCards()
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = { active: 'bg-green-100 text-green-700', inactive: 'bg-slate-100 text-slate-600', expired: 'bg-red-100 text-red-600', cancelled: 'bg-red-100 text-red-600', redeemed: 'bg-blue-100 text-blue-700' }
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Gift Cards</h2>
          <p className="text-sm text-slate-500">Issue, manage, and redeem gift cards</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cards..." className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg w-48" />
          </div>
          <button onClick={() => setShowIssue(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus size={14} /> Issue Card
          </button>
          <button onClick={loadCards} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Quick redeem */}
      <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3">
        <span className="text-xs font-bold text-amber-700">Redeem Card:</span>
        <input type="text" value={redeemCode} onChange={e => setRedeemCode(e.target.value.toUpperCase())} placeholder="Enter gift card code..." className="flex-1 text-sm border border-amber-300 rounded-lg px-2.5 py-1.5 font-mono" />
        <button onClick={handleRedeem} disabled={!redeemCode} className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">Redeem</button>
      </div>

      {showIssue && (
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Code</label>
              <div className="flex gap-1">
                <input type="text" value={issueForm.code} onChange={e => setIssueForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="XXXX-XXXX-XXXX-XXXX" className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono" />
                <button onClick={() => setIssueForm(prev => ({ ...prev, code: generateCode() }))} className="px-2 text-xs text-blue-600 font-bold hover:text-blue-800">Generate</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Initial Balance ($)</label>
              <input type="number" value={issueForm.initialBalance} onChange={e => setIssueForm(prev => ({ ...prev, initialBalance: parseFloat(e.target.value) || 0 }))} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Expires At</label>
              <input type="date" value={issueForm.expiresAt} onChange={e => setIssueForm(prev => ({ ...prev, expiresAt: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Customer ID (optional)</label>
              <input type="text" value={issueForm.customerId} onChange={e => setIssueForm(prev => ({ ...prev, customerId: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Gift Message</label>
              <input type="text" value={issueForm.giftMessage} onChange={e => setIssueForm(prev => ({ ...prev, giftMessage: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Color</label>
              <input type="color" value={issueForm.designColor} onChange={e => setIssueForm(prev => ({ ...prev, designColor: e.target.value }))} className="w-full h-8 border border-slate-200 rounded-lg cursor-pointer" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mb-3">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={issueForm.rechargeable} onChange={e => setIssueForm(prev => ({ ...prev, rechargeable: e.target.checked }))} className="rounded" />
              Rechargeable
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={issueForm.transferable} onChange={e => setIssueForm(prev => ({ ...prev, transferable: e.target.checked }))} className="rounded" />
              Transferable
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleIssue} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-green-600 rounded-lg hover:bg-green-700"><Plus size={12} /> Issue Card</button>
            <button onClick={() => setShowIssue(false)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border rounded-lg hover:bg-slate-50"><X size={12} /> Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filteredCards.map(card => (
          <div key={card.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-6 rounded" style={{ backgroundColor: card.designColor || '#10b981' }} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold text-slate-800">{card.code}</span>
                  {statusBadge(card.status || 'active')}
                </div>
                <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                  <span>Balance: ${card.currentBalance?.toFixed(2)} / ${card.initialBalance?.toFixed(2)}</span>
                  {card.customerId && <span>Customer: {card.customerId}</span>}
                  {card.expiresAt && <span>Expires: {new Date(card.expiresAt).toLocaleDateString()}</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              {(card.status === 'active') && (
                <button onClick={() => cancelCard(card.id)} className="p-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg">Cancel</button>
              )}
            </div>
          </div>
        ))}
        {filteredCards.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            {search ? 'No gift cards match your search.' : 'No gift cards issued yet. Click "Issue Card" to create one.'}
          </div>
        )}
      </div>
    </div>
  )
}

export default GiftCardsAdmin
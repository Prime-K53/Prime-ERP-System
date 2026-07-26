import React, { useState, useEffect } from 'react'
import { dbService } from '../../services/db'
import { Promotion } from '../../types/engagement'
import { Plus, Pencil, Trash2, Save, X, Play, Pause } from 'lucide-react'

const STACKING_OPTIONS = ['best_only', 'stackable', 'exclusive'] as const
const STATUS_OPTIONS = ['draft', 'active', 'paused', 'expired', 'cancelled'] as const
const PROMO_TYPES = ['percentage', 'fixed', 'category', 'brand', 'bundle', 'buy_x_get_y', 'tier', 'campaign', 'coupon'] as const

export const PromotionsAdmin: React.FC = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Promotion>>({})
  const [showNew, setShowNew] = useState(false)
  const [newPromo, setNewPromo] = useState<Partial<Promotion>>({
    name: '', description: '', type: 'percentage', value: 0, stackingRule: 'best_only',
    priority: 0, minPurchase: 0, maxDiscount: 0, maxUses: 0, currentUses: 0,
    customerIds: [], tierIds: [], status: 'draft', startsAt: new Date().toISOString(),
    expiresAt: '', buyXQty: 0, getYQty: 0, getYDiscount: 0,
  })

  useEffect(() => { loadPromotions() }, [])

  const loadPromotions = async () => {
    const data = await dbService.getAll<Promotion>('engagementPromotions')
    setPromotions(data.sort((a, b) => (b.priority || 0) - (a.priority || 0)))
  }

  const startEdit = (p: Promotion) => {
    setEditingId(p.id)
    setEditForm({ ...p })
  }

  const saveEdit = async () => {
    if (!editingId || !editForm.name) return
    await dbService.put('engagementPromotions', { ...editForm, id: editingId } as Promotion)
    setEditingId(null)
    setEditForm({})
    await loadPromotions()
  }

  const saveNew = async () => {
    if (!newPromo.name) return
    const id = `PROMO_${Date.now()}`
    await dbService.put('engagementPromotions', { ...newPromo, id } as Promotion)
    setShowNew(false)
    setNewPromo({
      name: '', description: '', type: 'percentage', value: 0, stackingRule: 'best_only',
      priority: 0, minPurchase: 0, maxDiscount: 0, maxUses: 0, currentUses: 0,
      customerIds: [], tierIds: [], status: 'draft', startsAt: new Date().toISOString(),
      expiresAt: '', buyXQty: 0, getYQty: 0, getYDiscount: 0,
    })
    await loadPromotions()
  }

  const deletePromo = async (id: string) => {
    await dbService.delete('engagementPromotions', id)
    await loadPromotions()
  }

  const toggleStatus = async (p: Promotion) => {
    const newStatus = p.status === 'active' ? 'paused' : 'active'
    await dbService.put('engagementPromotions', { ...p, status: newStatus } as Promotion)
    await loadPromotions()
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = { draft: 'bg-slate-100 text-slate-600', active: 'bg-green-100 text-green-700', paused: 'bg-amber-100 text-amber-700', expired: 'bg-red-100 text-red-600', cancelled: 'bg-red-100 text-red-600' }
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Promotions</h2>
          <p className="text-sm text-slate-500">Manage discounts, coupons, and promotional campaigns</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus size={14} /> Add Promotion
        </button>
      </div>

      {showNew && (
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Input label="Name" value={newPromo.name || ''} onChange={v => setNewPromo(prev => ({ ...prev, name: v }))} />
            <Select label="Type" value={newPromo.type || 'percentage'} options={PROMO_TYPES} onChange={v => setNewPromo(prev => ({ ...prev, type: v as any }))} />
            <Input label="Value" type="number" value={newPromo.value} onChange={v => setNewPromo(prev => ({ ...prev, value: parseFloat(v) || 0 }))} />
            <Input label="Min Purchase ($)" type="number" value={newPromo.minPurchase} onChange={v => setNewPromo(prev => ({ ...prev, minPurchase: parseFloat(v) || 0 }))} />
            <Input label="Max Discount ($)" type="number" value={newPromo.maxDiscount} onChange={v => setNewPromo(prev => ({ ...prev, maxDiscount: parseFloat(v) || 0 }))} />
            <Input label="Max Uses" type="number" value={newPromo.maxUses} onChange={v => setNewPromo(prev => ({ ...prev, maxUses: parseInt(v) || 0 }))} />
            <Select label="Stacking" value={newPromo.stackingRule || 'best_only'} options={STACKING_OPTIONS} onChange={v => setNewPromo(prev => ({ ...prev, stackingRule: v as any }))} />
            <Select label="Status" value={newPromo.status || 'draft'} options={STATUS_OPTIONS} onChange={v => setNewPromo(prev => ({ ...prev, status: v as any }))} />
            <Input label="Priority" type="number" value={newPromo.priority} onChange={v => setNewPromo(prev => ({ ...prev, priority: parseInt(v) || 0 }))} />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
            <textarea value={newPromo.description || ''} onChange={e => setNewPromo(prev => ({ ...prev, description: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" rows={2} />
          </div>
          <div className="flex gap-2">
            <button onClick={saveNew} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-green-600 rounded-lg hover:bg-green-700"><Save size={12} /> Create</button>
            <button onClick={() => setShowNew(false)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border rounded-lg hover:bg-slate-50"><X size={12} /> Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {promotions.map(p => (
          <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
            {editingId === p.id ? (
              <div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <Input label="Name" value={editForm.name || ''} onChange={v => setEditForm(prev => ({ ...prev, name: v }))} />
                  <Select label="Type" value={editForm.type || 'percentage'} options={PROMO_TYPES} onChange={v => setEditForm(prev => ({ ...prev, type: v as any }))} />
                  <Input label="Value" type="number" value={editForm.value} onChange={v => setEditForm(prev => ({ ...prev, value: parseFloat(v) || 0 }))} />
                  <Input label="Min Purchase ($)" type="number" value={editForm.minPurchase} onChange={v => setEditForm(prev => ({ ...prev, minPurchase: parseFloat(v) || 0 }))} />
                  <Input label="Max Discount ($)" type="number" value={editForm.maxDiscount} onChange={v => setEditForm(prev => ({ ...prev, maxDiscount: parseFloat(v) || 0 }))} />
                  <Input label="Max Uses" type="number" value={editForm.maxUses} onChange={v => setEditForm(prev => ({ ...prev, maxUses: parseInt(v) || 0 }))} />
                  <Select label="Stacking" value={editForm.stackingRule || 'best_only'} options={STACKING_OPTIONS} onChange={v => setEditForm(prev => ({ ...prev, stackingRule: v as any }))} />
                  <Select label="Status" value={editForm.status || 'draft'} options={STATUS_OPTIONS} onChange={v => setEditForm(prev => ({ ...prev, status: v as any }))} />
                  <Input label="Priority" type="number" value={editForm.priority} onChange={v => setEditForm(prev => ({ ...prev, priority: parseInt(v) || 0 }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700"><Save size={12} /> Save</button>
                  <button onClick={() => { setEditingId(null); setEditForm({}) }} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border rounded-lg hover:bg-slate-50"><X size={12} /> Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{p.name}</span>
                      {statusBadge(p.status || 'draft')}
                    </div>
                    <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                      <span>{p.type}: {p.type === 'percentage' ? `${p.value}%` : `$${p.value}`}</span>
                      <span>Min: ${p.minPurchase}</span>
                      <span>Uses: {p.currentUses}/{p.maxUses || '∞'}</span>
                      <span>Stack: {p.stackingRule}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleStatus(p)} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50">
                    {p.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button onClick={() => startEdit(p)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Pencil size={14} /></button>
                  <button onClick={() => deletePromo(p.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"><Trash2 size={14} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {promotions.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">No promotions defined. Click "Add Promotion" to create one.</div>
        )}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
    </div>
  )
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

export default PromotionsAdmin
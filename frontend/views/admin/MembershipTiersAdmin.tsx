import React, { useState, useEffect } from 'react'
import { dbService } from '../../services/db'
import { MembershipTier } from '../../types/engagement'
import { Plus, Pencil, Trash2, Save, X, GripVertical } from 'lucide-react'

export const MembershipTiersAdmin: React.FC = () => {
  const [tiers, setTiers] = useState<MembershipTier[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<MembershipTier>>({})
  const [showNew, setShowNew] = useState(false)
  const [newTier, setNewTier] = useState<Partial<MembershipTier>>({
    name: '', level: 0, description: '', color: '#6366f1', icon: '',
    minSpend: 0, entrySpend: 0, minFrequency: 0, minClv: 0, pointMultiplier: 1, cashbackRate: 0,
    prioritySupport: false, exclusivePricing: false, exclusiveCampaigns: false, freeShipping: false,
    birthdayReward: 0, annualReward: 0, benefits: {}, status: 'active',
  })

  useEffect(() => { loadTiers() }, [])

  const loadTiers = async () => {
    const data = await dbService.getAll<MembershipTier>('engagementMembershipTiers')
    setTiers(data.sort((a, b) => a.level - b.level))
  }

  const startEdit = (tier: MembershipTier) => {
    setEditingId(tier.id)
    setEditForm({ ...tier })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = async () => {
    if (!editingId || !editForm.name) return
    await dbService.put('engagementMembershipTiers', { ...editForm, id: editingId } as MembershipTier)
    setEditingId(null)
    setEditForm({})
    await loadTiers()
  }

  const saveNew = async () => {
    if (!newTier.name) return
    const id = `TIER_${Date.now()}`
    const tier: MembershipTier = { ...newTier as any, id } as MembershipTier
    await dbService.put('engagementMembershipTiers', tier)
    setShowNew(false)
    setNewTier({
      name: '', level: tiers.length, description: '', color: '#6366f1', icon: '',
      minSpend: 0, entrySpend: 0, minFrequency: 0, minClv: 0, pointMultiplier: 1, cashbackRate: 0,
      prioritySupport: false, exclusivePricing: false, exclusiveCampaigns: false, freeShipping: false,
      birthdayReward: 0, annualReward: 0, benefits: {}, status: 'active',
    })
    await loadTiers()
  }

  const deleteTier = async (id: string) => {
    await dbService.delete('engagementMembershipTiers', id)
    await loadTiers()
  }

  const updateField = (key: string, value: any) => {
    setEditForm(prev => ({ ...prev, [key]: value }))
  }

  const updateNewField = (key: string, value: any) => {
    setNewTier(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Membership Tiers</h2>
          <p className="text-sm text-slate-500">Manage loyalty tiers and benefits</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus size={14} /> Add Tier
        </button>
      </div>

      {showNew && (
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Input label="Name" value={newTier.name} onChange={v => updateNewField('name', v)} />
            <Input label="Level" type="number" value={newTier.level} onChange={v => updateNewField('level', parseInt(v) || 0)} />
            <Input label="Color" value={newTier.color} onChange={v => updateNewField('color', v)} />
            <Input label="Min Spend" type="number" value={newTier.minSpend} onChange={v => updateNewField('minSpend', parseFloat(v) || 0)} />
            <Input label="Entry Spend" type="number" value={newTier.entrySpend} onChange={v => updateNewField('entrySpend', parseFloat(v) || 0)} />
            <Input label="Min Purchases" type="number" value={newTier.minFrequency} onChange={v => updateNewField('minFrequency', parseInt(v) || 0)} />
            <Input label="Point Multiplier" type="number" step="0.1" value={newTier.pointMultiplier} onChange={v => updateNewField('pointMultiplier', parseFloat(v) || 1)} />
            <Input label="Cashback Rate (%)" type="number" step="0.1" value={newTier.cashbackRate} onChange={v => updateNewField('cashbackRate', parseFloat(v) || 0)} />
            <Input label="Birthday Reward ($)" type="number" value={newTier.birthdayReward} onChange={v => updateNewField('birthdayReward', parseFloat(v) || 0)} />
          </div>
          <div className="flex flex-wrap gap-4 mb-3">
            <Toggle label="Priority Support" value={newTier.prioritySupport} onChange={v => updateNewField('prioritySupport', v)} />
            <Toggle label="Exclusive Pricing" value={newTier.exclusivePricing} onChange={v => updateNewField('exclusivePricing', v)} />
            <Toggle label="Exclusive Campaigns" value={newTier.exclusiveCampaigns} onChange={v => updateNewField('exclusiveCampaigns', v)} />
            <Toggle label="Free Shipping" value={newTier.freeShipping} onChange={v => updateNewField('freeShipping', v)} />
          </div>
          <div className="flex gap-2">
            <button onClick={saveNew} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-green-600 rounded-lg hover:bg-green-700"><Save size={12} /> Create</button>
            <button onClick={() => setShowNew(false)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border rounded-lg hover:bg-slate-50"><X size={12} /> Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {tiers.map(tier => (
          <div key={tier.id} className="bg-white rounded-xl border border-slate-200 p-4">
            {editingId === tier.id ? (
              <div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <Input label="Name" value={editForm.name || ''} onChange={v => updateField('name', v)} />
                  <Input label="Level" type="number" value={editForm.level} onChange={v => updateField('level', parseInt(v) || 0)} />
                  <Input label="Color" value={editForm.color || ''} onChange={v => updateField('color', v)} />
                  <Input label="Min Spend" type="number" value={editForm.minSpend} onChange={v => updateField('minSpend', parseFloat(v) || 0)} />
                  <Input label="Entry Spend" type="number" value={editForm.entrySpend} onChange={v => updateField('entrySpend', parseFloat(v) || 0)} />
                  <Input label="Min Purchases" type="number" value={editForm.minFrequency} onChange={v => updateField('minFrequency', parseInt(v) || 0)} />
                  <Input label="Point Multiplier" type="number" step="0.1" value={editForm.pointMultiplier} onChange={v => updateField('pointMultiplier', parseFloat(v) || 1)} />
                  <Input label="Cashback Rate (%)" type="number" step="0.1" value={editForm.cashbackRate} onChange={v => updateField('cashbackRate', parseFloat(v) || 0)} />
                  <Input label="Birthday Reward ($)" type="number" value={editForm.birthdayReward} onChange={v => updateField('birthdayReward', parseFloat(v) || 0)} />
                </div>
                <div className="flex flex-wrap gap-4 mb-3">
                  <Toggle label="Priority Support" value={editForm.prioritySupport} onChange={v => updateField('prioritySupport', v)} />
                  <Toggle label="Exclusive Pricing" value={editForm.exclusivePricing} onChange={v => updateField('exclusivePricing', v)} />
                  <Toggle label="Exclusive Campaigns" value={editForm.exclusiveCampaigns} onChange={v => updateField('exclusiveCampaigns', v)} />
                  <Toggle label="Free Shipping" value={editForm.freeShipping} onChange={v => updateField('freeShipping', v)} />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700"><Save size={12} /> Save</button>
                  <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border rounded-lg hover:bg-slate-50"><X size={12} /> Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tier.color || '#6366f1' }} />
                  <div>
                    <span className="text-sm font-bold text-slate-800">{tier.name}</span>
                    <span className="text-xs text-slate-400 ml-2">Level {tier.level}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-slate-400 ml-4">
                    <span>Min ${tier.minSpend}</span>
                    <span>{tier.pointMultiplier}x pts</span>
                    <span>{tier.cashbackRate}% cashback</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(tier)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Pencil size={14} /></button>
                  <button onClick={() => deleteTier(tier.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"><Trash2 size={14} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {tiers.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">No membership tiers defined. Click "Add Tier" to create one.</div>
        )}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', step }: { label: string; value: any; onChange: (v: string) => void; type?: string; step?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} step={step} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
      <button onClick={() => onChange(!value)} className={`w-8 h-4 rounded-full transition-colors relative ${value ? 'bg-blue-600' : 'bg-slate-300'}`}>
        <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
      {label}
    </label>
  )
}

export default MembershipTiersAdmin
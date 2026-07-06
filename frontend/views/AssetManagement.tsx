import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Printer, Truck, Wrench, Monitor, Package, MoreVertical, Edit2, Trash2, X, ChevronDown, Calendar, DollarSign, MapPin, User, FileText, AlertCircle } from 'lucide-react';

interface Asset {
  id: string;
  name: string;
  asset_type: string;
  serial_number: string | null;
  model: string | null;
  manufacturer: string | null;
  purchase_date: string | null;
  purchase_cost: number;
  current_value: number;
  useful_life_years: number;
  status: string;
  location: string | null;
  assigned_to: string | null;
  notes: string | null;
  warranty_expiry: string | null;
  last_maintenance: string | null;
  next_maintenance: string | null;
  created_at: string;
}

const ASSET_TYPES = [
  { value: 'printer', label: 'Printer', icon: Printer },
  { value: 'vehicle', label: 'Vehicle', icon: Truck },
  { value: 'equipment', label: 'Equipment', icon: Wrench },
  { value: 'furniture', label: 'Furniture', icon: Package },
  { value: 'computer', label: 'Computer', icon: Monitor },
  { value: 'other', label: 'Other', icon: Package },
];

const TYPE_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  printer: Printer, vehicle: Truck, equipment: Wrench, furniture: Package, computer: Monitor, other: Package,
};

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'maintenance', label: 'In Maintenance', color: 'bg-amber-100 text-amber-700' },
  { value: 'retired', label: 'Retired', color: 'bg-slate-100 text-slate-600' },
  { value: 'sold', label: 'Sold', color: 'bg-red-100 text-red-700' },
];

const emptyForm = {
  name: '', asset_type: 'printer', serial_number: '', model: '', manufacturer: '',
  purchase_date: '', purchase_cost: 0, current_value: 0, useful_life_years: 5,
  status: 'active', location: '', assigned_to: '', notes: '', warranty_expiry: '',
};

const AssetManagement: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchAssets = async () => {
    try {
      const data = await api.get('/api/assets');
      setAssets(data || []);
    } catch { setAssets([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAssets(); }, []);

  const filtered = useMemo(() => {
    return assets.filter(a => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.serial_number?.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter && a.asset_type !== typeFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });
  }, [assets, search, typeFilter, statusFilter]);

  const handleSave = async () => {
    if (!form.name.trim()) return alert('Asset name is required');
    try {
      if (editingId) await api.put(`/api/assets/${editingId}`, form);
      else await api.post('/api/assets', form);
      setShowForm(false); setEditingId(null); setForm(emptyForm);
      await fetchAssets();
    } catch (err) { alert('Failed to save asset'); }
  };

  const handleEdit = (asset: Asset) => {
    setForm({
      name: asset.name, asset_type: asset.asset_type, serial_number: asset.serial_number || '',
      model: asset.model || '', manufacturer: asset.manufacturer || '',
      purchase_date: asset.purchase_date?.split('T')[0] || '', purchase_cost: asset.purchase_cost,
      current_value: asset.current_value, useful_life_years: asset.useful_life_years,
      status: asset.status, location: asset.location || '', assigned_to: asset.assigned_to || '',
      notes: asset.notes || '', warranty_expiry: asset.warranty_expiry?.split('T')[0] || '',
    });
    setEditingId(asset.id); setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this asset?')) return;
    try { await api.delete(`/api/assets/${id}`); await fetchAssets(); }
    catch { alert('Failed to delete'); }
  };

  const totalValue = useMemo(() => assets.reduce((s, a) => s + a.current_value, 0), [assets]);
  const activeCount = useMemo(() => assets.filter(a => a.status === 'active').length, [assets]);
  const maintenanceCount = useMemo(() => assets.filter(a => a.status === 'maintenance').length, [assets]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Asset Management</h1>
          <p className="text-sm text-slate-500 mt-1">Track printers, vehicles, equipment, and other physical assets</p>
        </div>
        <button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-200">
          <Plus size={16} /> Add Asset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-blue-500 hover:bg-slate-50 transition-all">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Total Value</p>
            <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">K {totalValue.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-emerald-500 hover:bg-slate-50 transition-all">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <Monitor size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Active Assets</p>
            <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{activeCount}</p>
          </div>
        </div>
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-amber-500 hover:bg-slate-50 transition-all">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Wrench size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">In Maintenance</p>
            <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{maintenanceCount}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white">
          <option value="">All Types</option>
          {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading assets...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Package size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No assets found</p>
          <p className="text-sm mt-1">Add your first asset to start tracking.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(asset => {
            const TypeIcon = TYPE_ICONS[asset.asset_type] || Package;
            const statusCfg = STATUS_OPTIONS.find(s => s.value === asset.status) || STATUS_OPTIONS[0];
            return (
              <div key={asset.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50">
                      <TypeIcon size={20} className="text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">{asset.name}</h3>
                      {asset.model && <p className="text-xs text-slate-400">{asset.model}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(asset)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(asset.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span>
                  {asset.asset_type && <span className="text-[10px] text-slate-400 capitalize">{asset.asset_type}</span>}
                </div>
                <div className="space-y-1.5 text-xs text-slate-500">
                  {asset.serial_number && <div className="flex items-center gap-1.5"><FileText size={12} /> SN: {asset.serial_number}</div>}
                  {asset.location && <div className="flex items-center gap-1.5"><MapPin size={12} /> {asset.location}</div>}
                  {asset.assigned_to && <div className="flex items-center gap-1.5"><User size={12} /> {asset.assigned_to}</div>}
                  <div className="flex items-center gap-1.5"><DollarSign size={12} /> Current value: <span className="font-semibold text-slate-700">K {asset.current_value.toLocaleString()}</span></div>
                  {asset.next_maintenance && <div className="flex items-center gap-1.5"><Calendar size={12} /> Next maintenance: {new Date(asset.next_maintenance).toLocaleDateString()}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Asset' : 'Add Asset'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" placeholder="e.g., Heidelberg Press X4" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <select value={form.asset_type} onChange={e => setForm({...form, asset_type: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white">
                    {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white">
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Serial Number</label>
                  <input type="text" value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Model</label>
                  <input type="text" value={form.model} onChange={e => setForm({...form, model: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Manufacturer</label>
                <input type="text" value={form.manufacturer} onChange={e => setForm({...form, manufacturer: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Date</label>
                  <input type="date" value={form.purchase_date} onChange={e => setForm({...form, purchase_date: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Warranty Expiry</label>
                  <input type="date" value={form.warranty_expiry} onChange={e => setForm({...form, warranty_expiry: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Cost (K)</label>
                  <input type="number" value={form.purchase_cost} onChange={e => setForm({...form, purchase_cost: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" min={0} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Current Value (K)</label>
                  <input type="number" value={form.current_value} onChange={e => setForm({...form, current_value: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" min={0} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
                  <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="e.g., Building A, Floor 2" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned To</label>
                  <input type="text" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Employee name" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none" rows={2} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700">
                  {editingId ? 'Update Asset' : 'Add Asset'}
                </button>
                <button onClick={() => setShowForm(false)} className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetManagement;

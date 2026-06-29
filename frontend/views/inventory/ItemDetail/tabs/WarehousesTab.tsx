import React from 'react';
import { Warehouse, MapPin, Thermometer, AlertTriangle, Layers, Hash, Barcode, Shield } from 'lucide-react';
import type { Item } from '../../../../types';

interface Props {
  item: Item;
}

export const WarehousesTab: React.FC<Props> = ({ item }) => {
  const locationStock = item.locationStock || [];
  const hasMultiWarehouse = locationStock.length > 0;

  const primaryWarehouse = {
    name: item.warehouseId || 'Default',
    location: item.storageLocation || '',
    shelf: item.shelf || '',
    bin: item.binLocation || '',
    quantity: locationStock.find((ls) => ls.warehouseId === item.warehouseId)?.quantity || item.stock || 0,
    reserved: item.reserved || 0,
  };

  const conditions = [
    { label: 'Hazardous', enabled: item.hazardous, color: 'bg-red-500' },
    { label: 'Temperature Controlled', enabled: item.temperatureControlled, color: 'bg-blue-500' },
    { label: 'Batch Controlled', enabled: item.batchControlled, color: 'bg-purple-500' },
    { label: 'Lot Tracking', enabled: item.lotTracking, color: 'bg-amber-500' },
    { label: 'Serial Tracking', enabled: item.serialTracking, color: 'bg-emerald-500' },
    { label: 'Expiration Tracking', enabled: item.expirationTracking, color: 'bg-red-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
          <span className="p-1.5 rounded-lg bg-white shadow-sm text-slate-500"><Warehouse size={16} /></span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {hasMultiWarehouse ? `Warehouses (${locationStock.length})` : 'Primary Warehouse'}
          </span>
        </div>
        {!hasMultiWarehouse ? (
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-blue-50 rounded-xl"><Warehouse size={20} className="text-blue-600" /></div>
              <div>
                <h4 className="font-semibold text-slate-800">{primaryWarehouse.name}</h4>
                <p className="text-xs text-slate-400">Primary Warehouse</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Storage Location</span>
                <span className="font-semibold text-slate-700">{primaryWarehouse.location || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Shelf</span>
                <span className="font-semibold text-slate-700">{primaryWarehouse.shelf || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Bin</span>
                <span className="font-mono font-semibold text-slate-700">{primaryWarehouse.bin || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Quantity</span>
                <span className="text-xl font-bold text-slate-900">{primaryWarehouse.quantity}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
              <span>Reserved: <strong className="text-amber-600">{primaryWarehouse.reserved}</strong></span>
              <span>Available: <strong className={Math.max(0, primaryWarehouse.quantity - primaryWarehouse.reserved) > 0 ? 'text-emerald-600' : 'text-red-600'}>
                {Math.max(0, primaryWarehouse.quantity - primaryWarehouse.reserved)}
              </strong></span>
            </div>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {locationStock.map((ls, i: number) => (
              <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={16} className="text-slate-400" />
                  <span className="font-semibold text-slate-800">{ls.warehouseId}</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">{ls.quantity}</p>
                <p className="text-xs text-slate-400">{item.unit || 'pcs'} in stock</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
          <span className="p-1.5 rounded-lg bg-white shadow-sm text-slate-500"><Shield size={16} /></span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Storage Conditions</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {conditions.map(c => (
              <div key={c.label} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50">
                <span className={`w-2 h-2 rounded-full ${c.enabled ? c.color : 'bg-slate-200'}`} />
                <span className={`text-sm ${c.enabled ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

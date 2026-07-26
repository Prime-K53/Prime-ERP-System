import React from 'react';
import { Building2, DollarSign, Clock, Package, Phone, Mail, User } from 'lucide-react';
import type { Item, Supplier } from '../../../../types';

interface Props {
  item: Item;
  suppliers: Supplier[];
}

export const SuppliersTab: React.FC<Props> = ({ item, suppliers }) => {
  const preferredSupplier = suppliers.find(s => s.id === item.preferredSupplierId);
  const alternateSuppliers = suppliers.filter(s => s.id !== item.preferredSupplierId);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
          <span className="p-1.5 rounded-lg bg-white shadow-sm text-emerald-600"><Building2 size={16} /></span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Preferred Supplier</span>
        </div>
        <div className="p-5">
          {preferredSupplier ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-emerald-50 rounded-xl"><Building2 size={20} className="text-emerald-600" /></div>
                <div>
                  <h4 className="font-semibold text-slate-800">{preferredSupplier.name}</h4>
                  <p className="text-xs text-slate-400">Primary source for this item</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Name</span>
                  <span className="font-semibold text-slate-700">{preferredSupplier.name}</span>
                </div>
                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Code</span>
                  <span className="font-mono text-slate-700">{preferredSupplier.code || preferredSupplier.id}</span>
                </div>
                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Contact</span>
                  <span className="text-slate-700">{preferredSupplier.contactPerson || preferredSupplier.email || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Phone</span>
                  <span className="text-slate-700">{preferredSupplier.phone || '—'}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-6 text-slate-400">
              <Building2 size={32} className="mb-2 opacity-50" />
              <p className="text-sm font-medium">No preferred supplier assigned</p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                <Clock size={11} className="inline mr-1" />Lead Time
              </span>
              <span className="font-semibold text-slate-700">{item.leadTimeDays || 0} days</span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                <Package size={11} className="inline mr-1" />MOQ
              </span>
              <span className="font-semibold text-slate-700">{item.minOrderQty || 0}</span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                <DollarSign size={11} className="inline mr-1" />Last Cost
              </span>
              <span className="font-mono font-semibold text-slate-700">{(item.costPrice || item.cost || 0).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Supplier SKU</span>
              <span className="font-mono text-slate-700">{(item as Item & { supplierCode?: string }).supplierCode || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {alternateSuppliers.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-white shadow-sm text-slate-500"><User size={16} /></span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alternate Suppliers ({alternateSuppliers.length})</span>
          </div>
          <div className="p-5 space-y-3">
            {alternateSuppliers.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-white rounded-lg shadow-sm">
                    <Building2 size={16} className="text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{s.name}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      {s.contactPerson && <span className="flex items-center gap-1"><User size={10} />{s.contactPerson}</span>}
                      {s.email && <span className="flex items-center gap-1"><Mail size={10} />{s.email}</span>}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Phone size={10} />{s.phone || '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!preferredSupplier && alternateSuppliers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <Building2 size={48} className="mb-4 opacity-50" />
          <p className="text-sm font-semibold">No Suppliers</p>
          <p className="text-xs mt-1">Add suppliers in the Purchasing module.</p>
        </div>
      )}
    </div>
  );
};

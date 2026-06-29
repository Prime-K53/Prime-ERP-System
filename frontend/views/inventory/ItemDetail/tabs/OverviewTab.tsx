import React from 'react';
import { Package, DollarSign, Warehouse, Shield } from 'lucide-react';
import type { Item } from '../../../../types';
import { resolveMinimumMarkup } from '../../../../services/pricingValidationService';

interface Props {
  item: Item;
}

export const OverviewTab: React.FC<Props> = ({ item }) => {
  const b = (val: any, fallback = '—') => val || fallback;

  const sections = [
    {
      icon: <Package size={16} />,
      title: 'General',
      fields: [
        { label: 'Name', value: item.name, bold: true },
        { label: 'SKU', value: b(item.sku), mono: true },
        { label: 'Description', value: b(item.description), span: 2 },
        { label: 'Brand', value: b(item.brand) },
        { label: 'Category', value: b(item.category) },
        { label: 'Classification', value: item.type },
        { label: 'Product Type', value: b(item.productType) },
        { label: 'Inventory Role', value: item.inventoryRole || 'sellable', capitalize: true },
        { label: 'Barcode', value: b(item.barcode), mono: true },
        { label: 'QR Code', value: b(item.qrCode), mono: true },
      ],
    },
    {
      icon: <DollarSign size={16} />,
      title: 'Costing & Pricing',
      fields: [
        { label: 'Cost Method', value: item.costingMethod || 'weighted_average', capitalize: true },
        { label: 'Last Purchase Cost', value: (item.costPrice || item.cost || 0).toFixed(2), mono: true },
        { label: 'Avg Cost', value: (item.normalizedCP || item.costPrice || item.cost || 0).toFixed(2), mono: true },
        { label: 'Cost Price', value: (item.costPrice || item.cost || 0).toFixed(2), mono: true, bold: true },
        { label: 'Selling Price', value: (item.sellingPrice || item.price || 0).toFixed(2), mono: true, bold: true, accent: true },
        { label: 'Min Markup', value: `${resolveMinimumMarkup(item)}%` },
        { label: 'Currency', value: item.currency || 'KWD' },
      ],
    },
    {
      icon: <Warehouse size={16} />,
      title: 'Storage',
      fields: [
        { label: 'Warehouse', value: b(item.warehouseId) },
        { label: 'Storage Location', value: b(item.storageLocation) },
        { label: 'Shelf', value: b(item.shelf) },
        { label: 'Bin', value: b(item.binLocation), mono: true },
      ],
    },
    {
      icon: <Shield size={16} />,
      title: 'Tracking',
      fields: [
        { label: 'Lot Tracking', value: item.lotTracking ? 'Enabled' : '—', enabled: !!item.lotTracking },
        { label: 'Serial Tracking', value: item.serialTracking ? 'Enabled' : '—', enabled: !!item.serialTracking },
        { label: 'Batch Controlled', value: item.batchControlled ? 'Enabled' : '—', enabled: !!item.batchControlled },
        { label: 'Temperature Controlled', value: item.temperatureControlled ? 'Enabled' : '—', enabled: !!item.temperatureControlled },
        { label: 'Hazardous', value: item.hazardous ? 'Yes' : 'No' },
        { label: 'Expiration Tracking', value: item.expirationTracking ? 'Enabled' : '—', enabled: !!item.expirationTracking },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {sections.map(section => (
        <div key={section.title} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-white shadow-sm text-slate-500">{section.icon}</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{section.title}</span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 text-sm">
              {section.fields.map(f => (
                <div key={f.label} className={f.span === 2 ? 'col-span-2' : ''}>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-0.5">{f.label}</span>
                  <span className={`${f.bold ? 'font-semibold' : ''} ${f.mono ? 'font-mono' : ''} ${f.accent ? 'text-blue-600' : 'text-slate-700'} ${f.capitalize ? 'capitalize' : ''} ${f.enabled ? 'text-emerald-600' : ''}`}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

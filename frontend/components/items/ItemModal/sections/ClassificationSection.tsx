import React from 'react';
import type { ItemClassification } from '../types/itemFormTypes';
import { CLASSIFICATION_OPTIONS, CLASSIFICATION_MAP } from '../types/itemFormTypes';

interface Props {
  value: ItemClassification;
  onChange: (value: ItemClassification) => void;
  readOnly?: boolean;
}

const CLASSIFICATION_LABELS: Record<ItemClassification, string> = {
  raw_material: 'Raw Material',
  consumable: 'Consumable',
  product: 'Product',
  stationery: 'Stationery',
  printing_service: 'Printing Service',
  non_stock_service: 'Non-Stock Service',
};

export const ClassificationSection: React.FC<Props> = ({ value, onChange, readOnly }) => {
  if (readOnly) {
    const opt = CLASSIFICATION_OPTIONS.find(o => o.value === value);
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Classification</h3>
        <div className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50">
          <div className="font-bold text-sm text-slate-900">{opt?.label || CLASSIFICATION_LABELS[value]}</div>
          <div className="text-xs text-slate-500 mt-1">{opt?.description}</div>
          <p className="text-xs text-slate-400 mt-2">This is set based on the section you were in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">Classification</h3>
      <p className="text-sm text-slate-500">Choose the type of item you are creating. This determines which sections appear next.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CLASSIFICATION_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              value === opt.value
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="font-bold text-sm text-slate-900">{opt.label}</div>
            <div className="text-xs text-slate-500 mt-1">{opt.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import type { ItemFormData } from '../types/itemFormTypes';
import { loadSuppliers } from '../services/itemFormService';

interface Props {
  data: ItemFormData;
  onChange: <K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => void;
}

export const PurchasingSection: React.FC<Props> = ({ data, onChange }) => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierOpen, setSupplierOpen] = useState(false);
  const supplierRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSuppliers().then(setSuppliers);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) setSupplierOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredSuppliers = suppliers.filter(s =>
    (s.name || '').toLowerCase().includes(supplierSearch.toLowerCase()) ||
    (s.code || '').toLowerCase().includes(supplierSearch.toLowerCase()),
  );

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.45, color: '#1E2A24' }}>
      <h3 style={{ fontSize: 20, fontWeight: 600, color: '#1E2A24', margin: '0 0 14px', lineHeight: 1.4 }}>Purchasing</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
        <div ref={supplierRef} style={{ position: 'relative' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Preferred Supplier</label>
          <input
            type="text"
            value={supplierOpen ? supplierSearch : data.preferredSupplier}
            onChange={e => { setSupplierSearch(e.target.value); setSupplierOpen(true); }}
            onFocus={() => setSupplierOpen(true)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="Search or type supplier name"
          />
          {supplierOpen && filteredSuppliers.length > 0 && (
            <div style={{
              position: 'absolute', zIndex: 10, marginTop: 4, width: '100%',
              background: 'white', border: '1px solid #E5E8E1', borderRadius: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,.08)', maxHeight: 180, overflowY: 'auto'
            }}>
              {filteredSuppliers.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onChange('preferredSupplier', s.name || s.code || '');
                    onChange('preferredSupplierId', s.id || '');
                    setSupplierSearch('');
                    setSupplierOpen(false);
                  }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '7px 10px', fontSize: 13,
                    background: 'none', border: 'none', cursor: 'pointer', color: '#1E2A24', lineHeight: 1.45
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F6F7F2'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                >
                  <span style={{ fontWeight: 600 }}>{s.name || s.code || s.id}</span>
                  {s.code && <span style={{ marginLeft: 6, fontSize: 12, color: '#9CA59E' }}>({s.code})</span>}
                </button>
              ))}
            </div>
          )}
          {supplierOpen && filteredSuppliers.length === 0 && (
            <div style={{
              position: 'absolute', zIndex: 10, marginTop: 4, width: '100%',
              background: 'white', border: '1px solid #E5E8E1', borderRadius: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,.08)', padding: 10, fontSize: 13, textAlign: 'center', color: '#9CA59E'
            }}>
              No suppliers found
            </div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Supplier Code</label>
          <input
            type="text"
            value={data.supplierCode}
            onChange={e => onChange('supplierCode', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="Supplier's SKU"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Lead Time (days)</label>
          <input
            type="number"
            min={0}
            value={data.supplierLeadTime}
            onChange={e => onChange('supplierLeadTime', Number(e.target.value))}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Last Purchase Price</label>
          <input
            type="number"
            min={0}
            step="any"
            value={data.lastPurchasePrice}
            onChange={e => onChange('lastPurchasePrice', Number(e.target.value))}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
          />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Purchase Notes</label>
          <textarea
            value={data.purchaseNotes}
            onChange={e => onChange('purchaseNotes', e.target.value)}
            rows={2}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none',
              lineHeight: 1.45, resize: 'none'
            }}
            placeholder="Internal notes for purchasing"
          />
        </div>
      </div>
    </div>
  );
};

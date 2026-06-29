import React, { useEffect, useState } from 'react';
import type { ItemFormData } from '../types/itemFormTypes';
import type { CostingMethod } from '../../../../types/inventory';
import { loadWarehouses } from '../services/itemFormService';

interface Props {
  data: ItemFormData;
  onChange: <K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => void;
  errors: Record<string, string>;
}

export const InventorySection: React.FC<Props> = ({ data, onChange, errors }) => {
  const [warehouses, setWarehouses] = useState<any[]>([]);

  useEffect(() => {
    loadWarehouses().then(setWarehouses);
  }, []);

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.45, color: '#1E2A24' }}>
      <h3 style={{ fontSize: 20, fontWeight: 600, color: '#1E2A24', margin: '0 0 14px', lineHeight: 1.4 }}>Inventory Configuration</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Costing Method</label>
          <select
            value={data.costingMethod}
            onChange={e => onChange('costingMethod', e.target.value as CostingMethod)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
          >
            <option value="weighted_average">Weighted Average</option>
            <option value="fifo">FIFO</option>
            <option value="standard">Standard</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Warehouse</label>
          <select
            value={data.warehouseId}
            onChange={e => onChange('warehouseId', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
          >
            <option value="">Select warehouse</option>
            {warehouses.map((w: any) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Min Stock Level</label>
          <input
            type="number"
            min={0}
            value={data.minStockLevel}
            onChange={e => onChange('minStockLevel', Number(e.target.value))}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Max Stock Level</label>
          <input
            type="number"
            min={0}
            value={data.maxStockLevel}
            onChange={e => onChange('maxStockLevel', Number(e.target.value))}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Reorder Point</label>
          <input
            type="number"
            min={0}
            value={data.reorderPoint}
            onChange={e => onChange('reorderPoint', Number(e.target.value))}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
          />
        </div>
      </div>
    </div>
  );
};

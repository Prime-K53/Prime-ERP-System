import React from 'react';
import type { ItemFormData } from '../types/itemFormTypes';

interface Props {
  data: ItemFormData;
  onChange: <K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => void;
}

interface ToggleField {
  key: keyof ItemFormData;
  label: string;
  description: string;
}

const TRACKING_TOGGLES: ToggleField[] = [
  { key: 'lotTracking', label: 'Lot Tracking', description: 'Track by lot/batch number' },
  { key: 'serialTracking', label: 'Serial Tracking', description: 'Track individual serial numbers' },
  { key: 'expirationTracking', label: 'Expiration Tracking', description: 'Track expiry dates for lots' },
  { key: 'temperatureControlled', label: 'Temperature Controlled', description: 'Requires temperature monitoring' },
  { key: 'batchControlled', label: 'Batch Controlled', description: 'Track by production batch' },
  { key: 'hazardous', label: 'Hazardous Material', description: 'Requires special handling and storage' },
];

export const WarehouseSection: React.FC<Props> = ({ data, onChange }) => {
  return (
    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.45, color: '#1E2A24' }}>
      <h3 style={{ fontSize: 20, fontWeight: 600, color: '#1E2A24', margin: '0 0 14px', lineHeight: 1.4 }}>Warehouse & Storage</h3>

      {/* Location Hierarchy */}
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Warehouse</label>
          <input
            type="text"
            value={data.warehouseId}
            onChange={e => onChange('warehouseId', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="Warehouse name or ID"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Storage Location</label>
          <input
            type="text"
            value={data.storageLocation}
            onChange={e => onChange('storageLocation', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="e.g. Aisle 3, Shelf B"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Shelf / Rack</label>
          <input
            type="text"
            value={data.shelf}
            onChange={e => onChange('shelf', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="e.g. Rack-01, Shelf-A2"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Bin Location</label>
          <input
            type="text"
            value={data.binLocation || data.bin}
            onChange={e => { onChange('binLocation', e.target.value); onChange('bin', e.target.value); }}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="e.g. BIN-01-A"
          />
        </div>
      </div>

      {/* Barcode & QR */}
      <div style={{ borderTop: '1px solid #E5E8E1', paddingTop: 12, marginTop: 12 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1E2A24', margin: '0 0 10px', lineHeight: 1.4 }}>Barcode & QR Code</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Barcode</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={data.barcode}
                onChange={e => onChange('barcode', e.target.value)}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 7,
                  border: '1px solid #E5E8E1',
                  fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
                  color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
                }}
                placeholder="Manual entry or scan"
              />
              <button
                type="button"
                onClick={() => onChange('barcode', 'GEN-' + Date.now().toString(36).toUpperCase())}
                style={{
                  padding: '7px 10px', fontSize: 12, fontWeight: 600, borderRadius: 7,
                  border: 'none', background: '#128C72', color: 'white', cursor: 'pointer', lineHeight: 1.45
                }}
                title="Generate barcode"
              >
                Gen
              </button>
            </div>
            {data.barcode && (
              <p style={{ fontSize: 11, marginTop: 3, fontFamily: "'Inter',sans-serif", color: '#9CA59E', lineHeight: 1.4 }}>{data.barcode}</p>
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>QR Code</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={data.qrCode}
                onChange={e => onChange('qrCode', e.target.value)}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 7,
                  border: '1px solid #E5E8E1',
                  fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
                  color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
                }}
                placeholder="Manual entry or generate"
              />
              <button
                type="button"
                onClick={() => onChange('qrCode', 'QR-' + Date.now().toString(36).toUpperCase())}
                style={{
                  padding: '7px 10px', fontSize: 12, fontWeight: 600, borderRadius: 7,
                  border: 'none', background: '#128C72', color: 'white', cursor: 'pointer', lineHeight: 1.45
                }}
                title="Generate QR"
              >
                Gen
              </button>
            </div>
            {data.qrCode && (
              <p style={{ fontSize: 11, marginTop: 3, fontFamily: "'Inter',sans-serif", color: '#9CA59E', lineHeight: 1.4 }}>{data.qrCode}</p>
            )}
          </div>
        </div>
      </div>

      {/* Handling */}
      <div style={{ borderTop: '1px solid #E5E8E1', paddingTop: 12, marginTop: 12 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1E2A24', margin: '0 0 10px', lineHeight: 1.4 }}>Handling & Shelf Life</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Handling Instructions</label>
            <input
              type="text"
              value={data.handlingInstructions}
              onChange={e => onChange('handlingInstructions', e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 7,
                border: '1px solid #E5E8E1',
                fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
                color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
              }}
              placeholder="e.g. Fragile, Keep dry"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Shelf Life (days)</label>
            <input
              type="number"
              min={0}
              value={data.shelfLife}
              onChange={e => onChange('shelfLife', Number(e.target.value))}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 7,
                border: '1px solid #E5E8E1',
                fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
                color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Stacking Factor</label>
            <input
              type="number"
              min={1}
              step="any"
              value={data.stackingFactor}
              onChange={e => onChange('stackingFactor', Number(e.target.value))}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 7,
                border: '1px solid #E5E8E1',
                fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
                color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
              }}
              placeholder="Max layers"
            />
          </div>
        </div>
      </div>

      {/* Tracking Toggles */}
      <div style={{ borderTop: '1px solid #E5E8E1', paddingTop: 12, marginTop: 12 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1E2A24', margin: '0 0 10px', lineHeight: 1.4 }}>Tracking & Classification</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 10 }}>
          {TRACKING_TOGGLES.map(tf => (
            <label
              key={tf.key}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                borderRadius: 12, cursor: 'pointer', background: '#F6F7F2',
                transition: 'background .15s', lineHeight: 1.45
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#E9F1EA'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F6F7F2'; }}
            >
              <input
                type="checkbox"
                checked={!!(data[tf.key] as boolean)}
                onChange={e => onChange(tf.key, e.target.checked)}
                style={{ width: 14, height: 14, borderRadius: 3, accentColor: '#128C72', margin: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1E2A24', lineHeight: 1.45 }}>{tf.label}</div>
                <div style={{ fontSize: 10, color: '#9CA59E', lineHeight: 1.4 }}>{tf.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

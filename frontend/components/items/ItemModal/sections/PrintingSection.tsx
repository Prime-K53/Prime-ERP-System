import React from 'react';
import type { ItemFormData } from '../types/itemFormTypes';

interface Props {
  data: ItemFormData;
  onChange: <K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => void;
}

const PRINT_TYPES = [
  { value: 'digital', label: 'Digital Print' },
  { value: 'offset', label: 'Offset Print' },
  { value: 'large_format', label: 'Large Format' },
  { value: 'screen', label: 'Screen Printing' },
];

const SERVICE_TYPES = [
  { value: 'printing', label: 'General Printing' },
  { value: 'binding', label: 'Binding' },
  { value: 'lamination', label: 'Lamination' },
  { value: 'design', label: 'Design & Layout' },
  { value: 'finishing', label: 'Finishing Only' },
  { value: 'other', label: 'Other' },
];

const FINISHING_OPTIONS = [
  'Cutting', 'Folding', 'Binding', 'Stapling', 'Lamination',
  'Spiral Binding', 'Punching', 'Scoring', 'Perforating', 'Numbering',
];

export const PrintingSection: React.FC<Props> = ({ data, onChange }) => {
  const toggleFinishing = (opt: string) => {
    const current = data.printFinishing || [];
    const next = current.includes(opt) ? current.filter(x => x !== opt) : [...current, opt];
    onChange('printFinishing', next);
  };

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.45, color: '#1E2A24' }}>
      <h3 style={{ fontSize: 20, fontWeight: 600, color: '#1E2A24', margin: '0 0 14px', lineHeight: 1.4 }}>Printing Configuration</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Service Type</label>
          <select
            value={data.printingServiceType}
            onChange={e => onChange('printingServiceType', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
          >
            <option value="">Select service type</option>
            {SERVICE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Print Type</label>
          <select
            value={data.printType}
            onChange={e => onChange('printType', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
          >
            <option value="">Select print type</option>
            {PRINT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Color Mode</label>
          <select
            value={data.printColorMode}
            onChange={e => onChange('printColorMode', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
          >
            <option value="">Select color mode</option>
            <option value="bw">Black & White</option>
            <option value="color">Full Color</option>
            <option value="spot">Spot Color</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Sides</label>
          <select
            value={data.printSides}
            onChange={e => onChange('printSides', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
          >
            <option value="single">Single Sided</option>
            <option value="double">Double Sided</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Paper Size</label>
          <input
            type="text"
            value={data.printPaperSize || ''}
            onChange={e => onChange('printPaperSize', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="e.g. A4, A3, SRA3"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Est. Time (minutes)</label>
          <input
            type="number"
            min={0}
            value={data.estimatedTime || 0}
            onChange={e => onChange('estimatedTime', parseInt(e.target.value) || 0)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="0"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Default Machine</label>
          <input
            type="text"
            value={data.defaultMachine || ''}
            onChange={e => onChange('defaultMachine', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="e.g. HP Indigo, Heidelberg"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Default Labor</label>
          <input
            type="text"
            value={data.defaultLabor || ''}
            onChange={e => onChange('defaultLabor', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="e.g. Press Operator"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Department</label>
          <input
            type="text"
            value={data.productionDepartment || ''}
            onChange={e => onChange('productionDepartment', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="e.g. Digital Press, Bindery"
          />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 6, lineHeight: 1.45 }}>Finishing Options</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {FINISHING_OPTIONS.map(opt => {
            const active = (data.printFinishing || []).includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleFinishing(opt)}
                style={{
                  padding: '5px 10px', fontSize: 12, fontWeight: 500, borderRadius: 999,
                  border: active ? 'none' : '1px solid #E5E8E1',
                  background: active ? '#128C72' : 'white',
                  color: active ? 'white' : '#6C766F',
                  cursor: 'pointer', lineHeight: 1.45
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import type { Item } from '../../../types';
import type { ItemFormData } from '../types/itemFormTypes';
import { CLASSIFICATION_OPTIONS } from '../types/itemFormTypes';

interface Props {
  data: ItemFormData;
  onChange: <K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => void;
  errors: Record<string, string>;
  onGenerateSku?: (category: string) => string;
  classificationReadOnly?: boolean;
  allItems?: Item[];
}

export const BasicInformation: React.FC<Props> = ({ data, onChange, errors, onGenerateSku, classificationReadOnly, allItems }) => {
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const existingCategories = useMemo(() => {
    if (!allItems) return [];
    const cats = new Set<string>();
    allItems.forEach(item => { if (item.category) cats.add(item.category); });
    return Array.from(cats).sort();
  }, [allItems]);

  const handleCategorySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__new__') {
      setNewCategory('');
      setIsAddingCategory(true);
    } else {
      onChange('category', value);
    }
  };

  const handleNewCategorySave = () => {
    const trimmed = newCategory.trim();
    if (trimmed) {
      onChange('category', trimmed);
      setNewCategory('');
      setIsAddingCategory(false);
    }
  };

  const handleNewCategoryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNewCategorySave();
    } else if (e.key === 'Escape') {
      setIsAddingCategory(false);
      setNewCategory('');
    }
  };

  const handleCategoryBlur = () => {
    if (!data.code && data.category && onGenerateSku) {
      const sku = onGenerateSku(data.category);
      if (sku) onChange('code', sku);
    }
  };

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.45, color: '#1E2A24' }}>
      <h3 style={{ fontSize: 20, fontWeight: 600, color: '#1E2A24', margin: '0 0 14px', lineHeight: 1.4 }}>Basic Information</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Classification *</label>
          <select
            value={data.classification}
            onChange={e => onChange('classification', e.target.value)}
            disabled={classificationReadOnly}
            className={classificationReadOnly ? 'opacity-60 cursor-not-allowed' : ''}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: errors.classification ? '1px solid #B23A34' : '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: errors.classification ? '#FBEAE8' : 'white',
              outline: 'none', lineHeight: 1.45
            }}
          >
            {CLASSIFICATION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {errors.classification && <p style={{ fontSize: 12, color: '#B23A34', margin: '3px 0 0', lineHeight: 1.4 }}>{errors.classification}</p>}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Code / SKU *</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={data.code}
              onChange={e => onChange('code', e.target.value)}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 7,
                border: errors.code ? '1px solid #B23A34' : '1px solid #E5E8E1',
                fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
                color: '#1E2A24', background: errors.code ? '#FBEAE8' : 'white',
                outline: 'none', lineHeight: 1.45
              }}
              placeholder="e.g. RAW-A4-001"
            />
            <button
              type="button"
              onClick={() => {
                const sku = onGenerateSku?.(data.category) || '';
                if (sku) onChange('code', sku);
              }}
              title="Generate SKU"
              style={{
                padding: '7px 10px', borderRadius: 7, border: '1px solid #E5E8E1',
                background: 'white', color: '#6C766F', cursor: 'pointer', lineHeight: 1
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ display: 'block' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          {errors.code && <p style={{ fontSize: 12, color: '#B23A34', margin: '3px 0 0', lineHeight: 1.4 }}>{errors.code}</p>}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Name *</label>
          <input
            type="text"
            value={data.name}
            onChange={e => onChange('name', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: errors.name ? '1px solid #B23A34' : '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: errors.name ? '#FBEAE8' : 'white',
              outline: 'none', lineHeight: 1.45
            }}
            placeholder="e.g. A4 Paper 80gsm"
          />
          {errors.name && <p style={{ fontSize: 12, color: '#B23A34', margin: '3px 0 0', lineHeight: 1.4 }}>{errors.name}</p>}
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Description</label>
          <textarea
            value={data.description}
            onChange={e => onChange('description', e.target.value)}
            rows={3}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none',
              lineHeight: 1.45, resize: 'none'
            }}
            placeholder="Optional description"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Brand</label>
          <input
            type="text"
            value={data.brand}
            onChange={e => onChange('brand', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="e.g. HP, Canon"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Category</label>
          {isAddingCategory ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                onKeyDown={handleNewCategoryKeyDown}
                onBlur={handleNewCategorySave}
                autoFocus
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 7,
                  border: '1px solid #E5E8E1',
                  fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
                  color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
                }}
                placeholder="New category name"
              />
              <button
                type="button"
                onClick={handleNewCategorySave}
                style={{
                  padding: '7px 10px', borderRadius: 7, border: '1px solid #128C72',
                  background: '#128C72', color: 'white', cursor: 'pointer',
                  fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 500,
                  lineHeight: 1, whiteSpace: 'nowrap'
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setIsAddingCategory(false); setNewCategory(''); }}
                style={{
                  padding: '7px 10px', borderRadius: 7, border: '1px solid #E5E8E1',
                  background: 'white', color: '#6C766F', cursor: 'pointer',
                  fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 500,
                  lineHeight: 1
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={data.category || ''}
                onChange={handleCategorySelect}
                onBlur={handleCategoryBlur}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 7,
                  border: '1px solid #E5E8E1',
                  fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
                  color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
                }}
              >
                <option value="">Select category</option>
                {existingCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__new__">+ Add new category</option>
              </select>
            </div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Tags</label>
          <input
            type="text"
            value={data.tags}
            onChange={e => onChange('tags', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="Comma separated"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Status</label>
          <select
            value={data.status}
            onChange={e => onChange('status', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      </div>
    </div>
  );
};

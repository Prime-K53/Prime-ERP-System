import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { ItemFormData } from '../types/itemFormTypes';
import { loadBomTemplates, loadServiceRecipes } from '../services/itemFormService';
import { BOMConfigurator } from '../components/BOMConfigurator';
import type { Item } from '../../../../types';

interface Props {
  data: ItemFormData;
  onChange: <K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => void;
  onOpenRecipeEditor: () => void;
  allItems?: Item[];
}

interface RecipeOption {
  id: string;
  name: string;
  type: 'bom' | 'service_recipe';
  version?: string;
  lastModified?: string;
  active?: boolean;
  costSummary?: string;
}

export const RecipeSection: React.FC<Props> = ({ data, onChange, onOpenRecipeEditor, allItems }) => {
  const [options, setOptions] = useState<RecipeOption[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isBom = data.classification === 'product';
  const isServiceRecipe = data.classification === 'printing_service';

  useEffect(() => {
    const load = async () => {
      if (isBom) {
        const boms = await loadBomTemplates();
        setOptions(boms.map((b: any) => ({
          id: b.id,
          name: b.name || b.sku || b.id,
          type: 'bom' as const,
          version: b.bomVersion || b.pricingVersion?.toString(),
          lastModified: b.validationTimestamp,
          active: b.status === 'Active',
          costSummary: b.costPrice ? `${b.costPrice}` : undefined,
        })));
      } else if (isServiceRecipe) {
        const recipes = await loadServiceRecipes();
        setOptions((recipes || []).map((r: any) => ({
          id: r.id,
          name: r.name || r.sku || r.id,
          type: 'service_recipe' as const,
          version: r.version?.toString(),
          lastModified: r.updatedAt || r.createdAt,
          active: r.active !== false,
          costSummary: r.cost ? `${r.cost}` : undefined,
        })));
      } else {
        setOptions([]);
      }
    };
    load();
  }, [isBom, isServiceRecipe]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = options.find(o => o.id === data.recipeId);
  const filtered = options.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (opt: RecipeOption) => {
    onChange('recipeId', opt.id);
    onChange('recipeType', opt.type);
    if (opt.type === 'service_recipe') {
      onChange('serviceRecipeId', opt.id);
    }
    if (opt.costSummary) {
      const cost = parseFloat(opt.costSummary);
      if (!isNaN(cost)) {
        onChange('costPrice', cost);
      }
    }
    setSearch('');
    setOpen(false);
  };

  const handleCostChange = useCallback((cost: number, sellingPrice: number, _breakdown: any[]) => {
    onChange('costPrice', cost);
    onChange('sellingPrice', sellingPrice);
  }, [onChange]);

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.45, color: '#1E2A24' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 20, fontWeight: 600, color: '#1E2A24', margin: '0 0 14px', lineHeight: 1.4 }}>
          {isServiceRecipe ? 'Service Recipe' : isBom ? 'Bill of Materials' : 'Recipe / BOM'}
        </h3>
        <button
          type="button"
          onClick={onOpenRecipeEditor}
          style={{
            padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 7,
            border: 'none', background: '#128C72', color: 'white', cursor: 'pointer', lineHeight: 1.45
          }}
        >
          Open Editor
        </button>
      </div>

      <p style={{ fontSize: 13, color: '#6C766F', margin: '0 0 10px', lineHeight: 1.45 }}>
        {isServiceRecipe
          ? 'Select the service recipe this printing service links to.'
          : isBom
          ? 'Select the Bill of Materials for this manufactured product.'
          : 'Recipe linking is not available for this item type.'}
      </p>

      {(isBom || isServiceRecipe) && (
        <div ref={ref} style={{ position: 'relative' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>
            {isServiceRecipe ? 'Search Service Recipe' : 'Search BOM'}
          </label>
          <input
            type="text"
            value={open ? search : (selected?.name || '')}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder={isServiceRecipe ? 'Type to search service recipes...' : 'Type to search BOMs...'}
          />
          {open && filtered.length > 0 && (
            <div style={{
              position: 'absolute', zIndex: 10, marginTop: 4, width: '100%',
              background: 'white', border: '1px solid #E5E8E1', borderRadius: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,.08)', maxHeight: 240, overflowY: 'auto'
            }}>
              {filtered.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 13,
                    background: 'none', border: 'none', cursor: 'pointer', color: '#1E2A24',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', lineHeight: 1.45
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F6F7F2'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1E2A24', fontSize: 13 }}>{opt.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{
                        fontSize: 10, padding: '1px 5px', borderRadius: 999, fontWeight: 600,
                        background: opt.type === 'bom' ? '#DCF0EA' : '#F0F0F5',
                        color: opt.type === 'bom' ? '#128C72' : '#6B6B9C'
                      }}>
                        {opt.type === 'bom' ? 'BOM' : 'Service Recipe'}
                      </span>
                      {opt.version && <span style={{ fontSize: 10, color: '#9CA59E' }}>v{opt.version}</span>}
                      {opt.active === false && <span style={{ fontSize: 10, color: '#B23A34' }}>Inactive</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: 10, flexShrink: 0 }}>
                    {opt.costSummary && (
                      <div style={{ fontSize: 12, fontFamily: "'Inter',sans-serif", color: '#6C766F', fontVariantNumeric: 'tabular-nums' }}>{opt.costSummary}</div>
                    )}
                    {opt.lastModified && (
                      <div style={{ fontSize: 10, color: '#9CA59E' }}>{new Date(opt.lastModified).toLocaleDateString()}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          {open && filtered.length === 0 && (
            <div style={{
              position: 'absolute', zIndex: 10, marginTop: 4, width: '100%',
              background: 'white', border: '1px solid #E5E8E1', borderRadius: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,.08)', padding: 10, fontSize: 13, textAlign: 'center', color: '#9CA59E'
            }}>
              No {isServiceRecipe ? 'service recipes' : 'BOMs'} found
            </div>
          )}
        </div>
      )}

      {selected && (
        <div style={{ borderRadius: 12, padding: 12, background: '#F6F7F2', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600,
              background: selected.type === 'bom' ? '#DCF0EA' : '#F0F0F5',
              color: selected.type === 'bom' ? '#128C72' : '#6B6B9C'
            }}>
              {selected.type === 'bom' ? 'BOM' : 'Service Recipe'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1E2A24' }}>{selected.name}</span>
          </div>
          {selected.version && <p style={{ fontSize: 12, color: '#6C766F', margin: '4px 0 0', lineHeight: 1.45 }}>Version: {selected.version}</p>}
          {selected.lastModified && (
            <p style={{ fontSize: 12, color: '#6C766F', margin: '2px 0 0', lineHeight: 1.45 }}>Last Modified: {new Date(selected.lastModified).toLocaleString()}</p>
          )}
          {selected.costSummary && <p style={{ fontSize: 12, color: '#6C766F', margin: '2px 0 0', lineHeight: 1.45, fontVariantNumeric: 'tabular-nums' }}>Cost: {selected.costSummary}</p>}
          {selected.active === false && (
            <p style={{ fontSize: 12, fontWeight: 600, color: '#B23A34', margin: '4px 0 0', lineHeight: 1.45 }}>Inactive Recipe</p>
          )}
        </div>
      )}

      {selected && selected.type === 'bom' && allItems && (
        <BOMConfigurator
          bomTemplateId={selected.id}
          inventory={allItems}
          minimumMargin={data.minimumMargin || 20}
          onCostChange={handleCostChange}
        />
      )}

      {!selected && (isBom || isServiceRecipe) && (
        <p style={{ fontSize: 12, fontWeight: 600, color: '#B76E00', margin: '8px 0 0', lineHeight: 1.45 }}>No recipe selected. Select one above or create a new one in the editor.</p>
      )}
    </div>
  );
};

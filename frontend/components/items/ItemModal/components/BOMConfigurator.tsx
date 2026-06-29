import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SafeFormulaEngine } from '../../../../services/formulaEngine';
import { dbService } from '../../../../services/db';
import type { Item } from '../../../../types';

interface ComponentCost {
  name: string;
  formula: string;
  unit: string;
  computedQty: number;
  unitCost: number;
  lineTotal: number;
}

interface Props {
  bomTemplateId: string;
  inventory: Item[];
  minimumMargin: number;
  onCostChange: (cost: number, sellingPrice: number, breakdown: ComponentCost[]) => void;
}

const VARIABLE_LABELS: Record<string, string> = {
  pages: 'Pages',
  pageCount: 'Pages',
  quantity: 'Quantity',
  copies: 'Copies',
  totalPages: 'Total Pages',
  total_pages: 'Total Pages',
  sheetsPerCopy: 'Sheets / Copy',
  sheets_per_copy: 'Sheets / Copy',
  totalSheets: 'Total Sheets',
  total_sheets: 'Total Sheets',
};

const FUNCTION_NAMES = new Set([
  'Math', 'ceil', 'floor', 'round', 'min', 'max', 'abs', 'sqrt', 'pow',
  'parseInt', 'parseFloat', 'Number', 'String', 'Boolean', 'Array',
]);

function extractVariables(formulas: string[]): string[] {
  const varSet = new Set<string>();
  for (const f of formulas) {
    if (!f) continue;
    const tokens = f.match(/[a-zA-Z_]\w*/g) || [];
    for (const t of tokens) {
      if (!FUNCTION_NAMES.has(t)) varSet.add(t);
    }
  }
  return Array.from(varSet);
}

function wrapVariable(name: string): string {
  const label = VARIABLE_LABELS[name] || name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return label;
}

export const BOMConfigurator: React.FC<Props> = ({
  bomTemplateId,
  inventory,
  minimumMargin,
  onCostChange,
}) => {
  const [template, setTemplate] = useState<any>(null);
  const [values, setValues] = useState<Record<string, number>>({
    pages: 1,
    quantity: 1,
    copies: 1,
  });
  const [overrideCosts, setOverrideCosts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!bomTemplateId) { setTemplate(null); return; }
    (async () => {
      const t = await dbService.get<any>('bomTemplates', bomTemplateId);
      setTemplate(t);
    })();
  }, [bomTemplateId]);

  const formulas = useMemo(() => {
    return (template?.components || []).map((c: any) => c.formula || c.quantityFormula || '');
  }, [template]);

  const variables = useMemo(() => {
    const extracted = extractVariables(formulas);
    return Array.from(new Set(['pages', 'quantity', 'copies', ...extracted]));
  }, [formulas]);

  const handleValueChange = useCallback((name: string, val: number) => {
    setValues(prev => ({ ...prev, [name]: Math.max(0, val) }));
  }, []);

  const handleOverrideCost = useCallback((idx: number, val: number) => {
    setOverrideCosts(prev => ({ ...prev, [String(idx)]: val }));
  }, []);

  const breakdown = useMemo((): ComponentCost[] => {
    if (!template?.components) return [];
    return template.components.map((comp: any, idx: number) => {
      const formula = comp.formula || comp.quantityFormula || '1';
      const material = inventory.find(i => i.id === comp.itemId || i.name === comp.name);
      const computedQty = SafeFormulaEngine.evaluate(formula, values);
      const key = String(idx);
      const unitCost = key in overrideCosts
        ? overrideCosts[key]
        : (comp.costPerUnit ?? material?.cost ?? 0);
      return {
        name: comp.name || material?.name || `Component ${idx + 1}`,
        formula,
        unit: comp.unit || material?.unit || 'pcs',
        computedQty,
        unitCost,
        lineTotal: computedQty * unitCost,
      };
    });
  }, [template, inventory, values, overrideCosts]);

  const totalJobCost = useMemo(() => breakdown.reduce((s, c) => s + c.lineTotal, 0), [breakdown]);
  const jobQty = values.quantity || 1;
  const costPerUnit = useMemo(() => totalJobCost / jobQty, [totalJobCost, jobQty]);
  const sellingPricePerUnit = useMemo(() => {
    if (minimumMargin <= 0 || costPerUnit <= 0) return costPerUnit;
    return costPerUnit / (1 - minimumMargin / 100);
  }, [costPerUnit, minimumMargin]);
  const totalSellingPrice = sellingPricePerUnit * jobQty;

  useEffect(() => {
    onCostChange(costPerUnit, sellingPricePerUnit, breakdown);
  }, [costPerUnit, sellingPricePerUnit, breakdown, onCostChange]);

  if (!bomTemplateId || !template) return null;

  const comps = template.components || [];
  const hasFormulas = variables.length > 0;

  return (
    <div style={{
      borderRadius: 12, border: '1px solid #E5E8E1', background: 'white',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 14px', background: '#F6F7F2',
        borderBottom: '1px solid #E5E8E1',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1E2A24' }}>{template.name}</span>
          {template.type && (
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 999, fontWeight: 600,
              background: '#DCF0EA', color: '#128C72', marginLeft: 8,
            }}>
              {template.type}
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: '#6C766F' }}>{comps.length} components</span>
      </div>

      <div style={{ padding: '12px 14px' }}>
        {hasFormulas && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8, marginBottom: 12,
          }}>
            {variables.map(name => (
              <div key={name}>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 500,
                  color: '#6C766F', marginBottom: 2, lineHeight: 1.4,
                }}>
                  {wrapVariable(name)}
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={values[name] ?? 0}
                  onChange={e => handleValueChange(name, Number(e.target.value))}
                  style={{
                    width: '100%', padding: '5px 8px', borderRadius: 6,
                    border: '1px solid #E5E8E1',
                    fontFamily: "'IBM Plex Mono','Courier New',monospace",
                    fontSize: 12, fontWeight: 400,
                    color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.4,
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <div style={{
          borderRadius: 8, border: '1px solid #E5E8E1', overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F6F7F2' }}>
                <th style={thStyle}>Component</th>
                <th style={thStyle}>Formula</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Unit</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Cost/Unit</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F0F1F0' }}>
                  <td style={tdStyle}>{c.name}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, color: '#64748B' }}>{c.formula}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'IBM Plex Mono','Courier New',monospace" }}>{Number.isFinite(c.computedQty) ? c.computedQty.toFixed(2) : '\u2014'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#64748B' }}>{c.unit}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={c.unitCost}
                      onChange={e => handleOverrideCost(i, Number(e.target.value))}
                      style={{
                        width: '100%', padding: '2px 4px', borderRadius: 4,
                        border: '1px solid #E5E8E1',
                        fontFamily: "'IBM Plex Mono','Courier New',monospace",
                        fontSize: 12, fontWeight: 400,
                        color: '#1E2A24', background: 'white', outline: 'none',
                        lineHeight: 1.4, textAlign: 'right',
                      }}
                    />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontFamily: "'IBM Plex Mono','Courier New',monospace" }}>
                    {c.lineTotal.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 24,
          marginTop: 10, padding: '8px 12px', background: '#F6F7F2',
          borderRadius: 8, fontSize: 12,
        }}>
          <div>
            <span style={{ color: '#6C766F', fontWeight: 500 }}>CP/Unit: </span>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1E2A24', fontFamily: "'IBM Plex Mono','Courier New',monospace" }}>
              {costPerUnit.toFixed(3)}
            </span>
          </div>
          {jobQty > 1 && (
            <div>
              <span style={{ color: '#6C766F', fontWeight: 500 }}>Total Job: </span>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#475569', fontFamily: "'IBM Plex Mono','Courier New',monospace" }}>
                {totalJobCost.toFixed(3)}
              </span>
            </div>
          )}
          {minimumMargin > 0 && costPerUnit > 0 && (
            <div>
              <span style={{ color: '#6C766F', fontWeight: 500 }}>SP/Unit ({minimumMargin}%): </span>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#128C72', fontFamily: "'IBM Plex Mono','Courier New',monospace" }}>
                {sellingPricePerUnit.toFixed(3)}
              </span>
            </div>
          )}
          {minimumMargin > 0 && costPerUnit > 0 && jobQty > 1 && (
            <div>
              <span style={{ color: '#6C766F', fontWeight: 500 }}>Total SP: </span>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#0F973D', fontFamily: "'IBM Plex Mono','Courier New',monospace" }}>
                {totalSellingPrice.toFixed(3)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: 10, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '-0.025em',
  color: '#475569', textAlign: 'left', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px', color: '#1E2A24', lineHeight: 1.4,
};

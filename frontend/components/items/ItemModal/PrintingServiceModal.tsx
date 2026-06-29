import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Item, FinishingOption } from '../../../types';
import { dbService } from '../../../services/db';

interface Props {
  item?: Item | null;
  onSave: (item: Item) => Promise<void>;
  onClose: () => void;
  allItems?: Item[];
  lockClassification?: boolean;
}

type PrintingTab = 'general' | 'specs' | 'materials' | 'pricing' | 'variants';

const TABS: { key: PrintingTab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'specs', label: 'Print Specifications' },
  { key: 'materials', label: 'Materials' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'variants', label: 'Variants' },
];

const PRINT_METHODS = ['Digital', 'Offset', 'Large Format', 'Screen Printing', 'UV Printing', 'Sublimation', 'Flexographic', 'Letterpress'];
const CATEGORIES = ['Business Cards', 'Flyers', 'Brochures', 'Posters', 'Books', 'Magazines', 'Stickers', 'Packaging', 'Labels', 'Certificates', 'Calendars', 'Banners', 'Receipt Books', 'Photocopying', 'Graphic Design'];

const defaultFinishingOptions: FinishingOption[] = [
  { id: 'binding', name: 'Binding', enabled: false, price: 150, description: 'Book binding - comb or spiral', items: [] },
  { id: 'coverPages', name: 'Cover Pages', enabled: false, price: 20, description: 'Front and back cover pages per copy', items: [] },
  { id: 'cutting', name: 'Cutting & Trimming', enabled: false, price: 30, description: 'Trim edges to clean finish', items: [] },
  { id: 'holePunch', name: 'Hole Punching', enabled: false, price: 20, description: 'Punch holes for folder binding', items: [] },
  { id: 'folding', name: 'Folding', enabled: false, price: 15, description: 'Fold pages for insertion', items: [] },
  { id: 'stapling', name: 'Stapling', enabled: false, price: 10, description: 'Corner or saddle stapling', items: [] },
];
interface MaterialRow {
  id: string;
  material: string;
  warehouse: string;
  unit: string;
  usagePerCopy: number;
  wastePct: number;
  stock: number;
  cost: number;
}

interface PricingTier {
  minQty: number;
  maxQty: number;
  price: number;
  discount: number;
  prodTime: string;
}

interface MaterialCost {
  paper: number;
  ink: number;
  glue: number;
  binding: number;
  packaging: number;
  other: number;
}

const inputClass = "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all";
const labelClass = "block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5";
const cardClass = "bg-white rounded-xl border border-slate-200 p-5 shadow-sm";
const selectClass = "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all appearance-none cursor-pointer";

export const PrintingServiceModal: React.FC<Props> = ({ item, onSave, onClose, allItems }) => {
  const [activeTab, setActiveTab] = useState<PrintingTab>('general');
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(true);
  const [isFav, setIsFav] = useState(false);

  const [form, setForm] = useState<Record<string, any>>(() => ({
    name: item?.name || '',
    code: item?.sku || `SRV-${Date.now().toString(36).toUpperCase()}`,
    category: item?.category || '',
    department: (item as any)?.productionDepartment || '',
    description: item?.description || '',
    internalNotes: (item as any)?.internalNotes || '',
    keywords: '',
    searchTags: '',
    image: (item as any)?.image || '',

    printMethod: (item as any)?.printType || '',
    colorMode: (item as any)?.printColorMode || '',
    printSides: (item as any)?.printSides || 'single',
    orientation: 'portrait',
    paperSize: (item as any)?.printPaperSize || '',
    customWidth: '',
    customHeight: '',
    customUnit: 'mm',
    paperType: '',
    gsm: '',
    bleed: false,
    safeMargin: false,
    cropMarks: false,
    resolution: '300 DPI',
    finishingOptions: structuredClone(defaultFinishingOptions).map(o => ({
      ...o,
      enabled: (item as any)?.printFinishing?.some?.((f: any) => typeof f === 'string' ? f === o.name : f.id === o.id) ?? false,
      price: (item as any)?.printFinishing?.find?.((f: any) => typeof f === 'object' && f.id === o.id)?.price ?? o.price,
    })),
    paperCost: (item as any)?.paperCost ?? 0,
    tonerCost: (item as any)?.tonerCost ?? 0,

    materials: [] as MaterialRow[],
    materialCosts: { paper: 0, ink: 0, glue: 0, binding: 0, packaging: 0, other: 0 } as MaterialCost,

    pricingStrategy: 'fixed',
    setupCost: 0,
    machineCost: 0,
    labourCost: 0,
    inkCost: 0,
    materialCost: 0,
    finishingCost: 0,
    packagingCost: 0,
    deliveryCost: 0,
    markupPct: 20,
    marginPct: 0,
    minimumCharge: 0,
    maxDiscount: 0,
    vatRate: 0,
    taxGroup: '',
    currency: 'KWD',
    pricingTiers: [] as PricingTier[],

    machine: '',
    speedSheetsPerHour: 0,
    setupTime: 0,
    prodTime: 0,
    finishingTime: 0,
    wastePct: 3,
    qcRequired: false,
    machineOperator: '',
    prodDepartment: '',
    priority: 'medium',

    acceptedFormats: ['PDF', 'AI', 'PSD', 'EPS', 'SVG', 'CDR', 'PNG', 'JPEG', 'TIFF', 'DOCX'],
    maxUploadSize: 50,
    artworkApproval: false,
    digitalProof: false,
    printedProof: false,
    preflightCheck: false,

    variantsEnabled: false,
    variantAttributes: [] as string[],
    variants: [] as any[],

    rushOrderPct: 0,
    productionBuffer: 0,
    wastePctAdvanced: 3,
    onlineOrdering: true,
    availableForQuotation: true,
    requireApproval: false,
    allowDiscounts: true,
    allowNegotiation: false,
    customerPortalVisibility: true,
    defaultTurnaround: 3,
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    prodNotes: '',
    internalInstructions: '',
    barcode: '',
    qrCode: '',
  }));

  useEffect(() => {
    (async () => {
      try {
        const savedCosts = await dbService.getSetting<Record<string, number>>('finishingOptionCosts');
        if (savedCosts) {
          setForm(prev => ({
            ...prev,
            finishingOptions: prev.finishingOptions.map(o => ({
              ...o,
              price: savedCosts[o.id] ?? o.price,
            })),
          }));
        }
      } catch {}
    })();
  }, []);

  const update = useCallback(<K extends string>(key: K, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleFinishing = useCallback((id: string) => {
    setForm(prev => ({
      ...prev,
      finishingOptions: prev.finishingOptions.map(o =>
        o.id === id ? { ...o, enabled: !o.enabled } : o
      ),
    }));
  }, []);

  const updateFinishingPrice = useCallback((id: string, price: number) => {
    setForm(prev => ({
      ...prev,
      finishingOptions: prev.finishingOptions.map(o =>
        o.id === id ? { ...o, price } : o
      ),
    }));
  }, []);

  const toggleFormat = useCallback((fmt: string) => {
    setForm(prev => ({
      ...prev,
      acceptedFormats: prev.acceptedFormats.includes(fmt) ? prev.acceptedFormats.filter((x: string) => x !== fmt) : [...prev.acceptedFormats, fmt],
    }));
  }, []);

  const finishingTotalCost = useMemo(() => {
    return form.finishingOptions
      .filter((o: FinishingOption) => o.enabled)
      .reduce((sum: number, o: FinishingOption) => sum + Number(o.price), 0);
  }, [form.finishingOptions]);

  const totalMaterialCost = useMemo(() => {
    return form.materials.reduce((sum: number, m: MaterialRow) => sum + (m.cost * m.usagePerCopy * (1 + m.wastePct / 100)), 0);
  }, [form.materials]);

  const productionCost = useMemo(() => {
    return Number(form.setupCost) + Number(form.machineCost) + Number(form.labourCost) + Number(form.finishingCost) + Number(form.packagingCost) + Number(form.deliveryCost);
  }, [form]);

  const totalCost = useMemo(() => {
    return totalMaterialCost + productionCost + Number(form.inkCost) + Number(form.paperCost) + Number(form.tonerCost) + finishingTotalCost;
  }, [totalMaterialCost, productionCost, form.inkCost, form.paperCost, form.tonerCost, finishingTotalCost]);

  const sellingPrice = useMemo(() => {
    const markup = Number(form.markupPct) / 100;
    return totalCost * (1 + markup);
  }, [totalCost, form.markupPct]);

  const profitAmount = useMemo(() => sellingPrice - totalCost, [sellingPrice, totalCost]);
  const marginPct = useMemo(() => sellingPrice > 0 ? (profitAmount / sellingPrice) * 100 : 0, [sellingPrice, profitAmount]);

  const addMaterial = useCallback(() => {
    setForm(prev => ({
      ...prev,
      materials: [...prev.materials, { id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, material: '', warehouse: '', unit: 'sheet', usagePerCopy: 1, wastePct: 3, stock: 0, cost: 0 }],
    }));
  }, []);

  const updateMaterial = useCallback((id: string, key: string, value: any) => {
    setForm(prev => ({
      ...prev,
      materials: prev.materials.map((m: MaterialRow) => m.id === id ? { ...m, [key]: value } : m),
    }));
  }, []);

  const removeMaterial = useCallback((id: string) => {
    setForm(prev => ({ ...prev, materials: prev.materials.filter((m: MaterialRow) => m.id !== id) }));
  }, []);

  const addTier = useCallback(() => {
    const tiers = form.pricingTiers as PricingTier[];
    const last = tiers[tiers.length - 1];
    const nextMin = last ? last.maxQty + 1 : 1;
    setForm(prev => ({
      ...prev,
      pricingTiers: [...prev.pricingTiers, { minQty: nextMin, maxQty: nextMin + 49, price: sellingPrice, discount: 0, prodTime: '1 day' }],
    }));
  }, [form.pricingTiers, sellingPrice]);

  const updateTier = useCallback((idx: number, key: string, value: any) => {
    setForm(prev => ({
      ...prev,
      pricingTiers: prev.pricingTiers.map((t: PricingTier, i: number) => i === idx ? { ...t, [key]: value } : t),
    }));
  }, []);

  const removeTier = useCallback((idx: number) => {
    setForm(prev => ({ ...prev, pricingTiers: prev.pricingTiers.filter((_: any, i: number) => i !== idx) }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const finalItem: Item & Record<string, unknown> = {
        ...item,
        id: item?.id || '',
        name: form.name,
        sku: form.code,
        type: 'Service',
        category: form.category,
        description: form.description,
        unit: 'pcs',
        costPrice: totalCost,
        sellingPrice: sellingPrice,
        price: sellingPrice,
        cost: totalCost,
        status: active ? 'Active' : 'Inactive',
        productType: 'SERVICE',
        inventoryRole: 'sellable',

        printType: form.printMethod,
        printColorMode: form.colorMode,
        printSides: form.printSides,
        printPaperSize: form.paperSize,
        printFinishing: form.finishingOptions.filter((o: FinishingOption) => o.enabled).map((o: FinishingOption) => ({ id: o.id, name: o.name, price: o.price })),
        paperCost: form.paperCost,
        tonerCost: form.tonerCost,
        printingServiceType: form.category?.toLowerCase().replace(/\s+/g, '_') || 'printing',
        estimatedTime: Number(form.setupTime) + Number(form.prodTime) + Number(form.finishingTime),
        defaultMachine: form.machine,
        defaultLabor: form.machineOperator,
        productionDepartment: form.prodDepartment,

        _printingForm: form,
      } as unknown as Item & Record<string, unknown>;
      await onSave(finalItem as Item);
    } finally {
      setSaving(false);
    }
  };

  const renderGeneralTab = () => (
    <div className="space-y-6">
      <div className={cardClass}>
        <h4 className="text-sm font-bold text-slate-800 mb-4">Service Information</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>Service Name *</label>
            <input className={inputClass} value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. A4 Full Colour Flyers" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>Service Code</label>
            <input className={inputClass} value={form.code} onChange={e => update('code', e.target.value)} placeholder="Auto-generated" />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select className={selectClass} value={form.category} onChange={e => update('category', e.target.value)}>
              <option value="">Select category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Department</label>
            <input className={inputClass} value={form.department} onChange={e => update('department', e.target.value)} placeholder="e.g. Digital Press" />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Description</label>
            <textarea className={`${inputClass} resize-none`} rows={3} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Service description for customer-facing documents" />
          </div>
          <div>
            <label className={labelClass}>Internal Notes</label>
            <textarea className={`${inputClass} resize-none`} rows={2} value={form.internalNotes} onChange={e => update('internalNotes', e.target.value)} placeholder="Internal notes" />
          </div>
          <div>
            <label className={labelClass}>Keywords / Search Tags</label>
            <input className={inputClass} value={form.searchTags} onChange={e => update('searchTags', e.target.value)} placeholder="e.g. flyers, business cards, brochures" />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Service Image</label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-blue-300 transition-colors cursor-pointer bg-slate-50/50">
              <svg className="w-8 h-8 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <p className="text-xs text-slate-400">Drag & drop an image or click to browse</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSpecsTab = () => (
    <div className="space-y-6">
      <div className={cardClass}>
        <h4 className="text-sm font-bold text-slate-800 mb-4">Printing Method</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRINT_METHODS.map(m => (
            <button key={m} type="button" onClick={() => update('printMethod', m)}
              className={`px-4 py-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${form.printMethod === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={cardClass}>
          <h4 className="text-sm font-bold text-slate-800 mb-4">Color</h4>
          <div className="space-y-2">
            {['Black & White', 'Full Colour CMYK', 'Pantone', 'Spot Colour'].map(c => (
              <label key={c} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                <input type="radio" name="colorMode" checked={form.colorMode === c} onChange={() => update('colorMode', c)} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                <span className="text-sm text-slate-700">{c}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={cardClass}>
          <h4 className="text-sm font-bold text-slate-800 mb-4">Layout</h4>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Sides</label>
              <div className="flex gap-3">
                {['single', 'double'].map(s => (
                  <button key={s} type="button" onClick={() => update('printSides', s)}
                    className={`flex-1 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${form.printSides === s ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                    {s === 'single' ? 'Single Side' : 'Double Side'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={cardClass}>
          <h4 className="text-sm font-bold text-slate-800 mb-4">Paper & Toner Charges</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Paper Cost (per job)</label>
              <input className={inputClass} type="number" min={0} step="0.01" value={form.paperCost} onChange={e => update('paperCost', parseFloat(e.target.value) || 0)} placeholder="0.00" />
            </div>
            <div>
              <label className={labelClass}>Toner Cost (per job)</label>
              <input className={inputClass} type="number" min={0} step="0.01" value={form.tonerCost} onChange={e => update('tonerCost', parseFloat(e.target.value) || 0)} placeholder="0.00" />
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <h4 className="text-sm font-bold text-slate-800 mb-4">Finishing Options</h4>
          <p className="text-[11px] text-slate-400 mb-3">Per-unit costs shared with Smart Pricing</p>
          <div className="space-y-2">
            {form.finishingOptions.map((opt: FinishingOption) => (
              <div key={opt.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors">
                <input type="checkbox" checked={opt.enabled} onChange={() => toggleFinishing(opt.id)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-slate-700 flex-1">{opt.name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400">K</span>
                  <input type="number" min={0} step="0.5" value={opt.price}
                    onChange={e => updateFinishingPrice(opt.id, parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 rounded border border-slate-200 text-xs text-right font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-400 outline-none" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderMaterialsTab = () => (
    <div className="space-y-6">
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-slate-800">Material Consumption</h4>
          <button type="button" onClick={addMaterial} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Material
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2.5 px-3 font-semibold text-slate-500">Material</th>
                <th className="text-left py-2.5 px-3 font-semibold text-slate-500">Warehouse</th>
                <th className="text-left py-2.5 px-3 font-semibold text-slate-500">Unit</th>
                <th className="text-right py-2.5 px-3 font-semibold text-slate-500">Usage/Copy</th>
                <th className="text-right py-2.5 px-3 font-semibold text-slate-500">Waste %</th>
                <th className="text-right py-2.5 px-3 font-semibold text-slate-500">Stock</th>
                <th className="text-right py-2.5 px-3 font-semibold text-slate-500">Cost</th>
                <th className="text-right py-2.5 px-3 font-semibold text-slate-500">Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {form.materials.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-slate-400">No materials added. Click "Add Material" to begin.</td></tr>
              ) : form.materials.map((m: MaterialRow) => (
                <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3 py-2"><input className={inputClass} value={m.material} onChange={e => updateMaterial(m.id, 'material', e.target.value)} placeholder="e.g. Paper, Ink" /></td>
                  <td className="px-3 py-2"><input className={inputClass} value={m.warehouse} onChange={e => updateMaterial(m.id, 'warehouse', e.target.value)} /></td>
                  <td className="px-3 py-2"><select className={selectClass} value={m.unit} onChange={e => updateMaterial(m.id, 'unit', e.target.value)}><option value="sheet">sheet</option><option value="kg">kg</option><option value="liter">liter</option><option value="m">m</option><option value="roll">roll</option></select></td>
                  <td className="px-3 py-2"><input className={`${inputClass} text-right`} type="number" min={0} step="0.01" value={m.usagePerCopy} onChange={e => updateMaterial(m.id, 'usagePerCopy', parseFloat(e.target.value) || 0)} /></td>
                  <td className="px-3 py-2"><input className={`${inputClass} text-right`} type="number" min={0} step="0.1" value={m.wastePct} onChange={e => updateMaterial(m.id, 'wastePct', parseFloat(e.target.value) || 0)} /></td>
                  <td className="px-3 py-2 text-right font-mono text-slate-600">{m.stock}</td>
                  <td className="px-3 py-2"><input className={`${inputClass} text-right`} type="number" min={0} step="0.001" value={m.cost} onChange={e => updateMaterial(m.id, 'cost', parseFloat(e.target.value) || 0)} /></td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">{(m.cost * m.usagePerCopy * (1 + m.wastePct / 100)).toFixed(3)}</td>
                  <td className="px-3 py-2"><button type="button" onClick={() => removeMaterial(m.id)} className="text-slate-300 hover:text-red-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={7} className="px-3 py-3 text-right text-slate-700">Total Material Cost</td>
                <td className="px-3 py-3 text-right font-mono text-blue-700">{totalMaterialCost.toFixed(3)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );

  const renderPricingTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className={cardClass}>
            <h4 className="text-sm font-bold text-slate-800 mb-4">Pricing Strategy</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[['fixed', 'Fixed Price'], ['quantity', 'Quantity Based'], ['area', 'Area Based'], ['per_sheet', 'Per Sheet'], ['per_hour', 'Per Hour'], ['per_sqm', 'Per m²'], ['formula', 'Custom Formula']].map(([val, label]) => (
                <button key={val} type="button" onClick={() => update('pricingStrategy', val)}
                  className={`px-3 py-2.5 rounded-lg border-2 text-xs font-medium transition-all ${form.pricingStrategy === val ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={cardClass}>
            <h4 className="text-sm font-bold text-slate-800 mb-4">Cost Breakdown</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                ['setupCost', 'Setup Cost'],
                ['machineCost', 'Machine Cost'],
                ['labourCost', 'Labour Cost'],
                ['inkCost', 'Ink Cost'],
                ['materialCost', 'Material Cost'],
                ['finishingCost', 'Finishing Cost'],
                ['packagingCost', 'Packaging Cost'],
                ['deliveryCost', 'Delivery Cost'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className={labelClass}>{label}</label>
                  <input className={inputClass} type="number" min={0} step="0.01" value={form[key] || 0} onChange={e => update(key, parseFloat(e.target.value) || 0)} />
                </div>
              ))}
            </div>
          </div>

          <div className={cardClass}>
            <h4 className="text-sm font-bold text-slate-800 mb-4">Pricing Adjustments</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div><label className={labelClass}>Markup %</label><input className={inputClass} type="number" min={0} step="0.1" value={form.markupPct} onChange={e => update('markupPct', parseFloat(e.target.value) || 0)} /></div>
              <div><label className={labelClass}>Margin %</label><input className={inputClass} type="number" min={0} step="0.1" value={marginPct.toFixed(1)} readOnly /></div>
              <div><label className={labelClass}>Minimum Charge</label><input className={inputClass} type="number" min={0} step="0.01" value={form.minimumCharge} onChange={e => update('minimumCharge', parseFloat(e.target.value) || 0)} /></div>
              <div><label className={labelClass}>Max Discount %</label><input className={inputClass} type="number" min={0} step="0.1" value={form.maxDiscount} onChange={e => update('maxDiscount', parseFloat(e.target.value) || 0)} /></div>
              <div><label className={labelClass}>VAT %</label><input className={inputClass} type="number" min={0} step="0.1" value={form.vatRate} onChange={e => update('vatRate', parseFloat(e.target.value) || 0)} /></div>
              <div><label className={labelClass}>Tax Group</label><input className={inputClass} value={form.taxGroup} onChange={e => update('taxGroup', e.target.value)} /></div>
              <div><label className={labelClass}>Currency</label><input className={inputClass} value={form.currency} onChange={e => update('currency', e.target.value)} /></div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-800">Quantity Pricing Tiers</h4>
              <button type="button" onClick={addTier} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">+ Add Tier</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-semibold text-slate-500">Min Qty</th>
                    <th className="text-left py-2 px-3 font-semibold text-slate-500">Max Qty</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-500">Price</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-500">Discount %</th>
                    <th className="text-left py-2 px-3 font-semibold text-slate-500">Production Time</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-500">Margin %</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {(form.pricingTiers as PricingTier[]).length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-slate-400">No pricing tiers defined.</td></tr>
                  ) : (form.pricingTiers as PricingTier[]).map((tier, idx) => {
                    const tierMargin = tier.price > 0 ? ((tier.price - totalCost) / tier.price) * 100 : 0;
                    return (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="px-3 py-2"><input className={inputClass} type="number" min={1} value={tier.minQty} onChange={e => updateTier(idx, 'minQty', parseInt(e.target.value) || 1)} /></td>
                        <td className="px-3 py-2"><input className={inputClass} type="number" min={1} value={tier.maxQty} onChange={e => updateTier(idx, 'maxQty', parseInt(e.target.value) || 1)} /></td>
                        <td className="px-3 py-2"><input className={`${inputClass} text-right`} type="number" min={0} step="0.001" value={tier.price} onChange={e => updateTier(idx, 'price', parseFloat(e.target.value) || 0)} /></td>
                        <td className="px-3 py-2"><input className={`${inputClass} text-right`} type="number" min={0} step="0.1" value={tier.discount} onChange={e => updateTier(idx, 'discount', parseFloat(e.target.value) || 0)} /></td>
                        <td className="px-3 py-2"><input className={inputClass} value={tier.prodTime} onChange={e => updateTier(idx, 'prodTime', e.target.value)} /></td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{tierMargin.toFixed(1)}%</td>
                        <td className="px-3 py-2"><button type="button" onClick={() => removeTier(idx)} className="text-slate-300 hover:text-red-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`${cardClass} sticky top-0`}>
            <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              Live Cost Calculator
            </h4>
            <div className="space-y-2.5">
              {[
                ['Material Cost', totalMaterialCost],
                ['Production Cost', productionCost],
                ['Labour', Number(form.labourCost)],
                ['Machine', Number(form.machineCost)],
                ['Finishing', Number(form.finishingCost)],
                ['Packaging', Number(form.packagingCost)],
                ['Overheads', Number(form.deliveryCost)],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-slate-500">{label as string}</span>
                  <span className="font-mono font-medium text-slate-700">{(val as number).toFixed(3)}</span>
                </div>
              ))}
              <div className="border-t border-slate-200 pt-2 mt-2">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Total Cost</span>
                  <span className="font-mono">{totalCost.toFixed(3)}</span>
                </div>
              </div>
              <div className="pt-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-800">Selling Price</span>
                  <span className="font-mono text-blue-700">{sellingPrice.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-slate-500">Profit</span>
                  <span className={`font-mono font-semibold ${profitAmount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{profitAmount.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Margin</span>
                  <span className={`font-mono font-semibold ${marginPct >= Number(form.markupPct) ? 'text-emerald-600' : 'text-amber-500'}`}>{marginPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span>Profit Target ({form.markupPct}%)</span>
                <span className={marginPct >= Number(form.markupPct) ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                  {marginPct >= Number(form.markupPct) ? 'On Target' : 'Below Target'}
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${marginPct >= Number(form.markupPct) ? 'bg-emerald-500' : marginPct >= Number(form.markupPct) * 0.7 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${Math.min(100, (marginPct / Math.max(1, Number(form.markupPct))) * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderVariantsTab = () => (
    <div className="space-y-6">
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-slate-800">Variant Generator</h4>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-slate-500">Enable Variants</span>
            <input type="checkbox" checked={form.variantsEnabled} onChange={e => update('variantsEnabled', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          </label>
        </div>
        {form.variantsEnabled && (
          <>
            <div className="mb-4">
              <label className={labelClass}>Variant Attributes</label>
              <div className="flex flex-wrap gap-2">
                {[['Paper Size', 'paperSize'], ['Paper Type', 'paperType'], ['GSM', 'gsm'], ['Color', 'colorMode'], ['Finish', 'finishing'], ['Binding', 'binding']].map(([label, key]) => {
                  const active = form.variantAttributes.includes(key);
                  return (
                    <button key={key} type="button" onClick={() => update('variantAttributes', active ? form.variantAttributes.filter((x: string) => x !== key) : [...form.variantAttributes, key])}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-semibold text-slate-500">Variant</th>
                    <th className="text-left py-2 px-3 font-semibold text-slate-500">SKU</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-500">Cost</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-500">Price</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-500">Margin %</th>
                    <th className="text-center py-2 px-3 font-semibold text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400">Select attributes above and generate variants automatically.</td></tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const tabContent: Record<PrintingTab, () => React.ReactNode> = {
    general: renderGeneralTab,
    specs: renderSpecsTab,
    materials: renderMaterialsTab,
    pricing: renderPricingTab,
    variants: renderVariantsTab,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.45, color: '#1E2A24' }}>
      {/* Tabs */}
      <div className="flex items-center gap-0 shrink-0 flex-wrap border-b border-slate-200" style={{ marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 }}>
        {TABS.map(tab => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${activeTab === tab.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content + Sidebar */}
      <div className="flex-1 flex gap-6 overflow-hidden mt-4" style={{ minHeight: 0 }}>
        <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
          <div className="flex-1 overflow-auto custom-scrollbar pr-2" style={{ minHeight: 0 }}>
            {tabContent[activeTab]()}
          </div>
        </div>
        {/* Right Sidebar */}
        <div className="w-72 shrink-0 hidden lg:flex flex-col gap-4 overflow-y-auto custom-scrollbar min-h-0">
          <div className={cardClass}>
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Live Quote</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Quantity</span><span className="font-semibold text-slate-700">1,000</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Material Cost</span><span className="font-mono text-slate-600">{totalMaterialCost.toFixed(3)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Machine Cost</span><span className="font-mono text-slate-600">{Number(form.machineCost).toFixed(3)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Ink</span><span className="font-mono text-slate-600">{Number(form.inkCost).toFixed(3)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Finishing</span><span className="font-mono text-slate-600">{Number(form.finishingCost).toFixed(3)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Labour</span><span className="font-mono text-slate-600">{Number(form.labourCost).toFixed(3)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Packaging</span><span className="font-mono text-slate-600">{Number(form.packagingCost).toFixed(3)}</span></div>
              <div className="border-t border-slate-200 pt-2 mt-2">
                <div className="flex justify-between font-semibold text-slate-700"><span>Subtotal</span><span className="font-mono">{totalCost.toFixed(3)}</span></div>
                <div className="flex justify-between text-emerald-600 font-semibold"><span>Profit ({form.markupPct}%)</span><span className="font-mono">{profitAmount.toFixed(3)}</span></div>
                <div className="flex justify-between text-sm font-bold text-blue-700 mt-1"><span>Grand Total</span><span className="font-mono">{sellingPrice.toFixed(3)}</span></div>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Profit Meter</h4>
            <div className="flex items-center justify-center py-4">
              <div className="relative w-28 h-28">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#E2E8F0" strokeWidth="8" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke={marginPct >= Number(form.markupPct) ? '#10B981' : marginPct >= Number(form.markupPct) * 0.7 ? '#F59E0B' : '#EF4444'} strokeWidth="8" strokeDasharray={`${(Math.min(marginPct, Number(form.markupPct) * 1.5) / (Number(form.markupPct) * 1.5)) * 326.7} 326.7`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className={`text-lg font-bold ${marginPct >= Number(form.markupPct) ? 'text-emerald-600' : marginPct >= Number(form.markupPct) * 0.7 ? 'text-amber-500' : 'text-red-500'}`}>{marginPct.toFixed(1)}%</span>
                  <span className="text-[10px] text-slate-400">margin</span>
                </div>
              </div>
            </div>
            <div className="text-center text-[10px] text-slate-400">
              {marginPct >= Number(form.markupPct) ? 'Above Target' : marginPct >= Number(form.markupPct) * 0.7 ? 'Near Target' : 'Below Target'}
            </div>
          </div>

          <div className={cardClass}>
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Stock Impact</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Paper Required</span><span className="font-mono text-slate-600">0 sheets</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Ink Required</span><span className="font-mono text-slate-600">0 units</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Current Stock</span><span className="font-mono text-slate-600">—</span></div>
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700 mt-2">Add materials to calculate stock impact.</div>
            </div>
          </div>

          <div className={cardClass}>
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Production Time</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Setup</span><span className="font-mono text-slate-600">{form.setupTime || 0} min</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Production</span><span className="font-mono text-slate-600">{form.prodTime || 0} min</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Finishing</span><span className="font-mono text-slate-600">{form.finishingTime || 0} min</span></div>
              <div className="border-t border-slate-200 pt-2 mt-2">
                <div className="flex justify-between font-semibold"><span className="text-slate-600">Total</span><span className="font-mono text-slate-800">{(Number(form.setupTime) + Number(form.prodTime) + Number(form.finishingTime)) || 0} min</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between shrink-0 pt-4 mt-4 border-t border-slate-200" style={{ marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 }}>
        <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          Cancel
        </button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleSave} disabled={saving || !form.name}
            className="px-5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
            Save Draft
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !form.name}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm disabled:opacity-40 transition-all flex items-center gap-2">
            {saving ? 'Saving...' : 'Save Service'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintingServiceModal;

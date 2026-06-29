import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, Save, ShoppingCart, FileText, Clock, User, Hash, Layers,
  Printer, Book, Image, Palette, Scissors, Wrench, Package,
  DollarSign, Percent, Tag, ChevronDown, ChevronUp, AlertCircle,
  CheckCircle, Upload, FilePlus, Star
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePrintingStore } from '../../stores/printingStore';
import { printingService } from '../../services/printingService';
import { formatNumber } from '../../utils/helpers';
import type {
  PrintingJobSpecification, PaperSize, ColorMode, SidedMode,
  Orientation, ArtworkSource, ArtworkStatus, PrintingJobPriority, FinishingSpec,
} from '../../types/printing';

interface PrintingJobModalProps {
  serviceId: string;
  serviceName: string;
  customerName?: string;
  customerId?: string;
  onSaveDraft: (spec: PrintingJobSpecification) => void;
  onAddToCart: (spec: PrintingJobSpecification) => void;
  onSaveAsQuote: (spec: PrintingJobSpecification) => void;
  onCancel: () => void;
}

type ModalTab = 'basic' | 'specs' | 'finishing' | 'artwork' | 'pricing' | 'summary';

const TABS: { key: ModalTab; label: string; icon: React.ElementType }[] = [
  { key: 'basic', label: 'Basic Info', icon: FileText },
  { key: 'specs', label: 'Print Specs', icon: Printer },
  { key: 'finishing', label: 'Finishing', icon: Scissors },
  { key: 'artwork', label: 'Artwork', icon: Image },
  { key: 'pricing', label: 'Pricing', icon: DollarSign },
  { key: 'summary', label: 'Summary', icon: Star },
];

const PAPER_TYPES = ['Art Card', 'Art Paper', 'Gloss Art', 'Matte Art', 'Offset', 'Newsprint', 'Kraft', 'Specialty'];
const PAPER_WEIGHTS = [80, 100, 120, 150, 170, 200, 250, 300, 350, 400];
const PAPER_SIZES: PaperSize[] = ['A4', 'A3', 'A5', 'Legal', 'Letter', 'Custom'];

const PaperSpecSection: React.FC<{
  paper: PrintingJobSpecification['paper'];
  onChange: (paper: PrintingJobSpecification['paper']) => void;
}> = ({ paper, onChange }) => (
  <div className="grid grid-cols-2 gap-4">
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-600">Paper Type</label>
      <select value={paper.type} onChange={e => onChange({ ...paper, type: e.target.value })}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white">
        {PAPER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-600">Weight (gsm)</label>
      <select value={paper.weight} onChange={e => onChange({ ...paper, weight: Number(e.target.value) })}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white">
        {PAPER_WEIGHTS.map(w => <option key={w} value={w}>{w} gsm</option>)}
      </select>
    </div>
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-600">Paper Size</label>
      <select value={paper.size} onChange={e => onChange({ ...paper, size: e.target.value as PaperSize })}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white">
        {PAPER_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
    {paper.size === 'Custom' && (
      <>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">Width (mm)</label>
          <input type="number" value={paper.customWidth || ''} onChange={e => onChange({ ...paper, customWidth: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" placeholder="e.g. 210" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">Height (mm)</label>
          <input type="number" value={paper.customHeight || ''} onChange={e => onChange({ ...paper, customHeight: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" placeholder="e.g. 297" />
        </div>
      </>
    )}
  </div>
);

const FinishingOptions: React.FC<{
  finishing: FinishingSpec;
  onChange: (f: FinishingSpec) => void;
}> = ({ finishing, onChange }) => {
  const toggle = (key: keyof FinishingSpec) => onChange({ ...finishing, [key]: !finishing[key] });
  const options: { key: keyof FinishingSpec; label: string; icon: React.ElementType }[] = [
    { key: 'lamination', label: 'Lamination', icon: Layers },
    { key: 'binding', label: 'Binding', icon: Book },
    { key: 'folding', label: 'Folding', icon: Wrench },
    { key: 'creasing', label: 'Creasing', icon: Wrench },
    { key: 'perforation', label: 'Perforation', icon: Scissors },
    { key: 'numbering', label: 'Numbering', icon: Hash },
    { key: 'stitching', label: 'Stitching', icon: Wrench },
    { key: 'spotUV', label: 'Spot UV', icon: Palette },
    { key: 'foiling', label: 'Foiling', icon: Star },
    { key: 'dieCutting', label: 'Die Cutting', icon: Scissors },
    { key: 'packaging', label: 'Packaging', icon: Package },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {options.map(opt => {
        const Icon = opt.icon;
        const isOn = finishing[opt.key] === true;
        return (
          <button key={opt.key} onClick={() => toggle(opt.key)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all
              ${isOn ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            <Icon size={16} className={isOn ? 'text-indigo-600' : 'text-slate-400'} />
            <span>{opt.label}</span>
            {isOn && <CheckCircle size={14} className="ml-auto text-indigo-600" />}
          </button>
        );
      })}
    </div>
  );
};

const PricingDisplay: React.FC<{ pricing: PrintingJobSpecification['pricing']; currency: string }> = ({ pricing, currency }) => {
  const Row = ({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) => (
    <div className={`flex justify-between items-center py-1.5 ${highlight ? 'border-t-2 border-indigo-200 mt-1 pt-2' : ''}`}>
      <span className={`text-sm ${highlight ? 'font-bold text-slate-800' : 'text-slate-500'}`}>{label}</span>
      <span className={`font-mono text-sm ${highlight ? 'font-bold text-indigo-600 text-base' : 'text-slate-700'}`}>
        {currency}{formatNumber(value)}
      </span>
    </div>
  );
  return (
    <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 p-4 space-y-0.5">
      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-100">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Live Pricing</span>
      </div>
      <Row label="Printing Cost" value={pricing.printingCost} />
      <Row label="Paper Cost" value={pricing.paperCost} />
      <Row label="Ink Cost" value={pricing.inkCost} />
      <Row label="Finishing Cost" value={pricing.finishingCost} />
      <Row label="Design Cost" value={pricing.designCost} />
      <Row label="Machine Setup" value={pricing.machineSetupCost} />
      <Row label="Delivery Cost" value={pricing.deliveryCost} />
      {pricing.urgentFee > 0 && <Row label="Urgent Fee" value={pricing.urgentFee} />}
      <div className="border-t border-slate-200 my-1" />
      <Row label="Subtotal" value={pricing.subtotal} />
      {pricing.discount > 0 && <Row label="Discount" value={-pricing.discount} />}
      <Row label="Tax (16%)" value={pricing.tax} />
      <Row label="Grand Total" value={pricing.grandTotal} highlight />
    </div>
  );
};

const JobSummaryCard: React.FC<{ spec: PrintingJobSpecification; currency: string }> = ({ spec, currency }) => {
  const finishingActive = Object.entries(spec.finishing).filter(([k, v]) => v === true && !k.includes('Type')).map(([k]) => k);
  const estimatedTime = printingService.estimateProductionTime(spec);
  const estimatedProfit = spec.pricing.grandTotal - spec.pricing.subtotal + spec.pricing.tax;
  return (
    <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-xl p-5 text-white shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold">{spec.jobName || spec.serviceName}</h3>
          <p className="text-indigo-200 text-sm mt-0.5">{spec.quantity} {spec.unit}</p>
        </div>
        <div className="bg-white/20 rounded-lg px-3 py-1.5 text-right">
          <div className="text-xs text-indigo-200">Amount</div>
          <div className="text-lg font-bold">{currency}{formatNumber(spec.pricing.grandTotal)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/10 rounded-lg p-2.5">
          <div className="text-xs text-indigo-200">Paper</div>
          <div className="font-semibold text-sm">{spec.paper.weight}gsm {spec.paper.type} — {spec.paper.size}</div>
        </div>
        <div className="bg-white/10 rounded-lg p-2.5">
          <div className="text-xs text-indigo-200">Printing</div>
          <div className="font-semibold text-sm">{spec.printing.color} · {spec.printing.sides}</div>
        </div>
        {finishingActive.length > 0 && (
          <div className="bg-white/10 rounded-lg p-2.5">
            <div className="text-xs text-indigo-200">Finishing</div>
            <div className="font-semibold text-sm">{finishingActive.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(', ')}</div>
          </div>
        )}
        <div className="bg-white/10 rounded-lg p-2.5">
          <div className="text-xs text-indigo-200">Due</div>
          <div className="font-semibold text-sm">{spec.dueDate ? new Date(spec.dueDate).toLocaleDateString() : 'Not set'}</div>
        </div>
      </div>
      <div className="border-t border-white/20 pt-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-xs text-indigo-200">Est. Time</div>
          <div className="font-bold text-sm">{estimatedTime}</div>
        </div>
        <div>
          <div className="text-xs text-indigo-200">Est. Cost</div>
          <div className="font-bold text-sm">{currency}{formatNumber(spec.pricing.subtotal)}</div>
        </div>
        <div>
          <div className="text-xs text-indigo-200">Est. Profit</div>
          <div className="font-bold text-sm text-emerald-300">{currency}{formatNumber(estimatedProfit)}</div>
        </div>
      </div>
    </div>
  );
};

export const PrintingJobModal: React.FC<PrintingJobModalProps> = ({
  serviceId, serviceName, customerName, customerId,
  onSaveDraft, onAddToCart, onSaveAsQuote, onCancel,
}) => {
  const { companyConfig } = useAuth();
  const currency = companyConfig.currencySymbol;
  const { calculatePricing } = usePrintingStore();

  const [activeTab, setActiveTab] = useState<ModalTab>('basic');
  const [spec, setSpec] = useState<PrintingJobSpecification>({
    serviceId,
    serviceName,
    jobName: serviceName,
    customerName: customerName || '',
    customerId,
    quantity: 500,
    unit: 'pcs',
    dueDate: '',
    priority: 'Normal',
    paper: { type: 'Art Card', weight: 300, size: 'A4' },
    printing: { color: 'Full Color', sides: 'Double Sided', pages: 1, copies: 1, orientation: 'Portrait' },
    finishing: {
      lamination: false, binding: false, folding: false, creasing: false,
      perforation: false, numbering: false, stitching: false, spotUV: false,
      foiling: false, dieCutting: false, packaging: false,
    },
    artwork: { source: 'Customer Artwork', files: [], status: 'Pending', notes: '' },
    customerNotes: '',
    internalNotes: '',
    pricing: {
      printingCost: 0, paperCost: 0, inkCost: 0, finishingCost: 0,
      designCost: 0, machineSetupCost: 0, deliveryCost: 0, urgentFee: 0,
      discount: 0, tax: 0, subtotal: 0, grandTotal: 0,
    },
  });

  const updateSpec = useCallback((patch: Partial<PrintingJobSpecification>) => {
    setSpec(prev => {
      const next = { ...prev, ...patch };
      if (patch.printing || patch.paper || patch.finishing || patch.priority || patch.quantity) {
        next.pricing = calculatePricing(next);
      }
      return next;
    });
  }, [calculatePricing]);

  useEffect(() => {
    setSpec(prev => {
      const pricing = calculatePricing(prev);
      return { ...prev, pricing };
    });
  }, []);

  const tabErrors = useMemo(() => {
    const errs: Partial<Record<ModalTab, string[]>> = {};
    if (!spec.jobName) errs.basic = ['Job name is required'];
    if (!spec.customerName) errs.basic = [...(errs.basic || []), 'Customer is required'];
    if (spec.quantity < 1) errs.basic = [...(errs.basic || []), 'Quantity must be at least 1'];
    return errs;
  }, [spec]);

  const canAddToCart = !tabErrors.basic || tabErrors.basic.length === 0;

  const TabButton: React.FC<{ tab: ModalTab; icon: React.ElementType }> = ({ tab, icon: Icon }) => {
    const isActive = activeTab === tab;
    const hasError = tabErrors[tab]?.length;
    return (
      <button onClick={() => setActiveTab(tab)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
          ${isActive ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
          ${hasError ? 'ring-2 ring-red-300' : ''}`}>
        <Icon size={14} />
        <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <Printer size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Configure Printing Job</h2>
              <p className="text-xs text-slate-500 font-medium">{serviceName}</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-rose-500">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-2 border-b border-slate-100 bg-slate-50/50 flex gap-1 overflow-x-auto shrink-0">
          {TABS.map(t => <TabButton key={t.key} tab={t.key} icon={t.icon} />)}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6">
            {activeTab === 'basic' && (
              <div className="max-w-2xl space-y-5">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Job Name *</label>
                    <input type="text" value={spec.jobName} onChange={e => updateSpec({ jobName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" placeholder="e.g. Business Cards" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Service</label>
                    <input type="text" value={spec.serviceName} disabled
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Customer *</label>
                    <input type="text" value={spec.customerName} onChange={e => updateSpec({ customerName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" placeholder="Customer name" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Unit</label>
                    <select value={spec.unit} onChange={e => updateSpec({ unit: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white">
                      <option value="pcs">Pieces</option>
                      <option value="sets">Sets</option>
                      <option value="books">Books</option>
                      <option value="boxes">Boxes</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Quantity</label>
                    <input type="number" min={1} value={spec.quantity} onChange={e => updateSpec({ quantity: Math.max(1, Number(e.target.value)) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Due Date</label>
                    <input type="date" value={spec.dueDate} onChange={e => updateSpec({ dueDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Priority</label>
                    <div className="flex gap-2">
                      {(['Normal', 'Urgent', 'Express'] as PrintingJobPriority[]).map(p => (
                        <button key={p} onClick={() => updateSpec({ priority: p })}
                          className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold transition-all
                            ${spec.priority === p
                              ? p === 'Normal' ? 'bg-slate-800 text-white border-slate-800'
                                : p === 'Urgent' ? 'bg-orange-500 text-white border-orange-500'
                                : 'bg-red-500 text-white border-red-500'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'specs' && (
              <div className="max-w-3xl space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Layers size={16} /> Paper
                  </h3>
                  <PaperSpecSection paper={spec.paper} onChange={paper => updateSpec({ paper })} />
                </div>
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Printer size={16} /> Printing
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Color</label>
                      <div className="flex gap-2">
                        {(['Full Color', 'Black & White'] as ColorMode[]).map(c => (
                          <button key={c} onClick={() => updateSpec({ printing: { ...spec.printing, color: c } })}
                            className={`flex-1 px-3 py-2 rounded-lg border text-xs font-semibold transition-all
                              ${spec.printing.color === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Sides</label>
                      <div className="flex gap-2">
                        {(['Single Sided', 'Double Sided'] as SidedMode[]).map(s => (
                          <button key={s} onClick={() => updateSpec({ printing: { ...spec.printing, sides: s } })}
                            className={`flex-1 px-3 py-2 rounded-lg border text-xs font-semibold transition-all
                              ${spec.printing.sides === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                            {s === 'Single Sided' ? 'Single' : 'Double'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Pages per Copy</label>
                      <input type="number" min={1} value={spec.printing.pages} onChange={e => updateSpec({ printing: { ...spec.printing, pages: Math.max(1, Number(e.target.value)) } })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Orientation</label>
                      <div className="flex gap-2">
                        {(['Portrait', 'Landscape'] as Orientation[]).map(o => (
                          <button key={o} onClick={() => updateSpec({ printing: { ...spec.printing, orientation: o } })}
                            className={`flex-1 px-3 py-2 rounded-lg border text-xs font-semibold transition-all
                              ${spec.printing.orientation === o ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'finishing' && (
              <div className="max-w-3xl space-y-4">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Scissors size={16} /> Finishing Options
                </h3>
                <FinishingOptions finishing={spec.finishing} onChange={finishing => updateSpec({ finishing })} />
              </div>
            )}

            {activeTab === 'artwork' && (
              <div className="max-w-2xl space-y-5">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Image size={16} /> Artwork
                </h3>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Artwork Source</label>
                  <div className="flex gap-3">
                    {(['Customer Artwork', 'Design Required'] as ArtworkSource[]).map(src => (
                      <button key={src} onClick={() => updateSpec({ artwork: { ...spec.artwork, source: src } })}
                        className={`flex-1 px-4 py-3 rounded-xl border text-sm font-semibold transition-all
                          ${spec.artwork.source === src ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                        {src}
                      </button>
                    ))}
                  </div>
                </div>
                {spec.artwork.source === 'Customer Artwork' && (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-indigo-300 transition-colors cursor-pointer">
                    <Upload size={32} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">Drop artwork files here or click to upload</p>
                    <p className="text-xs text-slate-400 mt-1">PDF, AI, EPS, PSD, TIFF — Max 50MB</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Artwork Status</label>
                  <div className="flex gap-2">
                    {(['Pending', 'Received', 'Approved'] as ArtworkStatus[]).map(s => (
                      <button key={s} onClick={() => updateSpec({ artwork: { ...spec.artwork, status: s } })}
                        className={`px-4 py-2 rounded-lg border text-xs font-bold transition-all
                          ${spec.artwork.status === s
                            ? s === 'Approved' ? 'bg-emerald-600 text-white border-emerald-600'
                              : s === 'Received' ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-slate-600 border-slate-200'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Customer Notes</label>
                  <textarea value={spec.customerNotes} onChange={e => updateSpec({ customerNotes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none h-20" placeholder="Any special instructions from the customer..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Internal Production Notes</label>
                  <textarea value={spec.internalNotes} onChange={e => updateSpec({ internalNotes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none h-20" placeholder="Internal instructions for the production team..." />
                </div>
              </div>
            )}

            {activeTab === 'pricing' && (
              <div className="max-w-md mx-auto">
                <PricingDisplay pricing={spec.pricing} currency={currency} />
              </div>
            )}

            {activeTab === 'summary' && (
              <div className="max-w-lg mx-auto">
                <JobSummaryCard spec={spec} currency={currency} />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg px-4 py-2 border border-slate-200">
              <span className="text-xs text-slate-500">Total</span>
              <div className="font-bold text-lg text-indigo-600">{currency}{formatNumber(spec.pricing.grandTotal)}</div>
            </div>
            {!canAddToCart && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
                <AlertCircle size={12} /> Fill required fields
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onCancel}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all">
              Cancel
            </button>
            <button onClick={() => onSaveDraft(spec)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all flex items-center gap-1.5">
              <Save size={14} /> Save Draft
            </button>
            <button onClick={() => onSaveAsQuote(spec)}
              className="px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all flex items-center gap-1.5">
              <FileText size={14} /> Save as Quote
            </button>
            <button onClick={() => onAddToCart(spec)} disabled={!canAddToCart}
              className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm">
              <ShoppingCart size={16} /> Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintingJobModal;

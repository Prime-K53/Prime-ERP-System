import React, { useState } from 'react';
import { Plus, Save, Eye, Code, Type, Image, Square, Move, Trash2, GripVertical } from 'lucide-react';

interface TemplateField {
  id: string;
  type: 'text' | 'image' | 'qr' | 'barcode' | 'table' | 'line';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  content?: string;
  dataField?: string;
}

const DocumentTemplateBuilder: React.FC = () => {
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [selectedField, setSelectedField] = useState<string | null>(null);

  const addField = (type: TemplateField['type']) => {
    const id = `fld-${Date.now()}`;
    const base: TemplateField = { id, type, label: type.charAt(0).toUpperCase() + type.slice(1), x: 20, y: 20 + fields.length * 40, width: 150, height: 24, content: '', dataField: '' };
    if (type === 'text') { base.fontSize = 11; base.fontFamily = 'Inter'; }
    if (type === 'qr') { base.width = 60; base.height = 60; }
    setFields([...fields, base]);
    setSelectedField(id);
  };

  const updateField = (id: string, updates: Partial<TemplateField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    if (selectedField === id) setSelectedField(null);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-900">Document Template Builder</h1><p className="text-sm text-slate-500 mt-1">Design invoice, receipt, and document layouts</p></div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Eye size={15} /> Preview</button>
          <button className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-200 flex items-center gap-2"><Save size={15} /> Save Template</button>
        </div>
      </div>
      <div className="flex gap-3 mb-4">
        <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Template name (e.g., Standard Invoice)" />
      </div>

      <div className="flex gap-6">
        <div className="w-48 shrink-0 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Add Elements</p>
          {(['text', 'image', 'line', 'table'] as const).map(type => (
            <button key={type} onClick={() => addField(type)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 hover:border-indigo-300 transition-all">
              {type === 'text' ? <Type size={14} /> : type === 'image' ? <Image size={14} /> : type === 'line' ? <Square size={14} /> : <Code size={14} />}
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-3">Special</p>
          {(['qr', 'barcode'] as const).map(type => (
            <button key={type} onClick={() => addField(type)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 hover:border-indigo-300 transition-all">
              <Code size={14} /> {type.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white rounded-xl border border-slate-200 p-6 min-h-[500px] relative">
          <div className="absolute inset-0 m-6 border-2 border-dashed border-slate-200 rounded-lg pointer-events-none" />
          <p className="text-xs text-slate-300 absolute top-3 left-4">Canvas — drag elements to position</p>
          {fields.map(f => (
            <div key={f.id} onClick={() => setSelectedField(f.id)} className={`absolute cursor-move p-1 rounded border text-xs ${selectedField === f.id ? 'border-indigo-500 bg-indigo-50' : 'border-transparent hover:border-slate-300'}`} style={{ left: f.x, top: f.y, width: f.width, height: f.height }}>
              <span className="text-slate-600 truncate block">{f.content || f.label}</span>
            </div>
          ))}
          {fields.length === 0 && <div className="absolute inset-0 flex items-center justify-center"><p className="text-slate-300 text-sm">Add elements from the left panel to build your template.</p></div>}
        </div>

        {selectedField && (() => {
          const field = fields.find(f => f.id === selectedField);
          if (!field) return null;
          return (
            <div className="w-56 shrink-0 space-y-3">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Properties</p><button onClick={() => removeField(field.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button></div>
              <div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Label</label><input type="text" value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs" /></div>
              <div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Data Field</label><input type="text" value={field.dataField || ''} onChange={e => updateField(field.id, { dataField: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs" placeholder="e.g., invoice.number" /></div>
              {field.type === 'text' && <><div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Font Size</label><input type="number" value={field.fontSize || 11} onChange={e => updateField(field.id, { fontSize: parseInt(e.target.value) || 11 })} className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs" /></div>
              <div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Content</label><input type="text" value={field.content || ''} onChange={e => updateField(field.id, { content: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs" placeholder="Static text" /></div></>}
              <div className="grid grid-cols-2 gap-2"><div><label className="block text-[10px] font-semibold text-slate-600 mb-1">X</label><input type="number" value={field.x} onChange={e => updateField(field.id, { x: parseInt(e.target.value) || 0 })} className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs" /></div>
              <div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Y</label><input type="number" value={field.y} onChange={e => updateField(field.id, { y: parseInt(e.target.value) || 0 })} className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs" /></div></div>
              <div className="grid grid-cols-2 gap-2"><div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Width</label><input type="number" value={field.width} onChange={e => updateField(field.id, { width: parseInt(e.target.value) || 50 })} className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs" /></div>
              <div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Height</label><input type="number" value={field.height} onChange={e => updateField(field.id, { height: parseInt(e.target.value) || 20 })} className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs" /></div></div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default DocumentTemplateBuilder;

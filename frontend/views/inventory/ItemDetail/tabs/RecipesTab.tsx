import React from 'react';
import { FlaskConical, Clock, Cpu, Users, FileText, Layers } from 'lucide-react';
import type { Item } from '../../../../types';

interface Props {
  item: Item;
}

export const RecipesTab: React.FC<Props> = ({ item }) => {
  const isManufactured = item.productType === 'MANUFACTURED';
  const isPrintingService = item.type === 'Service' && item.printingServiceType;
  const isRawMaterial = item.type === 'Raw Material' || item.type === 'Material';

  if (isRawMaterial) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <FlaskConical size={48} className="mb-4 opacity-50" />
        <p className="text-sm font-semibold">No Recipe Required</p>
        <p className="text-xs mt-1">Raw materials and consumables do not require recipes.</p>
      </div>
    );
  }

  const SectionCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
        <span className="p-1.5 rounded-lg bg-white shadow-sm text-slate-500">{icon}</span>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );

  if (isManufactured) {
    return (
      <div className="space-y-6">
        <SectionCard icon={<FileText size={16} />} title="Bill of Materials">
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">BOM ID</span>
              <span className="font-mono font-semibold text-slate-800">{item.serviceRecipeId || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Last Updated</span>
              <span className="text-slate-700">{item.validationTimestamp ? new Date(item.validationTimestamp).toLocaleString() : '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Version</span>
              <span className="text-slate-700 font-medium">{item.pricingVersion ? `v${item.pricingVersion}` : '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Estimated Cost</span>
              <span className="font-mono font-semibold text-blue-600">{(item.costPrice || item.cost || 0).toFixed(2)}</span>
            </div>
          </div>
          <button className="mt-5 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-all shadow-sm inline-flex items-center gap-2">
            <FileText size={14} /> Open BOM Editor
          </button>
        </SectionCard>
      </div>
    );
  }

  if (isPrintingService) {
    return (
      <div className="space-y-6">
        <SectionCard icon={<Layers size={16} />} title="Service Recipe">
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Recipe ID</span>
              <span className="font-mono font-bold text-slate-800">{item.serviceRecipeId || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Print Type</span>
              <span className="capitalize font-medium text-slate-700">{item.printType || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                <Clock size={10} className="inline mr-1" />Est. Time
              </span>
              <span className="font-semibold text-slate-700">{item.estimatedTime || 0} min</span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                <Cpu size={10} className="inline mr-1" />Default Machine
              </span>
              <span className="text-slate-700">{item.defaultMachine || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                <Users size={10} className="inline mr-1" />Default Labor
              </span>
              <span className="text-slate-700">{item.defaultLabor || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Department</span>
              <span className="text-slate-700">{item.productionDepartment || '—'}</span>
            </div>
          </div>
          <button className="mt-5 px-4 py-2 bg-violet-50 text-violet-700 rounded-lg text-xs font-semibold hover:bg-violet-100 transition-all shadow-sm inline-flex items-center gap-2">
            <Layers size={14} /> Open Service Recipe
          </button>
        </SectionCard>

        {(item.printFinishing || []).length > 0 && (
          <SectionCard icon={<Layers size={16} />} title="Finishing Options">
            <div className="flex flex-wrap gap-2">
              {item.printFinishing?.map((f: string, i: number) => (
                <span key={i} className="px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-xs font-medium border border-slate-200">
                  {f}
                </span>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <FlaskConical size={48} className="mb-4 opacity-50" />
      <p className="text-sm font-semibold">Recipe Not Applicable</p>
      <p className="text-xs mt-1">This item type does not use recipes.</p>
    </div>
  );
};

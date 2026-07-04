import React from 'react';
import { CompanyConfig, FinishingOption } from '../../../types';
import { Scissors, BookOpen, Layers, Triangle, PanelTop, Ruler } from 'lucide-react';

const OPTION_ICONS: Record<string, React.ReactNode> = {
  binding: <BookOpen size={20} />,
  coverPages: <Layers size={20} />,
  cutting: <Scissors size={20} />,
  holePunch: <Triangle size={20} />,
  folding: <PanelTop size={20} />,
  stapling: <Ruler size={20} />,
};

const DEFAULT_FINISHING_OPTIONS: FinishingOption[] = [
  { id: 'binding', name: 'Binding', enabled: false, price: 150, description: 'Book binding - comb or spiral', items: [] },
  { id: 'coverPages', name: 'Cover Pages', enabled: false, price: 20, description: 'Front and back cover pages per copy', items: [] },
  { id: 'cutting', name: 'Cutting & Trimming', enabled: false, price: 30, description: 'Trim edges to clean finish', items: [] },
  { id: 'holePunch', name: 'Hole Punching', enabled: false, price: 20, description: 'Punch holes for folder binding', items: [] },
  { id: 'folding', name: 'Folding', enabled: false, price: 15, description: 'Fold pages for insertion', items: [] },
  { id: 'stapling', name: 'Stapling', enabled: false, price: 10, description: 'Corner or saddle stapling', items: [] },
];

function getOptions(config: CompanyConfig): FinishingOption[] {
  if (config.productionSettings?.finishingOptions?.length > 0) {
    return config.productionSettings.finishingOptions;
  }
  return DEFAULT_FINISHING_OPTIONS;
}

function setOptions(config: CompanyConfig, options: FinishingOption[]): CompanyConfig {
  return {
    ...config,
    productionSettings: {
      ...config.productionSettings,
      finishingOptions: options,
    },
  };
}

interface FinishingOptionsTabProps {
  config: CompanyConfig;
  setConfig: React.Dispatch<React.SetStateAction<CompanyConfig>>;
  notify: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const FinishingOptionsTab: React.FC<FinishingOptionsTabProps> = ({ config, setConfig, notify }) => {
  const options = getOptions(config);

  const updateOption = (id: string, field: keyof FinishingOption, value: any) => {
    const updated = options.map(opt =>
      opt.id === id ? { ...opt, [field]: value } : opt
    );
    setConfig(prev => setOptions(prev, updated));
  };

  const resetDefaults = () => {
    setConfig(prev => setOptions(prev, DEFAULT_FINISHING_OPTIONS.map(o => ({ ...o }))));
    notify('Finishing options reset to defaults', 'info');
  };

  const currency = config.currencySymbol || 'K';

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-white rounded-lg border border-[#D4D7DC] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Scissors size={18} className="text-indigo-600" />
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Finishing Options Pricing</h3>
          </div>
          <button
            onClick={resetDefaults}
            className="px-4 py-2 text-xs font-bold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
          >
            Reset to Defaults
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-6">
          Set the default price for each finishing option. These prices are used as defaults
          across all pricing tools and product configurations.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {options.map(option => (
            <div
              key={option.id}
              className="flex items-center justify-between p-4 bg-[#F4F5F8] rounded-lg border border-[#D4D7DC] group hover:border-indigo-300 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-white rounded-lg shadow-sm text-indigo-600 border border-slate-100">
                  {OPTION_ICONS[option.id] || <Scissors size={20} />}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{option.name}</p>
                  {option.description && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{option.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-medium">{currency}</span>
                  <input
                    type="number"
                    value={option.price}
                    onChange={e => updateOption(option.id, 'price', parseFloat(e.target.value) || 0)}
                    className="w-20 px-2.5 py-1.5 border border-slate-200 rounded-lg text-right text-sm font-bold text-slate-700 bg-white"
                    min={0}
                    step={0.5}
                  />
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-2">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={option.enabled}
                    onChange={e => updateOption(option.id, 'enabled', e.target.checked)}
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

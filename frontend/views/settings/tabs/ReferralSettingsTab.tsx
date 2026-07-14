import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Award, DollarSign, Settings } from 'lucide-react';
import { referralService } from '../../../services/referralService';
import type { ReferralSettings } from '../../../types/referral';

interface Props {
  notify: (msg: string, type?: string) => void;
}

export const ReferralSettingsTab: React.FC<Props> = ({ notify }) => {
  const [settings, setSettings] = useState<ReferralSettings>({
    enableReferralSystem: true,
    defaultCommissionPercent: 5,
    defaultCommissionFixed: 0,
    approvalRequired: false,
    autoCreditWallet: true,
    minInvoiceAmount: 0,
    maxCommission: 0,
    commissionValidityDays: 365,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    referralService.getSettings().then(s => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    await referralService.saveSettings(settings);
    notify('Referral settings saved successfully', 'success');
  };

  if (loading) return <div className="p-8 text-slate-400 italic">Loading settings...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Award size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900">Referral Program Settings</h2>
          <p className="text-xs text-slate-500">Configure commission rules and behavior</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Settings size={14} /> General
          </h3>
          <ToggleRow label="Enable Referral System" value={settings.enableReferralSystem}
            onChange={v => setSettings({ ...settings, enableReferralSystem: v })} />
          <ToggleRow label="Approval Required" value={settings.approvalRequired}
            onChange={v => setSettings({ ...settings, approvalRequired: v })} />
          <ToggleRow label="Auto-Credit Wallet" value={settings.autoCreditWallet}
            onChange={v => setSettings({ ...settings, autoCreditWallet: v })} />
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <DollarSign size={14} /> Commission Rules
          </h3>
          <NumberRow label="Default Commission %" value={settings.defaultCommissionPercent}
            onChange={v => setSettings({ ...settings, defaultCommissionPercent: v })} suffix="%" />
          <NumberRow label="Default Fixed Amount" value={settings.defaultCommissionFixed}
            onChange={v => setSettings({ ...settings, defaultCommissionFixed: v })} prefix="$" />
          <NumberRow label="Min Invoice Amount" value={settings.minInvoiceAmount}
            onChange={v => setSettings({ ...settings, minInvoiceAmount: v })} prefix="$" />
          <NumberRow label="Max Commission (0 = unlimited)" value={settings.maxCommission}
            onChange={v => setSettings({ ...settings, maxCommission: v })} prefix="$" />
          <NumberRow label="Commission Validity (days)" value={settings.commissionValidityDays}
            onChange={v => setSettings({ ...settings, commissionValidityDays: v })} suffix="days" />
        </section>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button onClick={handleSave}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-tight hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20">
          <Save size={16} /> Save Settings
        </button>
      </div>
    </div>
  );
};

const ToggleRow: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <button onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full transition-colors relative ${value ? 'bg-blue-600' : 'bg-slate-300'}`}>
      <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
    </button>
  </div>
);

const NumberRow: React.FC<{ label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string }> = ({ label, value, onChange, prefix, suffix }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <div className="flex items-center gap-1">
      {prefix && <span className="text-sm text-slate-500">{prefix}</span>}
      <input type="number" value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-24 text-right border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20" />
      {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
    </div>
  </div>
);

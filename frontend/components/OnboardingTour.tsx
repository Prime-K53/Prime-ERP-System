import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Compass } from 'lucide-react';

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  { target: '[data-tour="dashboard"]', title: 'Dashboard', content: 'Get a quick overview of your business performance with KPIs, charts, and recent activity.', placement: 'bottom' },
  { target: '[data-tour="inventory"]', title: 'Inventory Management', content: 'Manage your stock, track items, set reorder points, and monitor warehouse levels.', placement: 'right' },
  { target: '[data-tour="sales"]', title: 'Sales & Orders', content: 'Create quotations, invoices, and manage the full sales order lifecycle.', placement: 'right' },
  { target: '[data-tour="production"]', title: 'Production', content: 'Manage work orders, shop floor operations, and printing job tracking.', placement: 'right' },
  { target: '[data-tour="settings"]', title: 'Settings', content: 'Configure company details, user permissions, and system preferences.', placement: 'top' },
];

const OnboardingTour: React.FC = () => {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [position, setPosition] = useState({ top: 80, left: typeof window !== 'undefined' ? window.innerWidth / 2 : 400 });

  useEffect(() => {
    const done = localStorage.getItem('prime_erp_onboarding_done');
    if (!done) setTimeout(() => setActive(true), 1000);
  }, []);

  useEffect(() => {
    if (!active) return;
    const el = document.querySelector(TOUR_STEPS[step].target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setPosition({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
    } else {
      setPosition({ top: 80, left: window.innerWidth / 2 });
    }
  }, [active, step]);

  const handleNext = () => {
    if (step < TOUR_STEPS.length - 1) setStep(s => s + 1);
    else { setActive(false); localStorage.setItem('prime_erp_onboarding_done', 'true'); }
  };

  const handleSkip = () => {
    setActive(false);
    localStorage.setItem('prime_erp_onboarding_done', 'true');
  };

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      <div className="absolute inset-0 bg-black/20" />
      <div className="pointer-events-auto absolute" style={{ top: position.top, left: position.left, transform: 'translateX(-50%)' }}>
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-5 w-80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-indigo-600"><Compass size={16} /><span className="text-xs font-semibold uppercase tracking-wider">Step {step + 1} of {TOUR_STEPS.length}</span></div>
            <button onClick={handleSkip} className="p-1 text-slate-400 hover:text-slate-600"><X size={14} /></button>
          </div>
          <h3 className="font-bold text-slate-900 mb-1">{TOUR_STEPS[step].title}</h3>
          <p className="text-sm text-slate-500 mb-4">{TOUR_STEPS[step].content}</p>
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">{TOUR_STEPS.map((_, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === step ? 'bg-indigo-600' : 'bg-slate-200'}`} />)}</div>
            <div className="flex gap-2">
              {step > 0 && <button onClick={() => setStep(s => s - 1)} className="p-1.5 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100"><ChevronLeft size={16} /></button>}
              <button onClick={handleNext} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1">{step < TOUR_STEPS.length - 1 ? <>Next <ChevronRight size={14} /></> : 'Done'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;

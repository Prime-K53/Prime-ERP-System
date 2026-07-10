import React, { useState } from 'react';
import { BarChart3, FileBarChart, FileText, Scale, Target, FileCheck, TrendingUp, DollarSign, History, CheckCircle2, Activity } from 'lucide-react';
import GenericHub from './GenericHub';
import ReportOptionsModal from '../components/ReportOptionsModal';

const FiscalReportsHub: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<{ type: any, label: string } | null>(null);

  const options = [
    {
      label: 'Profit & loss',
      description: 'Review revenue, expenses, and net profit over a specific period.',
      icon: <TrendingUp />,
      color: 'bg-blue-50 text-blue-600',
      path: '/fiscal-reports/financials?type=IncomeStatement'
    },
    {
      label: 'Balance sheet',
      description: 'Snapshot of assets, liabilities, and equity at a point in time.',
      icon: <Scale />,
      color: 'bg-blue-50 text-blue-600',
      path: '/fiscal-reports/financials?type=BalanceSheet'
    },
    {
      label: 'Cash flow',
      description: 'Track the flow of cash in and out of your business.',
      icon: <Activity />,
      color: 'bg-blue-50 text-blue-600',
      path: '/fiscal-reports/financials?type=CashFlow'
    },
    {
      label: 'Trial balance',
      description: 'Verify the mathematical accuracy of your ledger balances.',
      icon: <FileCheck />,
      color: 'bg-blue-50 text-blue-600',
      path: '/fiscal-reports/financials?type=TrialBalance'
    },
    {
      label: 'Budget analysis',
      description: 'Compare actual spending against your planned budgets.',
      icon: <Target />,
      color: 'bg-blue-50 text-blue-600',
      path: '/fiscal-reports/financials?type=Budget'
    },
    {
      label: 'Aged receivables',
      description: 'Track outstanding customer invoices and their overdue status.',
      icon: <History />,
      color: 'bg-blue-50 text-blue-600',
      path: '/fiscal-reports/financials?type=AgedAR'
    },
    {
      label: 'Financials',
      description: 'Balance sheet, P&L, trial balance, and cash flow.',
      path: '/fiscal-reports/financials',
      icon: <BarChart3 />,
      color: 'bg-blue-50 text-blue-500'
    },
    {
      label: 'Aged reports',
      description: 'Aged receivables and payables analysis.',
      icon: <FileText />,
      color: 'bg-blue-50 text-blue-600',
      path: '/fiscal-reports/financials?type=AgedAP'
    }
  ];

  return (
    <>
      <GenericHub
        title="Fiscal reports"
        subtitle="Comprehensive financial oversight, auditing, and performance reporting."
        options={options}
        accentColor="#6366f1"
      />
      {selectedReport && (
        <ReportOptionsModal
          isOpen={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          reportType={selectedReport.type}
          reportLabel={selectedReport.label}
        />
      )}
    </>
  );
};

export default FiscalReportsHub;

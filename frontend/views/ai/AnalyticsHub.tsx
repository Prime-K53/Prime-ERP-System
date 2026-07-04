import React from 'react';
import { Layers, TrendingUp, AlertTriangle, Users, Package, FileSearch, Calendar, MessageSquare, Shield, FileText } from 'lucide-react';
import GenericHub from '../GenericHub';

const AnalyticsHub: React.FC = () => {
  const options = [
    { label: 'Gang Run Optimizer', description: 'Group similar print jobs to reduce setup waste and maximize press utilization.', path: '/smart-operations/ai/gang-run', icon: <Layers />, color: 'bg-blue-50 text-blue-500' },
    { label: 'Cash Flow Forecaster', description: 'ML-based cash flow projections from AR, AP, invoices, and historical trends.', path: '/smart-operations/ai/cash-flow', icon: <TrendingUp />, color: 'bg-emerald-50 text-emerald-500' },
    { label: 'Anomaly Detector', description: 'Flag unusual transactions, pricing overrides, and security events.', path: '/smart-operations/ai/anomalies', icon: <AlertTriangle />, color: 'bg-red-50 text-red-500' },
    { label: 'Churn Predictor', description: 'Identify at-risk customers from declining order patterns and engagement.', path: '/smart-operations/ai/churn', icon: <Users />, color: 'bg-orange-50 text-orange-500' },
    { label: 'Reorder Optimizer', description: 'Smart inventory reorder points with EOQ, safety stock, and demand variability.', path: '/smart-operations/ai/reorder', icon: <Package />, color: 'bg-cyan-50 text-cyan-500' },
    { label: 'PO Matcher', description: '3-way matching: Purchase Orders vs Goods Receipts vs Supplier Invoices.', path: '/smart-operations/ai/po-match', icon: <FileSearch />, color: 'bg-violet-50 text-violet-500' },
    { label: 'Smart Scheduler', description: 'Constraint-based production scheduling across work centers and resources.', path: '/smart-operations/ai/scheduler', icon: <Calendar />, color: 'bg-indigo-50 text-indigo-500' },
    { label: 'Conversational Query', description: 'Ask business questions in plain English — get instant answers.', path: '/smart-operations/ai/query', icon: <MessageSquare />, color: 'bg-purple-50 text-purple-500' },
    { label: 'Audit Investigator', description: 'AI-powered audit trail analysis with integrity verification.', path: '/smart-operations/ai/audit', icon: <Shield />, color: 'bg-slate-50 text-slate-500' },
    { label: 'BOM Generator', description: 'Auto-generate Bill of Materials from product specifications.', path: '/smart-operations/ai/bom', icon: <FileText />, color: 'bg-teal-50 text-teal-500' },
  ];

  return (
    <GenericHub
      title="AI Analytics"
      subtitle="AI-Powered Business Intelligence & Operational Optimization"
      options={options}
      accentColor="#8b5cf6"
    />
  );
};

export default AnalyticsHub;

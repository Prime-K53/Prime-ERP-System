import React from 'react';
import { Sparkles, TrendingUp, Calculator, MessageSquare, Brain, BarChart3 } from 'lucide-react';
import GenericHub from './GenericHub';

const SmartOperationsHub: React.FC = () => {
  const options = [
    {
      label: 'AI Assistant',
      description: 'AI-powered chat for business insights, analytics, and smart recommendations.',
      path: '/smart-operations/ai',
      icon: <Brain />,
      color: 'bg-blue-50 text-blue-600'
    },
    {
      label: 'AI Analytics',
      description: 'Gang Run, Cash Flow, Anomaly Detection, Churn, Reorder, PO Match, Schedule, Query, Audit, BOM.',
      path: '/smart-operations/ai/analytics',
      icon: <BarChart3 />,
      color: 'bg-blue-50 text-blue-600'
    },
    {
      label: 'Market Adjustments',
      description: 'Manage global cost layers, inflation adjustments, and logistics surcharges.',
      path: '/smart-operations/adjustments',
      icon: <TrendingUp />,
      color: 'bg-blue-50 text-blue-600'
    },
    {
      label: 'Smart Pricing Engine',
      description: 'Calculate item prices with market adjustments and generate revenue reports.',
      path: '/smart-operations/pricing',
      icon: <Calculator />,
      color: 'bg-blue-50 text-blue-600'
    },
    {
      label: 'Marketing Messages',
      description: 'WhatsApp automation, bulk campaigns, and customer communications.',
      path: '/smart-operations/messages',
      icon: <MessageSquare />,
      color: 'bg-blue-50 text-blue-600'
    }
  ];

  return (
    <GenericHub 
      title="Smart Operations" 
      subtitle="Smart Operations"
      options={options}
      accentColor="#6366f1"
    />
  );
};

export default SmartOperationsHub;

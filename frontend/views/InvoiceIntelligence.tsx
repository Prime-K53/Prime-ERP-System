import React, { useState } from 'react';
import { logger } from '@/services/logger';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, AlertCircle, CheckCircle2, Clock,
  FileText, Shield, Copy, Percent,
  DollarSign, Loader2, Flag, Users, Ban,
  TrendingUp, TrendingDown, ChevronRight, BrainCircuit,
  Search, BarChart3
} from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { useFinance } from '../context/FinanceContext';
import {
  detectDuplicateInvoices, validateInvoiceTotals,
  identifyMissingTaxInfo, flagOverduePayments,
  detectSuspiciousInvoices
} from '../services/invoiceIntelligenceService';
import { formatCurrency } from '../services/reportSummaryService';
import { useApp } from '../context/AppContext';

const toSafeNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

type Tab = 'duplicates' | 'validation' | 'overdue' | 'suspicious' | 'tax';

const TABS: { key: Tab; label: string; icon: React.FC<{ size?: number }>; desc: string; color: string }[] = [
  { key: 'duplicates', label: 'Duplicate Detection', icon: Copy, desc: 'Flag potentially duplicated invoices', color: '#7c3aed' },
  { key: 'validation', label: 'Validation Issues', icon: AlertCircle, desc: 'Invoice total mismatches and errors', color: '#dc2626' },
  { key: 'overdue', label: 'Overdue Payments', icon: Clock, desc: 'Past-due invoices requiring follow-up', color: '#ea580c' },
  { key: 'suspicious', label: 'Suspicious Activity', icon: Shield, desc: 'High-risk invoice patterns detected', color: '#dc2626' },
  { key: 'tax', label: 'Missing Tax Info', icon: Percent, desc: 'Incomplete tax documentation', color: '#b45309' },
];

const SeverityBadge = ({ severity }: { severity: 'low' | 'medium' | 'high' | 'critical' }) => {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    low: { bg: '#f0fdf4', color: '#16a34a', label: 'Low' },
    medium: { bg: '#fffbeb', color: '#b45309', label: 'Medium' },
    high: { bg: '#fef2f2', color: '#dc2626', label: 'High' },
    critical: { bg: '#fef2f2', color: '#991b1b', label: 'Critical' },
  };
  const s = config[severity] || config.low;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: s.bg, color: s.color, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
      {s.label}
    </span>
  );
};

const RiskScoreBadge = ({ score }: { score: number }) => {
  const color = score >= 70 ? '#dc2626' : score >= 40 ? '#b45309' : '#16a34a';
  const bg = score >= 70 ? '#fef2f2' : score >= 40 ? '#fffbeb' : '#f0fdf4';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: bg, color, padding: '2px 8px', borderRadius: 6 }}>
      {score}/100
    </span>
  );
};

const InvoiceIntelligence: React.FC = () => {
  const navigate = useNavigate();
  const { companyConfig } = useApp();
  const { invoices: contextInvoices } = useFinance();
  const { customers: contextCustomers } = useSales();

  const invoices = Array.isArray(contextInvoices) ? contextInvoices : [];
  const customers = Array.isArray(contextCustomers) ? contextCustomers : [];

  const [activeTab, setActiveTab] = useState<Tab>('duplicates');
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<{ invoiceId: string; duplicateOf: string; confidence: number; reason: string }[]>([]);
  const [validationResults, setValidationResults] = useState<{ invoiceId: string; valid: boolean; issues: string[] }[]>([]);
  const [missingTaxInvoices, setMissingTaxInvoices] = useState<{ invoiceId: string; customerName: string; missingFields: string[] }[]>([]);
  const [overduePayments, setOverduePayments] = useState<{ invoiceId: string; customerName: string; amountDue: number; daysOverdue: number; severity: 'low' | 'medium' | 'high' }[]>([]);
  const [suspiciousInvoices, setSuspiciousInvoices] = useState<{ invoiceId: string; flags: string[]; riskScore: number }[]>([]);

  const invoicesCount = invoices.length;
  const customersCount = customers.length;

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const duplicateResults = await detectDuplicateInvoices(invoices);
      setDuplicates(duplicateResults);

      const validation = invoices
        .map((inv: any) => ({ invoiceId: inv.id, ...validateInvoiceTotals(inv) }))
        .filter((r: any) => !r.valid);
      setValidationResults(validation);

      const missing = invoices
        .map((inv: any) => ({ invoiceId: inv.id, customerName: inv.customerName || 'Unknown', missingFields: identifyMissingTaxInfo(inv) }))
        .filter((r: any) => r.missingFields.length > 0);
      setMissingTaxInvoices(missing);

      const overdue = flagOverduePayments(invoices, { lateFeeEnabled: true, graceDays: 3 });
      setOverduePayments(overdue);

      const suspicious = detectSuspiciousInvoices(invoices);
      setSuspiciousInvoices(suspicious.filter((s: any) => s.riskScore > 0));
    } catch (err) {
      logger.error('InvoiceIntelligence analysis error', err);
    } finally {
      setLoading(false);
    }
  };

  const totalIssues = validationResults.length + missingTaxInvoices.length + suspiciousInvoices.length + overduePayments.length;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f0f4f8', flexDirection: 'column', gap: 16 }}>
        <Loader2 size={40} className="animate-spin" style={{ color: '#6366f1' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>Analyzing invoices...</span>
      </div>
    );
  }

  const emptyState = (icon: React.ReactNode, message: string) => (
    <div style={{ padding: '60px 0', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
        {icon}
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>{message}</p>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'duplicates':
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>Duplicate Detection</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                  {duplicates.length > 0 ? `${duplicates.length} potential duplicate${duplicates.length !== 1 ? 's' : ''} found` : 'Scanning for duplicate invoices'}
                </p>
              </div>
              {duplicates.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', backgroundColor: '#f5f3ff', padding: '4px 12px', borderRadius: 8 }}>
                  {duplicates.length} duplicate{duplicates.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {duplicates.length > 0 ? (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Invoice ID</th>
                        <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Duplicate Of</th>
                        <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confidence</th>
                        <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reason</th>
                        <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {duplicates.map((d, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafbfc'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a', fontFamily: 'monospace', fontSize: 12 }}>{d.invoiceId.slice(0, 12)}...</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a', fontFamily: 'monospace', fontSize: 12 }}>{d.duplicateOf.slice(0, 12)}...</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: d.confidence >= 0.9 ? '#fef2f2' : '#fffbeb', color: d.confidence >= 0.9 ? '#dc2626' : '#b45309' }}>
                              {(d.confidence * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#475569' }}>{d.reason}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button onClick={() => navigate(`/sales-flow/invoices?id=${d.invoiceId}`)} style={{ border: 'none', background: '#eef2ff', color: '#4f46e5', padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              Review <ChevronRight size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : emptyState(<CheckCircle2 size={28} color="#16a34a" />, 'No duplicate invoices detected.')}
          </div>
        );

      case 'validation':
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>Validation Issues</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                  {validationResults.length > 0 ? `${validationResults.length} invoice${validationResults.length !== 1 ? 's' : ''} with total mismatches` : 'All invoices pass validation'}
                </p>
              </div>
              {validationResults.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', backgroundColor: '#fef2f2', padding: '4px 12px', borderRadius: 8 }}>
                  {validationResults.length} issue{validationResults.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {validationResults.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {validationResults.slice(0, 10).map((r, i) => (
                  <div key={i} style={{ padding: '14px 18px', borderRadius: 12, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', fontFamily: 'monospace' }}>{r.invoiceId.slice(0, 12)}...</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', backgroundColor: '#fecaca', padding: '2px 8px', borderRadius: 4 }}>Invalid</span>
                    </div>
                    {r.issues.map((issue, j) => (
                      <div key={j} style={{ fontSize: 12, color: '#7f1d1d', padding: '2px 0', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{ color: '#dc2626', flexShrink: 0 }}>•</span>
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {validationResults.length > 10 && (
                  <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', fontWeight: 600, padding: 8 }}>
                    +{validationResults.length - 10} more issues
                  </div>
                )}
              </div>
            ) : emptyState(<CheckCircle2 size={28} color="#16a34a" />, 'All invoices pass validation.')}
          </div>
        );

      case 'overdue':
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>Overdue Payments</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                  {overduePayments.length > 0 ? `${overduePayments.length} overdue invoice${overduePayments.length !== 1 ? 's' : ''} requiring attention` : 'No overdue payments'}
                </p>
              </div>
              {overduePayments.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#ea580c', backgroundColor: '#fff7ed', padding: '4px 12px', borderRadius: 8 }}>
                  {overduePayments.length} overdue
                </span>
              )}
            </div>
            {overduePayments.length > 0 ? (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer</th>
                        <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount Due</th>
                        <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Days Overdue</th>
                        <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Severity</th>
                        <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overduePayments.map((o, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafbfc'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{o.customerName}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(o.amountDue)}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                            <span style={{ color: o.daysOverdue > 30 ? '#dc2626' : '#b45309' }}>
                              {o.daysOverdue} {o.daysOverdue === 1 ? 'day' : 'days'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}><SeverityBadge severity={o.severity} /></td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button onClick={() => navigate(`/sales-flow/invoices?id=${o.invoiceId}`)} style={{ border: 'none', background: '#eef2ff', color: '#4f46e5', padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              View <ChevronRight size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : emptyState(<CheckCircle2 size={28} color="#16a34a" />, 'No overdue payments found.')}
          </div>
        );

      case 'suspicious':
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>Suspicious Activity</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                  {suspiciousInvoices.length > 0 ? `${suspiciousInvoices.length} flagged invoice${suspiciousInvoices.length !== 1 ? 's' : ''} with unusual patterns` : 'No suspicious activity detected'}
                </p>
              </div>
              {suspiciousInvoices.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', backgroundColor: '#fef2f2', padding: '4px 12px', borderRadius: 8 }}>
                  {suspiciousInvoices.length} flagged
                </span>
              )}
            </div>
            {suspiciousInvoices.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                {suspiciousInvoices.map((s, i) => (
                  <div key={i} style={{
                    padding: '18px', borderRadius: 14,
                    backgroundColor: s.riskScore >= 70 ? '#fef2f2' : s.riskScore >= 40 ? '#fffbeb' : '#f8fafc',
                    border: `1px solid ${s.riskScore >= 70 ? '#fecaca' : s.riskScore >= 40 ? '#fde68a' : '#e2e8f0'}`,
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: '#1e293b' }}>
                        {s.invoiceId.slice(0, 14)}...
                      </span>
                      <RiskScoreBadge score={s.riskScore} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {s.flags.map((flag, j) => (
                        <div key={j} style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <Flag size={12} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
                          <span>{flag}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => navigate(`/sales-flow/invoices?id=${s.invoiceId}`)} style={{
                      border: 'none', background: '#eef2ff', color: '#4f46e5', padding: '6px 14px', borderRadius: 8,
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                      alignSelf: 'flex-start', marginTop: 4,
                    }}>
                      Investigate <ChevronRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : emptyState(<Shield size={28} color="#16a34a" />, 'No suspicious activity detected.')}
          </div>
        );

      case 'tax':
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>Missing Tax Information</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                  {missingTaxInvoices.length > 0 ? `${missingTaxInvoices.length} invoice${missingTaxInvoices.length !== 1 ? 's' : ''} with incomplete tax data` : 'All invoices have complete tax info'}
                </p>
              </div>
              {missingTaxInvoices.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', backgroundColor: '#fffbeb', padding: '4px 12px', borderRadius: 8 }}>
                  {missingTaxInvoices.length} affected
                </span>
              )}
            </div>
            {missingTaxInvoices.length > 0 ? (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Invoice ID</th>
                        <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer</th>
                        <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Missing Fields</th>
                        <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missingTaxInvoices.map((m, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafbfc'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a', fontFamily: 'monospace', fontSize: 12 }}>{m.invoiceId.slice(0, 12)}...</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{m.customerName}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {m.missingFields.map((field, j) => (
                                <span key={j} style={{ fontSize: 10, fontWeight: 700, backgroundColor: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: 4 }}>
                                  {field}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button onClick={() => navigate(`/sales-flow/invoices?id=${m.invoiceId}`)} style={{ border: 'none', background: '#eef2ff', color: '#4f46e5', padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              Fix <ChevronRight size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : emptyState(<CheckCircle2 size={28} color="#16a34a" />, 'All invoices have complete tax information.')}
          </div>
        );
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f4f8 0%, #eef2ff 100%)',
      padding: '20px',
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: '#1e293b',
    }}>
      <div style={{ maxWidth: 1520, width: '100%', margin: '0 auto', display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', borderRadius: 16, padding: '20px 18px', color: '#fff', boxShadow: '0 8px 32px rgba(15,23,42,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                <Shield size={18} />
              </div>
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>Invoice</h1>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Intelligence</p>
              </div>
            </div>
            <button
              onClick={runAnalysis}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '8px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            >
              <Loader2 size={13} /> Run Analysis
            </button>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10,
                  border: 'none', background: isActive ? '#fff' : 'transparent',
                  boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s', marginBottom: 2,
                }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: isActive ? `${tab.color}15` : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <tab.icon size={15} color={isActive ? tab.color : '#94a3b8'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 600, color: isActive ? '#0f172a' : '#475569' }}>{tab.label}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.desc}</div>
                  </div>
                  {isActive && <ChevronRight size={14} color={tab.color} />}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', borderRadius: 12, padding: '12px', border: '1px solid rgba(255,255,255,0.6)', textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Validated</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#6366f1', marginTop: 4 }}>{invoicesCount}</div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>invoices</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', borderRadius: 12, padding: '12px', border: '1px solid rgba(255,255,255,0.6)', textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Issues</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: totalIssues > 0 ? '#dc2626' : '#16a34a', marginTop: 4 }}>{totalIssues}</div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>found</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', borderRadius: 12, padding: '12px', border: '1px solid rgba(255,255,255,0.6)', textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overdue</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#ea580c', marginTop: 4 }}>{overduePayments.length}</div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>payments</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', borderRadius: 12, padding: '12px', border: '1px solid rgba(255,255,255,0.6)', textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customers</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed', marginTop: 4 }}>{customersCount}</div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>tracked</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '24px', overflow: 'auto' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default InvoiceIntelligence;

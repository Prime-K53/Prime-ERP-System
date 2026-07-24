import React, { useState } from 'react';
import { logger } from '@/services/logger';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, AlertCircle, CheckCircle2, Clock,
  FileText, Shield, Copy, Percent,
  DollarSign, Calendar, ArrowRight,
  Loader2, Flag, Hash, Users, Ban, X,
  TrendingUp, TrendingDown, ChevronRight
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

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.75)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRadius: 16,
  padding: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  border: '1px solid rgba(255,255,255,0.6)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const cardHeaderStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#64748b',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontWeight: 700,
  color: '#64748b',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid #f1f5f9',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #f1f5f9',
  color: '#1e293b',
  fontWeight: 500,
  fontSize: 12,
};

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

const StatCard = ({ label, value, icon, color, bg }: { label: string; value: string | number; icon: React.ReactNode; color: string; bg: string }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, borderLeft: `3px solid ${color}` }}>
    <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{value}</div>
    </div>
  </div>
);

const InvoiceIntelligence: React.FC = () => {
  const navigate = useNavigate();
  const { companyConfig } = useApp();
  const currencySymbol = companyConfig?.currencySymbol || '$';

  const { invoices: contextInvoices } = useFinance();
  const { customers: contextCustomers } = useSales();

  const invoices = Array.isArray(contextInvoices) ? contextInvoices : [];
  const customers = Array.isArray(contextCustomers) ? contextCustomers : [];

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
        .map((inv: any) => ({
          invoiceId: inv.id,
          ...validateInvoiceTotals(inv)
        }))
        .filter((r: any) => !r.valid);
      setValidationResults(validation);

      const missing = invoices
        .map((inv: any) => ({
          invoiceId: inv.id,
          customerName: inv.customerName || 'Unknown',
          missingFields: identifyMissingTaxInfo(inv)
        }))
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
  const totalValidated = invoicesCount;

  const emptyState = (icon: React.ReactNode, message: string) => (
    <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
      {icon}
      <p style={{ margin: '8px 0 0' }}>{message}</p>
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', flexDirection: 'column', gap: 16 }}>
        <Loader2 size={40} className="animate-spin text-indigo-500" />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>Analyzing invoices...</span>
      </div>
    );
  }

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-4 duration-700"
      style={{
        minHeight: '100vh',
background: '#f0f4f8',
        padding: '24px',
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: '#1e293b',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          border: '1px solid #e2e8f0',
          maxWidth: 1520,
          width: '100%',
          margin: '0 auto',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} color="#6366f1" />
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Invoice Intelligence
            </h1>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', backgroundColor: '#eef2ff', padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              AI Analysis
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
              {invoicesCount} invoices · {customersCount} customers
            </span>
            <button
              onClick={runAnalysis}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8,
                border: '1px solid #E2E8F0', backgroundColor: '#fff',
                fontSize: 12, fontWeight: 600, color: '#6366f1',
                cursor: 'pointer',
              }}
            >
              <Loader2 size={14} /> Re-run Analysis
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Validation Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <StatCard
              label="Invoices Validated"
              value={totalValidated}
              icon={<FileText size={16} />}
              color="#4f46e5"
              bg="#eef2ff"
            />
            <StatCard
              label="Issues Found"
              value={totalIssues}
              icon={<AlertTriangle size={16} />}
              color="#dc2626"
              bg="#fef2f2"
            />
            <StatCard
              label="Missing Tax Info"
              value={missingTaxInvoices.length}
              icon={<Percent size={16} />}
              color="#b45309"
              bg="#fffbeb"
            />
            <StatCard
              label="Overdue Payments"
              value={overduePayments.length}
              icon={<Clock size={16} />}
              color="#ea580c"
              bg="#fff7ed"
            />
            <StatCard
              label="Suspicious Flagged"
              value={suspiciousInvoices.length}
              icon={<Shield size={16} />}
              color="#dc2626"
              bg="#fef2f2"
            />
            <StatCard
              label="Potential Duplicates"
              value={duplicates.length}
              icon={<Copy size={16} />}
              color="#7c3aed"
              bg="#f5f3ff"
            />
          </div>

          {/* Duplicate Detection */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Copy size={16} color="#7c3aed" />
                <div style={cardHeaderStyle}>Duplicate Detection</div>
              </div>
              {duplicates.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', backgroundColor: '#f5f3ff', padding: '2px 8px', borderRadius: 6 }}>
                  {duplicates.length} potential {duplicates.length === 1 ? 'duplicate' : 'duplicates'}
                </span>
              )}
            </div>
            {duplicates.length > 0 ? (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Invoice ID</th>
                    <th style={thStyle}>Duplicate Of</th>
                    <th style={thStyle}>Confidence</th>
                    <th style={thStyle}>Reason</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicates.map((d, i) => (
                    <tr key={i}>
                      <td style={{ ...tdStyle, fontWeight: 600, fontFamily: 'monospace' }}>{d.invoiceId.slice(0, 12)}...</td>
                      <td style={{ ...tdStyle, fontWeight: 600, fontFamily: 'monospace' }}>{d.duplicateOf.slice(0, 12)}...</td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          backgroundColor: d.confidence >= 0.9 ? '#fef2f2' : '#fffbeb',
                          color: d.confidence >= 0.9 ? '#dc2626' : '#b45309',
                        }}>
                          {(d.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td style={tdStyle}>{d.reason}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => navigate(`/sales-flow/invoices?id=${d.invoiceId}`)}
                          style={{
                            border: 'none', background: '#eef2ff', color: '#4f46e5',
                            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          Review <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : emptyState(<Copy size={32} style={{ opacity: 0.2 }} />, 'No duplicate invoices detected.')}
          </div>

          {/* Validation Results */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} color="#dc2626" />
                <div style={cardHeaderStyle}>Validation Issues</div>
              </div>
              {validationResults.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: 6 }}>
                  {validationResults.length} {validationResults.length === 1 ? 'issue' : 'issues'}
                </span>
              )}
            </div>
            {validationResults.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {validationResults.slice(0, 10).map((r, i) => (
                  <div key={i} style={{ padding: '12px 16px', borderRadius: 12, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', fontFamily: 'monospace' }}>{r.invoiceId.slice(0, 12)}...</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', backgroundColor: '#fecaca', padding: '1px 6px', borderRadius: 4 }}>Invalid</span>
                    </div>
                    {r.issues.map((issue, j) => (
                      <div key={j} style={{ fontSize: 11, color: '#7f1d1d', padding: '2px 0', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{ color: '#dc2626', flexShrink: 0 }}>•</span>
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {validationResults.length > 10 && (
                  <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', fontWeight: 600, padding: 8 }}>
                    +{validationResults.length - 10} more issues
                  </div>
                )}
              </div>
            ) : emptyState(<CheckCircle2 size={32} style={{ opacity: 0.2 }} />, 'All invoices pass validation.')}
          </div>

          {/* Overdue Payments */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} color="#ea580c" />
                <div style={cardHeaderStyle}>Overdue Payments</div>
              </div>
              {overduePayments.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#ea580c', backgroundColor: '#fff7ed', padding: '2px 8px', borderRadius: 6 }}>
                  {overduePayments.length} overdue
                </span>
              )}
            </div>
            {overduePayments.length > 0 ? (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Customer</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Amount Due</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Days Overdue</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Severity</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {overduePayments.map((o, i) => (
                    <tr key={i}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{o.customerName}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                        {formatCurrency(o.amountDue, currencySymbol)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                        <span style={{ color: o.daysOverdue > 30 ? '#dc2626' : '#b45309' }}>
                          {o.daysOverdue} {o.daysOverdue === 1 ? 'day' : 'days'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><SeverityBadge severity={o.severity} /></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => navigate(`/sales-flow/invoices?id=${o.invoiceId}`)}
                          style={{
                            border: 'none', background: '#eef2ff', color: '#4f46e5',
                            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          View <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : emptyState(<CheckCircle2 size={32} style={{ opacity: 0.2 }} />, 'No overdue payments found.')}
          </div>

          {/* Suspicious Activity */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={16} color="#dc2626" />
                <div style={cardHeaderStyle}>Suspicious Activity</div>
              </div>
              {suspiciousInvoices.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: 6 }}>
                  {suspiciousInvoices.length} flagged
                </span>
              )}
            </div>
            {suspiciousInvoices.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {suspiciousInvoices.map((s, i) => (
                  <div key={i} style={{
                    padding: '16px', borderRadius: 16,
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
                    <button
                      onClick={() => navigate(`/sales-flow/invoices?id=${s.invoiceId}`)}
                      style={{
                        border: 'none', background: '#eef2ff', color: '#4f46e5',
                        padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                        alignSelf: 'flex-start', marginTop: 4,
                      }}
                    >
                      Investigate <ArrowRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : emptyState(<Shield size={32} style={{ opacity: 0.2 }} />, 'No suspicious activity detected.')}
          </div>

          {/* Missing Tax Info */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Percent size={16} color="#b45309" />
                <div style={cardHeaderStyle}>Missing Tax Information</div>
              </div>
              {missingTaxInvoices.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#b45309', backgroundColor: '#fffbeb', padding: '2px 8px', borderRadius: 6 }}>
                  {missingTaxInvoices.length} affected
                </span>
              )}
            </div>
            {missingTaxInvoices.length > 0 ? (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Invoice ID</th>
                    <th style={thStyle}>Customer</th>
                    <th style={thStyle}>Missing Fields</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {missingTaxInvoices.map((m, i) => (
                    <tr key={i}>
                      <td style={{ ...tdStyle, fontWeight: 600, fontFamily: 'monospace' }}>{m.invoiceId.slice(0, 12)}...</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{m.customerName}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {m.missingFields.map((field, j) => (
                            <span key={j} style={{ fontSize: 10, fontWeight: 700, backgroundColor: '#fef2f2', color: '#dc2626', padding: '1px 6px', borderRadius: 4 }}>
                              {field}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => navigate(`/sales-flow/invoices?id=${m.invoiceId}`)}
                          style={{
                            border: 'none', background: '#eef2ff', color: '#4f46e5',
                            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          Fix <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : emptyState(<CheckCircle2 size={32} style={{ opacity: 0.2 }} />, 'All invoices have complete tax information.')}
          </div>

        </div>
      </div>
    </div>
  );
};

export default InvoiceIntelligence;

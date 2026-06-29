import React from 'react';
import { Customer } from '../../../types';

interface CustomerCardProps {
  customer: Customer;
  onClose: () => void;
  onViewProfile?: (customer: Customer) => void;
  onEdit?: (customer: Customer) => void;
  onCreateInvoice?: (customer: Customer) => void;
  onCreateQuote?: (customer: Customer) => void;
  onStatement?: (customer: Customer) => void;
  onWhatsApp?: (customer: Customer) => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  onClose,
  onViewProfile,
  onEdit,
  onCreateInvoice,
  onCreateQuote,
  onStatement,
  onWhatsApp,
}) => {
  return (
    <>
      <style>{`
        .ccard *, .ccard *::before, .ccard *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        .ccard {
          font-family: 'DM Sans', sans-serif;
          width: 480px;
          background: #fff;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,.06), 0 12px 32px -4px rgba(0,0,0,.10);
        }
        .ccard-header {
          background: linear-gradient(135deg, #1A3A5C 0%, #0F5FA6 100%);
          padding: 28px 28px 20px;
          position: relative;
        }
        .ccard-header-top {
          display: flex;
          align-items: flex-start;
          gap: 16px;
        }
        .ccard-avatar {
          width: 64px;
          height: 64px;
          border-radius: 14px;
          background: rgba(255,255,255,0.15);
          border: 2px solid rgba(255,255,255,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 26px;
          font-weight: 600;
          color: #fff;
          letter-spacing: -1px;
        }
        .ccard-meta {
          flex: 1;
          min-width: 0;
        }
        .ccard-name {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          line-height: 1.25;
          margin-bottom: 4px;
        }
        .ccard-id {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: rgba(255,255,255,0.55);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .ccard-status-pill {
          margin-top: 6px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 20px;
          padding: 3px 10px;
          font-size: 11px;
          color: rgba(255,255,255,0.85);
          font-weight: 500;
        }
        .ccard-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4ADE80;
        }
        .ccard-close-btn {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: rgba(255,255,255,0.12);
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          transition: background .15s;
          flex-shrink: 0;
        }
        .ccard-close-btn:hover {
          background: rgba(255,255,255,0.22);
        }
        .ccard-contact-strip {
          display: flex;
          gap: 12px;
          margin-top: 18px;
        }
        .ccard-contact-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 12px;
          color: rgba(255,255,255,0.85);
        }
        .ccard-contact-chip svg { opacity: .75; flex-shrink: 0; }
        .ccard-body { padding: 22px 24px 24px; }
        .ccard-finance-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 20px;
        }
        .ccard-finance-box {
          border-radius: 12px;
          padding: 14px 16px;
          background: #F7F9FC;
          border: 1px solid #E8ECF2;
          position: relative;
          overflow: hidden;
        }
        .ccard-finance-box::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          border-radius: 12px 12px 0 0;
        }
        .ccard-finance-box.balance::after { background: #EF4444; }
        .ccard-finance-box.wallet::after  { background: #10B981; }
        .ccard-finance-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8492A6;
          margin-bottom: 6px;
        }
        .ccard-finance-amount {
          font-family: 'DM Mono', monospace;
          font-size: 22px;
          font-weight: 500;
          color: #1C2A3A;
          line-height: 1;
        }
        .ccard-finance-box.balance .ccard-finance-amount { color: #DC2626; }
        .ccard-finance-box.wallet  .ccard-finance-amount { color: #059669; }
        .ccard-section-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #8492A6;
          margin-bottom: 10px;
        }
        .ccard-sub-accounts {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 20px;
        }
        .ccard-sub-account {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: #F7F9FC;
          border: 1px solid #E8ECF2;
          border-radius: 10px;
          font-size: 13px;
          color: #2C3E50;
          font-weight: 500;
        }
        .ccard-sub-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .ccard-sub-icon {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: #E8F0FE;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
        }
        .ccard-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 20px;
        }
        .ccard-badge.active { background: #DCFCE7; color: #15803D; }
        .ccard-actions {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .ccard-action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 12px 8px 10px;
          background: #F7F9FC;
          border: 1px solid #E8ECF2;
          border-radius: 12px;
          cursor: pointer;
          transition: background .15s, border-color .15s, transform .1s;
          text-decoration: none;
          color: #3B4A5C;
          font-size: 11px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
        }
        .ccard-action-btn:hover {
          background: #EDF2FB;
          border-color: #C4D0E8;
          transform: translateY(-1px);
        }
        .ccard-action-btn svg { color: #0F5FA6; }
        .ccard-action-btn.whatsapp svg { color: #25D366; }
        .ccard-action-btn.profile svg { color: #7C3AED; }
        .ccard-action-btn.edit svg { color: #F59E0B; }
        .ccard-divider {
          height: 1px;
          background: #EBF0F6;
          margin: 18px 0;
        }
      `}</style>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.08)' }}
        onClick={onClose}
      >
        <div className="ccard" onClick={(e) => e.stopPropagation()}>
          {/* HEADER */}
          <div className="ccard-header">
            <div className="ccard-header-top">
              <div className="ccard-avatar">
                {customer.name?.charAt(0)?.toUpperCase() || '?'}
                {customer.name?.split(' ')[1]?.charAt(0)?.toUpperCase() || ''}
              </div>
              <div className="ccard-meta">
                <div className="ccard-name">{customer.name}</div>
                <div className="ccard-id">{customer.id} · {customer.segment || 'Individual'}</div>
                <div className="ccard-status-pill">
                  <span className="ccard-status-dot"></span>
                  {customer.status || 'Active'}
                </div>
              </div>
              <button className="ccard-close-btn" title="Close" onClick={onClose}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="ccard-contact-strip">
              {customer.phone && (
                <div className="ccard-contact-chip">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.92 1.18 2 2 0 012.92 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z"/>
                  </svg>
                  {customer.phone}
                </div>
              )}
              {customer.address && (
                <div className="ccard-contact-chip">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  {customer.address}
                </div>
              )}
            </div>
          </div>

          {/* BODY */}
          <div className="ccard-body">
            {/* Finance */}
            <div className="ccard-finance-row">
              <div className="ccard-finance-box balance">
                <div className="ccard-finance-label">Open Balance</div>
                <div className="ccard-finance-amount">${(customer.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="ccard-finance-box wallet">
                <div className="ccard-finance-label">Wallet</div>
                <div className="ccard-finance-amount">${(customer.walletBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            {/* Sub-accounts */}
            {customer.subAccounts && customer.subAccounts.length > 0 && (
              <>
                <div className="ccard-section-label">Sub Accounts ({customer.subAccounts.length})</div>
                <div className="ccard-sub-accounts">
                  {customer.subAccounts.map((sub: any) => (
                    <div key={sub.id} className="ccard-sub-account">
                      <div className="ccard-sub-left">
                        <div className="ccard-sub-icon">{sub.name?.charAt(0)?.toUpperCase() || '?'}</div>
                        {sub.name}
                      </div>
                      <span className={`ccard-badge ${sub.status === 'Active' ? 'active' : ''}`}>{sub.status}</span>
                    </div>
                  ))}
                </div>
                <div className="ccard-divider"></div>
              </>
            )}

            {/* Quick Actions */}
            <div className="ccard-section-label">Quick Actions</div>
            <div className="ccard-actions">
              <button className="ccard-action-btn" onClick={() => onCreateInvoice?.(customer)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                </svg>
                Invoice
              </button>
              <button className="ccard-action-btn" onClick={() => onCreateQuote?.(customer)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                </svg>
                Quote
              </button>
              <button className="ccard-action-btn" onClick={() => onStatement?.(customer)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 17H5a2 2 0 00-2 2v1M15 17h4a2 2 0 012 2v1M12 11V3M8 7l4-4 4 4"/>
                </svg>
                Statement
              </button>
              <button className="ccard-action-btn whatsapp" onClick={() => onWhatsApp?.(customer)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
                WhatsApp
              </button>
              <button className="ccard-action-btn profile" style={{ gridColumn: 'span 2' }} onClick={() => onViewProfile?.(customer)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                View Profile
              </button>
              <button className="ccard-action-btn edit" style={{ gridColumn: 'span 2' }} onClick={() => onEdit?.(customer)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CustomerCard;

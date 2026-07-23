import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const RESPONSES: Record<string, string> = {
  revenue: 'Revenue is up 12% this month. Paid invoices grew 18%, POS sales 7%.',
  profit: 'Net profit margin at 23.4%, 2.1% above target.',
  invoice: '14 outstanding invoices totaling MK 3.2M. 5 overdue >30 days.',
  customer: '8 high-risk customers, MK 1.8M outstanding. Top: Acme Corp.',
  forecast: 'Next month: MK 8.5M revenue projected, MK 5.2M expenses.',
  anomaly: '3 anomalies today: duplicate payment, sales spike, suspicious discount.',
  summary: 'Today: MK 420K revenue, 28 transactions, 3 invoices, 2 payments.',
  help: 'Ask me about revenue, invoices, customers, forecasts, anomalies...',
};

const DEFAULT_RESPONSE = 'I\'m your AI finance assistant. Ask me about revenue, invoices, customers, forecasts, or anomalies.';

function matchResponse(input: string): string {
  const lower = input.toLowerCase();
  for (const [key, reply] of Object.entries(RESPONSES)) {
    if (lower.includes(key)) return reply;
  }
  return DEFAULT_RESPONSE;
}

export default function AICopilot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I\'m your AI Copilot. ' + DEFAULT_RESPONSE },
  ]);
  const [typing, setTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || typing) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', content: matchResponse(text) }]);
      setTyping(false);
    }, 800);
  }, [input, typing]);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              bottom: 80,
              right: 24,
              zIndex: 9999,
              width: 380,
              maxHeight: 500,
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(15,23,42,0.18)',
              border: '1px solid rgba(15,23,42,0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color="#3b82f6" />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>AI Copilot</span>
              </div>
              <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex' }} aria-label="Close AI Copilot">
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200, maxHeight: 340 }}>
              {messages.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: 14,
                  background: m.role === 'user' ? '#3b82f6' : '#1e293b',
                  color: '#fff',
                  fontSize: 13,
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}>
                  {m.content}
                </div>
              ))}
              {typing && (
                <div style={{
                  alignSelf: 'flex-start',
                  padding: '12px 18px',
                  borderRadius: 14,
                  background: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#94a3b8',
                      animation: 'ai-bounce 1.4s infinite ease-in-out both',
                      animationDelay: `${i * 0.16}s`,
                    }} />
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask about revenue, invoices..."
                style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', fontSize: 13, outline: 'none', color: '#0f172a' }}
              />
              <button onClick={handleSend} disabled={typing || !input.trim()} style={{
                border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', width: 38, height: 38, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: typing || !input.trim() ? 0.5 : 1,
              }} aria-label="Send message">
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
        <div style={{
          position: 'absolute', inset: -8, borderRadius: '50%',
          border: '2px solid rgba(59,130,246,0.3)',
          animation: 'ai-pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite',
        }} />
        <button onClick={() => setOpen(o => !o)} style={{
          width: 48, height: 48, borderRadius: '50%', border: 'none',
          background: '#3b82f6', color: '#fff', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }} aria-label={open ? 'Close AI Copilot' : 'Open AI Copilot'}>
          {open ? <X size={20} /> : <Sparkles size={20} />}
        </button>
      </div>
      <style>{`
        @keyframes ai-pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes ai-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </>
  );
}

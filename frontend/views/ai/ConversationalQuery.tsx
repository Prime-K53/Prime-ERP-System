import React, { useState, useRef, useEffect } from 'react';
import { Loader2, MessageSquare, ArrowLeft, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSales } from '../../context/SalesContext';
import { useInventory } from '../../context/InventoryContext';
import { useFinance } from '../../context/FinanceContext';
import { useProduction } from '../../context/ProductionContext';
import { generateAIResponse } from '../../services/geminiService';

interface Message { role: 'user' | 'assistant'; content: string; }

const EXAMPLE_QUESTIONS = [
  'What are my top 5 customers?',
  'Which items need reordering?',
  'Show me last 30 days income vs expenses',
  'How many active work orders do I have?',
];

const ConversationalQuery: React.FC = () => {
  const navigate = useNavigate();
  const { sales, customers } = useSales();
  const { inventory } = useInventory();
  const { invoices, expenses, income, ledger } = useFinance();
  const { workOrders } = useProduction();
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: 'Ask me anything about your business data — sales, inventory, finance, production.' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const buildContext = () => {
    const parts: string[] = [];
    const salesTotal = (sales || []).reduce((s: number, x: any) => s + Number(x.total_amount || x.total || 0), 0);
    parts.push(`Sales: ${(sales || []).length} transactions totaling $${Math.round(salesTotal)}`);
    const topCust = [...(customers || [])].slice(0, 5).map((c: any) => c.customer_name || c.name).filter(Boolean);
    if (topCust.length) parts.push(`Customers: ${topCust.join(', ')}`);
    const invVal = (inventory || []).reduce((s: number, i: any) => s + Number(i.quantity || 0) * Number(i.cost_per_unit || 0), 0);
    parts.push(`Inventory: ${(inventory || []).length} items valued at $${Math.round(invVal)}`);
    const exp30 = (expenses || []).filter((e: any) => e.expense_date && new Date(e.expense_date) > new Date(Date.now() - 30 * 86400000)).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const inc30 = (income || []).filter((i: any) => i.income_date && new Date(i.income_date) > new Date(Date.now() - 30 * 86400000)).reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    parts.push(`Last 30 days: Expenses $${Math.round(exp30)}, Income $${Math.round(inc30)}`);
    const activeWO = (workOrders || []).filter((w: any) => w.status !== 'completed' && w.status !== 'cancelled').length;
    parts.push(`Active work orders: ${activeWO}`);
    return parts.join('\n');
  };

  const sendQuery = async (question?: string) => {
    const q = question || input;
    if (!q.trim() || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const context = buildContext();
      const systemPrompt = 'You are Prime ERP\'s AI business analyst. Answer concisely with specific numbers from the context provided.';
      const answer = await generateAIResponse(`Context:\n${context}\n\nQuestion: ${q}`, systemPrompt);
      setMessages(prev => [...prev, { role: 'assistant', content: answer || 'No answer available.' }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      <div className="flex items-center gap-3 p-4 border-b border-slate-200 bg-white">
        <button onClick={() => navigate('/smart-operations/ai')} className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft size={20} /></button>
        <MessageSquare className="text-purple-500" size={24} />
        <div><h1 className="text-lg font-bold text-slate-800">Conversational Query</h1><p className="text-xs text-slate-500">Ask business questions in plain English</p></div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-3 ${msg.role === 'user' ? 'bg-purple-500 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="bg-white border border-slate-200 rounded-2xl p-3"><Loader2 size={18} className="animate-spin text-purple-500" /></div></div>}
        <div ref={bottomRef} />
      </div>
      {messages.length === 1 && (
        <div className="px-4 pb-2">
          <div className="text-xs text-slate-400 mb-2 text-center">Try asking:</div>
          <div className="flex flex-wrap gap-2 justify-center">
            {EXAMPLE_QUESTIONS.map((q, i) => (
              <button key={i} onClick={() => sendQuery(q)} className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 text-slate-600 hover:border-purple-300 hover:text-purple-600">{q}</button>
            ))}
          </div>
        </div>
      )}
      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendQuery()} placeholder="Ask a business question..." className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
          <button onClick={() => sendQuery()} disabled={loading || !input.trim()} className="px-4 py-2.5 bg-purple-500 text-white rounded-xl hover:bg-purple-600 disabled:opacity-50"><Send size={18} /></button>
        </div>
      </div>
    </div>
  );
};

export default ConversationalQuery;

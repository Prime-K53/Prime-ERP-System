import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileText, Download, Clock, CreditCard, Package, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

const CustomerPortal: React.FC = () => {
  const { invoiceId } = useParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('nexus_salesOrders');
      if (raw) setOrders(JSON.parse(raw));
    } catch {}
    setLoading(false);
  }, []);

  if (invoiceId) {
    const order = orders.find((o: any) => o.id === invoiceId || o.invoice_number === invoiceId);
    if (!order) return <div className="p-8 text-center text-slate-500">Invoice not found.</div>;
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Link to="/portal" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 mb-6"><ArrowLeft size={14} /> Back to orders</Link>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div><h1 className="text-xl font-bold text-slate-900">Invoice #{order.invoice_number || order.id}</h1>
              <p className="text-sm text-slate-500">{new Date(order.date || order.created_at).toLocaleDateString()}</p></div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${order.status === 'Paid' || order.status === 'Fulfilled' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{order.status}</span>
          </div>
          <div className="border-t border-slate-200 pt-4 space-y-3">
            {order.items?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm"><span className="text-slate-600">{item.name || item.product_name} x{item.quantity}</span><span className="font-medium">K {((item.price || item.unit_price) * item.quantity).toFixed(2)}</span></div>
            ))}
          </div>
          <div className="border-t border-slate-200 mt-4 pt-4 flex justify-between text-lg font-bold"><span>Total</span><span>K {Number(order.total || order.grand_total || 0).toFixed(2)}</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">My Orders</h1>
      <p className="text-sm text-slate-500 mb-6">View your order history, download invoices, and track payments.</p>
      {loading ? <div className="text-center py-12 text-slate-400">Loading...</div> : orders.length === 0 ? (
        <div className="text-center py-12 text-slate-400"><Package size={40} className="mx-auto mb-3 text-slate-300" /><p>No orders yet.</p></div>
      ) : (
        <div className="space-y-3">
          {orders.map((o: any) => (
            <div key={o.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${o.status === 'Paid' || o.status === 'Fulfilled' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                  {o.status === 'Paid' || o.status === 'Fulfilled' ? <CheckCircle size={18} className="text-emerald-600" /> : <Clock size={18} className="text-amber-600" />}
                </div>
                <div><p className="font-medium text-sm text-slate-900">#{o.invoice_number || o.id}</p>
                  <p className="text-xs text-slate-400">{new Date(o.date || o.created_at).toLocaleDateString()} • {o.items?.length || 0} item(s)</p></div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm">K {Number(o.total || o.grand_total || 0).toFixed(2)}</span>
                <Link to={`/portal/${o.id}`} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><FileText size={16} /></Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerPortal;

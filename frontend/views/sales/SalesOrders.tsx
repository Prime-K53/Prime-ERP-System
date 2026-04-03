import React, { useState, useEffect } from 'react';
import { useSalesStore } from '../../stores/salesStore';
import { useFinanceStore } from '../../stores/financeStore';
import SalesOrderForm from './SalesOrderForm';
import SalesOrderDetail from './SalesOrderDetail';

const SalesOrders: React.FC = () => {
  const { salesOrders, isLoading, fetchSalesData, addSalesOrder, updateSalesOrder } = useSalesStore();
  const { addInvoice } = useFinanceStore();
  const [editing, setEditing] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConvertToInvoice = async (order: any) => {
    const invoice = {
      customerId: order.customerId,
      customerName: order.customerName || '',
      date: new Date().toISOString(),
      dueDate: order.deliveryDate || null,
      lines: (order.items || []).map((it: any) => ({ itemId: it.product_id || it.id, description: it.product_name || it.description || '', quantity: it.quantity, unitPrice: it.unit_price || it.unitPrice || 0, total: it.line_total || (it.quantity * (it.unit_price || it.unitPrice || 0)) })),
      totalAmount: order.total || 0,
      status: 'Unpaid',
      sourceOrderId: order.id
    };

    try {
      await addInvoice(invoice as any);
      alert('Converted to invoice');
    } catch (err: any) {
      alert('Failed to convert: ' + (err?.message || err));
    }
  };

  const changeStatus = async (order: any, status: string) => {
    try {
      await updateSalesOrder({ ...order, status });
      await fetchSalesData();
    } catch (err: any) {
      alert('Failed to update status: ' + (err?.message || err));
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null);
        await fetchSalesData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sales orders');
      }
    };
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mb-4"></div>
          <p className="text-gray-600 text-lg font-medium">Loading sales orders...</p>
          <p className="text-gray-400 text-sm mt-2">Please wait while we fetch your data</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Error Loading Sales Orders</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Sales Orders</h2>
      <div className="mb-4">
        {!editing ? (
          <SalesOrderForm onCreate={async (o: any) => { await addSalesOrder(o); await fetchSalesData(); }} />
        ) : (
          <div className="mb-4">
            <SalesOrderForm initial={editing} onDone={async () => { setEditing(null); await fetchSalesData(); }} />
          </div>
        )}
      </div>
      <div>
        {salesOrders.length === 0 ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center max-w-lg mx-auto p-8">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">No Sales Orders Yet</h3>
              <p className="text-gray-600 mb-6">
                You haven't created any sales orders yet. Start by creating your first sales order using the form above.
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full table-auto">
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Order Date</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {salesOrders.map((o: any) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.customerId || '-'}</td>
                  <td>{new Date(o.orderDate).toLocaleDateString()}</td>
                  <td>{o.status}</td>
                  <td>{o.total}</td>
                  <td>
                    <button className="mr-2 px-2 py-1 bg-white border rounded" onClick={() => setEditing(o)}>Edit</button>
                    <button className="mr-2 px-2 py-1 bg-white border rounded" onClick={() => handleConvertToInvoice(o)}>Convert</button>
                    <div className="inline-block ml-2">
                      <select value={o.status} onChange={(e) => changeStatus(o, e.target.value)} className="px-2 py-1 border rounded">
                        <option value="Draft">Draft</option>
                        <option value="Confirmed">Confirm</option>
                        <option value="Processing">Processing</option>
                        <option value="Fulfilled">Fulfilled</option>
                        <option value="Cancelled">Cancel</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SalesOrders;

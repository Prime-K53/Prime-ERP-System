import React, { useState, useMemo } from 'react';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';

interface SalesOrderFormProps {
  initial?: any;
  onDone?: () => void;
  onCreate?: (o: any) => Promise<void>;
}

const SalesOrderForm: React.FC<SalesOrderFormProps> = ({ initial, onDone, onCreate }) => {
  const { addSalesOrder, updateSalesOrder, customers } = useSales();
  const { companyConfig, checkPermission } = useAuth();
  const [order, setOrder] = React.useState<any>(initial || { items: [], subtotal: 0, total: 0, status: 'Draft' });
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const selectedCustomer = useMemo(() =>
    customers?.find((c: any) => c.id === order.customerId),
    [customers, order.customerId]
  );

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers || [];
    const term = searchTerm.toLowerCase();
    return (customers || []).filter((c: any) =>
      c.name?.toLowerCase().includes(term) ||
      c.id?.toLowerCase().includes(term) ||
      c.phone?.includes(term)
    );
  }, [customers, searchTerm]);

  const selectCustomer = (customer: any) => {
    const limit = Number(customer.creditLimit || 0);
    const outstanding = Number(customer.outstandingBalance || 0);
    const willBe = outstanding + (order.total || 0);
    let warning = '';
    if (customer.creditHold) {
      warning = 'Customer is on credit hold.';
    } else if (limit > 0 && willBe > limit && !checkPermission('accounts.override_credit')) {
      warning = `Credit limit ${limit} will be exceeded (${willBe}).`;
    }
    setOrder({ ...order, customerId: customer.id, customerName: customer.name, _creditWarning: warning });
    setSearchTerm(customer.name || customer.id);
    setShowDropdown(false);
  };

  const save = async () => {
    if (!order.id) {
      if (onCreate) await onCreate(order); else await addSalesOrder(order);
      alert('Sales order created');
    } else {
      await updateSalesOrder(order);
      alert('Sales order updated');
    }
    if (typeof onDone === 'function') onDone();
  };

  return (
    <div>
      <h2>{order.id ? 'Edit' : 'New'} Sales Order</h2>
      <div>
        <label>Customer</label>
        <div style={{ position: 'relative' }}>
          <input
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder="Search customer by name, ID, or phone..."
          />
          {selectedCustomer && (
            <small>Selected: {selectedCustomer.name} ({selectedCustomer.id})</small>
          )}
          {order._creditWarning && (
            <div style={{ color: 'red', fontSize: 12 }}>{order._creditWarning}</div>
          )}
          {showDropdown && (
            <ul style={{ position: 'absolute', zIndex: 10, background: 'white', border: '1px solid #ccc', maxHeight: 200, overflow: 'auto', listStyle: 'none', padding: 0, margin: 0, width: '100%' }}>
              {filteredCustomers.map((c: any) => (
                <li
                  key={c.id}
                  onMouseDown={() => selectCustomer(c)}
                  style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                >
                  {c.name} ({c.id}) {c.creditHold ? '⚠️ HOLD' : ''}
                </li>
              ))}
              {filteredCustomers.length === 0 && (
                <li style={{ padding: '6px 10px', color: '#999' }}>No customers found</li>
              )}
            </ul>
          )}
        </div>
      </div>
      <div>
        <label>Notes</label>
        <textarea value={order.notes || ''} onChange={e => setOrder({ ...order, notes: e.target.value })} />
      </div>
      <div>
        <button onClick={save} className="btn">Save</button>
      </div>
    </div>
  );
};

export default SalesOrderForm;

'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PAYMENT_OPTIONS } from '@/lib/format';
import CustomerSelect, { QUICK, EMPTY_QUICK, saveQuickCustomer } from '@/components/CustomerSelect';

let seq = 0;

// Direct Delivery Order: issued without picking an existing quotation.
// Takes the next sequential reference number and accepts inventory items and manual (non-inventory) items.
export default function DirectDelivery({ onClose, onCreated }) {
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [quick, setQuick] = useState(EMPTY_QUICK);
  const [payOpt, setPayOpt] = useState('1');
  const [customPay, setCustomPay] = useState('');
  const [refNo, setRefNo] = useState('…');
  const [lines, setLines] = useState([]);
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase.from('customers').select('*').order('company_name').then(({ data }) => setCustomers(data || []));
    supabase.from('inventory').select('*').order('description').then(({ data }) => setInventory(data || []));
    supabase.rpc('peek_next_quote_no').then(({ data }) => { if (data) setRefNo(data); });
  }, []);

  const addItem = (inv) =>
    setLines((l) => [...l, {
      key: ++seq, inventory_id: inv.id, description: inv.description, stock: inv.quantity,
      quantity: 1, unit_price: Number(inv.unit_rate), custom: false,
    }]);
  // manual (non-inventory) line: Unit price + Total + free-text stock are shown only for these rows
  const addCustom = () =>
    setLines((l) => [...l, {
      key: ++seq, inventory_id: null, description: '', stock: undefined, stock_text: '',
      quantity: 1, unit_price: '', custom: true,
    }]);
  const patch = (key, p) => setLines((l) => l.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const remove = (key) => setLines((l) => l.filter((x) => x.key !== key));

  const hasCustom = lines.some((x) => x.custom);
  const lineTotal = (x) => {
    const base = Math.round(((Number(x.quantity) || 0) * (Number(x.unit_price) || 0) + Number.EPSILON) * 100) / 100;
    return Math.round((base * 1.05 + Number.EPSILON) * 100) / 100;      // incl. 5% VAT, same as quotations
  };
  const paymentText = payOpt === '3' ? customPay.trim() : PAYMENT_OPTIONS.find((o) => o.id === payOpt).label;
  const filtered = inventory.filter((i) =>
    (i.description + ' ' + (i.company_name || '')).toLowerCase().includes(search.toLowerCase()));

  const create = async () => {
    if (!customerId) return setMsg({ err: true, text: 'Please select a customer.' });
    if (!lines.length) return setMsg({ err: true, text: 'Add at least one item.' });
    for (const [i, x] of lines.entries()) {
      if (x.custom && !String(x.description).trim()) return setMsg({ err: true, text: `Row ${i + 1}: enter a description.` });
      if (!(Number(x.quantity) > 0)) return setMsg({ err: true, text: `Row ${i + 1}: enter a quantity.` });
      if (x.custom && String(x.unit_price).trim() === '') return setMsg({ err: true, text: `Row ${i + 1}: enter a unit price.` });
    }
    if (!paymentText) return setMsg({ err: true, text: 'Enter the custom payment terms.' });
    setBusy(true); setMsg(null);
    let custId = customerId;
    if (customerId === QUICK) {                       // quick customer → saved into the official customer list
      const r = await saveQuickCustomer(quick);
      if (r.error) { setBusy(false); return setMsg({ err: true, text: r.error }); }
      custId = r.customer.id;
      setCustomers((c) => [...c, r.customer]);
      setCustomerId(custId); setQuick(EMPTY_QUICK);
    }
    const { data, error } = await supabase.rpc('create_direct_delivery_order', {
      p_customer_id: custId,
      p_payment: paymentText,
      p_items: lines.map((x) => ({
        inventory_id: x.inventory_id, description: x.description,
        quantity: Number(x.quantity), unit_price: Number(x.unit_price) || 0,
        stock_text: x.custom ? String(x.stock_text || '').trim() : '',
      })),
    });
    setBusy(false);
    if (error) return setMsg({ err: true, text: error.message });
    window.location.href = `/api/delivery-orders/${data.id}/docx`;     // instant download
    onCreated && onCreated(data);
  };

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2>Direct Delivery Order</h2>
        <button className="btn ghost sm" onClick={onClose}>Close</button>
      </div>

      <div className="grid g2" style={{ marginBottom: 14 }}>
        <div>
          <label>Customer *</label>
          <CustomerSelect customers={customers} value={customerId} onChange={setCustomerId} quick={quick} setQuick={setQuick} />
        </div>
        <div>
          <label>Reference number (auto)</label>
          <input readOnly value={refNo} style={{ fontWeight: 700, background: '#f3f4f6' }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2>Items</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" onClick={addCustom}>(+) Add Custom Item</button>
          <button className="btn" onClick={() => { setSearch(''); setPicker(true); }}>＋ Add from Inventory</button>
        </div>
      </div>

      <table>
        <thead>
          <tr><th>S.No</th><th style={{ minWidth: 260 }}>Description</th><th>Qty</th>
            {hasCustom && <th className="r">Unit price (AED)</th>}
            {hasCustom && <th className="r">Total (AED)</th>}
            <th>Stock</th><th /></tr>
        </thead>
        <tbody>
          {lines.map((x, i) => (
            <tr key={x.key}>
              <td>{i + 1}</td>
              <td>
                {x.custom ? (
                  <textarea className="cellin" rows={2} placeholder="Custom item description…" value={x.description}
                    onChange={(e) => patch(x.key, { description: e.target.value })} />
                ) : x.description}
              </td>
              <td>
                <input type="number" min="1" className={'cellin num' + (!x.custom && Number(x.quantity) > x.stock ? ' red' : '')} style={{ width: 80 }}
                  value={x.quantity} onChange={(e) => patch(x.key, { quantity: e.target.value })} />
              </td>
              {hasCustom && (
                <td className="r">
                  {x.custom ? (
                    <input type="number" min="0" step="0.01" className="cellin num" placeholder="0.00" value={x.unit_price}
                      onChange={(e) => patch(x.key, { unit_price: e.target.value })} />
                  ) : '—'}
                </td>
              )}
              {hasCustom && <td className="r">{x.custom ? <b>{lineTotal(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> : '—'}</td>}
              <td>
                {x.custom ? (
                  <input className="cellin" style={{ width: 110 }} placeholder="--" value={x.stock_text}
                    onChange={(e) => patch(x.key, { stock_text: e.target.value })} />
                ) : x.stock}
              </td>
              <td><button className="btn danger sm" onClick={() => remove(x.key)}>✕</button></td>
            </tr>
          ))}
          {!lines.length && <tr><td colSpan={hasCustom ? 7 : 5} className="mut c" style={{ padding: 24 }}>No items yet.</td></tr>}
        </tbody>
      </table>

      <h2 style={{ marginTop: 18 }}>Payment terms</h2>
      {PAYMENT_OPTIONS.map((o) => (
        <label key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: 'inherit', fontWeight: 500, margin: '6px 0' }}>
          <input type="radio" style={{ width: 'auto' }} checked={payOpt === o.id} onChange={() => setPayOpt(o.id)} />{o.label}
        </label>
      ))}
      {payOpt === '3' && <textarea rows={2} placeholder="Type custom payment terms…" value={customPay} onChange={(e) => setCustomPay(e.target.value)} />}

      {msg && <p className={msg.err ? 'red' : ''}>{msg.text}</p>}
      <p>
        <button className="btn" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create Direct Delivery Order'}</button>
      </p>

      {picker && (
        <div className="modal-bg" onClick={() => setPicker(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <input autoFocus placeholder="🔍 Search by description or company…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className="btn ghost" onClick={() => setPicker(false)}>Done</button>
            </header>
            <div className="body">
              <table>
                <thead><tr><th>Description</th><th>Company</th><th className="r">In stock</th></tr></thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.id} className="pick" onClick={() => addItem(i)}>
                      <td>{i.description}</td><td>{i.company_name}</td>
                      <td className={'r' + (i.quantity === 0 ? ' red' : '')}>{i.quantity}</td>
                    </tr>
                  ))}
                  {!filtered.length && <tr><td colSpan="3" className="mut">No matching items.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
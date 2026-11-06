'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { money, round2, PAYMENT_OPTIONS } from '@/lib/format';

let keySeq = 0;

export default function NewQuotation() {
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [nextNo, setNextNo] = useState('…');
  const [lines, setLines] = useState([]);
  const [payOpt, setPayOpt] = useState('1');
  const [customPay, setCustomPay] = useState('');
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [saved, setSaved] = useState(null);

  const loadInventory = async () => {
    const { data } = await supabase.from('inventory').select('*').order('description');
    setInventory(data || []);
  };
  const loadNo = async () => {
    const { data } = await supabase.rpc('peek_next_quote_no');
    if (data) setNextNo(data);
  };

  useEffect(() => {
    supabase.from('customers').select('*').order('company_name').then(({ data }) => setCustomers(data || []));
    loadInventory();
    loadNo();
  }, []);

  const toast = (text, err = false, ms = 6000) => {
    const id = ++keySeq;
    setToasts((t) => [...t, { id, text, err }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  };

  // ----- line handling -----
  const addItem = (inv) =>
    setLines((l) => [...l, {
      key: ++keySeq, inventory_id: inv.id, description: inv.description, stock: inv.quantity,
      quantity: 1, unit_price: Number(inv.unit_rate), days: '', editDesc: false, editPrice: false,
    }]);
  const patch = (key, p) => setLines((l) => l.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const remove = (key) => setLines((l) => l.filter((x) => x.key !== key));

  const calc = (x) => {
    const base = round2((Number(x.quantity) || 0) * (Number(x.unit_price) || 0));
    const vat = round2(base * 0.05);
    return { base, vat, total: round2(base + vat), over: (Number(x.quantity) || 0) > x.stock };
  };
  const totals = useMemo(() => {
    let sub = 0, vat = 0;
    lines.forEach((x) => { const c = calc(x); sub += c.base; vat += c.vat; });
    return { sub: round2(sub), vat: round2(vat), grand: round2(sub + vat) };
  }, [lines]);

  const filtered = inventory.filter((i) =>
    (i.description + ' ' + (i.company_name || '')).toLowerCase().includes(search.toLowerCase()));

  const paymentText = payOpt === '3' ? customPay.trim() : PAYMENT_OPTIONS.find((o) => o.id === payOpt).label;

  // ----- save -----
  const save = async () => {
    if (!customerId) return toast('Please select a customer.', true);
    if (!lines.length) return toast('Add at least one item.', true);
    for (const [i, x] of lines.entries()) {
      if (!(Number(x.quantity) > 0)) return toast(`Row ${i + 1}: enter a quantity.`, true);
      if (calc(x).over && !String(x.days).trim()) return toast(`Row ${i + 1}: enter the delivery days (stock is short).`, true);
    }
    if (!paymentText) return toast('Enter the custom payment terms.', true);

    setSaving(true);
    const { data, error } = await supabase.rpc('create_quotation', {
      p_customer_id: customerId,
      p_payment: paymentText,
      p_items: lines.map((x) => ({
        inventory_id: x.inventory_id, description: x.description,
        quantity: Number(x.quantity), unit_price: Number(x.unit_price), days: String(x.days || ''),
      })),
    });
    setSaving(false);
    if (error) return toast('Save failed: ' + error.message, true);

    setSaved(data);
    setLines([]);
    loadInventory();
    loadNo();
  };

  // ----- success screen -----
  if (saved)
    return (
      <div className="card hero">
        <h1>✅ Quotation {saved.quotation_no} saved</h1>
        <p className="mut">Quotation is an estimate only – inventory stock is not changed. Stock is deducted when a Delivery Order is created.</p>
        <a className="btn big" href={`/api/quotations/${saved.id}/docx`}>⬇ Download Word (.docx)</a>
        <p style={{ marginTop: 24 }}>
          <button className="btn ghost" onClick={() => setSaved(null)}>Create another</button>{' '}
          <Link className="btn ghost" href="/quotations">View all quotations</Link>
        </p>
        <Toasts toasts={toasts} />
      </div>
    );

  return (
    <>
      <h1>Create Quotation</h1>

      <div className="card grid g2">
        <div>
          <label>Customer *</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— Select customer —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.company_name} – {c.customer_name}</option>)}
          </select>
        </div>
        <div>
          <label>Quotation number (auto)</label>
          <input readOnly value={nextNo} style={{ fontWeight: 700, background: '#f3f4f6' }} />
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2>Items</h2>
          <button className="btn" onClick={() => { setSearch(''); setPicker(true); }}>＋ Add from Inventory</button>
        </div>
        <table>
          <thead>
            <tr><th>S.No</th><th style={{ minWidth: 260 }}>Description</th><th>Qty</th><th className="r">Unit price (AED)</th>
              <th className="r">VAT 5%</th><th className="r">Total (AED)</th><th>Stock status</th><th /></tr>
          </thead>
          <tbody>
            {lines.map((x, i) => {
              const c = calc(x);
              return (
                <tr key={x.key}>
                  <td>{i + 1}</td>
                  <td>
                    {x.editDesc ? (
                      <textarea className="cellin" rows={2} autoFocus value={x.description}
                        onChange={(e) => patch(x.key, { description: e.target.value })}
                        onBlur={() => patch(x.key, { editDesc: false })} />
                    ) : (
                      <>{x.description}<button className="pencil" title="Edit description" onClick={() => patch(x.key, { editDesc: true })}>✏️</button></>
                    )}
                    <div className="mut">Available stock: {x.stock}</div>
                  </td>
                  <td>
                    <input type="number" min="1" className={'cellin num' + (c.over ? ' red' : '')} style={{ width: 80 }}
                      value={x.quantity} onChange={(e) => patch(x.key, { quantity: e.target.value })} />
                  </td>
                  <td className="r">
                    {x.editPrice ? (
                      <input type="number" min="0" step="0.01" className="cellin num" autoFocus value={x.unit_price}
                        onChange={(e) => patch(x.key, { unit_price: e.target.value })}
                        onBlur={() => patch(x.key, { editPrice: false })} />
                    ) : (
                      <>{money(x.unit_price)}<button className="pencil" title="Edit price" onClick={() => patch(x.key, { editPrice: true })}>✏️</button></>
                    )}
                  </td>
                  <td className="r">{money(c.vat)}</td>
                  <td className="r"><b>{money(c.total)}</b></td>
                  <td>
                    {c.over ? (
                      <span><input type="number" min="1" className="cellin num" style={{ width: 64 }} placeholder="__"
                        value={x.days} onChange={(e) => patch(x.key, { days: e.target.value })} /> Days</span>
                    ) : <span className="badge">EX STOCK</span>}
                  </td>
                  <td><button className="btn danger sm" onClick={() => remove(x.key)}>✕</button></td>
                </tr>
              );
            })}
            {!lines.length && <tr><td colSpan="8" className="mut c" style={{ padding: 24 }}>No items yet – click “Add from Inventory”.</td></tr>}
          </tbody>
        </table>
        <div className="totals" style={{ marginTop: 16 }}>
          <div><span>Subtotal</span><span>AED {money(totals.sub)}</span></div>
          <div><span>VAT (5%)</span><span>AED {money(totals.vat)}</span></div>
          <div className="gt"><span>Grand total</span><span>AED {money(totals.grand)}</span></div>
        </div>
      </div>

      <div className="card">
        <h2>Payment terms</h2>
        {PAYMENT_OPTIONS.map((o) => (
          <label key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: 'inherit', fontWeight: 500, margin: '6px 0' }}>
            <input type="radio" style={{ width: 'auto' }} checked={payOpt === o.id} onChange={() => setPayOpt(o.id)} />{o.label}
          </label>
        ))}
        {payOpt === '3' && <textarea rows={2} placeholder="Type custom payment terms…" value={customPay} onChange={(e) => setCustomPay(e.target.value)} />}
      </div>

      <button className="btn big" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Quotation'}</button>

      {picker && (
        <div className="modal-bg" onClick={() => setPicker(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <input autoFocus placeholder="🔍 Search by description or company…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className="btn ghost" onClick={() => setPicker(false)}>Done</button>
            </header>
            <div className="body">
              <table>
                <thead><tr><th>Description</th><th>Company</th><th className="r">In stock</th><th className="r">Rate (AED)</th></tr></thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.id} className="pick" onClick={() => { addItem(i); toast(`Added: ${i.description}`, false, 1500); }}>
                      <td>{i.description}</td><td>{i.company_name}</td>
                      <td className={'r' + (i.quantity === 0 ? ' red' : '')}>{i.quantity}</td><td className="r">{money(i.unit_rate)}</td>
                    </tr>
                  ))}
                  {!filtered.length && <tr><td colSpan="4" className="mut">No matching items.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <Toasts toasts={toasts} />
    </>
  );
}

function Toasts({ toasts }) {
  return <div className="toasts">{toasts.map((t) => <div key={t.id} className={'toast' + (t.err ? ' err' : '')}>{t.text}</div>)}</div>;
}

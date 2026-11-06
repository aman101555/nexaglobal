'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { money, round2, dubaiDate } from '@/lib/format';
import ReturnModal from '@/components/ReturnModal';

const VAT_RATE = 0.05;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });   // YYYY-MM-DD
let keySeq = 0;
const blankLine = () => ({ key: ++keySeq, description: '', quantity: '1', unit_price: '' });

export default function Purchases() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dir, setDir] = useState('desc');                 // 'desc' = newest first (default), 'asc' = oldest first
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState('');
  const [date, setDate] = useState(today());
  const [lines, setLines] = useState([blankLine()]);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [ret, setRet] = useState(null);                   // { purchase, items } while the return pop-up is open
  const [retBusy, setRetBusy] = useState(false);
  const [retErr, setRetErr] = useState('');

  const load = async () => {
    const { data, error } = await supabase.from('purchases').select('*, purchase_items(*)');
    if (error) setToast({ err: true, text: 'Could not load purchases: ' + error.message });
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const flash = (t) => { setToast(t); setTimeout(() => setToast(null), 5000); };

  // ----- sorting by date (SI No breaks ties) -----
  const sorted = useMemo(() => {
    const k = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) =>
      a.purchase_date === b.purchase_date ? k * (a.si_no - b.si_no) : k * (a.purchase_date < b.purchase_date ? -1 : 1));
  }, [rows, dir]);

  // ----- modal calculations -----
  const lineTotal = (x) => round2((Number(x.quantity) || 0) * (Number(x.unit_price) || 0));
  const totals = useMemo(() => {
    const sub = round2(lines.reduce((a, x) => a + lineTotal(x), 0));
    const vat = round2(sub * VAT_RATE);
    return { sub, vat, grand: round2(sub + vat) };
  }, [lines]);

  const patch = (key, p) => setLines((l) => l.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const removeLine = (key) => setLines((l) => (l.length > 1 ? l.filter((x) => x.key !== key) : l));

  const openModal = () => { setCompany(''); setDate(today()); setLines([blankLine()]); setErr(''); setOpen(true); };

  const save = async () => {
    if (!company.trim()) return setErr('Enter the company / vendor name.');
    if (!date) return setErr('Select the invoice date.');
    for (const [i, x] of lines.entries()) {
      if (!x.description.trim()) return setErr(`Item ${i + 1}: enter a description.`);
      if (!(Number(x.quantity) > 0)) return setErr(`Item ${i + 1}: quantity must be more than 0.`);
      if (x.unit_price === '' || !(Number(x.unit_price) >= 0)) return setErr(`Item ${i + 1}: enter the unit price.`);
    }
    setSaving(true); setErr('');
    const { data, error } = await supabase.rpc('create_purchase', {
      p_company: company.trim(),
      p_date: date,
      p_items: lines.map((x) => ({ description: x.description.trim(), quantity: Number(x.quantity), unit_price: Number(x.unit_price) })),
    });
    setSaving(false);
    if (error) return setErr(error.message);
    setOpen(false);
    flash({ text: `Purchase invoice SI No ${data.si_no} saved.` });
    load();
  };

  // open the return pop-up with the purchase items + what was already returned
  const startReturn = async (r) => {
    setRetErr('');
    const { data: done } = await supabase.from('purchase_returns').select('purchase_item_id, quantity').eq('purchase_id', r.id);
    const got = {};
    (done || []).forEach((x) => { got[x.purchase_item_id] = (got[x.purchase_item_id] || 0) + Number(x.quantity); });
    const items = [...(r.purchase_items || [])].sort((a, b) => a.sno - b.sno).map((x) => ({ ...x, returned: got[x.id] || 0 }));
    setRet({ purchase: r, items });
  };
  const confirmReturn = async (picked) => {
    setRetBusy(true); setRetErr('');
    const { error } = await supabase.rpc('create_purchase_return', {
      p_purchase_id: ret.purchase.id,
      p_items: picked.map((x) => ({ purchase_item_id: x.id, quantity: x.quantity })),
    });
    setRetBusy(false);
    if (error) return setRetErr(error.message);
    flash({ text: `Purchase return recorded for SI No ${ret.purchase.si_no}. See Returns → Purchase Return.` });
    setRet(null);
  };

  const del = async (r) => {
    if (!confirm(`Delete purchase SI No ${r.si_no} (${r.company_name})?`)) return;
    const { error } = await supabase.from('purchases').delete().eq('id', r.id);
    if (error) flash({ err: true, text: error.message }); else load();
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1>Purchases</h1>
        <button className="btn" onClick={openModal}>＋ Create Purchase Invoice</button>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <label style={{ margin: 0 }}>Sort by date</label>
          <select value={dir} onChange={(e) => setDir(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="desc">Newest to Oldest</option>
            <option value="asc">Oldest to Newest</option>
          </select>
        </div>
        <table>
          <thead>
            <tr>
              <th>SI No</th>
              <th>Company Name</th>
              <th style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} title="Click to reverse the date order"
                onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}>Date {dir === 'asc' ? '▲' : '▼'}</th>
              <th>Line Items (Description · Qty × Unit Price)</th>
              <th className="r">Total Amount (AED)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const items = [...(r.purchase_items || [])].sort((a, b) => a.sno - b.sno);
              return (
                <tr key={r.id} style={{ verticalAlign: 'top' }}>
                  <td><b>{r.si_no}</b></td>
                  <td>{r.company_name}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{dubaiDate(r.purchase_date)}</td>
                  <td>
                    {items.map((it) => (
                      <div key={it.id} style={{ padding: '2px 0' }}>
                        {it.description} <span className="mut">· {Number(it.quantity)} × {money(it.unit_price)}</span>
                      </div>
                    ))}
                  </td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>
                    <b>{money(r.grand_total)}</b>
                    <div className="mut">Sub {money(r.subtotal)} + VAT {money(r.vat_total)}</div>
                  </td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" onClick={() => startReturn(r)}>Purchase Return</button>{' '}
                    <button className="btn danger sm" onClick={() => del(r)}>Delete</button>
                  </td>
                </tr>
              );
            })}
            {!sorted.length && <tr><td colSpan="6" className="mut c" style={{ padding: 24 }}>{loading ? 'Loading…' : 'No purchase invoices yet – click “Create Purchase Invoice”.'}</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-bg" onClick={() => !saving && setOpen(false)}>
          <div className="modal" style={{ width: 'min(960px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
            <header>
              <h2 style={{ margin: 0, flex: 1 }}>Create Purchase Invoice</h2>
              <button className="btn ghost" disabled={saving} onClick={() => setOpen(false)}>Cancel</button>
            </header>
            <div className="body" style={{ padding: 18 }}>
              <div className="grid g2">
                <div>
                  <label>Vendor / Company name *</label>
                  <input autoFocus value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
                <div>
                  <label>Invoice date *</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 8px' }}>
                <h2 style={{ margin: 0 }}>Items</h2>
                <button className="btn ghost sm" onClick={() => setLines((l) => [...l, blankLine()])}>＋ Add Item</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr><th style={{ width: 36 }}>#</th><th style={{ minWidth: 240 }}>Description</th><th>Qty</th>
                      <th className="r">Unit price (AED)</th><th className="r">Amount (AED)</th><th /></tr>
                  </thead>
                  <tbody>
                    {lines.map((x, i) => (
                      <tr key={x.key}>
                        <td>{i + 1}</td>
                        <td><input className="cellin" value={x.description} onChange={(e) => patch(x.key, { description: e.target.value })} /></td>
                        <td><input type="number" min="0" step="any" className="cellin num" style={{ width: 80 }} value={x.quantity}
                          onChange={(e) => patch(x.key, { quantity: e.target.value })} /></td>
                        <td className="r"><input type="number" min="0" step="0.01" className="cellin num" value={x.unit_price}
                          onChange={(e) => patch(x.key, { unit_price: e.target.value })} /></td>
                        <td className="r"><b>{money(lineTotal(x))}</b></td>
                        <td><button className="btn danger sm" disabled={lines.length === 1} onClick={() => removeLine(x.key)}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="totals" style={{ marginTop: 16 }}>
                <div><span>Subtotal</span><span>AED {money(totals.sub)}</span></div>
                <div><span>VAT (5%)</span><span>AED {money(totals.vat)}</span></div>
                <div className="gt"><span>Grand total</span><span>AED {money(totals.grand)}</span></div>
              </div>

              {err && <p className="red">{err}</p>}
              <p style={{ textAlign: 'right', marginBottom: 0 }}>
                <button className="btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Purchase Invoice'}</button>
              </p>
            </div>
          </div>
        </div>
      )}

      {ret && (
        <ReturnModal title="Initiate Vendor Return" subtitle={`SI No ${ret.purchase.si_no} · ${ret.purchase.company_name}`}
          items={ret.items} busy={retBusy} error={retErr} onConfirm={confirmReturn} onClose={() => setRet(null)} />
      )}

      {toast && <div className="toasts"><div className={'toast' + (toast.err ? ' err' : '')}>{toast.text}</div></div>}
    </>
  );
}
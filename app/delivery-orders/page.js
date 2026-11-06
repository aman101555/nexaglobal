'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { dubaiDate } from '@/lib/format';
import DirectDelivery from '@/components/DirectDelivery';

export default function DeliveryOrders() {
  const [quotes, setQuotes] = useState([]);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);     // which quotation row is expanded
  const [items, setItems] = useState([]);         // line items of the open quotation (+ delivered qty)
  const [history, setHistory] = useState([]);     // earlier DOs of the open quotation
  const [sel, setSel] = useState({});             // { itemId: { on: bool, qty: number } }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [cutover, setCutover] = useState(null);   // when stock deduction moved from quotations to delivery orders
  const [direct, setDirect] = useState(false);     // Direct Delivery panel open

  const loadQuotes = () =>
    supabase.from('quotations').select('id, quotation_no, created_at, customers(company_name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setQuotes(data || []));

  useEffect(() => {
    loadQuotes();
    supabase.from('inventory_logic_cutover').select('applied_at').limit(1)
      .then(({ data }) => setCutover(data && data[0] ? data[0].applied_at : null));
  }, []);

  // load items + what was already delivered for one quotation
  const loadQuote = async (qid) => {
    const { data: qi } = await supabase.from('quotation_items').select('*').eq('quotation_id', qid).order('sno');
    const ids = (qi || []).map((x) => x.id);
    const delivered = {};
    if (ids.length) {
      const { data: di } = await supabase.from('delivery_order_items').select('quotation_item_id, quantity').in('quotation_item_id', ids);
      (di || []).forEach((r) => { delivered[r.quotation_item_id] = (delivered[r.quotation_item_id] || 0) + r.quantity; });
    }
    // live stock balance of each inventory item (fresh every time a quotation is opened / a DO is created)
    const invIds = [...new Set((qi || []).map((x) => x.inventory_id).filter(Boolean))];
    const stock = {};
    if (invIds.length) {
      const { data: inv } = await supabase.from('inventory').select('id, quantity').in('id', invIds);
      (inv || []).forEach((r) => { stock[r.id] = r.quantity; });
    }
    const rows = (qi || []).map((x) => {
      const done = delivered[x.id] || 0;
      return { ...x, done, remaining: Math.max(x.quantity - done, 0), stock: x.inventory_id ? stock[x.inventory_id] : undefined };
    });
    setItems(rows);
    const s = {};
    rows.forEach((r) => { s[r.id] = { on: false, qty: r.remaining }; });
    setSel(s);
    const { data: h } = await supabase.from('delivery_orders').select('id, created_at').eq('quotation_id', qid).order('created_at');
    setHistory(h || []);
  };

  const toggleOpen = async (qid) => {
    setMsg(null);
    if (openId === qid) return setOpenId(null);
    setOpenId(qid);
    setItems([]); setHistory([]);
    await loadQuote(qid);
  };

  const chosen = items.filter((r) => r.remaining > 0 && sel[r.id]?.on);

  // quotations saved before the logic change were already deducted at quote time → DO does not deduct them again
  const openQuote = quotes.find((q) => q.id === openId);
  const legacy = !!(cutover && openQuote && new Date(openQuote.created_at) < new Date(cutover));
  // balance after this delivery order is finalized
  const after = (r) => {
    if (r.stock === undefined) return undefined;
    if (legacy || !sel[r.id]?.on || r.remaining === 0) return r.stock;
    return Math.max(r.stock - (Number(sel[r.id].qty) || 0), 0);
  };

  const create = async () => {
    if (!chosen.length) return setMsg({ err: true, text: 'Select at least one item.' });
    for (const r of chosen) {
      const q = Number(sel[r.id].qty);
      if (!(q > 0) || q > r.remaining) return setMsg({ err: true, text: `Row ${r.sno}: quantity must be between 1 and ${r.remaining}.` });
    }
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc('create_delivery_order', {
      p_quotation_id: openId,
      p_items: chosen.map((r) => ({ quotation_item_id: r.id, quantity: Number(sel[r.id].qty) })),
    });
    setBusy(false);
    if (error) return setMsg({ err: true, text: error.message });
    setMsg({ text: legacy ? 'Delivery order created.' : 'Delivery order created – inventory stock updated.', doId: data });
    window.location.href = `/api/delivery-orders/${data}/docx`;     // instant download
    await loadQuote(openId);                                        // refresh → delivered rows grey out
  };

  const shown = quotes.filter((q) =>
    (q.quotation_no + ' ' + (q.customers?.company_name || '')).toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Delivery Orders</h1>
        <button className="btn" onClick={() => setDirect(true)}>+ Direct Delivery</button>
      </div>
      {direct && <DirectDelivery onClose={() => setDirect(false)} onCreated={() => { setDirect(false); loadQuotes(); }} />}
      <div className="card" style={{ overflowX: 'auto' }}>
        <input placeholder="Search by quote no. or customer…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12, maxWidth: 360 }} />
        <table>
          <thead><tr><th>Quote No.</th><th>Date</th><th>Customer</th><th /></tr></thead>
          <tbody>
            {shown.map((q) => (
              <FragmentRow key={q.id}>
                <tr>
                  <td><b>{q.quotation_no}</b></td>
                  <td>{dubaiDate(q.created_at)}</td>
                  <td>{q.customers?.company_name}</td>
                  <td className="r">
                    <button className={openId === q.id ? 'btn ghost sm' : 'btn sm'} onClick={() => toggleOpen(q.id)}>
                      {openId === q.id ? 'Close' : 'Make Delivery Order'}
                    </button>
                  </td>
                </tr>
                {openId === q.id && (
                  <tr>
                    <td colSpan="4" style={{ padding: 0 }}>
                      <div className="subpanel">
                        <table>
                          <thead>
                            <tr><th style={{ width: 40 }} /><th>S.No</th><th>Description</th><th className="r">Quoted qty</th>
                              <th className="r">Already delivered</th><th className="r">Deliver now</th>
                              <th className="r">In stock now</th><th className="r">Stock after this DO</th></tr>
                          </thead>
                          <tbody>
                            {items.map((r) => {
                              const fully = r.remaining === 0;
                              return (
                                <tr key={r.id} className={fully ? 'done' : ''}>
                                  <td><input type="checkbox" style={{ width: 'auto' }} disabled={fully}
                                    checked={!!sel[r.id]?.on} onChange={(e) => setSel({ ...sel, [r.id]: { ...sel[r.id], on: e.target.checked } })} /></td>
                                  <td>{r.sno}</td>
                                  <td>{r.description} {fully && <span className="badge g">DELIVERED</span>}</td>
                                  <td className="r">{r.quantity}</td>
                                  <td className="r">{r.done}</td>
                                  <td className="r">
                                    {fully ? '—' : (
                                      <input type="number" min="1" max={r.remaining} className="cellin num"
                                        disabled={!sel[r.id]?.on} value={sel[r.id]?.qty ?? ''}
                                        onChange={(e) => setSel({ ...sel, [r.id]: { ...sel[r.id], qty: e.target.value } })} />
                                    )}
                                  </td>
                                  <td className="r">{r.stock === undefined ? '—' : r.stock}</td>
                                  <td className={'r' + (after(r) === 0 ? ' red' : '')}><b>{after(r) === undefined ? '—' : after(r)}</b></td>
                                </tr>
                              );
                            })}
                            {!items.length && <tr><td colSpan="8" className="mut">Loading…</td></tr>}
                          </tbody>
                        </table>

                        {msg && <p className={msg.err ? 'red' : ''} style={!msg.err ? { color: 'var(--ok)', fontWeight: 600 } : {}}>
                          {msg.text} {msg.doId && <a href={`/api/delivery-orders/${msg.doId}/docx`}>⬇ Download again</a>}</p>}

                        <p>
                          <button className="btn" disabled={busy || !chosen.length} onClick={create}>
                            {busy ? 'Creating…' : `Create Delivery Order (${chosen.length} item${chosen.length === 1 ? '' : 's'})`}
                          </button>
                        </p>

                        {history.length > 0 && (
                          <p className="mut">Earlier delivery orders:{' '}
                            {history.map((h, i) => (
                              <a key={h.id} href={`/api/delivery-orders/${h.id}/docx`} style={{ marginRight: 12 }}>
                                DO {i + 1} ({dubaiDate(h.created_at)}) ⬇
                              </a>
                            ))}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </FragmentRow>
            ))}
            {!shown.length && <tr><td colSpan="4" className="mut">No quotations found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// tiny helper so a row + its expanded row can share one React key
function FragmentRow({ children }) { return <>{children}</>; }
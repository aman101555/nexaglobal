'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { money, dubaiDate } from '@/lib/format';
import ReturnModal from '@/components/ReturnModal';

const one = (x) => (Array.isArray(x) ? x[0] : x);

export default function TaxInvoices() {
  const [dos, setDos] = useState([]);       // delivery orders still waiting for an invoice
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [ret, setRet] = useState(null);          // { inv, items } while the return pop-up is open
  const [retBusy, setRetBusy] = useState(false);
  const [retErr, setRetErr] = useState('');
  const [note, setNote] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase
        .from('delivery_orders')
        .select('id, created_at, quotation_id, quotations(quotation_no, customers(company_name)), delivery_order_items(count), invoices(id)')
        .order('created_at', { ascending: false });
      const all = d || [];
      // "DO 1, DO 2 ..." per quotation (oldest first)
      const seen = {};
      [...all].reverse().forEach((x) => { seen[x.quotation_id] = (seen[x.quotation_id] || 0) + 1; x.doNo = seen[x.quotation_id]; });
      setDos(all.filter((x) => !one(x.invoices)));

      const { data: inv } = await supabase
        .from('invoices')
        .select('id, invoice_no, created_at, grand_total, quotations(quotation_no, customers(company_name))')
        .order('created_at', { ascending: false });
      setInvoices(inv || []);
    })();
  }, []);

  // open the return pop-up with the invoice's items + what was already returned
  const markReturn = async (inv) => {
    setRetErr(''); setNote(null);
    const { data: its, error } = await supabase.from('invoice_items').select('id, sno, description, quantity').eq('invoice_id', inv.id).order('sno');
    if (error) return setNote({ err: true, text: error.message });
    const { data: done } = await supabase.from('sales_returns').select('invoice_item_id, quantity').eq('invoice_id', inv.id);
    const got = {};
    (done || []).forEach((r) => { got[r.invoice_item_id] = (got[r.invoice_item_id] || 0) + Number(r.quantity); });
    setRet({ inv, items: (its || []).map((x) => ({ ...x, returned: got[x.id] || 0 })) });
  };
  const confirmReturn = async (picked) => {
    setRetBusy(true); setRetErr('');
    const { error } = await supabase.rpc('create_sales_return', {
      p_invoice_id: ret.inv.id,
      p_invoice_no: ret.inv.invoice_no,
      p_company: ret.inv.quotations?.customers?.company_name || '',
      p_items: picked.map((x) => ({ invoice_item_id: x.id, quantity: x.quantity })),
    });
    setRetBusy(false);
    if (error) return setRetErr(error.message);
    setNote({ text: `Sales return recorded for invoice ${ret.inv.invoice_no}. See Returns → Sales Return.` });
    setRet(null);
  };

  const match = (t) => t.toLowerCase().includes(search.toLowerCase());
  const shownDos = dos.filter((x) => match((x.quotations?.quotation_no || '') + ' ' + (x.quotations?.customers?.company_name || '')));
  const shownInv = invoices.filter((x) => match(x.invoice_no + ' ' + (x.quotations?.quotation_no || '') + ' ' + (x.quotations?.customers?.company_name || '')));

  return (
    <>
      <h1>Tax Invoices</h1>
      {note && <p className={note.err ? 'red' : ''} style={!note.err ? { color: 'var(--ok)', fontWeight: 600 } : {}}>{note.text}</p>}
      <input placeholder="Search by invoice no., quote no. or customer…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 380, marginBottom: 16 }} />

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Delivery orders ready to invoice</h2>
        <table>
          <thead><tr><th>S.No</th><th>Quotation No.</th><th>Consignee</th><th>Delivery order</th><th className="r">Items</th><th /></tr></thead>
          <tbody>
            {shownDos.map((x, i) => (
              <tr key={x.id}>
                <td>{i + 1}</td>
                <td><b>{x.quotations?.quotation_no}</b></td>
                <td>{x.quotations?.customers?.company_name}</td>
                <td>DO {x.doNo} · {dubaiDate(x.created_at)}</td>
                <td className="r">{x.delivery_order_items?.[0]?.count ?? ''}</td>
                <td className="r"><Link href={`/invoices/make/${x.id}`} className="btn sm">Make Invoice</Link></td>
              </tr>
            ))}
            {!shownDos.length && <tr><td colSpan="6" className="mut">No delivery orders waiting for an invoice. Create a delivery order first.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Tax invoice history</h2>
        <table>
          <thead><tr><th>S.No</th><th>Invoice No.</th><th>Quotation No.</th><th>Consignee</th><th>Date made</th><th className="r">Grand total (AED)</th><th /></tr></thead>
          <tbody>
            {shownInv.map((x, i) => (
              <tr key={x.id}>
                <td>{i + 1}</td>
                <td><b>{x.invoice_no}</b></td>
                <td>{x.quotations?.quotation_no}</td>
                <td>{x.quotations?.customers?.company_name}</td>
                <td>{dubaiDate(x.created_at)}</td>
                <td className="r">{money(x.grand_total)}</td>
                <td className="r" style={{ whiteSpace: 'nowrap' }}>
                  <a className="btn ghost sm" href={`/api/invoices/${x.id}/docx`}>⬇ Word</a>{' '}
                  <button className="btn danger sm" onClick={() => markReturn(x)}>Mark Sales Return</button>
                </td>
              </tr>
            ))}
            {!shownInv.length && <tr><td colSpan="7" className="mut">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {ret && (
        <ReturnModal title="Mark Sales Return" subtitle={`Invoice ${ret.inv.invoice_no} · ${ret.inv.quotations?.customers?.company_name || ''}`}
          items={ret.items} busy={retBusy} error={retErr} onConfirm={confirmReturn} onClose={() => setRet(null)} />
      )}
    </>
  );
}
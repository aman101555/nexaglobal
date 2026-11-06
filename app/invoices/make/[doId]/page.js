'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { money, round2 } from '@/lib/format';
import { aedInWords } from '@/lib/numberToWords';

export default function MakeInvoice({ params }) {
  const doId = params.doId;
  const [info, setInfo] = useState(null);      // { quotation_no, company, location, payment }
  const [lines, setLines] = useState([]);
  const [invNo, setInvNo] = useState('…');
  const [buyerOrder, setBuyerOrder] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: d, error } = await supabase
        .from('delivery_orders')
        .select('id, quotations(quotation_no, payment_terms, customers(company_name, location))')
        .eq('id', doId).single();
      if (error || !d) return setErr('Delivery order not found.');
      const q = d.quotations;
      setInfo({ quotation_no: q.quotation_no, company: q.customers?.company_name, location: q.customers?.location, payment: q.payment_terms });

      const { data: items } = await supabase
        .from('delivery_order_items').select('*, quotation_items(unit_price)').eq('delivery_order_id', doId).order('sno');
      setLines((items || []).map((x) => ({
        id: x.id, description: x.description, quantity: x.quantity,
        rate: Number(x.quotation_items?.unit_price ?? 0), vat_rate: 5,
      })));
      const { data: n } = await supabase.rpc('peek_next_invoice_no');
      if (n) setInvNo(n);
    })();
  }, [doId]);

  const patch = (id, p) => setLines((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const calc = (x) => {
    const taxable = round2((Number(x.quantity) || 0) * (Number(x.rate) || 0));
    const vat = round2(taxable * (Number(x.vat_rate) || 0) / 100);
    return { taxable, vat, amount: round2(taxable + vat) };
  };
  const totals = useMemo(() => {
    let sub = 0, vat = 0;
    lines.forEach((x) => { const c = calc(x); sub += c.taxable; vat += c.vat; });
    return { sub: round2(sub), vat: round2(vat), grand: round2(sub + vat) };
  }, [lines]);

  const confirm = async () => {
    setErr('');
    if (lines.some((x) => !(Number(x.rate) >= 0) || x.rate === '')) return setErr('Enter a rate for every item.');
    setBusy(true);
    const { data, error } = await supabase.rpc('create_invoice', {
      p_delivery_order_id: doId,
      p_buyer_order: buyerOrder,
      p_items: lines.map((x) => ({ delivery_order_item_id: x.id, rate: Number(x.rate), vat_rate: Number(x.vat_rate) || 0 })),
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setDone(data);
    window.location.href = `/api/invoices/${data.id}/docx`;      // instant download
  };

  if (done)
    return (
      <div className="card hero">
        <h1>✅ Invoice {done.invoice_no} created</h1>
        <p className="mut">Your Word file is downloading.</p>
        <a className="btn big" href={`/api/invoices/${done.id}/docx`}>⬇ Download again</a>
        <p style={{ marginTop: 24 }}><Link className="btn ghost" href="/invoices">Back to Tax Invoices</Link></p>
      </div>
    );

  if (!info) return <p className={err ? 'red' : 'mut'}>{err || 'Loading…'}</p>;

  return (
    <>
      <h1>Make Tax Invoice</h1>
      <div className="card grid g3">
        <div><label>Invoice number (auto)</label><input readOnly value={invNo} style={{ fontWeight: 700, background: '#f3f4f6' }} /></div>
        <div><label>Consignee</label><input readOnly value={info.company || ''} style={{ background: '#f3f4f6' }} /></div>
        <div><label>Supplier’s Ref (quotation)</label><input readOnly value={info.quotation_no} style={{ background: '#f3f4f6' }} /></div>
        <div><label>Buyer’s Order No (optional)</label><input value={buyerOrder} onChange={(e) => setBuyerOrder(e.target.value)} /></div>
        <div style={{ gridColumn: 'span 2' }}><label>Terms of payment (from quotation)</label><input readOnly value={info.payment || ''} style={{ background: '#f3f4f6' }} /></div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>S.No</th><th style={{ minWidth: 220 }}>Description</th><th className="r">Qty</th><th className="r">Rate in AED</th>
              <th className="r">Taxable value</th><th className="r">VAT rate %</th><th className="r">VAT amount in AED</th><th className="r">Amount</th></tr>
          </thead>
          <tbody>
            {lines.map((x, i) => {
              const c = calc(x);
              return (
                <tr key={x.id}>
                  <td>{i + 1}</td>
                  <td>{x.description}</td>
                  <td className="r">{x.quantity}</td>
                  <td className="r"><input type="number" min="0" step="0.01" className="cellin num" value={x.rate} onChange={(e) => patch(x.id, { rate: e.target.value })} /></td>
                  <td className="r">{money(c.taxable)}</td>
                  <td className="r"><input type="number" min="0" step="0.01" className="cellin num" style={{ width: 70 }} value={x.vat_rate} onChange={(e) => patch(x.id, { vat_rate: e.target.value })} /></td>
                  <td className="r">{money(c.vat)}</td>
                  <td className="r"><b>{money(c.amount)}</b></td>
                </tr>
              );
            })}
            {!lines.length && <tr><td colSpan="8" className="mut">This delivery order has no items.</td></tr>}
          </tbody>
        </table>

        <div className="totals" style={{ marginTop: 18 }}>
          <div><span>Subtotal before tax</span><span>AED {money(totals.sub)}</span></div>
          <div><span>VAT</span><span>AED {money(totals.vat)}</span></div>
          <div className="gt"><span>Grand total</span><span>AED {money(totals.grand)}</span></div>
        </div>
        <p className="mut" style={{ textAlign: 'right' }}>{aedInWords(totals.grand)}</p>
      </div>

      {err && <p className="red">{err}</p>}
      <button className="btn big" disabled={busy || !lines.length} onClick={confirm}>{busy ? 'Creating…' : 'Confirm'}</button>{' '}
      <Link href="/invoices" className="btn ghost big">Cancel</Link>
    </>
  );
}
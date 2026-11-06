'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { money } from '@/lib/format';

const STATUSES = ['Pickup Pending', 'Shipped / In Transit', 'Credit Received'];
const TINT = { 'Pickup Pending': '#fef3c7', 'Shipped / In Transit': '#e0f2fe', 'Credit Received': '#dcfce7' };

export default function PurchaseReturns() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = async () => {
    const { data, error } = await supabase.from('purchase_returns').select('*').order('sl_no', { ascending: false });
    if (error) setErr(error.message);
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));       // instant feedback
    const { error } = await supabase.from('purchase_returns').update({ status }).eq('id', id);
    if (error) { setErr(error.message); load(); } else setErr('');
  };

  return (
    <>
      <h1>Purchase Return</h1>
      <p className="mut">Returns are created from the Purchases page → “Initiate Vendor Return”.</p>
      {err && <p className="red">{err}</p>}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>Sl. No.</th><th>Invoice ID</th><th>Company Name</th><th>Item Description</th><th className="r">Qty Returned</th><th className="r">Amount (AED)</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{r.sl_no}</b></td>
                <td>{r.invoice_ref}</td>
                <td>{r.company_name}</td>
                <td>{r.description}</td>
                <td className="r">{Number(r.quantity)}</td>
                <td className="r">{money(r.amount)}</td>
                <td>
                  <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}
                    style={{ width: 'auto', fontWeight: 600, background: TINT[r.status] }}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="7" className="mut c" style={{ padding: 24 }}>{loading ? 'Loading…' : 'No purchase returns yet.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
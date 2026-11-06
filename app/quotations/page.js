'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { money, dubaiDate } from '@/lib/format';

export default function Quotations() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    supabase.from('quotations').select('*, customers(company_name)').order('created_at', { ascending: false })
      .then(({ data }) => setRows(data || []));
  }, []);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Quotations</h1>
        <Link href="/quotations/new" className="btn">＋ Create Quotation</Link>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Quote No.</th><th>Date</th><th>Customer</th><th className="r">Subtotal</th><th className="r">VAT</th><th className="r">Grand total (AED)</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{r.quotation_no}</b></td><td>{dubaiDate(r.created_at)}</td><td>{r.customers?.company_name}</td>
                <td className="r">{money(r.subtotal)}</td><td className="r">{money(r.vat_total)}</td><td className="r"><b>{money(r.grand_total)}</b></td>
                <td className="r"><a className="btn ghost sm" href={`/api/quotations/${r.id}/docx`}>⬇ Word</a></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="7" className="mut">No quotations yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

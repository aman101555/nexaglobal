'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const EMPTY = { customer_name: '', company_name: '', phone: '', email: '', trn: '', location: '' };

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [f, setF] = useState(EMPTY);
  const [err, setErr] = useState('');

  const load = async () => {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!f.customer_name.trim() || !f.company_name.trim()) return setErr('Customer name and company name are required.');
    const { error } = await supabase.from('customers').insert(f);
    if (error) return setErr(error.message);
    setErr(''); setF(EMPTY); load();
  };
  const del = async (id) => {
    if (!confirm('Delete this customer?')) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) alert('Cannot delete – customer is used in a quotation.'); else load();
  };

  const fld = (k, label) => (
    <div><label>{label}</label><input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );

  return (
    <>
      <h1>Customers</h1>
      <div className="card">
        <h2>Add customer</h2>
        <div className="grid g3">
          {fld('customer_name', 'Customer name *')}{fld('company_name', 'Company name *')}{fld('phone', 'Phone')}
          {fld('email', 'Email')}{fld('trn', 'TRN (Tax Registration No.)')}{fld('location', 'Location')}
        </div>
        {err && <p className="red">{err}</p>}
        <p><button className="btn" onClick={add}>Save customer</button></p>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Customer</th><th>Company</th><th>Phone</th><th>Email</th><th>TRN</th><th>Location</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.customer_name}</td><td>{r.company_name}</td><td>{r.phone}</td>
                <td>{r.email}</td><td>{r.trn}</td><td>{r.location}</td>
                <td className="r"><button className="btn danger sm" onClick={() => del(r.id)}>Delete</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="7" className="mut">No customers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

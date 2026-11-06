'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const EMPTY = { description: '', quantity: '', company_name: '', unit_rate: '', date_received: new Date().toISOString().slice(0, 10) };

export default function Inventory() {
  const [rows, setRows] = useState([]);
  const [f, setF] = useState(EMPTY);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    const { data } = await supabase.from('inventory').select('*').order('created_at', { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!f.description.trim() || f.quantity === '' || f.unit_rate === '') return setErr('Description, quantity and unit rate are required.');
    const { error } = await supabase.from('inventory').insert({ ...f, quantity: parseInt(f.quantity, 10), unit_rate: parseFloat(f.unit_rate) });
    if (error) return setErr(error.message);
    setErr(''); setF(EMPTY); load();
  };
  const update = async (id, patch) => { await supabase.from('inventory').update(patch).eq('id', id); load(); };
  const del = async (id) => {
    if (!confirm('Delete this item?')) return;
    await supabase.from('inventory').delete().eq('id', id); load();
  };

  const shown = rows.filter((r) => (r.description + ' ' + (r.company_name || '')).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <h1>Inventory</h1>
      <div className="card">
        <h2>Receive stock</h2>
        <div className="grid g4">
          <div style={{ gridColumn: 'span 2' }}><label>Description *</label><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div><label>Quantity *</label><input type="number" min="0" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
          <div><label>Unit rate (AED) *</label><input type="number" min="0" step="0.01" value={f.unit_rate} onChange={(e) => setF({ ...f, unit_rate: e.target.value })} /></div>
          <div><label>Company name</label><input value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} /></div>
          <div><label>Date received</label><input type="date" value={f.date_received} onChange={(e) => setF({ ...f, date_received: e.target.value })} /></div>
        </div>
        {err && <p className="red">{err}</p>}
        <p><button className="btn" onClick={add}>Add to inventory</button></p>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <input placeholder="Search inventory…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12, maxWidth: 360 }} />
        <table>
          <thead><tr><th>Description</th><th>Company</th><th className="r">Qty available</th><th className="r">Unit rate (AED)</th><th>Received</th><th /></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>{r.description}</td><td>{r.company_name}</td>
                <td className="r"><input className="cellin num" type="number" min="0" defaultValue={r.quantity}
                  onBlur={(e) => e.target.value !== String(r.quantity) && update(r.id, { quantity: parseInt(e.target.value || 0, 10) })} /></td>
                <td className="r"><input className="cellin num" type="number" min="0" step="0.01" defaultValue={r.unit_rate}
                  onBlur={(e) => e.target.value !== String(r.unit_rate) && update(r.id, { unit_rate: parseFloat(e.target.value || 0) })} /></td>
                <td>{r.date_received}</td>
                <td className="r"><button className="btn danger sm" onClick={() => del(r.id)}>Delete</button></td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan="6" className="mut">No items found.</td></tr>}
          </tbody>
        </table>
        <p className="mut">Edit quantity or rate directly in the table – changes save when you click away. All rates are in AED.</p>
      </div>
    </>
  );
}

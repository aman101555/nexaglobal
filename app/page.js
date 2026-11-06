'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { money } from '@/lib/format';
import Icon from '@/components/Icons';

const LOW_STOCK = 5;                                   // items with this many (or fewer) are flagged "Low Stock"
const one = (x) => (Array.isArray(x) ? x[0] : x);
const ymd = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });   // YYYY-MM-DD

export default function Dashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    (async () => {
      const [c, i, q, o, v] = await Promise.all([
        supabase.from('customers').select('id, created_at'),
        supabase.from('inventory').select('id, description, company_name, quantity, unit_rate'),
        supabase.from('quotations').select('id, created_at, grand_total'),
        supabase.from('delivery_orders').select('id, invoices(id)'),
        supabase.from('invoices').select('*', { count: 'exact', head: true }),
      ]);
      setD({ customers: c.data || [], inventory: i.data || [], quotations: q.data || [], dos: o.data || [], invoices: v.count || 0 });
    })();
  }, []);

  const today = ymd(new Date());
  const ym = today.slice(0, 7);

  // ---------- stat cards ----------
  const s = useMemo(() => {
    if (!d) return null;
    return {
      customers: d.customers.length,
      newCustomers: d.customers.filter((x) => ymd(x.created_at).startsWith(ym)).length,
      items: d.inventory.length,
      units: d.inventory.reduce((a, x) => a + x.quantity, 0),
      stockValue: d.inventory.reduce((a, x) => a + x.quantity * Number(x.unit_rate), 0),
      quotes: d.quotations.length,
      newQuotes: d.quotations.filter((x) => ymd(x.created_at).startsWith(ym)).length,
      quoteValue: d.quotations.reduce((a, x) => a + Number(x.grand_total), 0),
      dos: d.dos.length,
      toInvoice: d.dos.filter((x) => !one(x.invoices)).length,
    };
  }, [d, ym]);

  const lowest = d ? [...d.inventory].sort((a, b) => a.quantity - b.quantity).slice(0, 4) : [];

  return (
    <>
      <div className="dash-hero">
        <h1>Dashboard</h1>
        <div className="hero-actions">
          <Link href="/quotations/new" className="btn lg"><Icon name="plus" size={18} /> Create Quotation</Link>
          <Link href="/inventory" className="btn lg dark"><Icon name="package" size={18} /> Add To Inventory</Link>
          <Link href="/invoices" className="btn lg outline"><Icon name="receipt" size={18} /> Create Invoice</Link>
        </div>
      </div>

      <div className="stats">
        <Stat label="Total Customers" icon="users" tint="#eaf2ff" color="#3b82f6" value={s?.customers}
          pill={s && `+${s.newCustomers} this month`} pillBg="#dcfce7" pillColor="#15803d" line="Registered clients" />
        <Stat label="Inventory Items" icon="package" tint="#eef0ff" color="#6366f1" value={s?.items}
          pill={s && `${s.units} units`} pillBg="#fff1d6" pillColor="#b45309" line={s && `AED ${money(s.stockValue)} stock value`} />
        <Stat label="Quotations Issued" icon="file" tint="#fff4d6" color="#f59e0b" value={s?.quotes}
          pill={s && `+${s.newQuotes} this month`} pillBg="#fef3c7" pillColor="#b45309" line={s && `AED ${money(s.quoteValue)} total value`} />
        <Stat label="Delivery Orders" icon="truck" tint="#e3f8ec" color="#10b981" value={s?.dos}
          pill={s && `${s.toInvoice} to invoice`} pillBg="#dcfce7" pillColor="#15803d" line={d && `${d.invoices} tax invoice${d.invoices === 1 ? '' : 's'} issued`} />
      </div>

      <div className="dash-grid one">
        <section className="panel">
          <div className="panel-head" style={{ alignItems: 'center' }}>
            <h3>Inventory Status</h3>
            <Link href="/inventory" style={{ fontWeight: 700, fontSize: 14 }}>View All ({d ? d.inventory.length : 0})</Link>
          </div>
          <div className="inv-row">
          {lowest.map((x) => (
            <div key={x.id} className="inv-item">
              <div>
                <div className="nm">{x.description}</div>
                <div className="co">{x.company_name || '—'}</div>
              </div>
              <div className="qt">
                {x.quantity} in stock
                {x.quantity <= LOW_STOCK && <div><span className="tag-low">{x.quantity === 0 ? 'Out of Stock' : 'Low Stock'}</span></div>}
              </div>
            </div>
          ))}
          </div>
          {d && !lowest.length && <p className="mut">No inventory yet.</p>}
        </section>
      </div>
    </>
  );
}

function Stat({ label, icon, tint, color, value, pill, pillBg, pillColor, line }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-lbl">{label}</div>
        <div className="stat-ico" style={{ background: tint, color }}><Icon name={icon} size={22} /></div>
      </div>
      <div className="stat-num">
        <b>{value ?? '–'}</b>
        {pill && <span className="pill" style={{ background: pillBg, color: pillColor }}>{pill}</span>}
      </div>
      <div className="trend"><Icon name="trend" size={16} /> {line || ' '}</div>
    </div>
  );
}
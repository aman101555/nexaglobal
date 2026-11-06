'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Icon from './Icons';

export default function SearchBox() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);      // { customers, inventory, quotations }
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  // debounced search across customers, inventory and quotations
  useEffect(() => {
    const t = q.replace(/[,()%*]/g, ' ').trim();
    if (t.length < 2) { setRes(null); return; }
    const id = setTimeout(async () => {
      const like = `%${t}%`;
      const [c, i, n] = await Promise.all([
        supabase.from('customers').select('id, customer_name, company_name').or(`company_name.ilike.${like},customer_name.ilike.${like}`).limit(4),
        supabase.from('inventory').select('id, description, company_name, quantity').or(`description.ilike.${like},company_name.ilike.${like}`).limit(4),
        supabase.from('quotations').select('id, quotation_no, customers(company_name)').ilike('quotation_no', like).limit(4),
      ]);
      setRes({ customers: c.data || [], inventory: i.data || [], quotations: n.data || [] });
      setOpen(true);
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  // close on outside click / Esc
  useEffect(() => {
    const click = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key); };
  }, []);

  const close = () => { setOpen(false); setQ(''); };
  const total = res ? res.customers.length + res.inventory.length + res.quotations.length : 0;

  return (
    <div className="search" ref={box}>
      <span className="ico"><Icon name="search" size={18} /></span>
      <input placeholder="Search quotations, items, customers…" value={q}
        onChange={(e) => setQ(e.target.value)} onFocus={() => res && setOpen(true)} />
      {open && res && (
        <div className="search-drop">
          {!total && <div className="sr"><span className="s">No results for “{q}”.</span></div>}

          {res.quotations.length > 0 && <div className="sg">Quotations</div>}
          {res.quotations.map((x) => (
            <a key={x.id} className="sr" href={`/api/quotations/${x.id}/docx`} onClick={close}>
              <div className="t">{x.quotation_no}</div><div className="s">{x.customers?.company_name} · download Word</div>
            </a>
          ))}

          {res.inventory.length > 0 && <div className="sg">Inventory</div>}
          {res.inventory.map((x) => (
            <Link key={x.id} className="sr" href="/inventory" onClick={close}>
              <div className="t">{x.description}</div><div className="s">{x.company_name} · {x.quantity} in stock</div>
            </Link>
          ))}

          {res.customers.length > 0 && <div className="sg">Customers</div>}
          {res.customers.map((x) => (
            <Link key={x.id} className="sr" href="/customers" onClick={close}>
              <div className="t">{x.company_name}</div><div className="s">{x.customer_name}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Icon from './Icons';
import SearchBox from './SearchBox';

const TABS = [
  { href: '/', label: 'Dashboard', icon: 'dashboard' },
  { href: '/customers', label: 'Customers', icon: 'users', table: 'customers' },
  { href: '/inventory', label: 'Inventory', icon: 'package', table: 'inventory' },
  { href: '/purchases', label: 'Purchases', icon: 'cart', table: 'purchases' },
  { href: '/quotations', label: 'Quotations', icon: 'file', table: 'quotations' },
  { href: '/delivery-orders', label: 'Delivery Orders', icon: 'truck', table: 'delivery_orders' },
  { href: '/invoices', label: 'Tax Invoices', icon: 'receipt', table: 'invoices' },
];

const RETURNS = [
  { href: '/returns/sales', label: 'Sales Return', table: 'sales_returns' },
  { href: '/returns/purchases', label: 'Purchase Return', table: 'purchase_returns' },
];

export default function Shell({ children }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [counts, setCounts] = useState({});
  const [retOpen, setRetOpen] = useState(false);

  useEffect(() => { if (window.innerWidth < 900) setCollapsed(true); }, []);
  useEffect(() => { if (path.startsWith('/returns')) setRetOpen(true); }, [path]);

  // numbers shown next to each menu item
  useEffect(() => {
    let off = false;
    (async () => {
      const out = {};
      await Promise.all([...TABS, ...RETURNS].filter((t) => t.table).map(async (t) => {
        const { count } = await supabase.from(t.table).select('*', { count: 'exact', head: true });
        out[t.table] = count ?? 0;
      }));
      if (!off) setCounts(out);
    })();
    return () => { off = true; };
  }, [path]);

  const inReturns = path.startsWith('/returns');
  const active = (h) => (h === '/' ? path === '/' : path.startsWith(h));

  return (
    <div className={'app' + (collapsed ? ' collapsed' : '')}>
      <aside className="sidebar">
        <div className="side-head">
          <button className="logo-box" title={collapsed ? 'Expand menu' : 'Nexa Global'}
            onClick={() => collapsed && setCollapsed(false)} style={{ cursor: collapsed ? 'pointer' : 'default' }}>
            <img src="/logo-globe.png" alt="Nexa Global" />
          </button>
          <div className="side-brand">
            <div className="nm">Nexa Global L.L.C - FZ</div>
            <div className="sub">Ras Al Khor, Dubai</div>
          </div>
          <button className="icon-btn hamburger" title="Collapse menu" onClick={() => setCollapsed(true)}>
            <Icon name="menu" size={22} />
          </button>
        </div>

        <nav className="side-nav">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} title={t.label} className={'side-link' + (active(t.href) ? ' on' : '')}>
              <Icon name={t.icon} size={22} />
              <span className="lbl">{t.label}</span>
              {t.table && counts[t.table] !== undefined && <span className="cnt">{counts[t.table]}</span>}
            </Link>
          ))}

          <button type="button" title="Returns" className="side-link"
            style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 600, fontSize: 15, textAlign: 'left',
              ...(inReturns ? { color: '#fff' } : {}), ...(inReturns && collapsed ? { background: 'var(--blue)' } : {}) }}
            onClick={() => { if (collapsed) { setCollapsed(false); setRetOpen(true); } else setRetOpen(!retOpen); }}>
            <Icon name="undo" size={22} />
            <span className="lbl">Returns</span>
            <span style={{ display: 'inline-flex', transform: retOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><Icon name="chevron" size={18} /></span>
          </button>
          {!collapsed && retOpen && RETURNS.map((t) => (
            <Link key={t.href} href={t.href} className={'side-link' + (active(t.href) ? ' on' : '')} style={{ paddingLeft: 52, fontSize: 14 }}>
              <span className="lbl">{t.label}</span>
              {counts[t.table] !== undefined && <span className="cnt">{counts[t.table]}</span>}
            </Link>
          ))}
        </nav>

        <div className="side-foot">
          <div className="user-row">
            <div className="avatar">NG</div>
            <div className="user-txt"><div className="un">User</div><div className="ue">www.nexaglobalme.com</div></div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar"><SearchBox /></header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
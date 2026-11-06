'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Dashboard' },
  { href: '/customers', label: 'Customers' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/quotations', label: 'Quotations' },
  { href: '/delivery-orders', label: 'Delivery Orders' },
  { href: '/invoices', label: 'Tax Invoices' },
];

export default function Nav() {
  const path = usePathname();
  const active = (h) => (h === '/' ? path === '/' : path.startsWith(h));
  return (
    <header className="nav">
      <div className="brand">
        <img src="/logo-globe.png" alt="Nexa Global" className="logo" />
        <div>
          <div className="co">Nexa Global L.L.C - FZ</div>
          <div className="addr">Ras Al Khor Industrial Area 2, Dubai - UAE</div>
          <div className="addr">TEL: +971 4 3205373, Mob : 050 369 2244</div>
        </div>
      </div>
      <nav>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={active(t.href) ? 'tab on' : 'tab'}>
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
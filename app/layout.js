import './globals.css';
import Shell from '@/components/Shell';

export const metadata = {
  title: 'Nexa Global – Quotations',
  description: 'Quotation & Inventory Management',
  other: { google: 'notranslate' },        // stops Chrome auto-translating the page (breaks React hydration)
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
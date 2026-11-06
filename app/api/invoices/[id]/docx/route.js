import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { createClient } from '@supabase/supabase-js';
import { money, dubaiDate } from '@/lib/format';
import { aedInWords } from '@/lib/numberToWords';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const pct = (n) => `${Number(n)}%`;           // 5.00 -> "5%"

export async function GET(_req, { params }) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const { data: inv, error } = await supabase
    .from('invoices').select('*, quotations(*, customers(*))').eq('id', params.id).single();
  if (error || !inv) return new Response('Invoice not found', { status: 404 });

  const { data: items } = await supabase
    .from('invoice_items').select('*').eq('invoice_id', inv.id).order('sno');

  const q = inv.quotations;
  const rates = [...new Set((items || []).map((i) => Number(i.vat_rate)))];

  const data = {
    invoiceno: inv.invoice_no,
    date: dubaiDate(inv.created_at),
    buyerorder: inv.buyer_order_no || '',
    supplierref: q.quotation_no,
    companyname: q.customers?.company_name || '',
    companylocation: q.customers?.location || '',
    customertrn: q.customers?.trn || false,
    payment: q.payment_terms || '',
    items: (items || []).map((it) => ({
      sno: it.sno,
      description: it.description,
      qty: it.quantity,
      rate: money(it.rate),
      taxable: money(it.taxable_value),
      vatrate: pct(it.vat_rate),
      vatamount: money(it.vat_amount),
      amount: money(it.line_total),
    })),
    subtotal: money(inv.subtotal),
    vatlabel: rates.length === 1 ? `VAT @${pct(rates[0])}` : 'VAT',
    vattotal: money(inv.vat_total),
    amountwords: aedInWords(inv.grand_total),
    grandtotal: money(inv.grand_total),
  };

  const file = fs.readFileSync(path.join(process.cwd(), 'templates', 'NG_Invoice_Template.docx'));
  const doc = new Docxtemplater(new PizZip(file), { paragraphLoop: true, linebreaks: true });
  doc.render(data);
  const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

  const fname = `Tax_Invoice_${inv.invoice_no.replace(/[\/\\]/g, '-')}.docx`;
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fname}"`,
    },
  });
}
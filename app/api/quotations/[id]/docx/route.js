import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { createClient } from '@supabase/supabase-js';
import { money, dubaiDate } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const { data: q, error } = await supabase
    .from('quotations').select('*, customers(*)').eq('id', params.id).single();
  if (error || !q) return new Response('Quotation not found', { status: 404 });

  const { data: items } = await supabase
    .from('quotation_items').select('*').eq('quotation_id', q.id).order('sno');

  // --- data for the template tags ---
  const data = {
    date: dubaiDate(q.created_at),
    qonumber: q.quotation_no.replace('NG-BM-BK-', ''),      // template already prints "NG-BM-BK-"
    companyname: q.customers?.company_name || '',
    companylocation: q.customers?.location || '',
    customertrn: q.customers?.trn || false,                  // false hides the TRN line
    items: (items || []).map((it) => ({                      // ← one table row per item
      sno: it.sno,
      description: it.description,
      qty: it.quantity,
      unitprice: money(it.unit_price),
      vat: money(it.vat_amount),
      total: money(it.line_total),
      stock: it.stock_status,
    })),
    subtotal: money(q.subtotal),
    vattotal: money(q.vat_total),
    grandtotal: money(q.grand_total),
    payment: q.payment_terms || '',
  };

  const file = fs.readFileSync(path.join(process.cwd(), 'templates', 'NG_Quotation_Template.docx'));
  const doc = new Docxtemplater(new PizZip(file), { paragraphLoop: true, linebreaks: true });
  doc.render(data);
  const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

  const fname = `Quotation_${q.quotation_no.replace(/[\/\\]/g, '-')}.docx`;
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fname}"`,
    },
  });
}

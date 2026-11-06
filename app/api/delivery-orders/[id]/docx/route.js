import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { createClient } from '@supabase/supabase-js';
import { dubaiDate } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const { data: dO, error } = await supabase
    .from('delivery_orders').select('*, quotations(*, customers(*))').eq('id', params.id).single();
  if (error || !dO) return new Response('Delivery order not found', { status: 404 });

  const { data: items } = await supabase
    .from('delivery_order_items').select('*').eq('delivery_order_id', dO.id).order('sno');

  const q = dO.quotations;
  const data = {
    date: dubaiDate(dO.created_at),
    qonumber: q.quotation_no.replace('NG-BM-BK-', ''),
    companyname: q.customers?.company_name || '',
    companylocation: q.customers?.location || '',
    payment: q.payment_terms || '',
    items: (items || []).map((it) => ({            // one table row per delivered item
      sno: it.sno,
      description: it.description,
      qty: it.quantity,
      stock: it.stock_status || '',
    })),
  };

  const file = fs.readFileSync(path.join(process.cwd(), 'templates', 'NG_DeliveryOrder_Template.docx'));
  const doc = new Docxtemplater(new PizZip(file), { paragraphLoop: true, linebreaks: true });
  doc.render(data);
  const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

  const fname = `Delivery_Order_${q.quotation_no.replace(/[\/\\]/g, '-')}_${dO.id.slice(0, 6)}.docx`;
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fname}"`,
    },
  });
}
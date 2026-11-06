# NG Quotation & Inventory App

Stack: **Next.js 14 + Supabase (Postgres) + docxtemplater** (fills your own Word template).

## Setup
1. Supabase → SQL Editor → paste & run `supabase/schema.sql` (tables, auto-numbering, stock-deduction function, 5 AED sample items).
2. `cp .env.local.example .env.local` and fill in your Supabase URL + anon key (Project Settings → API).
3. `npm install` then `npm run dev` → http://localhost:3000

## Word template (`templates/NG_Quotation_Template.docx`)
Your original layout, with these tags in place of the old `_xxx_` markers:

| Tag | Meaning |
|---|---|
| `{date}` `{qonumber}` `{companyname}` `{companylocation}` | header / customer block |
| `{#customertrn}TRN: {customertrn}{/customertrn}` | TRN line (hidden if customer has none) |
| `{#items}` … `{/items}` | the single table row that repeats once per item |
| `{sno} {description} {qty} {unitprice} {vat} {total} {stock}` | cells in that row |
| `{subtotal} {vattotal} {grandtotal}` | totals rows under the table |
| `{payment}` | payment terms |

To restyle, edit the .docx in Word – just don't retype the `{tags}` (paste them as plain text).

## Notes
- Quote numbers: `NG-BM-BK-0500/26`, `0501/26` … (sequence starts at 500; YY from Dubai time).
- Quotations are estimates only: saving a quotation does NOT change inventory stock.
  If the quoted qty exceeds stock, the line shows "N Days".
- Stock is deducted only when a Delivery Order is created (see `supabase/update_inventory_logic.sql`).
  The Delivery Orders screen shows the live stock and the balance after the DO.
- Security: the SQL opens tables to the anon key for simplicity. Before going live, add Supabase Auth and tighten the RLS policies.

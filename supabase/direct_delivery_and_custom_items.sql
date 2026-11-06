-- =====================================================================
--  CUSTOM ITEMS + DIRECT DELIVERY ORDERS  |  run ONCE in Supabase -> SQL Editor
--  (run AFTER update_inventory_logic.sql)
--
--  1. create_quotation : manual (non-inventory) lines keep their free-text stock note
--                        (e.g. '--', 'Ex-Stock', '7 Days')
--  2. create_direct_delivery_order : issues a Delivery Order without a prior quotation (inventory items).
--                        It takes the next sequential reference number and uses the existing
--                        create_delivery_order function, so stock deduction, DO download and
--                        invoicing all keep working unchanged.
-- =====================================================================

-- ---------- 1. SAVE QUOTATION (same as before + manual item stock text) ----------
create or replace function create_quotation(p_customer_id uuid, p_items jsonb, p_payment text)
returns jsonb language plpgsql security definer as $$
declare
  v_no text; v_id uuid; it jsonb;
  v_sno int := 0; v_sub numeric := 0; v_vat numeric := 0;
  v_qty int; v_price numeric; v_base numeric; v_lvat numeric;
  v_inv uuid; v_desc text; v_before int; v_status text;
begin
  if jsonb_array_length(p_items) = 0 then raise exception 'Quotation has no items'; end if;

  v_no := 'NG-BM-BK-' || lpad(nextval('quotation_seq')::text, 4, '0') || '/' ||
          to_char(now() at time zone 'Asia/Dubai', 'YY');

  insert into quotations (quotation_no, customer_id, payment_terms)
  values (v_no, p_customer_id, p_payment) returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_sno   := v_sno + 1;
    v_qty   := (it->>'quantity')::int;
    v_price := (it->>'unit_price')::numeric;
    v_desc  := it->>'description';
    v_inv   := nullif(it->>'inventory_id', '')::uuid;
    v_base  := round(v_qty * v_price, 2);
    v_lvat  := round(v_base * 0.05, 2);
    v_status := 'EX STOCK';

    if v_inv is not null then
      -- estimation only: read the stock to decide EX STOCK / N Days, but never change it
      select quantity into v_before from inventory where id = v_inv;
      if v_qty > v_before then
        v_status := coalesce(nullif(it->>'days', ''), '__') || ' Days';
      end if;
    elsif nullif(it->>'stock_text', '') is not null or it ? 'stock_text' then
      -- manual (non-inventory) item: free-text stock note, '--' when left blank
      v_status := coalesce(nullif(trim(it->>'stock_text'), ''), '--');
    end if;

    insert into quotation_items (quotation_id, sno, inventory_id, description, quantity,
                                 unit_price, vat_amount, line_total, stock_status)
    values (v_id, v_sno, v_inv, v_desc, v_qty, v_price, v_lvat, v_base + v_lvat, v_status);

    v_sub := v_sub + v_base;
    v_vat := v_vat + v_lvat;
  end loop;

  update quotations set subtotal = v_sub, vat_total = v_vat, grand_total = v_sub + v_vat where id = v_id;
  return jsonb_build_object('id', v_id, 'quotation_no', v_no, 'changes', '[]'::jsonb);
end $$;
grant execute on function create_quotation(uuid, jsonb, text) to anon, authenticated;

-- ---------- 2. DIRECT DELIVERY ORDER ----------
create or replace function create_direct_delivery_order(p_customer_id uuid, p_items jsonb)
returns jsonb language plpgsql security definer as $$
declare
  v_no text; v_qid uuid; v_doid uuid; it jsonb;
  v_sno int := 0; v_sub numeric := 0; v_vat numeric := 0;
  v_qty int; v_price numeric; v_base numeric; v_lvat numeric;
  v_inv uuid; v_status text; v_qi uuid;
  v_do_items jsonb := '[]'::jsonb;
begin
  if jsonb_array_length(p_items) = 0 then raise exception 'Delivery order has no items'; end if;

  -- next sequential reference number (shared with quotations)
  v_no := 'NG-BM-BK-' || lpad(nextval('quotation_seq')::text, 4, '0') || '/' ||
          to_char(now() at time zone 'Asia/Dubai', 'YY');

  insert into quotations (quotation_no, customer_id, payment_terms)
  values (v_no, p_customer_id, '') returning id into v_qid;

  for it in select * from jsonb_array_elements(p_items) loop
    v_sno   := v_sno + 1;
    v_qty   := (it->>'quantity')::int;
    v_price := coalesce((it->>'unit_price')::numeric, 0);
    v_inv   := nullif(it->>'inventory_id', '')::uuid;
    v_base  := round(v_qty * v_price, 2);
    v_lvat  := round(v_base * 0.05, 2);

    v_status := 'EX STOCK';

    insert into quotation_items (quotation_id, sno, inventory_id, description, quantity,
                                 unit_price, vat_amount, line_total, stock_status)
    values (v_qid, v_sno, v_inv, it->>'description', v_qty, v_price, v_lvat, v_base + v_lvat, v_status)
    returning id into v_qi;

    v_do_items := v_do_items || jsonb_build_object('quotation_item_id', v_qi, 'quantity', v_qty);
    v_sub := v_sub + v_base;
    v_vat := v_vat + v_lvat;
  end loop;

  update quotations set subtotal = v_sub, vat_total = v_vat, grand_total = v_sub + v_vat where id = v_qid;

  -- reuse the existing function: creates the DO and (via trigger) deducts inventory stock
  v_doid := create_delivery_order(v_qid, v_do_items);

  return jsonb_build_object('id', v_doid, 'quotation_no', v_no);
end $$;
grant execute on function create_direct_delivery_order(uuid, jsonb) to anon, authenticated;

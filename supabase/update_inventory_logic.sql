-- =====================================================================
--  INVENTORY LOGIC UPDATE  |  run ONCE in Supabase -> SQL Editor
--
--  1. Quotations   : estimation only  -> NO stock deduction any more
--  2. Delivery Orders : actual deduction -> stock is reduced when a DO is created
--
--  Quotations made BEFORE you run this were already deducted at quote time,
--  so they are NOT deducted a second time when their DO is created.
-- =====================================================================

-- remembers the moment this update was applied (only the first run counts)
create table if not exists inventory_logic_cutover (
  id         boolean primary key default true check (id),
  applied_at timestamptz not null default now()
);
insert into inventory_logic_cutover (id) values (true) on conflict (id) do nothing;
alter table inventory_logic_cutover enable row level security;
drop policy if exists "open_inventory_logic_cutover" on inventory_logic_cutover;
create policy "open_inventory_logic_cutover" on inventory_logic_cutover for all using (true) with check (true);

-- ---------- 1. SAVE QUOTATION (no stock deduction) ----------
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

    -- estimation only: read the stock to decide EX STOCK / N Days, but never change it
    if v_inv is not null then
      select quantity into v_before from inventory where id = v_inv;
      if v_qty > v_before then
        v_status := coalesce(nullif(it->>'days', ''), '__') || ' Days';
      end if;
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

-- ---------- 2. DELIVERY ORDER = ACTUAL STOCK DEDUCTION ----------
-- Fires for every line saved into a delivery order, so it works with your existing
-- create_delivery_order function without changing it.
create or replace function do_item_deduct_stock() returns trigger
language plpgsql security definer as $$
declare v_inv uuid; v_qcreated timestamptz; v_cut timestamptz;
begin
  select qi.inventory_id, q.created_at into v_inv, v_qcreated
    from quotation_items qi join quotations q on q.id = qi.quotation_id
   where qi.id = new.quotation_item_id;

  select applied_at into v_cut from inventory_logic_cutover limit 1;

  -- old quotations were already deducted when they were saved -> skip them
  if v_inv is not null and (v_cut is null or v_qcreated >= v_cut) then
    update inventory set quantity = greatest(quantity - new.quantity, 0) where id = v_inv;
  end if;
  return new;
end $$;

drop trigger if exists do_item_deduct_stock on delivery_order_items;
create trigger do_item_deduct_stock
  after insert on delivery_order_items
  for each row execute function do_item_deduct_stock();

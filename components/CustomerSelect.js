'use client';
import { supabase } from '@/lib/supabase';

export const QUICK = '__quick';
export const EMPTY_QUICK = { company_name: '', location: '', trn: '' };

// Customer dropdown with a "( Quick + )" option that reveals Company Name / Location / TRN fields.
export default function CustomerSelect({ customers, value, onChange, quick, setQuick }) {
  return (
    <>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Select customer —</option>
        {customers.map((c) => <option key={c.id} value={c.id}>{c.company_name} – {c.customer_name}</option>)}
        <option value={QUICK}>( New ✎ )</option>
      </select>
      {value === QUICK && (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <input placeholder="Company Name *" value={quick.company_name} onChange={(e) => setQuick({ ...quick, company_name: e.target.value })} />
          <input placeholder="Location" value={quick.location} onChange={(e) => setQuick({ ...quick, location: e.target.value })} />
          <input placeholder="TRN" value={quick.trn} onChange={(e) => setQuick({ ...quick, trn: e.target.value })} />
        </div>
      )}
    </>
  );
}

// Saves the quick entry into the official customers list; returns { customer } or { error }.
export async function saveQuickCustomer(quick) {
  const company = quick.company_name.trim();
  if (!company) return { error: 'Enter the company name.' };
  const { data, error } = await supabase.from('customers')
    .insert({ customer_name: company, company_name: company, location: quick.location.trim(), trn: quick.trn.trim() })
    .select().single();
  if (error) return { error: 'Could not save customer: ' + error.message };
  return { customer: data };
}
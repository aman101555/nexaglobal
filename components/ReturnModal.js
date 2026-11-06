'use client';
import { useState } from 'react';

// Shared pop-up used by "Mark Sales Return" and "Initiate Vendor Return".
// items: [{ id, description, quantity, returned }]  →  onConfirm([{ id, quantity }])
export default function ReturnModal({ title, subtitle, items, busy, error, confirmLabel = 'Confirm Return', onConfirm, onClose }) {
  const [sel, setSel] = useState(() => {
    const s = {};
    items.forEach((x) => { s[x.id] = { on: false, qty: String(Math.max(Number(x.quantity) - Number(x.returned), 0)) }; });
    return s;
  });
  const [localErr, setLocalErr] = useState('');

  const left = (x) => Math.max(Number(x.quantity) - Number(x.returned), 0);
  const chosen = items.filter((x) => left(x) > 0 && sel[x.id]?.on);

  const confirm = () => {
    if (!chosen.length) return setLocalErr('Select at least one item to return.');
    for (const x of chosen) {
      const q = Number(sel[x.id].qty);
      if (!(q > 0) || q > left(x)) return setLocalErr(`"${x.description}": quantity must be between 0 and ${left(x)}.`);
    }
    setLocalErr('');
    onConfirm(chosen.map((x) => ({ id: x.id, quantity: Number(sel[x.id].qty) })));
  };

  return (
    <div className="modal-bg" onClick={() => !busy && onClose()}>
      <div className="modal" style={{ width: 'min(860px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
        <header>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0 }}>{title}</h2>
            {subtitle && <div className="mut">{subtitle}</div>}
          </div>
          <button className="btn ghost" disabled={busy} onClick={onClose}>Cancel</button>
        </header>
        <div className="body" style={{ padding: 18 }}>
          <table>
            <thead>
              <tr><th style={{ width: 40 }} /><th>Description</th><th className="r">Qty</th><th className="r">Already returned</th><th className="r">Return now</th></tr>
            </thead>
            <tbody>
              {items.map((x) => {
                const none = left(x) === 0;
                return (
                  <tr key={x.id} className={none ? 'done' : ''}>
                    <td><input type="checkbox" style={{ width: 'auto' }} disabled={none} checked={!!sel[x.id]?.on}
                      onChange={(e) => setSel({ ...sel, [x.id]: { ...sel[x.id], on: e.target.checked } })} /></td>
                    <td>{x.description} {none && <span className="badge g">FULLY RETURNED</span>}</td>
                    <td className="r">{Number(x.quantity)}</td>
                    <td className="r">{Number(x.returned)}</td>
                    <td className="r">
                      {none ? '—' : (
                        <input type="number" min="0" max={left(x)} step="any" className="cellin num" disabled={!sel[x.id]?.on}
                          value={sel[x.id]?.qty ?? ''} onChange={(e) => setSel({ ...sel, [x.id]: { ...sel[x.id], qty: e.target.value } })} />
                      )}
                    </td>
                  </tr>
                );
              })}
              {!items.length && <tr><td colSpan="5" className="mut">No items found.</td></tr>}
            </tbody>
          </table>
          {(localErr || error) && <p className="red">{localErr || error}</p>}
          <p style={{ textAlign: 'right', marginBottom: 0 }}>
            <button className="btn" disabled={busy || !chosen.length} onClick={confirm}>
              {busy ? 'Saving…' : `${confirmLabel} (${chosen.length} item${chosen.length === 1 ? '' : 's'})`}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
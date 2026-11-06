export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const money = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const dubaiDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai' }); // dd/mm/yyyy

export const PAYMENT_OPTIONS = [
  { id: '1', label: '50% AGAINST DELIVERY 25% 30 DAYS PDC AND 25% 60 DAYS PDC' },
  { id: '2', label: '100% AGAINST DELIVERY' },
  { id: '3', label: 'Custom' },
];

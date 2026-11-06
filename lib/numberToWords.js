const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion'];

function below1000(n) {
  const parts = [];
  if (n >= 100) { parts.push(ONES[Math.floor(n / 100)] + ' Hundred'); n %= 100; }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')); }
  else if (n > 0) parts.push(ONES[n]);
  return parts.join(' ');
}

function intToWords(n) {
  if (n === 0) return 'Zero';
  const out = [];
  let i = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk) out.unshift(below1000(chunk) + (SCALES[i] ? ' ' + SCALES[i] : ''));
    n = Math.floor(n / 1000);
    i++;
  }
  return out.join(' ');
}

// 12836.25 -> "AED Twelve Thousand Eight Hundred Thirty Six and Twenty Five Fils Only"
export function aedInWords(amount) {
  const total = Math.round(Number(amount || 0) * 100);
  const dirhams = Math.floor(total / 100);
  const fils = total % 100;
  let s = 'AED ' + intToWords(dirhams);
  if (fils) s += ' and ' + intToWords(fils) + ' Fils';
  return s + ' Only';
}
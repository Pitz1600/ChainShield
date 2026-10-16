import limits from '../constants/fieldLimits.json' with { type: 'json' };

export const FIELD_LIMITS = limits;
export function fieldLimit(field = '', type = 'text') {
  if (/password|token|secret|recoveryCode|backupCode/i.test(field) || type === 'password') return undefined;
  if (!['text', 'search', 'email', 'tel', 'url', 'textarea'].includes(type)) return undefined;
  if (/^(otp|otpCode|totp|totpCode|code)$/i.test(field)) return 6;
  if (type === 'search' || /search/i.test(field)) return limits.search;
  if (type === 'email' || /email/i.test(field)) return limits.email;
  return limits[field] ?? (/remark|finding|note|response|reason|message|content/i.test(field) || type === 'textarea' ? limits.longText : limits.shortText);
}

export function apiFieldErrors(error) {
  const details = error?.response?.data?.details;
  return Object.fromEntries((Array.isArray(details) ? details : []).map(({ field, message }) => [field, message]));
}

export function manualRowErrors(row) {
  const errors = {};
  if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || Number.isNaN(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date) errors.date = 'Enter a valid date.';
  for (const [field, label] of Object.entries({ agency: 'Agency', programName: 'Program name', payerName: 'Payer name', payeeName: 'Payee name', description: 'Description' })) {
    const value = row[field] || '';
    if (!value.trim()) errors[field] = `${label} is required.`;
    else if (value.length > limits[field]) errors[field] = `${label} must not exceed ${limits[field]} characters.`;
    else if (/[<>{}[\]\\]/.test(value)) errors[field] = 'Characters < > { } [ ] and backslashes are not allowed.';
  }
  const amounts = ['debitAmount', 'creditAmount'].map(field => {
    const raw = String(row[field] ?? '').replace(/,/g, '');
    const amount = raw.trim() ? Number(raw) : NaN;
    if (!Number.isFinite(amount) || amount < 0) errors[field] = 'Enter a valid non-negative amount.';
    return amount;
  });
  if (amounts.every(amount => amount === 0)) errors.debitAmount = 'Debit and credit cannot both be zero.';
  return errors;
}

export function rowPages(index, count) {
  return [...new Set([0, index - 1, index, index + 1, count - 1])].filter(page => page >= 0 && page < count).sort((a, b) => a - b);
}
export function clampPage(page, count, pageSize) {
  return Math.max(1, Math.min(page, Math.ceil(count / pageSize) || 1));
}

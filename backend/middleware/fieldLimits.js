const limits = require('../constants/fieldLimits.json');

function limitFor(field, path = '') {
  if (/password|token|secret|code|hash|address|^_?id$|Id$|Ref$/i.test(field)) return undefined;
  if (path.startsWith('metadata.') || path.startsWith('options.')) return undefined;
  if (/email/i.test(field)) return limits.email;
  if (field === 'description' && path.startsWith('complaint.')) return limits.longText;
  if (/remark|finding|note|response|reason|message|content/i.test(field)) return limits.longText;
  return limits[field] ?? limits.shortText;
}
function validateFieldLengths(req, res, next) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
  const details = [];
  function visit(value, path = '') {
    if (!value || typeof value !== 'object') return;
    for (const [field, entry] of Object.entries(value)) {
      const key = path ? `${path}.${field}` : field;
      const limit = limitFor(field, req.baseUrl?.includes('complaints') ? `complaint.${key}` : key);
      if (typeof entry === 'string' && limit && entry.length > limit) details.push({ field: key, message: `Must not exceed ${limit} characters.` });
      else if (entry && typeof entry === 'object' && field !== 'metadata' && field !== 'options') visit(entry, key);
    }
  }
  visit(req.body);
  if (details.length) return res.status(400).json({ error: 'Validation failed', details });
  next();
}
module.exports = { validateFieldLengths, limitFor };

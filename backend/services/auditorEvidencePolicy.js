const crypto = require('crypto');
const { text, fail } = require('./budgetProposalPolicy');
const { validate } = require('./budgetDocumentPolicy');
const MAX_BYTES = 50 * 1024 * 1024, MAX_FILES = 50;
function documents(files, explanation, user) {
  if (typeof explanation !== 'string' || !explanation.trim() || explanation.length > 4000) fail('An explanation of up to 4,000 characters is required');
  if (!files?.length || files.length > 5 || files.some(f => f.buffer.length > 5 * 1024 * 1024) || files.reduce((n, f) => n + f.buffer.length, 0) > 10 * 1024 * 1024) fail('Attach one to five files, at most 5 MB each and 10 MB combined');
  const uploadedAt = new Date();
  return files.map(f => {
    if (!/\.(pdf|docx|jpe?g|png)$/i.test(f.originalname)) fail('Use PDF, DOCX, JPG or PNG evidence');
    return { originalName: text(f.originalname.replace(/[\\/\x00-\x1f\x7f]/g, '_'), 240), mimeType: validate(f), bytes: f.buffer.length, sha256: crypto.createHash('sha256').update(f.buffer).digest('hex'), data: f.buffer, uploadedBy: user._id, uploaderName: [user.firstName, user.lastName].filter(Boolean).join(' ') || String(user._id), uploadedAt, explanation: text(explanation, 4000) };
  });
}
module.exports = { documents, MAX_BYTES, MAX_FILES };

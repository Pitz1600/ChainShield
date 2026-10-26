const path = require('path');
const { inflateRawSync } = require('zlib');
const { fail } = require('./budgetProposalPolicy');
// Inspect ZIP entries, not merely the PK signature, for OOXML documents.
function office(buffer, kind) {
  let offset = 0; const names = new Set(); let expanded = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const flags = buffer.readUInt16LE(offset + 6), method = buffer.readUInt16LE(offset + 8);
    const size = buffer.readUInt32LE(offset + 18), nameSize = buffer.readUInt16LE(offset + 26), extra = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameSize).toString('utf8');
    const start = offset + 30 + nameSize + extra;
    if (flags & 9 || ![0, 8].includes(method) || start + size > buffer.length || name.includes('..') || name.startsWith('/') || /vbaProject|\.exe$/i.test(name)) return false;
    const data = buffer.subarray(start, start + size);
    const decoded = method === 8 ? inflateRawSync(data, { maxOutputLength: 20 * 1024 * 1024 }) : data;
    expanded += decoded.length;
    if (expanded > 30 * 1024 * 1024) return false;
    names.add(name); offset = start + size;
  }
  return names.has('[Content_Types].xml') && names.has('_rels/.rels') && names.has(kind === 'docx' ? 'word/document.xml' : 'xl/workbook.xml');
}
function validate(file) {
  const ext = path.extname(file.originalname).toLowerCase(); const b = file.buffer;
  const types = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  let valid = false;
  try {
    if (ext === '.pdf') valid = b.subarray(0, 5).toString() === '%PDF-' && b.subarray(-1024).includes(Buffer.from('%%EOF'));
    if (ext === '.png') valid = b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && b.includes(Buffer.from('IEND'));
    if (['.jpg', '.jpeg'].includes(ext)) valid = b[0] === 255 && b[1] === 216 && b[b.length - 2] === 255 && b[b.length - 1] === 217;
    if (['.docx', '.xlsx'].includes(ext)) valid = office(b, ext.slice(1));
  } catch { valid = false; }
  if (!valid || types[ext] !== file.mimetype) fail('File content, extension and MIME type must match PDF, DOCX, XLSX, JPG or PNG');
  return types[ext];
}
module.exports = { validate };

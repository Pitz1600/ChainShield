// Filesystem only. No models or database connection belong in this module.
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const root = path.resolve(process.env.RECEIPT_STORAGE_DIR || path.join(__dirname, '../local-receipts'));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const locks = new Map();
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function folder(id) {
  if (!uuid.test(id)) throw fail('Invalid import identifier');
  return path.join(root, 'imports', id);
}
function safeName(name) { return path.basename(String(name).replace(/\\/g, '/')).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 180) || 'attachment'; }
async function atomicWrite(manifest) {
  const dir = folder(manifest.importId);
  const temp = path.join(dir, `${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
    await fs.rename(temp, path.join(dir, 'manifest.json'));
  } finally { await fs.unlink(temp).catch(() => {}); }
}
async function read(id) {
  try { return JSON.parse(await fs.readFile(path.join(folder(id), 'manifest.json'), 'utf8')); }
  catch (err) { if (err.code === 'ENOENT') throw fail('CSV import not found', 404); throw err; }
}
async function list() {
  let entries;
  try { entries = await fs.readdir(path.join(root, 'imports')); }
  catch (err) { if (err.code === 'ENOENT') return []; throw err; }
  return Promise.all(entries.filter(id => uuid.test(id)).map(read));
}
async function createImport(name, user, ids) {
  if (!ids.length) throw fail('No imported transactions');
  const manifest = { version: 1, importId: randomUUID(), sourceCsvName: safeName(name), uploadedAt: new Date().toISOString(), uploadedBy: String(user), transactionIds: [...new Set(ids.map(String))], receipts: [] };
  await fs.mkdir(path.join(folder(manifest.importId), 'files'), { recursive: true, mode: 0o700 });
  await atomicWrite(manifest);
  return manifest;
}
function validateFiles(files) {
  if (!files?.length || files.length > 10) throw fail('Select 1–10 receipts');
  if (files.reduce((n, f) => n + f.size, 0) > 30 * 1024 * 1024) throw fail('Receipts must total at most 30 MB');
  return files.map(file => {
    const ext = path.extname(file.originalname).toLowerCase();
    const b = file.buffer;
    const type = b.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf'
      : b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
      : b[0] === 255 && b[1] === 216 && b[2] === 255 ? 'image/jpeg' : null;
    const expected = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
    if (!type || expected[ext] !== type || file.mimetype !== type || !file.size || file.size > 10 * 1024 * 1024) throw fail('Only valid JPG, PNG or PDF files up to 10 MB are accepted');
    return { file, type, ext };
  });
}
async function add(id, files, user) {
  folder(id);
  const validated = validateFiles(files);
  const previous = locks.get(id) || Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    const manifest = await read(id);
    const written = [];
    try {
      for (const { file, type, ext } of validated) {
        const receiptId = randomUUID();
        const storedName = receiptId + ext;
        const target = path.join(folder(id), 'files', storedName);
        await fs.writeFile(target, file.buffer, { flag: 'wx', mode: 0o600 });
        written.push(target);
        manifest.receipts.push({ receiptId, storedName, originalName: safeName(file.originalname), mimeType: type, size: file.size, uploadedAt: new Date().toISOString(), uploadedBy: String(user) });
      }
      await atomicWrite(manifest);
      return manifest;
    } catch (err) { await Promise.all(written.map(p => fs.unlink(p).catch(() => {}))); throw err; }
  });
  locks.set(id, task);
  try { return await task; } finally { if (locks.get(id) === task) locks.delete(id); }
}
function filePath(id, receipt) {
  if (!uuid.test(receipt.receiptId) || !new RegExp(`^${receipt.receiptId}\\.(pdf|png|jpe?g)$`).test(receipt.storedName)) throw fail('Invalid receipt');
  return path.join(folder(id), 'files', receipt.storedName);
}
function publicGroup(m) {
  return { importId: m.importId, sourceCsvName: m.sourceCsvName, uploadedAt: m.uploadedAt, transactionCount: m.transactionIds.length, receiptCount: m.receipts.length, receipts: m.receipts.map(({ storedName, ...r }) => r) };
}
module.exports = { createImport, read, list, add, filePath, publicGroup, validateFiles };

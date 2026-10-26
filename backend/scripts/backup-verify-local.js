#!/usr/bin/env node
// Read-only source backup, restore to a new local container, and verify full data.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { MongoClient, BSON } = require('mongoose').mongo;
const root = path.resolve(__dirname, '../..');
const env = require('dotenv').parse(fs.readFileSync(path.join(root, '.env')));
const uri = process.env.MONGODB_URI || env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');
process.umask(0o077);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const directory = path.join(root, 'backups', stamp);
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const secretDir = fs.mkdtempSync(path.join(directory, '.credentials-'));
fs.writeFileSync(path.join(secretDir, 'source.yml'), JSON.stringify({ uri }), { mode: 0o600 });
const container = `chainshield-restore-${stamp.toLowerCase()}`;
const volume = `${container}-data`;
const archive = path.join(directory, 'database.archive.gz');
const reportFile = path.join(directory, 'verification.json');
const report = { startedAt: new Date().toISOString(), directory, container, volume, sourceModified: false, status: 'in_progress' };
let source, restored, started = false;
function docker(args) { return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 }); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function json(value) { return JSON.stringify(canonical(BSON.EJSON.serialize(value, { relaxed: false }))); }
async function inventory(db) {
  const result = {};
  for (const info of (await db.listCollections().toArray()).sort((a, b) => a.name.localeCompare(b.name))) {
    if (info.type === 'view') { result[info.name] = { type: info.type, options: info.options }; continue; }
    const collection = db.collection(info.name);
    const digest = crypto.createHash('sha256'); let count = 0;
    for await (const document of collection.find({}, { promoteLongs: false, promoteValues: false }).sort({ _id: 1 })) {
      digest.update(json(document)); digest.update('\n'); count++;
    }
    result[info.name] = { type: info.type, count, sha256: digest.digest('hex'), options: info.options, indexes: (await collection.indexes()).map(({ v, ns, background, ...index }) => index).sort((a, b) => a.name.localeCompare(b.name)) };
    console.log(`Inventoried ${info.name}: ${count} documents`);
  }
  return result;
}
function save() { fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 }); }
async function main() {
  try {
    source = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 30000, readPreference: 'primary' });
    const db = source.db(); report.sourceDatabase = db.databaseName;
    report.sourceServerVersion = (await db.command({ buildInfo: 1 })).version;
    report.sourceBefore = await inventory(db);
    save(); console.log('Source inventory complete; creating isolated restore container.');
    docker(['run', '-d', '--name', container, '--label', 'chainshield.purpose=backup-restore-verification', '-p', '127.0.0.1::27017', '--mount', `type=volume,source=${volume},target=/data/db`, '--mount', `type=bind,source=${directory},target=/backup`, 'mongo:7.0', '--bind_ip_all', '--setParameter', 'ttlMonitorEnabled=false']); started = true;
    for (let i = 0; i < 60; i++) {
      try { docker(['exec', container, 'mongosh', '--quiet', '--eval', 'if (!db.adminCommand({ping:1}).ok) quit(1)']); break; }
      catch { if (i === 59) throw new Error('Local restore database did not start'); await new Promise(r => setTimeout(r, 1000)); }
    }
    report.toolsVersion = docker(['exec', container, 'mongodump', '--version']).trim();
    const dump = docker(['exec', container, 'mongodump', `--config=/backup/${path.basename(secretDir)}/source.yml`, '--archive=/backup/database.archive.gz', '--gzip']);
    fs.writeFileSync(path.join(directory, 'dump.stdout.log'), dump, { mode: 0o600 });
    fs.chmodSync(archive, 0o600);
    report.archive = { filename: 'database.archive.gz', bytes: fs.statSync(archive).size };
    if (!report.archive.bytes) throw new Error('Backup archive is empty');
    report.archive.sha256 = await new Promise((resolve, reject) => { const hash = crypto.createHash('sha256'); const stream = fs.createReadStream(archive); stream.on('error', reject); stream.on('data', b => hash.update(b)); stream.on('end', () => resolve(hash.digest('hex'))); });
    fs.writeFileSync(path.join(directory, 'SHA256SUMS'), `${report.archive.sha256}  database.archive.gz\n`, { mode: 0o600 });
    const uploads = path.join(root, 'backend/uploads');
    if (fs.existsSync(uploads)) {
      execFileSync('tar', ['-czf', path.join(directory, 'uploads.tar.gz'), '-C', path.join(root, 'backend'), 'uploads'], { stdio: 'pipe' });
      report.uploadsBackup = { filename: 'uploads.tar.gz', bytes: fs.statSync(path.join(directory, 'uploads.tar.gz')).size };
    }
    console.log(`Backup saved (${report.archive.bytes} bytes). Restoring into the isolated local database.`);
    report.restoreOutput = docker(['exec', container, 'mongorestore', '--uri=mongodb://127.0.0.1:27017', '--archive=/backup/database.archive.gz', '--gzip', '--stopOnError']);
    const port = docker(['port', container, '27017/tcp']).trim().split(':').at(-1);
    restored = await MongoClient.connect(`mongodb://127.0.0.1:${port}`, { serverSelectionTimeoutMS: 30000 });
    report.restoreVersionNote = 'MongoDB 8 cannot start on Docker kernel 7.0.12 (SERVER-121912). Local restore uses MongoDB 7; data and indexes are compared in full, but same-major restore remains a deployment check.';
    report.restoredServerVersion = (await restored.db('admin').command({ buildInfo: 1 })).version;
    report.restored = await inventory(restored.db(db.databaseName));
    report.sourceAfter = await inventory(db);
    report.collections = [...new Set([...Object.keys(report.sourceBefore), ...Object.keys(report.sourceAfter), ...Object.keys(report.restored)])].sort().map(name => {
      const before = report.sourceBefore[name], after = report.sourceAfter[name], local = report.restored[name];
      return { name, sourceStable: json(before) === json(after), restoredMatchesBefore: json(local) === json(before), restoredMatchesAfter: json(local) === json(after), restoredCount: local?.count };
    });
    report.verified = report.collections.every(c => c.restoredMatchesBefore || c.restoredMatchesAfter);
    report.status = report.verified ? 'verified' : 'verification_mismatch';
    report.finishedAt = new Date().toISOString();
    report.restoreCommand = 'docker exec <new-isolated-mongodb-container> mongorestore --uri=mongodb://127.0.0.1:27017 --archive=/backup/database.archive.gz --gzip --stopOnError';
    save(); console.log(JSON.stringify({ status: report.status, backup: archive, report: reportFile, collections: report.collections.length, restoredDocuments: report.collections.reduce((n, c) => n + (c.restoredCount || 0), 0), container, volume }, null, 2));
    if (!report.verified) process.exitCode = 2;
  } catch (error) {
    // Do not write driver/tool messages which may include credentials or documents.
    report.status = 'failed'; report.error = { name: error.name, code: error.code, stage: report.archive ? 'restore_or_verification' : 'inventory_or_backup' }; save();
    const diagnostic = String(error.stderr || error.message || '').replaceAll(uri, '[SOURCE_URI_REDACTED]').replace(/mongodb(?:\+srv)?:\/\/[^\s\"']+/g, '[MONGODB_URI_REDACTED]');
    fs.writeFileSync(path.join(directory, 'failure.log'), diagnostic, { mode: 0o600 });
    console.error('Backup/restore verification failed; sanitized details saved in verification.json and failure.log.'); process.exitCode = 1;
  } finally {
    await source?.close(); await restored?.close();
    if (started) { try { docker(['stop', container]); report.containerState = 'stopped'; } catch { report.containerState = 'stop_failed'; } }
    fs.unlinkSync(path.join(secretDir, 'source.yml')); fs.rmdirSync(secretDir); save();
  }
}
main();

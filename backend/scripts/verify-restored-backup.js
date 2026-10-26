#!/usr/bin/env node
// Read-only verification against a saved snapshot; never connects to the source URI.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, BSON } = require('mongoose').mongo;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
const json = value => JSON.stringify(canonical(BSON.EJSON.serialize(value, { relaxed: false })));
async function main() {
  const directory = path.resolve(process.argv[2] || '');
  const uri = process.env.RESTORE_VERIFY_URI;
  if (!uri || !/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) throw new Error('RESTORE_VERIFY_URI must point explicitly to a localhost verification server');
  const original = JSON.parse(fs.readFileSync(path.join(directory, 'verification.json')));
  const expected = original.sourceBefore;
  const bytes = fs.readFileSync(path.join(directory, original.archive.filename));
  const archiveSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (archiveSha256 !== original.archive.sha256) throw new Error('Backup archive checksum mismatch');
  const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    const db = client.db(original.sourceDatabase);
    const version = (await db.command({ buildInfo: 1 })).version;
    const hello = await db.command({ hello: 1 });
    const actual = {};
    for (const info of await db.listCollections().toArray()) {
      if (info.type === 'view') { actual[info.name] = { type: info.type, options: info.options }; continue; }
      const collection = db.collection(info.name); const hash = crypto.createHash('sha256'); let count = 0;
      for await (const document of collection.find({}, { promoteLongs: false, promoteValues: false }).sort({ _id: 1 })) { hash.update(json(document)); hash.update('\n'); count++; }
      actual[info.name] = { type: info.type, count, sha256: hash.digest('hex'), options: info.options, indexes: (await collection.indexes()).map(({ v, ns, background, ...i }) => i).sort((a, b) => a.name.localeCompare(b.name)) };
    }
    const comparable = info => info && { ...info, ...(info.indexes && { indexes: info.indexes.map(index => ({ ...index, key: Object.entries(index.key) })) }) };
    const collections = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort().map(name => ({ name, matches: json(comparable(actual[name])) === json(comparable(expected[name])), documents: actual[name]?.count || 0 }));
    const report = { verifiedAt: new Date().toISOString(), sourceVersion: original.sourceServerVersion, restoredVersion: version, exactVersion: version === original.sourceServerVersion, replicaSet: hello.setName, archiveSha256, collections, documents: collections.reduce((n, c) => n + c.documents, 0), verified: collections.every(c => c.matches), sourceAccessed: false };
    const filename = path.join(directory, 'verification-mongo8.json');
    fs.writeFileSync(filename, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify({ ...report, report: filename }, null, 2));
    if (!report.verified || !report.exactVersion || !hello.setName) process.exitCode = 1;
  } finally { await client.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

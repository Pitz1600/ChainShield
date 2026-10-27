#!/usr/bin/env node
// Restore a reconciliation snapshot ONLY into a fresh, isolated local database.
// No .env loading, application database writes, deletes or overwrites.
const { MongoClient, ObjectId } = require('mongoose').mongo;
async function main() {
  const sourceUri = process.env.ANNUAL_BACKUP_SOURCE_URI;
  const targetUri = process.env.ANNUAL_BACKUP_RESTORE_URI;
  const backupId = process.argv[2];
  if (!sourceUri || !/^mongodb:\/\/127\.0\.0\.1:\d+\/chainshield_annual_restore_[a-zA-Z0-9_]+(?:\?|$)/.test(targetUri || '') || !/^[a-fA-F0-9]{24}$/.test(backupId || '')) throw new Error('Supply source URI, fresh localhost chainshield_annual_restore_* target URI, and snapshot ID');
  const source = new MongoClient(sourceUri), target = new MongoClient(targetUri);
  try {
    await source.connect(); await target.connect();
    const db = target.db();
    if ((await db.listCollections().toArray()).length) throw new Error('Restore target must be empty');
    let count = 0;
    for await (const row of source.db().collection('annualbudgetbackups').find({ backupId: new ObjectId(backupId) })) {
      if (!['annualbudgets', 'budgetproposals'].includes(row.collection) || !row.document?._id) throw new Error('Invalid snapshot record');
      await db.collection(row.collection).insertOne(row.document); count++;
    }
    if (!count) throw new Error('Snapshot not found');
    console.log(`Restored ${count} documents into isolated local database. Source unchanged.`);
  } finally { await source.close(); await target.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });

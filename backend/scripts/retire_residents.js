// Run backup.sh first, then node scripts/retire_residents.js --dry-run.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    if (!await User.countDocuments({ role: 'administrator', isActive: true })) throw new Error('Retirement requires an active administrator');
    const query = { role: 'resident', isActive: { $ne: false } };
    const users = await User.collection.find(query, { projection: { _id: 1, email: 1 } }).toArray();
    console.log(JSON.stringify({ dryRun: process.argv.includes('--dry-run'), count: users.length, users }, null, 2));
    if (process.argv.includes('--dry-run') || !users.length) return;
    // Raw collection avoids validation of the retired role; references remain intact.
    const result = await User.collection.updateMany(query, { $set: { isActive: false, updatedAt: new Date() }, $inc: { sessionVersion: 1 } });
    await AuditLog.create({ action: 'residents_retired', details: { userIds: users.map(u => u._id), count: result.modifiedCount } });
    console.log(`Deactivated ${result.modifiedCount} accounts; complaints and feedback preserved.`);
  } finally { await mongoose.disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

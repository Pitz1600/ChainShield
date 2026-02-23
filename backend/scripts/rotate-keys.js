const fs = require('fs');
const path = require('path');
const { encryptFile, decryptStream } = require('../utils/encryption');
const { pipeline } = require('stream/promises');

async function rotateFile(filePath, oldKey, newKey) {
    if (!filePath.endsWith('.enc')) return;

    console.log(`🔄 Rotating: ${path.basename(filePath)}`);

    const tempPlainPath = filePath.replace('.enc', '.temp_plain');
    const outputPlain = fs.createWriteStream(tempPlainPath);

    try {
        // 1. Decrypt with OLD key
        await pipeline(decryptStream(filePath, oldKey), outputPlain);

        // 2. Re-encrypt with NEW key
        // Note: encryptFile automatically deletes the source file (the temp plain one)
        // and creates a new .enc file at the same location.
        // We need to move the original .enc out of the way first.
        const backupEncPath = filePath + '.old_key';
        fs.renameSync(filePath, backupEncPath);

        const newEncPath = await encryptFile(tempPlainPath, newKey);

        // Rename the new encrypted file to the original target path
        fs.renameSync(newEncPath, filePath);

        // 3. Cleanup the old key backup
        fs.unlinkSync(backupEncPath);
        console.log(`  ✅ Success: Mitigated compromise for ${path.basename(filePath)}`);
    } catch (err) {
        console.error(`  ❌ Failed: ${path.basename(filePath)} - ${err.message}`);
        // Attempt restoration from backup if failed
        if (fs.existsSync(filePath + '.old_key')) {
            fs.renameSync(filePath + '.old_key', filePath);
        }
    }
}

async function run() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.log('Usage: node rotate-keys.js <OLD_KEY>');
        console.log('Note: The NEW_KEY is automatically pulled from your current .env file.');
        process.exit(1);
    }

    const oldKey = args[0];
    const newKey = process.env.BACKUP_ENCRYPTION_KEY;

    if (!newKey) {
        console.error('Error: BACKUP_ENCRYPTION_KEY not found in .env');
        process.exit(1);
    }

    if (oldKey === newKey) {
        console.error('Error: The provided OLD_KEY is the same as the current NEW_KEY. No rotation needed.');
        process.exit(1);
    }

    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
        console.error('Error: uploads directory not found');
        process.exit(1);
    }

    console.log('🛡️  Starting Security Incident Response: Master Key Rotation');
    console.log('-----------------------------------------------------------');

    const files = fs.readdirSync(uploadsDir);
    const encFiles = files.filter(f => f.endsWith('.enc'));

    console.log(`📁 Processing ${encFiles.length} files in ${uploadsDir}...\n`);

    for (const file of encFiles) {
        await rotateFile(path.join(uploadsDir, file), oldKey, newKey);
    }

    console.log('\n🏁 Key Rotation & Data Migration Complete.');
    console.log('⚠️  REMINDER: If you have database backups, you must re-encrypt them manually or rotate them using the new key setup.');
}

// Load current env (which contains the NEW key)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

run();

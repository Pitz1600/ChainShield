const fs = require('fs');
const path = require('path');
const { decryptStream } = require('../utils/encryption');
const { pipeline } = require('stream/promises');

async function decryptFile(encryptedPath) {
    if (!encryptedPath.endsWith('.enc')) {
        console.warn(`  ⚠️  Skipping: ${encryptedPath} (not an .enc file)`);
        return;
    }

    const decryptedPath = encryptedPath.replace('.enc', '');
    const output = fs.createWriteStream(decryptedPath);

    console.log(`  🔓 Decrypting: ${path.basename(encryptedPath)}`);

    try {
        await pipeline(decryptStream(encryptedPath), output);
        console.log(`  ✅ Restored:   ${path.basename(decryptedPath)}`);
    } catch (err) {
        console.error(`  ❌ Failed:     ${path.basename(encryptedPath)} - ${err.message}`);
        if (fs.existsSync(decryptedPath)) fs.unlinkSync(decryptedPath);
    }
}

async function run() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log('Usage:');
        console.log('  Single File: node decrypt-upload.js uploads/file.csv.enc');
        console.log('  Directory:   node decrypt-upload.js uploads/');
        process.exit(1);
    }

    const targetPath = args[0];
    if (!fs.existsSync(targetPath)) {
        console.error(`Error: Path not found: ${targetPath}`);
        process.exit(1);
    }

    const stats = fs.statSync(targetPath);

    if (stats.isDirectory()) {
        console.log(`📁 Batch Decrypting directory: ${targetPath}`);
        const files = fs.readdirSync(targetPath);
        const encFiles = files.filter(f => f.endsWith('.enc'));

        console.log(`  Found ${encFiles.length} encrypted files.`);

        for (const file of encFiles) {
            await decryptFile(path.join(targetPath, file));
        }
        console.log('\n🏁 Batch Decryption Complete.');
    } else {
        await decryptFile(targetPath);
    }
}

// Load env vars if running locally
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

run();

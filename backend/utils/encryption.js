const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

// Use the same configuration as the backup script for consistency
const ALGORITHM = 'aes-256-cbc';
const PBKDF2_ITERATIONS = 100000;
const SALT_SIZE = 16;
const KEY_SIZE = 32;
const IV_SIZE = 16;

/**
 * Get the encryption key from environment variable or provided string
 * @param {Buffer} salt
 * @param {string} [customPassword]
 * @returns {Buffer}
 */
const getEncryptionKey = (salt, customPassword) => {
    const password = customPassword || process.env.BACKUP_ENCRYPTION_KEY;
    if (!password) {
        throw new Error('Encryption key/password is not defined');
    }
    return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_SIZE, 'sha256');
};

/**
 * Encrypt a file at the given path and append .enc extension
 * @param {string} filePath 
 * @param {string} [customPassword]
 */
exports.encryptFile = async (filePath, customPassword) => {
    const salt = crypto.randomBytes(SALT_SIZE);
    const iv = crypto.randomBytes(IV_SIZE);
    const key = getEncryptionKey(salt, customPassword);

    const encryptor = crypto.createCipheriv(ALGORITHM, key, iv);
    const input = fs.createReadStream(filePath);
    const output = fs.createWriteStream(`${filePath}.enc`);

    // Write salt and IV to the beginning of the file
    output.write(salt);
    output.write(iv);

    await pipeline(input, encryptor, output);

    // Remove the original unencrypted file
    fs.unlinkSync(filePath);
    return `${filePath}.enc`;
};

/**
 * Create a decryption stream for an encrypted file
 * @param {string} filePath 
 * @param {string} [customPassword]
 * @returns {ReadableStream}
 */
exports.decryptStream = (filePath, customPassword) => {
    const fd = fs.openSync(filePath, 'r');

    const salt = Buffer.alloc(SALT_SIZE);
    const iv = Buffer.alloc(IV_SIZE);

    fs.readSync(fd, salt, 0, SALT_SIZE, 0);
    fs.readSync(fd, iv, 0, IV_SIZE, SALT_SIZE);

    const key = getEncryptionKey(salt, customPassword);
    const decryptor = crypto.createDecipheriv(ALGORITHM, key, iv);

    const input = fs.createReadStream(filePath, { start: SALT_SIZE + IV_SIZE });
    return input.pipe(decryptor);
};

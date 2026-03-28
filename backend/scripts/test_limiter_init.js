try {
    console.log('Attempting to require rateLimiter.js...');
    const rateLimiter = require('./backend/middleware/rateLimiter');
    console.log('✅ Successfully required rateLimiter.js');
} catch (error) {
    console.error('❌ Failed to require rateLimiter.js:');
    console.error(error);
    process.exit(1);
}

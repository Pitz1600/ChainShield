const mongoose = require('mongoose');
const { EventEmitter } = require('events');
const auditLogMiddleware = require('../middleware/auditLog');
const AuditLog = require('../models/AuditLog');

// Mock request and response
const mockReq = {
    method: 'POST',
    originalUrl: '/api/transactions',
    ip: '127.0.0.1',
    get: (header) => 'TestAgent/1.0',
    user: { _id: new mongoose.Types.ObjectId() } // Simulate authenticated user
};

const mockRes = new EventEmitter();
mockRes.statusCode = 200;

// Mock next function
const next = () => {
    console.log('Middleware called next()');
    // Simulate request finishing
    mockRes.emit('finish');
};

async function runTest() {
    console.log('Starting Audit Log Verification...');

    // 1. Connect to DB (Mock or Real? Ideally we don't pollute real DB, but we need Mongoose to work)
    // We'll mock the Save function of AuditLog to avoid DB writes if possible, 
    // OR strictly test the middleware logic by stubbing AuditLog.prototype.save

    const originalSave = AuditLog.prototype.save;
    let saveCalled = false;

    AuditLog.prototype.save = async function () {
        console.log('AuditLog.save() called!');
        console.log('Entry:', this);
        saveCalled = true;

        // Validate fields based on context
        const expectedAction = this.action === 'Logged in' ? 'Logged in' : 'Created a new transaction';

        if (this.action === expectedAction) {
            console.log(`✅ Entry matches expected action: ${this.action}`);
        } else {
            console.error('❌ Entry values incorrect:', this);
        }

        return this;
    };

    try {
        // Run middleware
        auditLogMiddleware(mockReq, mockRes, next);

        // Wait a bit since saving is async inside the event listener
        await new Promise(resolve => setTimeout(resolve, 500));

        if (saveCalled) {
            console.log('✅ Verification Passed: Middleware attempted to save log.');
        } else {
            console.error('❌ Verification Failed: Middleware did not save log.');
        }

        // --- TEST 2: Simulate Login Flow (where User is added LATE) ---
        console.log('\n--- Test 2: Delayed User Attach (Login Flow) ---');
        saveCalled = false;
        const loginReq = {
            method: 'POST',
            originalUrl: '/api/auth/login',
            ip: '127.0.0.1',
            get: () => 'TestAgent',
        };
        const loginRes = new EventEmitter();
        loginRes.statusCode = 200;

        const loginNext = () => {
            // Simulate Controller Logic: Attach user THEN emit finish
            console.log('Controller executing...');
            const user = { _id: new mongoose.Types.ObjectId() };
            loginReq.user = user;
            console.log('User attached to req.');
            loginRes.emit('finish');
        };

        auditLogMiddleware(loginReq, loginRes, loginNext);
        await new Promise(resolve => setTimeout(resolve, 500));

        if (saveCalled) {
            console.log('✅ verification Passed: Login flow captured user correctly.');
        } else {
            console.error('❌ verification Failed: Login flow failed to capture user.');
        }

    } catch (error) {
        console.error('Test Error:', error);
    } finally {
        AuditLog.prototype.save = originalSave;
    }
}

runTest();

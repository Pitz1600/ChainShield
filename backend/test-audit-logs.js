const mongoose = require('mongoose');
const AuditLog = require('./models/AuditLog');
const User = require('./models/User');
require('dotenv').config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chainshield';
mongoose.connect(MONGODB_URI);

async function testAuditLogs() {
    try {
        console.log('Testing Audit Logs...');

        // 1. Create a dummy user if not exists
        let user = await User.findOne({ email: 'test_audit@example.com' });
        if (!user) {
            user = await User.create({
                username: 'TestAuditUser',
                email: 'test_audit@example.com',
                password: 'password123',
                role: 'resident',
                isVerified: true,
                isActive: true
            });
            console.log('Created test user:', user._id);
        } else {
            console.log('Found test user:', user._id);
        }

        // 2. Create a dummy audit log
        const log = await AuditLog.create({
            action: 'feedback_submitted',
            userId: user._id, // Use userId field as per schema
            userRole: user.role,
            username: user.username,
            details: { test: 'true', message: 'Test log entry' },
            ipAddress: '127.0.0.1',
            userAgent: 'TestScript/1.0'
        });
        console.log('Created audit log:', log._id);

        // 3. Simulate fetching logs (Controller logic)
        const logs = await AuditLog.find()
            .populate('userId', 'username email role')
            .sort({ createdAt: -1 })
            .limit(5);

        console.log(`Fetched ${logs.length} logs.`);

        if (logs.length > 0) {
            const fetchedLog = logs.find(l => l._id.toString() === log._id.toString());
            if (fetchedLog) {
                console.log('✅ Specific log found!');
                console.log('Action:', fetchedLog.action);
                console.log('User:', fetchedLog.userId.username);
            } else {
                console.log('❌ Specific log NOT found in top 5!');
            }
        }

        // 4. Test auditLogger utility
        console.log('\nTesting auditLogger utility...');
        const { logAudit } = require('./utils/auditLogger');
        const mockReq = {
            ip: '192.168.1.100',
            get: (header) => header === 'User-Agent' ? 'TestScript/2.0' : null
        };

        await logAudit({
            action: 'test_utility_action',
            userId: user._id,
            details: { test: 'utility' },
            req: mockReq
        });

        // Verify utility log
        const utilLog = await AuditLog.findOne({ action: 'test_utility_action' }).sort({ createdAt: -1 });
        if (utilLog) {
            console.log('✅ Utility log found!');
            console.log('Action:', utilLog.action);
            console.log('IP:', utilLog.ipAddress);
        } else {
            console.log('❌ Utility log NOT found!');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

testAuditLogs();

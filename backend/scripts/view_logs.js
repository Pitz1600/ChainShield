const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const AuditLog = require('../models/AuditLog');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (error) {
        console.error('MongoDB Connection Error:', error);
        process.exit(1);
    }
};

const viewLogs = async () => {
    await connectDB();

    try {
        console.log('Fetching latest 20 audit logs...\n');

        const logs = await AuditLog.find({})
            .sort({ timestamp: -1 })
            .limit(20)
            .lean(); // Convert to plain JS objects

        console.log(JSON.stringify(logs, null, 2));

    } catch (error) {
        console.error('Error fetching logs:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nConnection closed.');
    }
};

viewLogs();

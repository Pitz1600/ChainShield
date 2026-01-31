# Admin Account Setup Guide

## Creating an Administrator Account

**IMPORTANT**: For security reasons, administrator accounts cannot be created through the public registration page. Admin accounts must be created directly in the database by a system administrator.

## Method 1: Using MongoDB Shell (Recommended)

### Step 1: Access MongoDB
```bash
# Connect to MongoDB container
docker exec -it chainshield-mongodb mongosh

# Or if MongoDB is running locally
mongosh
```

### Step 2: Switch to ChainShield Database
```javascript
use chainshield
```

### Step 3: Create Admin Account
```javascript
// First, hash the password using bcrypt
// You'll need to generate this hash separately or use a temporary password

db.users.insertOne({
  username: "Admin User",
  email: "admin@chainshield.local",
  password: "$2a$10$YourBcryptHashedPasswordHere", // Replace with actual bcrypt hash
  role: "administrator",
  department: "IT Department",
  isVerified: true,
  createdAt: new Date(),
  updatedAt: new Date()
})
```

### Step 4: Generate Password Hash

To generate a bcrypt hash for your password, you can use Node.js:

```javascript
// Run this in Node.js REPL or create a script
const bcrypt = require('bcryptjs');
const password = 'YourSecurePassword123';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
```

Or use an online bcrypt generator (for development only):
- https://bcrypt-generator.com/
- Use rounds: 10

## Method 2: Using Backend Script

Create a file `create-admin.js` in the backend directory:

```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chainshield');

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  role: String,
  department: String,
  isVerified: Boolean,
  createdAt: Date,
  updatedAt: Date
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = new User({
    username: 'System Administrator',
    email: 'admin@chainshield.local',
    password: hashedPassword,
    role: 'administrator',
    department: 'IT Department',
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await admin.save();
  console.log('Admin account created successfully!');
  console.log('Email: admin@chainshield.local');
  console.log('Password: admin123');
  console.log('IMPORTANT: Change this password immediately after first login!');
  
  mongoose.connection.close();
}

createAdmin().catch(console.error);
```

Run the script:
```bash
cd backend
node create-admin.js
```

## Default Admin Credentials (Development)

**Email**: `admin@chainshield.local`  
**Password**: `admin123`

**⚠️ CRITICAL**: Change this password immediately after first login!

## Accessing Admin Features

Once logged in as an administrator, you'll have access to:

- ✅ **Dashboard**: Overview of all transaction alerts
- ✅ **Transaction Alerts**: View and manage fraud alerts
- ✅ **Transaction History**: View all transactions
- ✅ **CSV Import**: Bulk import transactions
- ✅ **Analytics**: View fraud analytics and trends
- ✅ **Flagged Cases**: Investigate fraud cases
- ✅ **Admin Panel**: Manage users, roles, and system settings
- ✅ **Profile**: Manage your account

## Role Hierarchy

1. **Administrator**: Full system access, user management
2. **Barangay Official**: Transaction management and analytics
3. **Analyst/Investigator**: Case investigation access
4. **Resident**: View-only access to own transactions

## Security Best Practices

- 🔒 **Never** create admin accounts through public registration
- 🔒 Always use strong passwords (12+ characters, mixed case, numbers, symbols)
- 🔒 Enable OTP verification for all profile and password changes
- 🔒 Regularly review user access and permissions
- 🔒 Monitor admin activity logs
- 🔒 Change default passwords immediately
- 🔒 Limit admin accounts to essential personnel only

## Troubleshooting

**Can't connect to MongoDB?**
- Ensure Docker containers are running: `docker compose ps`
- Check MongoDB logs: `docker logs chainshield-mongodb`

**Password hash not working?**
- Ensure you're using bcrypt with 10 rounds
- Verify the hash starts with `$2a$10$` or `$2b$10$`

**Need to reset admin password?**
- Use the same MongoDB method to update the password field
- Or use the "Forgot Password" feature (requires SMTP setup)

## Production Deployment

For production environments:

1. **Remove** or **disable** the create-admin script
2. Create admin accounts manually via secure database access
3. Use environment-specific credentials
4. Enable audit logging for admin actions
5. Implement IP whitelisting for admin access
6. Use VPN or secure network for database access

## Support

For additional help:
- Check backend logs: `docker logs chainshield-backend`
- Review main README.md for setup instructions
- Contact your system administrator

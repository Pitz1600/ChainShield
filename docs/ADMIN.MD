# Admin Account Setup Guide

## Creating an Administrator Account

**IMPORTANT**: For security reasons, administrator accounts cannot be created through the public registration page. Admin accounts must be created directly in the database using the provided script or manually via MongoDB shell.

## Method 1: Using the Setup Script (Recommended)

We have provided a script to easily create a default administrator account.

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Run the creation script:
   ```bash
   node create-admin.js
   ```

3. The script will create an admin user with the following credentials:
   - **Email**: `admin@chainshield.local`
   - **Password**: `admin123`

   > **⚠️ IMPORTANT**: Log in immediately and change this password!

## Method 2: Manual Creation via MongoDB Shell

If you prefer to create an admin manually:

1. Connect to your MongoDB instance:
   ```bash
   docker exec -it chainshield-mongodb mongosh
   # OR
   mongosh
   ```

2. Switch to the database:
   ```javascript
   use chainshield
   ```

3. Insert the admin user (password needs to be hashed using bcrypt):
   ```javascript
   db.users.insertOne({
     firstName: "System",
     lastName: "Administrator",
     email: "admin@chainshield.local",
     password: "$2a$10$YourHashedPasswordHere", // START WITH A KNOWN HASH OR GENERATE ONE
     role: "administrator",
     position: "System Administrator",
     isVerified: true,
     isActive: true,
     createdAt: new Date(),
     updatedAt: new Date()
   })
   ```

## Admin Access & Security

- **URL**: `/login`
- **Role**: `administrator`

### Best Practices
- **Never** leave the default password unchanged.
- **Do not** create admin accounts for users who do not need full system access.
- **Audit Logs**: All admin actions are logged.

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chainshield';

async function migrateUsers() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // Get all users
        const users = await usersCollection.find({}).toArray();
        console.log(`\n📊 Found ${users.length} users to migrate`);

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const user of users) {
            try {
                // Skip if already migrated (has firstName and lastName)
                if (user.firstName && user.lastName) {
                    console.log(`⏭️  Skipping ${user.email} - already migrated`);
                    successCount++;
                    continue;
                }

                // Split username into firstName and lastName
                const username = user.username || 'Unknown User';
                const nameParts = username.trim().split(/\s+/);

                let firstName, lastName;

                if (nameParts.length === 1) {
                    // Single name - use as firstName, set lastName to empty string or same
                    firstName = nameParts[0];
                    lastName = nameParts[0];
                } else if (nameParts.length === 2) {
                    // Two parts - first and last
                    firstName = nameParts[0];
                    lastName = nameParts[1];
                } else {
                    // Multiple parts - first is firstName, rest is lastName
                    firstName = nameParts[0];
                    lastName = nameParts.slice(1).join(' ');
                }

                // Update the user document
                const updateResult = await usersCollection.updateOne(
                    { _id: user._id },
                    {
                        $set: {
                            firstName: firstName,
                            lastName: lastName,
                            birthday: user.birthday || null
                        },
                        $unset: {
                            username: "" // Remove the old username field
                        }
                    }
                );

                if (updateResult.modifiedCount > 0) {
                    console.log(`✅ Migrated: ${user.email} -> ${firstName} ${lastName}`);
                    successCount++;
                } else {
                    console.log(`⚠️  No changes for: ${user.email}`);
                    successCount++;
                }

            } catch (error) {
                console.error(`❌ Error migrating ${user.email}:`, error.message);
                errors.push({ email: user.email, error: error.message });
                errorCount++;
            }
        }

        // Try to drop the old username index if it exists
        try {
            console.log('\n🔧 Attempting to drop old username_1 index...');
            await usersCollection.dropIndex('username_1');
            console.log('✅ Dropped username_1 index');
        } catch (indexError) {
            if (indexError.code === 27 || indexError.message.includes('index not found')) {
                console.log('ℹ️  username_1 index does not exist (already removed or never created)');
            } else {
                console.log('⚠️  Could not drop username_1 index:', indexError.message);
            }
        }

        // Print summary
        console.log('\n' + '='.repeat(50));
        console.log('📋 MIGRATION SUMMARY');
        console.log('='.repeat(50));
        console.log(`✅ Successful: ${successCount}`);
        console.log(`❌ Failed: ${errorCount}`);
        console.log(`📊 Total: ${users.length}`);

        if (errors.length > 0) {
            console.log('\n❌ Errors:');
            errors.forEach(err => {
                console.log(`  - ${err.email}: ${err.error}`);
            });
        }

        console.log('\n✨ Migration complete!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run migration
migrateUsers();

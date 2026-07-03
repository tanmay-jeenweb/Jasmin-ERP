const db = require("./config/db.js");

async function migrate() {
    try {
        console.log("Step 1: Creating user_devices table...");
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS user_devices (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              device_id VARCHAR(255) NOT NULL,
              status ENUM('pending', 'approved', 'revoked') DEFAULT 'pending',
              submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              approved_by INT NULL,
              approved_at TIMESTAMP NULL,
              closed_at TIMESTAMP NULL,
              closed_by INT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
              FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
            );
        `;
        await db.execute(createTableQuery);
        console.log("✅ Created user_devices table.");

        console.log("Step 2: Migrating existing device data...");
        try {
            // Check if device_id column still exists in users table before migrating
            const [columns] = await db.execute("SHOW COLUMNS FROM users LIKE 'device_id'");
            if (columns.length > 0) {
                await db.execute(`
                    INSERT INTO user_devices (user_id, device_id, status, submitted_at, approved_at)
                    SELECT id, device_id, 'approved', NOW(), NOW()
                    FROM users
                    WHERE device_id IS NOT NULL
                `);
                console.log("✅ Migrated existing device data.");
                
                console.log("Step 3: Dropping device_id column from users...");
                await db.execute("ALTER TABLE users DROP COLUMN device_id");
                console.log("✅ Dropped device_id column.");
            } else {
                console.log("ℹ️ Column device_id already removed from users table. Skipping data migration.");
            }
        } catch (e) {
            console.error("Error during step 2 or 3:", e.message);
        }

    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        process.exit();
    }
}

migrate();

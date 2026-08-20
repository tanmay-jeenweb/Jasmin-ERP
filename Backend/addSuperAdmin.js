require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./config/db.js");

async function addSuperAdmin() {
    const name = "Super Admin";
    const username = "superadmin";
    const email = "superadmin@erp.com";
    const plainPassword = "superadmin123";
    const role = "super admin";

    let connection;
    try {
        console.log("Connecting to database pool...");
        connection = await db.getConnection();
        console.log("✅ Obtained database connection.");

        console.log("Checking if users table has plain_password column...");
        // Make sure the users table has the plain_password column
        try {
            const [columns] = await connection.execute("SHOW COLUMNS FROM users LIKE 'plain_password'");
            if (columns.length === 0) {
                console.log("Adding plain_password column to users table...");
                await connection.execute("ALTER TABLE users ADD COLUMN plain_password VARCHAR(255) DEFAULT NULL");
                console.log("✅ Column added.");
            } else {
                console.log("ℹ️ plain_password column already exists.");
            }
        } catch (e) {
            console.log("⚠️ Could not check/alter users table schema (table may not exist yet):", e.message);
        }

        console.log("Checking if superadmin user exists...");
        const [existing] = await connection.execute(
            "SELECT id FROM users WHERE username = ?",
            [username]
        );

        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        if (existing.length > 0) {
            console.log(`⚠️ User with username '${username}' already exists. Updating settings...`);
            await connection.execute(
                `UPDATE users 
                 SET name = ?, email = ?, password = ?, role = ?, active = 1, device_verification_required = 0, plain_password = ?
                 WHERE username = ?`,
                [name, email, hashedPassword, role, plainPassword, username]
            );
            console.log("✅ Super Admin updated successfully!\n");
        } else {
            console.log("Creating new Super Admin user...");
            await connection.execute(
                `INSERT INTO users (name, username, email, password, role, active, device_verification_required, plain_password)
                 VALUES (?, ?, ?, ?, ?, 1, 0, ?)`,
                [name, username, email, hashedPassword, role, plainPassword]
            );
            console.log("✅ Super Admin created successfully!\n");
        }

        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`  Username : ${username}`);
        console.log(`  Password : ${plainPassword}`);
        console.log(`  Role     : ${role}`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    } catch (error) {
        console.error("❌ Failed to add super admin:", error.message);
    } finally {
        if (connection) {
            try {
                connection.release();
                console.log("Released database connection.");
            } catch (e) {}
        }
        process.exit(0);
    }
}

addSuperAdmin();

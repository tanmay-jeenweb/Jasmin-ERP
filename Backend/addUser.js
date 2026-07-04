require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./config/db.js");

async function addUser() {
    const name = "Admin User";
    const username = "admin";
    const email = "admin@erp.com";
    const plainPassword = "admin";
    const role = "admin";

    try {
        console.log("Connecting to database...");
        const connection = await db.getConnection();
        connection.release();
        console.log("Connected.\n");

        // Check if user already exists
        const [existing] = await db.execute(
            "SELECT id FROM users WHERE username = ?",
            [username]
        );

        if (existing.length > 0) {
            console.log(`⚠️ User with username '${username}' already exists.`);
            process.exit(0);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // Insert user
        await db.execute(
            `INSERT INTO users (name, username, email, password, role, active, device_verification_required)
             VALUES (?, ?, ?, ?, ?, 1, 0)`,
            [name, username, email, hashedPassword, role]
        );

        console.log("✅ User created successfully!\n");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`  Username : ${username}`);
        console.log(`  Password : ${plainPassword}`);
        console.log(`  Role     : ${role}`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    } catch (error) {
        console.error("Failed to add user:", error.message);
    } finally {
        process.exit(0);
    }
}

addUser();

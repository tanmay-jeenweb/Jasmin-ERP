require("dotenv").config();
const mysql = require("mysql2/promise");

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    dateStrings: true, // Return DATE and DATETIME as strings to avoid timezone shift

    waitForConnections: true,
    connectionLimit: 5,       // Keep low for shared CPanel hosting
    queueLimit: 0,
    connectTimeout: 30000,    // 30s to establish a new connection

    // Keep connections alive via TCP keepalive packets
    enableKeepAlive: true,
    keepAliveInitialDelay: 5000  // Start sending keepalives after 5s of idle
});

const connectDB = async () => {
    try {
        const connection = await db.getConnection();
        console.log("MySQL Connected Successfully");
        connection.release();
    } catch (error) {
        console.error("MySQL Connection Error:");
        console.error(error.message);
        process.exit(1);
    }
};

module.exports = db;
module.exports.connectDB = connectDB;
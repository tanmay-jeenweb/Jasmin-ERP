const db = require("../config/db.js");

/**
 * Creates the refresh_tokens table if it does not exist.
 */
const createRefreshTokensTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(512) NOT NULL,
            device_id VARCHAR(255) NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_token (token(255))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await db.execute(query);
    console.log("Refresh tokens table ready");
};

/**
 * Saves a new refresh token for a user.
 */
const addRefreshToken = async (userId, token, deviceId = null, expiresAt) => {
    const query = `
        INSERT INTO refresh_tokens (user_id, token, device_id, expires_at)
        VALUES (?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [userId, token, deviceId, expiresAt]);
    return result;
};

/**
 * Finds a refresh token that has not expired yet.
 */
const findRefreshToken = async (token) => {
    const query = `
        SELECT * FROM refresh_tokens
        WHERE token = ? AND expires_at > NOW()
        LIMIT 1
    `;
    const [rows] = await db.execute(query, [token]);
    return rows[0];
};

/**
 * Deletes a specific refresh token (revokes it).
 */
const deleteRefreshToken = async (token) => {
    const query = `
        DELETE FROM refresh_tokens
        WHERE token = ?
    `;
    const [result] = await db.execute(query, [token]);
    return result;
};

/**
 * Deletes all active refresh tokens for a user.
 */
const deleteUserRefreshTokens = async (userId) => {
    const query = `
        DELETE FROM refresh_tokens
        WHERE user_id = ?
    `;
    const [result] = await db.execute(query, [userId]);
    return result;
};

/**
 * Clean up expired refresh tokens.
 */
const deleteExpiredRefreshTokens = async () => {
    const query = `
        DELETE FROM refresh_tokens
        WHERE expires_at <= NOW()
    `;
    const [result] = await db.execute(query);
    return result;
};

module.exports = {
    createRefreshTokensTable,
    addRefreshToken,
    findRefreshToken,
    deleteRefreshToken,
    deleteUserRefreshTokens,
    deleteExpiredRefreshTokens
};

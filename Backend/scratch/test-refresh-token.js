require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const jwt = require("jsonwebtoken");
const db = require("../config/db.js");
const {
    createRefreshTokensTable,
    addRefreshToken,
    findRefreshToken,
    deleteRefreshToken
} = require("../models/refreshTokenModel.js");

async function runTests() {
    console.log("=== Refresh Token System Testing ===");

    try {
        // 1. Verify Database Connection
        try {
            const conn = await db.getConnection();
            console.log("✅ Database connected successfully.");
            conn.release();
        } catch (err) {
            console.error("❌ Database connection failed:", err.message);
            return;
        }

        // 2. Ensure Refresh Tokens Table is Ready
        try {
            await createRefreshTokensTable();
            console.log("✅ Refresh tokens table initialized.");
        } catch (err) {
            console.error("❌ Failed to initialize refresh tokens table:", err.message);
            return;
        }

        // 3. Test Database Model Operations
        console.log("\nTesting Database Model functions...");
        const testUserId = 1; // Assuming user ID 1 exists
        const testToken = "test_refresh_token_value_abc123";
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

        try {
            // Clean up any stale test token first
            await deleteRefreshToken(testToken);

            // Add
            await addRefreshToken(testUserId, testToken, "test-device", expiresAt);
            console.log("   - addRefreshToken: Success");

            // Find
            const found = await findRefreshToken(testToken);
            if (found && found.token === testToken) {
                console.log("   - findRefreshToken: Success (token found and matches)");
            } else {
                throw new Error("Token was not found in database or did not match.");
            }

            // Delete
            await deleteRefreshToken(testToken);
            const deleted = await findRefreshToken(testToken);
            if (!deleted) {
                console.log("   - deleteRefreshToken: Success (token revoked/deleted)");
            } else {
                throw new Error("Token was not deleted from database.");
            }
        } catch (err) {
            console.error("❌ Database Model Test failed:", err.message);
            return;
        }

        // 4. Test HTTP Endpoints (if server is running)
        console.log("\nTesting HTTP API Endpoints...");
        const PORT = process.env.PORT || 5000;
        const baseURL = `http://localhost:${PORT}`;
        console.log(`Checking if backend server is running on ${baseURL}...`);

        let isServerRunning = false;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${baseURL}/api/auth/active-users`, { signal: controller.signal });
            clearTimeout(timeoutId);
            isServerRunning = true;
            console.log("✅ Server detected.");
        } catch (err) {
            console.log("ℹ️ Server not running or connection refused. Start the server (npm run dev) to test HTTP routes.");
            console.log("   Skipping HTTP endpoint tests. Database tests completed successfully.");
            return;
        }

        if (isServerRunning) {
            try {
                // A. Login
                console.log("\n1. Logging in...");
                const loginRes = await fetch(`${baseURL}/api/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: "admin",
                        password: "admin",
                        deviceId: "test-device-id"
                    })
                });

                const loginData = await loginRes.json();
                const setCookieHeader = loginRes.headers.get("set-cookie");

                if (!loginRes.ok || !loginData.success) {
                    console.error("❌ Login failed:", loginData.message || loginRes.statusText);
                    console.log("Please ensure the 'admin' user exists in the database (run node addUser.js).");
                    return;
                }

                console.log("✅ Login successful.");
                console.log("   Access Token (first 30 chars):", loginData.token.substring(0, 30) + "...");
                console.log("   Refresh Token from Body (first 30 chars):", loginData.refreshToken.substring(0, 30) + "...");
                console.log("   Set-Cookie Header:", setCookieHeader ? "Present" : "Missing ❌");

                const firstAccessToken = loginData.token;
                let refreshToken = loginData.refreshToken;

                // B. Access protected endpoint
                console.log("\n2. Accessing protected endpoint with Access Token...");
                const protectedRes = await fetch(`${baseURL}/api/auth/my-permissions`, {
                    headers: { "Authorization": `Bearer ${firstAccessToken}` }
                });
                const protectedData = await protectedRes.json();
                if (protectedRes.ok && protectedData.success) {
                    console.log("✅ Access approved.");
                } else {
                    console.error("❌ Access denied:", protectedData.message);
                    return;
                }

                // C. Refresh token (using JSON body fallback)
                console.log("\n3. Refreshing token via JSON body...");
                const refreshRes = await fetch(`${baseURL}/api/auth/refresh`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken })
                });

                const refreshData = await refreshRes.json();
                if (!refreshRes.ok || !refreshData.success) {
                    console.error("❌ Refresh failed:", refreshData.message);
                    return;
                }

                console.log("✅ Token refresh successful.");
                console.log("   New Access Token (first 30 chars):", refreshData.token.substring(0, 30) + "...");
                console.log("   New Refresh Token (first 30 chars):", refreshData.refreshToken.substring(0, 30) + "...");

                const secondAccessToken = refreshData.token;
                const newRefreshToken = refreshData.refreshToken;

                // D. Refresh token (using Cookie)
                if (setCookieHeader) {
                    console.log("\n4. Refreshing token via Cookies...");
                    const cookieVal = setCookieHeader.split(";")[0];
                    const cookieRefreshRes = await fetch(`${baseURL}/api/auth/refresh`, {
                        method: "POST",
                        headers: { "Cookie": cookieVal }
                    });

                    const cookieRefreshData = await cookieRefreshRes.json();
                    if (cookieRefreshRes.ok && cookieRefreshData.success) {
                        console.log("✅ Cookie token refresh successful.");
                        console.log("   New Access Token (first 30 chars):", cookieRefreshData.token.substring(0, 30) + "...");
                    } else {
                        console.error("❌ Cookie refresh failed:", cookieRefreshData.message);
                    }
                }

                // E. Logout (revokes refresh token)
                console.log("\n5. Logging out...");
                const logoutRes = await fetch(`${baseURL}/api/auth/logout`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken: newRefreshToken })
                });
                const logoutData = await logoutRes.json();
                if (logoutRes.ok && logoutData.success) {
                    console.log("✅ Logout successful (cookie cleared and DB token deleted).");
                } else {
                    console.error("❌ Logout failed:", logoutData.message);
                    return;
                }

                // F. Try refreshing again (should fail because revoked)
                console.log("\n6. Attempting to refresh with revoked token...");
                const failRes = await fetch(`${baseURL}/api/auth/refresh`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken: newRefreshToken })
                });
                const failData = await failRes.json();
                if (failRes.status === 401 && !failData.success) {
                    console.log("✅ Correctly rejected with 401:", failData.message);
                } else {
                    console.error("❌ Security flaw: Revoked token was accepted or returned incorrect status:", failRes.status, failData);
                    return;
                }

                console.log("\n🎉 All integration tests passed successfully!");

            } catch (err) {
                console.error("❌ Integration Test Error:", err.message);
            }
        }
    } finally {
        console.log("\nClosing database connection pool...");
        try {
            await db.end();
            console.log("✅ Database pool closed successfully.");
        } catch (e) {
            console.error("❌ Failed to close database pool:", e.message);
        }
    }
}

runTests();

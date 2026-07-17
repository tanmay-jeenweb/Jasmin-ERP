const db = require("../config/db.js");
const { 
    createAlertsTable, 
    createAlert, 
    getAllAlerts, 
    toggleAlertActive, 
    deleteAlert 
} = require("../models/alertModel.js");

async function runTests() {
    try {
        console.log("Starting backend Alert System tests...\n");

        console.log("Step 1: Running createAlertsTable()...");
        await createAlertsTable();
        console.log("✅ Table check/creation complete.");

        console.log("\nStep 2: Creating a test alert...");
        const insertRes = await createAlert("Test Alert Title", "This is a verification description.", "test_image.png");
        const alertId = insertRes.insertId;
        console.log(`✅ Alert created with ID: ${alertId}`);

        console.log("\nStep 3: Fetching all alerts...");
        const allAlerts = await getAllAlerts();
        console.log(`✅ Found ${allAlerts.length} alerts in database.`);
        console.log("Alert preview:", allAlerts.find(a => a.id === alertId));

        console.log("\nStep 4: Toggling alert to inactive...");
        await toggleAlertActive(alertId, false);
        const [rows] = await db.execute("SELECT active FROM alerts WHERE id = ?", [alertId]);
        console.log(`✅ Active status is now: ${rows[0].active} (expected: 0)`);

        console.log("\nStep 5: Deleting the test alert...");
        await deleteAlert(alertId);
        const [postDelete] = await db.execute("SELECT * FROM alerts WHERE id = ?", [alertId]);
        console.log(`✅ Alert delete verified. Rows found: ${postDelete.length} (expected: 0)`);

        console.log("\n🎉 All database operations succeeded perfectly!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Test failed with error:", error);
        process.exit(1);
    }
}

runTests();

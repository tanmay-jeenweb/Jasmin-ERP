/**
 * Jasmin ERP - Unified Cron Sync Runner Script
 * 
 * Usage from terminal or cPanel Cron Job:
 *   node scripts/cronSync.js --type=sales
 *   node scripts/cronSync.js --type=masters
 *   node scripts/cronSync.js --type=all
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../config/db.js');

// Import controllers
const { syncBranchesController } = require('../controllers/branchController.js');
const { syncModelGroupsController } = require('../controllers/modelGroupController.js');
const { syncItemModelsController } = require('../controllers/itemModelController.js');
const { syncTargetVsAchievementsController } = require('../controllers/targetVsAchievementController.js');

// Helper to wrap express controllers for CLI invocation
function runController(controllerFn, reqOverride = {}) {
    return new Promise((resolve) => {
        let statusCode = 200;
        let responseData = null;

        const req = {
            user: { id: 1, name: 'cPanel Cron Job', username: 'system_cron' },
            headers: { 'x-device-id': 'cPanel-Cron' },
            body: {},
            query: {},
            ...reqOverride
        };

        const res = {
            status(code) {
                statusCode = code;
                return this;
            },
            json(data) {
                responseData = data;
                resolve({ statusCode, data: responseData });
                return this;
            }
        };

        try {
            controllerFn(req, res).catch(err => {
                console.error('Unhandled Controller Error:', err);
                resolve({ statusCode: 500, data: { success: false, message: err.message } });
            });
        } catch (err) {
            console.error('Sync Execution Error:', err);
            resolve({ statusCode: 500, data: { success: false, message: err.message } });
        }
    });
}

async function main() {
    const args = process.argv.slice(2);
    let syncType = 'all';

    args.forEach(arg => {
        if (arg.startsWith('--type=')) {
            syncType = arg.split('=')[1].toLowerCase();
        }
    });

    console.log(`====================================================`);
    console.log(`[${new Date().toISOString()}] Starting Cron Sync Target: ${syncType.toUpperCase()}`);
    console.log(`====================================================`);

    try {
        if (syncType === 'masters' || syncType === 'all') {
            console.log('\n--- Syncing Branch Master ---');
            const branchRes = await runController(syncBranchesController);
            console.log(`Branch Sync Status [${branchRes.statusCode}]:`, branchRes.data?.message || branchRes.data);

            console.log('\n--- Syncing Model Groups ---');
            const mgRes = await runController(syncModelGroupsController);
            console.log(`Model Group Sync Status [${mgRes.statusCode}]:`, mgRes.data?.message || mgRes.data);

            console.log('\n--- Syncing Item Models ---');
            const imRes = await runController(syncItemModelsController);
            console.log(`Item Model Sync Status [${imRes.statusCode}]:`, imRes.data?.message || imRes.data);
        }

        if (syncType === 'sales' || syncType === 'all') {
            console.log('\n--- Syncing Sales Invoices & Returns (Target vs Achievement) ---');
            const salesRes = await runController(syncTargetVsAchievementsController);
            console.log(`Sales & Returns Sync Status [${salesRes.statusCode}]:`, salesRes.data?.message || salesRes.data);
        }

        console.log(`\n====================================================`);
        console.log(`[${new Date().toISOString()}] Cron Sync Completed Successfully.`);
        console.log(`====================================================`);
    } catch (err) {
        console.error('Fatal Error during Cron Sync Execution:', err);
    } finally {
        try {
            await db.end();
        } catch (e) {
            // Ignore if pool already ended
        }
        process.exit(0);
    }
}

main();

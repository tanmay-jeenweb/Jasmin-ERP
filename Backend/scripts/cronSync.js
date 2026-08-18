/**
 * Jasmin ERP - Unified Cron Sync Runner Script
 * 
 * Usage from terminal or cPanel Cron Job:
 *   node scripts/cronSync.js --type=sales
 *   node scripts/cronSync.js --type=masters
 *   node scripts/cronSync.js --type=all
 */

const path = require('path');
const fs = require('fs');
const dns = require('dns');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Override global fetch with native HTTP/HTTPS modules to bypass undici's WebAssembly LVE memory allocation limits
const http = require('http');
const https = require('https');
const { URL } = require('url');

// --- Lock file mechanism to prevent overlapping cron runs ---
const LOCK_FILE = path.join(__dirname, '.cronSync.lock');
const LOCK_MAX_AGE_MS = 4 * 60 * 1000; // 4 minutes — stale lock threshold

function acquireLock() {
    try {
        if (fs.existsSync(LOCK_FILE)) {
            const lockContent = fs.readFileSync(LOCK_FILE, 'utf8').trim();
            const lockTime = parseInt(lockContent, 10);
            const lockAge = Date.now() - lockTime;
            if (lockAge < LOCK_MAX_AGE_MS) {
                console.log(`[${new Date().toISOString()}] Another cron sync is already running (lock age: ${Math.round(lockAge / 1000)}s). Exiting.`);
                return false;
            }
        }
        fs.writeFileSync(LOCK_FILE, String(Date.now()));
        return true;
    } catch (err) {
        return true; // Proceed anyway if lock mechanism fails
    }
}

function releaseLock() {
    try { if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); } catch (e) {}
}

global.fetch = function (url, options = {}) {
    return new Promise(async (resolve, reject) => {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;
        const timeoutMs = options.timeout || 120000; // 120 seconds default timeout

        // Pre-resolve DNS with a 10s timeout to fail fast if DNS is broken
        let resolvedIp;
        try {
            resolvedIp = await new Promise((dnsResolve, dnsReject) => {
                const dnsTimer = setTimeout(() => {
                    dnsReject(new Error(`DNS resolution timeout for ${parsedUrl.hostname}`));
                }, 10000);
                dns.lookup(parsedUrl.hostname, (err, address) => {
                    clearTimeout(dnsTimer);
                    if (err) dnsReject(err);
                    else dnsResolve(address);
                });
            });
        } catch (dnsErr) {
            return reject(dnsErr);
        }

        const reqOptions = {
            hostname: resolvedIp,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: { ...options.headers, 'Host': parsedUrl.hostname },
            rejectUnauthorized: false,
            timeout: timeoutMs,
            agent: false,                    // Fresh socket per request — prevents zombie socket exhaustion
            servername: parsedUrl.hostname    // Required for TLS SNI when connecting via resolved IP
        };

        let isSettled = false;
        let req;

        function settle(type, value) {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(timer);
            if (type === 'resolve') resolve(value);
            else reject(value);
        }

        const timer = setTimeout(() => {
            if (req) req.destroy();
            settle('reject', new Error(`Fetch timeout: ${url} after ${timeoutMs}ms`));
        }, timeoutMs);

        req = client.request(reqOptions, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('error', (err) => settle('reject', new Error(`Response error: ${err.message}`)));
            res.on('aborted', () => settle('reject', new Error(`Response aborted: ${url}`)));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString();
                settle('resolve', {
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    headers: { get: (name) => res.headers[name.toLowerCase()] },
                    json: async () => JSON.parse(body),
                    text: async () => body
                });
            });
        });

        req.on('timeout', () => { req.destroy(); settle('reject', new Error(`Socket timeout: ${url}`)); });
        req.on('error', (err) => settle('reject', err));

        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        req.end();
    });
};

// --- Check lock before proceeding ---
if (!acquireLock()) {
    process.exit(0);
}

const db = require('../config/db.js');

// Safety timeout: force-kill process after 4 minutes if anything hangs
const SAFETY_TIMEOUT_MS = 240000;
const safetyTimeout = setTimeout(() => {
    console.error(`[${new Date().toISOString()}] Fatal: Cron sync exceeded ${SAFETY_TIMEOUT_MS / 1000}s safety timeout. Force terminating.`);
    releaseLock();
    try { db.end(); } catch (e) {}
    process.exit(1);
}, SAFETY_TIMEOUT_MS);
safetyTimeout.unref();

// Import controllers
const { syncBranchesController } = require('../controllers/branchController.js');
const { syncModelGroupsController } = require('../controllers/modelGroupController.js');
const { syncItemModelsController } = require('../controllers/itemModelController.js');
const { syncTargetVsAchievementsController } = require('../controllers/targetVsAchievementController.js');
const { syncBrandWiseSalesController } = require('../controllers/brandWiseSalesController.js');


// Helper to wrap express controllers for CLI invocation with per-controller timeout
function runController(controllerFn, reqOverride = {}, timeoutMs = 120000) {
    return new Promise((resolve) => {
        let statusCode = 200;
        let settled = false;

        const controllerTimer = setTimeout(() => {
            if (settled) return;
            settled = true;
            resolve({ statusCode: 504, data: { success: false, message: `Controller timed out after ${timeoutMs / 1000}s` } });
        }, timeoutMs);

        const req = {
            user: { id: 1, name: 'cPanel Cron Job', username: 'system_cron' },
            headers: { 'x-device-id': 'cPanel-Cron' },
            body: {},
            query: {},
            ...reqOverride
        };

        const res = {
            status(code) { statusCode = code; return this; },
            json(data) {
                if (settled) return this;
                settled = true;
                clearTimeout(controllerTimer);
                resolve({ statusCode, data });
                return this;
            }
        };

        try {
            controllerFn(req, res).catch(err => {
                if (settled) return;
                settled = true;
                clearTimeout(controllerTimer);
                console.error(`Controller Error (${controllerFn.name}):`, err.message);
                resolve({ statusCode: 500, data: { success: false, message: err.message } });
            });
        } catch (err) {
            if (settled) return;
            settled = true;
            clearTimeout(controllerTimer);
            console.error(`Sync Error (${controllerFn.name}):`, err.message);
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

            console.log('\n--- Syncing Brand Wise Sales ---');
            const brandSalesRes = await runController(syncBrandWiseSalesController);
            console.log(`Brand Wise Sales Sync Status [${brandSalesRes.statusCode}]:`, brandSalesRes.data?.message || brandSalesRes.data);
        }

        console.log(`\n====================================================`);
        console.log(`[${new Date().toISOString()}] Cron Sync Completed Successfully.`);
        console.log(`====================================================`);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Fatal Error:`, err.message);
    } finally {
        releaseLock();
        try { await db.end(); } catch (e) {}
        process.exit(0);
    }
}

main();

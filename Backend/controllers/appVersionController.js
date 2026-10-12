const { getSetting, setSetting } = require("../models/settingModel.js");

// =========================================================================
// APP CONFIGURATION
// - To update version: change HARDCODED_APP_VERSION here, or set in .env
// - Direct APK download link:
// =========================================================================
const HARDCODED_APP_VERSION = "01.05.10";
const APK_DOWNLOAD_URL = "https://interlink.jasminmobile.com/apk/app-release.apk";

/**
 * Resolves the active latest version string.
 * Priority:
 * 1. Database setting 'latest_app_version' (if set)
 * 2. Environment variable LATEST_APP_VERSION
 * 3. HARDCODED_APP_VERSION constant defined above
 */
const getLatestVersion = async () => {
    try {
        const dbVersion = await getSetting("latest_app_version");
        if (dbVersion && typeof dbVersion === "string" && dbVersion.trim()) {
            return dbVersion.trim();
        }
    } catch (e) {
        // Fallback to env or code
    }

    return (process.env.LATEST_APP_VERSION || HARDCODED_APP_VERSION).trim();
};

/**
 * Normalizes a version string for comparison (strips whitespace and optional leading 'v').
 */
const normalizeVersion = (v) => {
    if (v === undefined || v === null) return "";
    return String(v).trim().toLowerCase().replace(/^v/, "");
};

/**
 * Checks if two version numbers/strings are identical.
 */
const isSameVersion = (v1, v2) => {
    return normalizeVersion(v1) === normalizeVersion(v2);
};

/**
 * Check if update is required or get current version info.
 * Route: GET/POST /v1/api/app/check-update or /v1/api/app/version
 *
 * Payload (optional for POST / query for GET):
 * { "version": "1.0.0" }
 */
const checkAppVersion = async (req, res) => {
    try {
        const latestVersion = await getLatestVersion();
        const clientVersion = req.body?.version || req.query?.version || req.headers["x-app-version"];

        const responseData = {
            success: true,
            latestVersion,
            downloadUrl: APK_DOWNLOAD_URL
        };

        if (clientVersion !== undefined) {
            const same = isSameVersion(clientVersion, latestVersion);
            responseData.currentVersion = String(clientVersion);
            responseData.updateRequired = !same;
            responseData.message = same
                ? `App is already up to date (version ${latestVersion}).`
                : `New version available (${latestVersion}).`;
        }

        return res.status(200).json(responseData);
    } catch (error) {
        console.error("Error in checkAppVersion:", error);
        return res.status(500).json({
            success: false,
            message: "Error checking app version"
        });
    }
};

/**
 * Download the updated APK.
 * Route: GET/POST /v1/api/app/download (also aliased at /download/app and /download/apk)
 *
 * If version matches, returns JSON updateRequired: false.
 * If mismatch or no version passed, redirects straight to https://interlink.jasminmobile.com/apk/app-release.apk
 */
const downloadApk = async (req, res) => {
    try {
        const latestVersion = await getLatestVersion();
        const clientVersion = req.body?.version || req.query?.version || req.headers["x-app-version"];

        // If client specifically sent their version and it already matches, no need to download
        if (clientVersion !== undefined && isSameVersion(clientVersion, latestVersion)) {
            return res.status(200).json({
                success: true,
                updateRequired: false,
                message: `App is already on the latest version (${latestVersion}). No download needed.`,
                latestVersion,
                downloadUrl: APK_DOWNLOAD_URL
            });
        }

        // If mismatch or clicked directly, redirect straight to the APK URL
        return res.redirect(APK_DOWNLOAD_URL);
    } catch (error) {
        console.error("Error in downloadApk:", error);
        return res.redirect(APK_DOWNLOAD_URL);
    }
};

/**
 * Optional route for admin to update the latest version in the database.
 * Route: POST /v1/api/app/version
 */
const setAppVersion = async (req, res) => {
    try {
        const { version } = req.body;
        if (!version || !String(version).trim()) {
            return res.status(400).json({
                success: false,
                message: "A valid version string is required (e.g. '1.0.1')"
            });
        }

        const cleanVersion = String(version).trim();
        await setSetting("latest_app_version", cleanVersion);

        return res.status(200).json({
            success: true,
            message: `Latest app version updated to ${cleanVersion}`,
            latestVersion: cleanVersion,
            downloadUrl: APK_DOWNLOAD_URL
        });
    } catch (error) {
        console.error("Error setting app version:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update latest app version"
        });
    }
};

module.exports = {
    HARDCODED_APP_VERSION,
    APK_DOWNLOAD_URL,
    getLatestVersion,
    checkAppVersion,
    downloadApk,
    setAppVersion
};

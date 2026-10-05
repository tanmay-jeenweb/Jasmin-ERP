const path = require("path");
const fs = require("fs");
const uploadConfig = require("../config/uploadConfig.js");
const { getSetting, setSetting } = require("../models/settingModel.js");

// =========================================================================
// APP VERSION CONFIGURATION
// You can change the latest version here in code, OR via .env LATEST_APP_VERSION,
// OR dynamically via the database setting 'latest_app_version'.
// =========================================================================
const HARDCODED_APP_VERSION = "1.0.0";

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
        console.warn("Could not read 'latest_app_version' from settings table, falling back to code/env:", e.message);
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
 * Finds the app-release.apk file in server storage.
 * Strictly looks for 'app-release.apk'.
 */
const findApkFile = () => {
    const candidatePaths = [
        path.join(uploadConfig.apkUploadDir, "app-release.apk"),
        path.join(uploadConfig.uploadDir, "apk", "app-release.apk"),
        path.join(uploadConfig.uploadDir, "app-release.apk"),
        path.resolve(__dirname, "..", "uploads", "apk", "app-release.apk"),
        path.resolve(__dirname, "..", "uploads", "app-release.apk")
    ];

    for (const filePath of candidatePaths) {
        try {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    return { exists: true, filePath, stats };
                }
            }
        } catch (e) {
            // continue checking next path
        }
    }

    return { exists: false, checkedPath: candidatePaths[0] };
};

/**
 * Check if update is required or get current version info.
 * Route: GET /v1/api/app/version or GET /v1/api/app/check-update
 */
const checkAppVersion = async (req, res) => {
    try {
        const latestVersion = await getLatestVersion();
        const clientVersion = req.query.version || req.headers["x-app-version"];
        const apkInfo = findApkFile();

        const responseData = {
            success: true,
            latestVersion,
            apkAvailable: apkInfo.exists,
            downloadUrl: "/v1/api/app/download"
        };

        if (apkInfo.exists) {
            responseData.fileSize = apkInfo.stats.size;
            responseData.lastModified = apkInfo.stats.mtime;
        }

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
 * Route: GET /v1/api/app/download (also aliased at /download/app and /download/apk)
 *
 * If ?version=X is passed and matches latestVersion, returns JSON updateRequired: false.
 * Otherwise, straight away downloads app-release.apk.
 */
const downloadApk = async (req, res) => {
    try {
        const latestVersion = await getLatestVersion();
        const clientVersion = req.query.version || req.headers["x-app-version"];

        // If client specifically sent their version and it already matches, no need to download
        if (clientVersion !== undefined && isSameVersion(clientVersion, latestVersion)) {
            return res.status(200).json({
                success: true,
                updateRequired: false,
                message: `App is already on the latest version (${latestVersion}). No download needed.`,
                latestVersion
            });
        }

        // Look strictly for app-release.apk
        const apkInfo = findApkFile();

        if (!apkInfo.exists) {
            return res.status(404).json({
                success: false,
                message: "app-release.apk not found on server. Please place app-release.apk in the uploads/apk/ directory.",
                expectedFile: "app-release.apk",
                targetPath: apkInfo.checkedPath
            });
        }

        const filename = "app-release.apk";

        // Set proper download headers for mobile devices / Android package installer
        res.setHeader("Content-Type", "application/vnd.android.package-archive");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Length", apkInfo.stats.size);

        return res.download(apkInfo.filePath, filename, (err) => {
            if (err) {
                console.error("Error streaming app-release.apk download:", err);
                if (!res.headersSent) {
                    return res.status(500).json({
                        success: false,
                        message: "Failed to download app-release.apk"
                    });
                }
            }
        });
    } catch (error) {
        console.error("Error in downloadApk:", error);
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: "Server error while processing APK download"
            });
        }
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
            latestVersion: cleanVersion
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
    getLatestVersion,
    checkAppVersion,
    downloadApk,
    setAppVersion,
    findApkFile
};

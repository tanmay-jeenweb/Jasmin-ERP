const path = require("path");
const fs = require("fs");

const port = process.env.PORT || 5005;
const rawUploadDir = process.env.UPLOAD_DIR || "uploads";
const isWindows = process.platform === "win32";

// Resolve upload directory path.
// On Windows (local development), Linux absolute paths like /home/... MUST always resolve to local Backend/uploads
let uploadDir;
if (isWindows && (rawUploadDir.startsWith("/home/") || rawUploadDir.includes("adminjasminmobil"))) {
    uploadDir = path.resolve(__dirname, "..", "uploads");
} else {
    uploadDir = path.isAbsolute(rawUploadDir)
        ? rawUploadDir
        : path.resolve(__dirname, "..", rawUploadDir);
}

// Ensure the directory exists
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`Created uploads directory at: ${uploadDir}`);
    } catch (err) {
        console.error(`Failed to create uploads directory at ${uploadDir}:`, err);
        uploadDir = path.resolve(__dirname, "..", "uploads");
        if (!fs.existsSync(uploadDir)) {
            try {
                fs.mkdirSync(uploadDir, { recursive: true });
            } catch (mkdirErr) {
                console.error("Failed to create fallback uploads directory:", mkdirErr);
            }
        }
    }
}

// Ensure apk subdirectory exists for APK distributions
const apkUploadDir = path.join(uploadDir, "apk");
if (!fs.existsSync(apkUploadDir)) {
    try {
        fs.mkdirSync(apkUploadDir, { recursive: true });
        console.log(`Created APK uploads directory at: ${apkUploadDir}`);
    } catch (err) {
        console.error(`Failed to create APK uploads directory at ${apkUploadDir}:`, err);
    }
}

// Determine uploadBaseUrl:
// If running on Windows and UPLOAD_BASE_URL points to the remote production domain (interlink.jasminmobile.com),
// use local http://localhost:${port}/uploads so locally uploaded files can be loaded by the browser.
const defaultUploadBaseUrl = `http://localhost:${port}/uploads`;
let uploadBaseUrl = process.env.UPLOAD_BASE_URL || defaultUploadBaseUrl;

if (isWindows && uploadBaseUrl.includes("interlink.jasminmobile.com")) {
    uploadBaseUrl = defaultUploadBaseUrl;
}

const serveMethod = isWindows ? "express" : (process.env.UPLOAD_SERVE_METHOD || "express");

module.exports = {
    uploadDir,
    apkUploadDir,
    uploadBaseUrl,
    serveMethod,
    
    // Helper to generate public URL for a file
    getFileUrl: (filename) => {
        if (!filename) return "";
        if (filename.startsWith("http://") || filename.startsWith("https://")) {
            // If running on Windows/localhost and someone has an interlink URL, rewrite to local backend
            if (isWindows && filename.includes("interlink.jasminmobile.com/uploads/")) {
                const cleanName = filename.split("/uploads/").pop();
                const activePort = process.env.PORT || 5005;
                return `http://localhost:${activePort}/uploads/${cleanName}`;
            }
            return filename;
        }
        const activePort = process.env.PORT || 5005;
        let baseUrl = process.env.UPLOAD_BASE_URL || `http://localhost:${activePort}/uploads`;
        if (isWindows && baseUrl.includes("interlink.jasminmobile.com")) {
            baseUrl = `http://localhost:${activePort}/uploads`;
        }
        const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
        const cleanFilename = filename.startsWith("/") ? filename.slice(1) : filename;
        return `${cleanBaseUrl}/${cleanFilename}`;
    }
};

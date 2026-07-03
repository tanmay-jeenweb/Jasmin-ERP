const path = require("path");
const fs = require("fs");

const rawUploadDir = process.env.UPLOAD_DIR || "uploads";

// Resolve upload directory path. If relative, resolve from Backend root directory.
const uploadDir = path.isAbsolute(rawUploadDir)
    ? rawUploadDir
    : path.resolve(__dirname, "..", rawUploadDir);

// Ensure the directory exists
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`Created uploads directory at: ${uploadDir}`);
    } catch (err) {
        console.error(`Failed to create uploads directory at ${uploadDir}:`, err);
    }
}

module.exports = {
    uploadDir,
    uploadBaseUrl: process.env.UPLOAD_BASE_URL || "http://localhost:5000/uploads",
    serveMethod: process.env.UPLOAD_SERVE_METHOD || "express",
    
    // Helper to generate public URL for a file
    getFileUrl: (filename) => {
        const baseUrl = process.env.UPLOAD_BASE_URL || "http://localhost:5000/uploads";
        // Ensure base URL doesn't end with a slash, and filename doesn't start with one
        const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
        const cleanFilename = filename.startsWith("/") ? filename.slice(1) : filename;
        return `${cleanBaseUrl}/${cleanFilename}`;
    }
};

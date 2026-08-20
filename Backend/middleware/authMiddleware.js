const jwt = require("jsonwebtoken");
const db = require("../config/db.js");

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "No token provided. Unauthorized."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;

        if (!req.user.username || !req.user.name) {
            const [rows] = await db.execute(
                "SELECT name, username, role FROM users WHERE id = ?",
                [req.user.id]
            );

            if (rows.length) {
                req.user = {
                    ...req.user,
                    name: rows[0].name,
                    username: rows[0].username,
                    role: rows[0].role || req.user.role
                };
            }
        }

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token."
        });
    }
};

const verifyAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "super admin")) {
        return res.status(403).json({
            success: false,
            message: "Access denied. Admin only."
        });
    }
    next();
};

const verifyPermission = (masterName, action) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized. No user information."
                });
            }

            // Admins bypass all permission checks
            if (req.user.role === "admin" || req.user.role === "super admin") {
                return next();
            }

            const userId = req.user.id;

            // Get user's user_type_id
            const [userRows] = await db.execute(
                "SELECT user_type_id FROM users WHERE id = ?",
                [userId]
            );

            if (userRows.length === 0 || userRows[0].user_type_id === null) {
                return res.status(403).json({
                    success: false,
                    message: `Access Denied. You do not have permission for ${masterName} (${action}).`
                });
            }

            const userTypeId = userRows[0].user_type_id;

            // Query permission table
            let column = "";
            if (action === "read") column = "can_read";
            else if (action === "write") column = "can_write";
            else if (action === "update") column = "can_update";
            else if (action === "delete") column = "can_delete";
            else {
                return res.status(500).json({
                    success: false,
                    message: "Invalid permission action."
                });
            }

            const masterNames = Array.isArray(masterName) ? masterName : [masterName];
            const placeholders = masterNames.map(() => "?").join(", ");
            const query = `
                SELECT ${column} AS permitted 
                FROM user_type_permissions 
                WHERE user_type_id = ? AND master_name IN (${placeholders})
            `;
            const [permRows] = await db.execute(query, [userTypeId, ...masterNames]);

            if (permRows.some(row => row.permitted === 1)) {
                return next();
            }

            return res.status(403).json({
                success: false,
                message: `Access Denied. Insufficient permissions for ${masterNames.join(" or ")} (${action}).`
            });

        } catch (error) {
            console.error("Error in verifyPermission middleware:", error);
            return res.status(500).json({
                success: false,
                message: "Internal Server Error during permission verification."
            });
        }
    };
};
const verifyFindStoreApproved = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Franchise ID is required."
            });
        }

        const [rows] = await db.execute(
            "SELECT status FROM in_process_franchise_find_stores WHERE in_process_franchise_id = ?",
            [id]
        );

        if (rows.length === 0 || rows[0].status !== "approved") {
            return res.status(403).json({
                success: false,
                message: "Access Denied. Find Store details must be approved first."
            });
        }

        next();
    } catch (error) {
        console.error("Error in verifyFindStoreApproved middleware:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error during permission check."
        });
    }
};

module.exports = { verifyToken, verifyAdmin, verifyPermission, verifyFindStoreApproved };

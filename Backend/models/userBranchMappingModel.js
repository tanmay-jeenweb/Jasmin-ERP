const db = require('../config/db.js');

const createUserBranchMappingsTable = async () => {
    // 1. Run migrations first if old table/columns exist
    try {
        await db.execute("ALTER TABLE abm_branch_mappings RENAME TO user_branch_mappings");
        console.log("Renamed abm_branch_mappings to user_branch_mappings");
    } catch (e) { /* already renamed or table doesn't exist */ }

    try {
        await db.execute("ALTER TABLE user_branch_mappings RENAME COLUMN abm_user_id TO user_id");
        console.log("Renamed abm_user_id column to user_id");
    } catch (e) { /* already renamed */ }

    try {
        await db.execute("ALTER TABLE user_branch_mappings DROP INDEX uq_branch_id");
        console.log("Dropped uq_branch_id unique index");
    } catch (e) { /* already dropped or not exist */ }

    try {
        await db.execute("ALTER TABLE user_branch_mappings ADD UNIQUE KEY uq_user_branch (user_id, branch_id)");
        console.log("Added composite uq_user_branch unique key");
    } catch (e) { /* already exists */ }

    // 2. Define/Create table if not exists
    const query = `
        CREATE TABLE IF NOT EXISTS user_branch_mappings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            branch_id INT NOT NULL,
            added_by INT NOT NULL,
            device_id VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_user_branch (user_id, branch_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (branch_id) REFERENCES branch_master(id) ON DELETE CASCADE,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);
    console.log("User branch mappings table ready");
};

const getEligibleUsers = async () => {
    const query = `
        SELECT u.id, u.name, u.username, u.email, 
               ut.type_name AS user_type_name, 
               ut.user_role AS user_role
        FROM users u
        INNER JOIN user_types ut ON u.user_type_id = ut.id
        WHERE u.active = TRUE
        ORDER BY u.name ASC
    `;
    const [rows] = await db.execute(query);
    return rows;
};

const getEligibleAbms = async () => {
    const query = `
        SELECT u.id, u.name, u.username, u.email, ut.type_name AS user_type_name
        FROM users u
        INNER JOIN user_types ut ON u.user_type_id = ut.id
        WHERE u.active = TRUE AND (ut.user_role = 'ABM' OR ut.type_name = 'ABM')
        ORDER BY u.name ASC
    `;
    const [rows] = await db.execute(query);
    return rows;
};

const getActiveBranches = async () => {
    const query = `
        SELECT bm.id, bm.name, bm.code, bm.city, bm.state_id, COALESCE(sm.name, '—') AS state_name
        FROM branch_master bm
        LEFT JOIN state_master sm ON bm.state_id = sm.id
        WHERE bm.status = 'active' 
        ORDER BY bm.name ASC
    `;
    const [rows] = await db.execute(query);
    return rows;
};

const getAllUserMappings = async () => {
    const query = `
        SELECT 
            u.id AS user_id,
            u.name AS user_name,
            u.username AS user_username,
            u.email AS user_email,
            ut.type_name AS user_type_name,
            ut.user_role AS user_role,
            COALESCE(added_u.name, 'Unknown') AS added_by_name,
            MAX(ubm.timestamp) AS timestamp,
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'branch_id', bm.id,
                    'branch_name', bm.name,
                    'branch_code', bm.code
                )
            ) AS mapped_branches
        FROM user_branch_mappings ubm
        JOIN users u ON ubm.user_id = u.id
        LEFT JOIN user_types ut ON u.user_type_id = ut.id
        JOIN branch_master bm ON ubm.branch_id = bm.id
        LEFT JOIN users added_u ON ubm.added_by = added_u.id
        GROUP BY u.id, u.name, u.username, u.email, ut.type_name, ut.user_role, added_u.name
        ORDER BY timestamp DESC
    `;
    const [rows] = await db.execute(query);
    return rows;
};

const getUserMappingById = async (userId) => {
    const query = `
        SELECT branch_id 
        FROM user_branch_mappings 
        WHERE user_id = ?
    `;
    const [rows] = await db.execute(query, [userId]);
    return rows.map(r => r.branch_id);
};

const saveUserBranchMapping = async (userId, branchIds, addedBy, deviceId, oldUserId = null) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Delete existing mappings for the old user if changed
        if (oldUserId && Number(oldUserId) !== Number(userId)) {
            await connection.execute(
                'DELETE FROM user_branch_mappings WHERE user_id = ?',
                [oldUserId]
            );
        }

        // 2. Delete existing mappings for the target user (to overwrite/clean up)
        await connection.execute(
            'DELETE FROM user_branch_mappings WHERE user_id = ?',
            [userId]
        );

        // 3. Insert new mappings if any are provided
        if (branchIds && branchIds.length > 0) {
            const insertQuery = `
                INSERT INTO user_branch_mappings (user_id, branch_id, added_by, device_id)
                VALUES (?, ?, ?, ?)
            `;
            for (const branchId of branchIds) {
                await connection.execute(insertQuery, [userId, branchId, addedBy, deviceId]);
            }
        }

        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const deleteUserMapping = async (userId) => {
    const query = `DELETE FROM user_branch_mappings WHERE user_id = ?`;
    const [result] = await db.execute(query, [userId]);
    return result;
};

const checkConflictingBranchMappings = async (userId, branchIds, oldUserId = null) => {
    if (!branchIds || branchIds.length === 0) return [];
    
    // Check if the current user is an ABM
    const userQuery = `
        SELECT u.id, ut.user_role, ut.type_name
        FROM users u
        INNER JOIN user_types ut ON u.user_type_id = ut.id
        WHERE u.id = ?
    `;
    const [userRows] = await db.execute(userQuery, [userId]);
    if (userRows.length === 0) return [];
    
    const isAbm = userRows[0].user_role === 'ABM' || userRows[0].type_name === 'ABM';
    if (!isAbm) {
        // Non-ABM users can be mapped without unique constraints per branch
        return [];
    }

    const ignoreUserIds = [Number(userId)];
    if (oldUserId) {
        ignoreUserIds.push(Number(oldUserId));
    }
    
    const query = `
        SELECT bm.name AS branch_name, u.name AS abm_name
        FROM user_branch_mappings ubm
        JOIN branch_master bm ON ubm.branch_id = bm.id
        JOIN users u ON ubm.user_id = u.id
        JOIN user_types ut ON u.user_type_id = ut.id
        WHERE ubm.branch_id IN (${branchIds.map(() => '?').join(',')}) 
          AND ubm.user_id NOT IN (${ignoreUserIds.map(() => '?').join(',')})
          AND (ut.user_role = 'ABM' OR ut.type_name = 'ABM')
    `;
    const [rows] = await db.execute(query, [...branchIds, ...ignoreUserIds]);
    return rows;
};

module.exports = {
    createUserBranchMappingsTable,
    getEligibleUsers,
    getEligibleAbms,
    getActiveBranches,
    getAllUserMappings,
    getUserMappingById,
    saveUserBranchMapping,
    deleteUserMapping,
    checkConflictingBranchMappings
};

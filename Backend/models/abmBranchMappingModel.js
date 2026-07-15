const db = require('../config/db.js');

const createAbmBranchMappingsTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS abm_branch_mappings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            abm_user_id INT NOT NULL,
            branch_id INT NOT NULL,
            added_by INT NOT NULL,
            device_id VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_branch_id (branch_id),
            FOREIGN KEY (abm_user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (branch_id) REFERENCES branch_master(id) ON DELETE CASCADE,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);
    console.log("ABM Branch mappings table ready");
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

const getAllAbmMappings = async () => {
    // We fetch mappings grouped by ABM user
    const query = `
        SELECT 
            u.id AS abm_user_id,
            u.name AS abm_name,
            u.username AS abm_username,
            u.email AS abm_email,
            COALESCE(added_u.name, 'Unknown') AS added_by_name,
            MAX(abm_map.timestamp) AS timestamp,
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'branch_id', bm.id,
                    'branch_name', bm.name,
                    'branch_code', bm.code
                )
            ) AS mapped_branches
        FROM abm_branch_mappings abm_map
        JOIN users u ON abm_map.abm_user_id = u.id
        JOIN branch_master bm ON abm_map.branch_id = bm.id
        LEFT JOIN users added_u ON abm_map.added_by = added_u.id
        GROUP BY u.id, u.name, u.username, u.email, added_u.name
        ORDER BY timestamp DESC
    `;
    const [rows] = await db.execute(query);
    return rows;
};

const getAbmMappingById = async (abmUserId) => {
    const query = `
        SELECT branch_id 
        FROM abm_branch_mappings 
        WHERE abm_user_id = ?
    `;
    const [rows] = await db.execute(query, [abmUserId]);
    return rows.map(r => r.branch_id);
};

const saveAbmBranchMapping = async (abmUserId, branchIds, addedBy, deviceId, oldAbmUserId = null) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Delete existing mappings for the old ABM user if changed
        if (oldAbmUserId && Number(oldAbmUserId) !== Number(abmUserId)) {
            await connection.execute(
                'DELETE FROM abm_branch_mappings WHERE abm_user_id = ?',
                [oldAbmUserId]
            );
        }

        // 2. Delete existing mappings for the target ABM user (to overwrite/clean up)
        await connection.execute(
            'DELETE FROM abm_branch_mappings WHERE abm_user_id = ?',
            [abmUserId]
        );

        // 3. Insert new mappings if any are provided
        if (branchIds && branchIds.length > 0) {
            const insertQuery = `
                INSERT INTO abm_branch_mappings (abm_user_id, branch_id, added_by, device_id)
                VALUES (?, ?, ?, ?)
            `;
            for (const branchId of branchIds) {
                await connection.execute(insertQuery, [abmUserId, branchId, addedBy, deviceId]);
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

const deleteAbmMapping = async (abmUserId) => {
    const query = `DELETE FROM abm_branch_mappings WHERE abm_user_id = ?`;
    const [result] = await db.execute(query, [abmUserId]);
    return result;
};

const checkConflictingBranchMappings = async (abmUserId, branchIds, oldAbmUserId = null) => {
    if (!branchIds || branchIds.length === 0) return [];
    
    const ignoreUserIds = [Number(abmUserId)];
    if (oldAbmUserId) {
        ignoreUserIds.push(Number(oldAbmUserId));
    }
    
    const query = `
        SELECT bm.name AS branch_name, u.name AS abm_name
        FROM abm_branch_mappings abm_m
        JOIN branch_master bm ON abm_m.branch_id = bm.id
        JOIN users u ON abm_m.abm_user_id = u.id
        WHERE abm_m.branch_id IN (${branchIds.map(() => '?').join(',')}) 
          AND abm_m.abm_user_id NOT IN (${ignoreUserIds.map(() => '?').join(',')})
    `;
    const [rows] = await db.execute(query, [...branchIds, ...ignoreUserIds]);
    return rows;
};

module.exports = {
    createAbmBranchMappingsTable,
    getEligibleAbms,
    getActiveBranches,
    getAllAbmMappings,
    getAbmMappingById,
    saveAbmBranchMapping,
    deleteAbmMapping,
    checkConflictingBranchMappings
};

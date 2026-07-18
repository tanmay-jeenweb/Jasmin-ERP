const db = require('../config/db.js');

const createVariationTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS variation_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            state_id INT NOT NULL,
            brands JSON NOT NULL,
            columns JSON NOT NULL,
            added_by INT NOT NULL,
            device_id VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (state_id) REFERENCES state_master(id) ON DELETE CASCADE,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);
    console.log("Variation master table ready");
};

const createVariation = async (stateId, brands, columns, addedBy, deviceId) => {
    const query = `
        INSERT INTO variation_master (state_id, brands, columns, added_by, device_id)
        VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [
        stateId,
        JSON.stringify(brands),
        JSON.stringify(columns),
        addedBy,
        deviceId
    ]);
    return result;
};

const getAllVariations = async () => {
    const query = `
        SELECT
            vm.id,
            vm.state_id,
            sm.name AS state_name,
            vm.brands,
            vm.columns,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            vm.device_id,
            vm.timestamp
        FROM variation_master vm
        LEFT JOIN state_master sm ON vm.state_id = sm.id
        LEFT JOIN users u ON vm.added_by = u.id
        ORDER BY vm.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return results;
};

const getVariationById = async (id) => {
    const query = `
        SELECT
            vm.id,
            vm.state_id,
            sm.name AS state_name,
            vm.brands,
            vm.columns,
            vm.added_by,
            vm.device_id,
            vm.timestamp
        FROM variation_master vm
        LEFT JOIN state_master sm ON vm.state_id = sm.id
        WHERE vm.id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

const updateVariation = async (id, stateId, brands, columns) => {
    const query = `
        UPDATE variation_master
        SET state_id = ?, brands = ?, columns = ?
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [
        stateId,
        JSON.stringify(brands),
        JSON.stringify(columns),
        id
    ]);
    return result;
};

const deleteVariation = async (id) => {
    const query = `DELETE FROM variation_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

module.exports = {
    createVariationTable,
    createVariation,
    getAllVariations,
    getVariationById,
    updateVariation,
    deleteVariation
};

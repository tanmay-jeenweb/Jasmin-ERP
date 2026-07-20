const db = require('../config/db.js');

const createVariationTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS variation_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            state_id INT NOT NULL,
            format_name VARCHAR(255) NOT NULL,
            columns JSON NOT NULL,
            brand_configs JSON NULL,
            added_by INT NOT NULL,
            device_id VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (state_id) REFERENCES state_master(id) ON DELETE CASCADE,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);

    // Migration logic
    try {
        const [columnsInfo] = await db.execute(`SHOW COLUMNS FROM variation_master LIKE 'brands'`);
        if (columnsInfo && columnsInfo.length > 0) {
            console.log("Migrating variation_master schema: converting brands to format_name and brand_configs...");

            // 1. Add format_name column if not present
            try {
                await db.execute(`ALTER TABLE variation_master ADD COLUMN format_name VARCHAR(255) NOT NULL DEFAULT 'Default Format'`);
            } catch (e) {
                // Column might already exist
            }

            // 2. Add brand_configs column if not present
            try {
                await db.execute(`ALTER TABLE variation_master ADD COLUMN brand_configs JSON NULL`);
            } catch (e) {
                // Column might already exist
            }

            // 3. Drop the old brands column
            try {
                await db.execute(`ALTER TABLE variation_master DROP COLUMN brands`);
            } catch (e) {
                // Column might already be dropped
            }
            console.log("Migration of variation_master table finished successfully.");
        }
    } catch (err) {
        console.error("Migration error on variation_master:", err);
    }

    console.log("Variation master table ready");
};

// Helpers for dynamic table schema updates
const checkTableExists = async (tableName) => {
    const query = `
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_name = ?
    `;
    const [rows] = await db.execute(query, [tableName]);
    return rows[0].count > 0;
};

const createFormatTable = async (variationId, columns) => {
    const tableName = `price_list_format_${variationId}`;
    const sanitize = (name) => name.replace(/`/g, '');

    const columnDefs = columns.map(col => {
        const safeName = sanitize(col.column_name);
        return `\`${safeName}\` VARCHAR(255) NULL`;
    }).join(', ');

    const query = `
        CREATE TABLE IF NOT EXISTS \`${tableName}\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_code VARCHAR(100) NOT NULL UNIQUE,
            brand VARCHAR(150) NOT NULL,
            icat_name VARCHAR(150) NOT NULL,
            model_group_name VARCHAR(255) NOT NULL,
            model_name VARCHAR(255) NOT NULL,
            ${columnDefs ? columnDefs + ',' : ''}
            added_by INT NULL,
            device_id VARCHAR(100) NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `;
    await db.execute(query);
    console.log(`Created dynamic price list format table: ${tableName}`);
};

const syncFormatTableSchema = async (variationId, oldColumns, newColumns) => {
    const tableName = `price_list_format_${variationId}`;
    const sanitize = (name) => name.replace(/`/g, '');

    const oldColsMap = new Map(oldColumns.map(c => [c.column_id, c.column_name]));
    const newColsMap = new Map(newColumns.map(c => [c.column_id, c.column_name]));

    // 1. Columns to Add or Rename
    for (const [colId, newName] of newColsMap.entries()) {
        const safeNewName = sanitize(newName);
        if (oldColsMap.has(colId)) {
            // Column exists in both, check if renamed
            const oldName = oldColsMap.get(colId);
            if (oldName !== newName) {
                const safeOldName = sanitize(oldName);
                const query = `ALTER TABLE \`${tableName}\` RENAME COLUMN \`${safeOldName}\` TO \`${safeNewName}\``;
                await db.execute(query);
                console.log(`Renamed column in ${tableName}: ${oldName} -> ${newName}`);
            }
        } else {
            // Column is new
            const query = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${safeNewName}\` VARCHAR(255) NULL`;
            await db.execute(query);
            console.log(`Added column to ${tableName}: ${newName}`);
        }
    }

    // 2. Columns to Drop
    for (const [colId, oldName] of oldColsMap.entries()) {
        if (!newColsMap.has(colId)) {
            const safeOldName = sanitize(oldName);
            const query = `ALTER TABLE \`${tableName}\` DROP COLUMN \`${safeOldName}\``;
            await db.execute(query);
            console.log(`Dropped column from ${tableName}: ${oldName}`);
        }
    }
};

const dropFormatTable = async (variationId) => {
    const tableName = `price_list_format_${variationId}`;
    await db.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
    console.log(`Dropped dynamic table: ${tableName}`);
};

const createVariation = async (stateId, formatName, columns, brandConfigs, addedBy, deviceId) => {
    const query = `
        INSERT INTO variation_master (state_id, format_name, columns, brand_configs, added_by, device_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [
        stateId,
        formatName,
        JSON.stringify(columns),
        brandConfigs ? JSON.stringify(brandConfigs) : null,
        addedBy,
        deviceId
    ]);

    const insertedId = result.insertId;
    await createFormatTable(insertedId, columns);

    return result;
};

const getAllVariations = async () => {
    const query = `
        SELECT
            vm.id,
            vm.state_id,
            sm.name AS state_name,
            vm.format_name,
            vm.brand_configs,
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
            vm.format_name,
            vm.brand_configs,
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

const updateVariation = async (id, stateId, formatName, columns, brandConfigs) => {
    // Get old columns to perform schema sync
    const [rows] = await db.execute("SELECT columns FROM variation_master WHERE id = ?", [id]);
    const oldColumns = rows[0] && rows[0].columns
        ? (typeof rows[0].columns === "string" ? JSON.parse(rows[0].columns) : rows[0].columns)
        : [];

    const query = `
        UPDATE variation_master
        SET state_id = ?, format_name = ?, columns = ?, brand_configs = ?
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [
        stateId,
        formatName,
        JSON.stringify(columns),
        brandConfigs ? JSON.stringify(brandConfigs) : null,
        id
    ]);

    // Sync table schema
    const tableName = `price_list_format_${id}`;
    const exists = await checkTableExists(tableName);
    if (exists) {
        await syncFormatTableSchema(id, oldColumns, columns);
    } else {
        await createFormatTable(id, columns);
    }

    return result;
};

const deleteVariation = async (id) => {
    await dropFormatTable(id);
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

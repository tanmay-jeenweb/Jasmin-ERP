const db = require('../config/db.js');

const createPricingFormulaTable = async () => {
    // Automatic Migration: Rename variation_master to pricing_formula_master if old table exists
    try {
        const [oldTables] = await db.execute(`SHOW TABLES LIKE 'variation_master'`);
        const [newTables] = await db.execute(`SHOW TABLES LIKE 'pricing_formula_master'`);
        if (oldTables.length > 0 && newTables.length === 0) {
            console.log("Migrating database: RENAME TABLE variation_master TO pricing_formula_master...");
            await db.execute(`RENAME TABLE variation_master TO pricing_formula_master`);
            console.log("Table variation_master successfully renamed to pricing_formula_master.");
        }
    } catch (migErr) {
        console.error("Error during table rename migration from variation_master to pricing_formula_master:", migErr);
    }

    const query = `
        CREATE TABLE IF NOT EXISTS pricing_formula_master (
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

    // Migration logic for old columns if any exist
    try {
        const [columnsInfo] = await db.execute(`SHOW COLUMNS FROM pricing_formula_master LIKE 'brands'`);
        if (columnsInfo && columnsInfo.length > 0) {
            console.log("Migrating pricing_formula_master schema: converting brands to format_name and brand_configs...");
            
            try {
                await db.execute(`ALTER TABLE pricing_formula_master ADD COLUMN format_name VARCHAR(255) NOT NULL DEFAULT 'Default Format'`);
            } catch (e) {
                // Column might already exist
            }

            try {
                await db.execute(`ALTER TABLE pricing_formula_master ADD COLUMN brand_configs JSON NULL`);
            } catch (e) {
                // Column might already exist
            }

            try {
                await db.execute(`ALTER TABLE pricing_formula_master DROP COLUMN brands`);
            } catch (e) {
                // Column might already be dropped
            }
            console.log("Migration of pricing_formula_master table finished successfully.");
        }
    } catch (err) {
        console.error("Migration error on pricing_formula_master:", err);
    }

    console.log("Pricing formula master table ready");
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

const createFormatTable = async (formulaId, columns) => {
    const tableName = `price_list_format_${formulaId}`;
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

const syncFormatTableSchema = async (formulaId, oldColumns, newColumns) => {
    const tableName = `price_list_format_${formulaId}`;
    const sanitize = (name) => name.replace(/`/g, '');

    const oldColsMap = new Map(oldColumns.map(c => [c.column_id, c.column_name]));
    const newColsMap = new Map(newColumns.map(c => [c.column_id, c.column_name]));

    // 1. Columns to Add or Rename
    for (const [colId, newName] of newColsMap.entries()) {
        const safeNewName = sanitize(newName);
        if (oldColsMap.has(colId)) {
            const oldName = oldColsMap.get(colId);
            if (oldName !== newName) {
                const safeOldName = sanitize(oldName);
                const query = `ALTER TABLE \`${tableName}\` RENAME COLUMN \`${safeOldName}\` TO \`${safeNewName}\``;
                await db.execute(query);
                console.log(`Renamed column in ${tableName}: ${oldName} -> ${newName}`);
            }
        } else {
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

const dropFormatTable = async (formulaId) => {
    const tableName = `price_list_format_${formulaId}`;
    await db.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
    console.log(`Dropped dynamic table: ${tableName}`);
};

const createPricingFormula = async (stateId, formatName, columns, brandConfigs, addedBy, deviceId) => {
    const query = `
        INSERT INTO pricing_formula_master (state_id, format_name, columns, brand_configs, added_by, device_id)
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

const getAllPricingFormulas = async () => {
    const query = `
        SELECT
            pfm.id,
            pfm.state_id,
            sm.name AS state_name,
            pfm.format_name,
            pfm.brand_configs,
            pfm.columns,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            pfm.device_id,
            pfm.timestamp
        FROM pricing_formula_master pfm
        LEFT JOIN state_master sm ON pfm.state_id = sm.id
        LEFT JOIN users u ON pfm.added_by = u.id
        ORDER BY pfm.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return results;
};

const getPricingFormulaById = async (id) => {
    const query = `
        SELECT
            pfm.id,
            pfm.state_id,
            sm.name AS state_name,
            pfm.format_name,
            pfm.brand_configs,
            pfm.columns,
            pfm.added_by,
            pfm.device_id,
            pfm.timestamp
        FROM pricing_formula_master pfm
        LEFT JOIN state_master sm ON pfm.state_id = sm.id
        WHERE pfm.id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

const updatePricingFormula = async (id, stateId, formatName, columns, brandConfigs) => {
    const [rows] = await db.execute("SELECT columns FROM pricing_formula_master WHERE id = ?", [id]);
    const oldColumns = rows[0] && rows[0].columns 
        ? (typeof rows[0].columns === "string" ? JSON.parse(rows[0].columns) : rows[0].columns)
        : [];

    const query = `
        UPDATE pricing_formula_master
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

    const tableName = `price_list_format_${id}`;
    const exists = await checkTableExists(tableName);
    if (exists) {
        await syncFormatTableSchema(id, oldColumns, columns);
    } else {
        await createFormatTable(id, columns);
    }

    return result;
};

const deletePricingFormula = async (id) => {
    await dropFormatTable(id);
    const query = `DELETE FROM pricing_formula_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

module.exports = {
    createPricingFormulaTable,
    createPricingFormula,
    getAllPricingFormulas,
    getPricingFormulaById,
    updatePricingFormula,
    deletePricingFormula,
    // Backward compatibility aliases
    createVariationTable: createPricingFormulaTable,
    createVariation: createPricingFormula,
    getAllVariations: getAllPricingFormulas,
    getVariationById: getPricingFormulaById,
    updateVariation: updatePricingFormula,
    deleteVariation: deletePricingFormula
};

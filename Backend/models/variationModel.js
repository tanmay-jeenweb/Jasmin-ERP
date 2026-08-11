const db = require('../config/db.js');

const sanitize = (name) => {
    if (!name) return '';
    if (typeof name === 'string') return name.replace(/`/g, '');
    if (typeof name === 'object') {
        if (name.column_name) return String(name.column_name).replace(/`/g, '');
        if (name.name) return String(name.name).replace(/`/g, '');
    }
    return String(name).replace(/`/g, '');
};

const deduplicateColumns = (columns) => {
    if (!columns || !Array.isArray(columns)) return { newColumns: columns || [], changed: false };
    
    let nameCounts = new Map();
    columns.forEach(col => {
        const name = col.column_name ? col.column_name.trim() : "";
        if (name) {
            nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
        }
    });

    let changed = false;
    const newColumns = columns.map(col => {
        const name = col.column_name ? col.column_name.trim() : "";
        if (name && nameCounts.get(name) > 1 && col.column_id) {
            changed = true;
            return {
                ...col,
                column_name: `${name} (${col.column_id})`
            };
        }
        return col;
    });

    return { newColumns, changed };
};


const createVariationTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS variation_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            state_id INT NOT NULL,
            state_ids JSON NULL,
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
        const [isDeletedCol] = await db.execute(`SHOW COLUMNS FROM variation_master LIKE 'is_deleted'`);
        if (!isDeletedCol || isDeletedCol.length === 0) {
            console.log("Migrating variation_master schema: adding is_deleted column...");
            await db.execute(`ALTER TABLE variation_master ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE`);
        }
        const [deletedAtCol] = await db.execute(`SHOW COLUMNS FROM variation_master LIKE 'deleted_at'`);
        if (!deletedAtCol || deletedAtCol.length === 0) {
            console.log("Migrating variation_master schema: adding deleted_at column...");
            await db.execute(`ALTER TABLE variation_master ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL`);
        }
        const [stateIdsCol] = await db.execute(`SHOW COLUMNS FROM variation_master LIKE 'state_ids'`);
        if (!stateIdsCol || stateIdsCol.length === 0) {
            console.log("Migrating variation_master schema: adding state_ids column...");
            await db.execute(`ALTER TABLE variation_master ADD COLUMN state_ids JSON NULL`);
            await db.execute(`UPDATE variation_master SET state_ids = JSON_ARRAY(state_id) WHERE state_ids IS NULL`);
        }

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

    // History table auto-creation & baseline seeding migration for existing variations
    try {
        const [variations] = await db.execute("SELECT id, columns FROM variation_master");
        for (const v of variations) {
            const vId = v.id;
            let columns = typeof v.columns === 'string' ? JSON.parse(v.columns) : (v.columns || []);
            
            // Deduplicate columns with identical names to prevent MySQL syntax errors and frontend overwrites
            const { newColumns, changed } = deduplicateColumns(columns);
            if (changed) {
                console.log(`Detected duplicate column names in variation #${vId}. Automatically updating to unique names...`);
                await db.execute("UPDATE variation_master SET columns = ? WHERE id = ?", [JSON.stringify(newColumns), vId]);
                columns = newColumns;
            }

            const tableName = `price_list_format_${vId}`;
            const historyTableName = `price_list_format_history_${vId}`;

            const currentExists = await checkTableExists(tableName);
            const historyExists = await checkTableExists(historyTableName);

            if (!currentExists) {
                console.log(`Recreating missing format and history tables for variation #${vId}...`);
                await createFormatTable(vId, columns);
            } else if (!historyExists) {
                console.log(`Migrating history table for variation #${vId}...`);
                const columnDefs = columns.map(col => {
                    const safeName = sanitize(col.column_name);
                    return `\`${safeName}\` TEXT NULL`;
                }).join(', ');

                const createHistQuery = `
                    CREATE TABLE IF NOT EXISTS \`${historyTableName}\` (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        product_code VARCHAR(100) NOT NULL,
                        brand VARCHAR(150) NOT NULL,
                        icat_name VARCHAR(150) NOT NULL,
                        model_group_name VARCHAR(255) NOT NULL,
                        model_name VARCHAR(255) NOT NULL,
                        ${columnDefs ? columnDefs + ',' : ''}
                        added_by INT NULL,
                        device_id VARCHAR(100) NULL,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
                    )
                `;
                await db.execute(createHistQuery);

                // Seed existing records as initial history baseline if rows exist
                try {
                    const customCols = columns.map(c => `\`${sanitize(c.column_name)}\``);
                    const colsString = customCols.length > 0 ? customCols.join(', ') + ', ' : '';

                    const seedQuery = `
                        INSERT INTO \`${historyTableName}\` (product_code, brand, icat_name, model_group_name, model_name, ${colsString}added_by, device_id, timestamp)
                        SELECT product_code, brand, icat_name, model_group_name, model_name, ${colsString}added_by, device_id, timestamp
                        FROM \`${tableName}\`
                    `;
                    await db.execute(seedQuery);
                    console.log(`Seeded history table ${historyTableName} from current table ${tableName}`);
                } catch (seedErr) {
                    console.warn(`Could not seed initial baseline for ${historyTableName}:`, seedErr.message);
                }
            }
        }
    } catch (migErr) {
        console.error("Error migrating price list history tables:", migErr.message);
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
    const historyTableName = `price_list_format_history_${variationId}`;

    const columnDefs = columns.map(col => {
        const safeName = sanitize(col.column_name);
        return `\`${safeName}\` TEXT NULL`;
    }).join(', ');

    // 1. Current Snapshot Table (product_code is UNIQUE)
    const currentQuery = `
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
    await db.execute(currentQuery);
    console.log(`Created dynamic price list format table: ${tableName}`);

    // 2. Historical Append-only Table (product_code is NOT unique)
    const historyQuery = `
        CREATE TABLE IF NOT EXISTS \`${historyTableName}\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_code VARCHAR(100) NOT NULL,
            brand VARCHAR(150) NOT NULL,
            icat_name VARCHAR(150) NOT NULL,
            model_group_name VARCHAR(255) NOT NULL,
            model_name VARCHAR(255) NOT NULL,
            ${columnDefs ? columnDefs + ',' : ''}
            added_by INT NULL,
            device_id VARCHAR(100) NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `;
    await db.execute(historyQuery);
    console.log(`Created dynamic price list format history table: ${historyTableName}`);
};

const syncFormatTableSchema = async (variationId, oldColumns, newColumns) => {
    const tableName = `price_list_format_${variationId}`;
    const historyTableName = `price_list_format_history_${variationId}`;

    const oldColsMap = new Map(oldColumns.map(c => [c.column_id, c.column_name]));
    const newColsMap = new Map(newColumns.map(c => [c.column_id, c.column_name]));

    const targetTables = [tableName];
    if (await checkTableExists(historyTableName)) {
        targetTables.push(historyTableName);
    }

    for (const target of targetTables) {
        // 1. Columns to Add or Rename
        for (const [colId, newName] of newColsMap.entries()) {
            const safeNewName = sanitize(newName);
            if (oldColsMap.has(colId)) {
                // Column exists in both, check if renamed
                const oldName = oldColsMap.get(colId);
                if (oldName !== newName) {
                    const safeOldName = sanitize(oldName);
                    const query = `ALTER TABLE \`${target}\` RENAME COLUMN \`${safeOldName}\` TO \`${safeNewName}\``;
                    await db.execute(query);
                    console.log(`Renamed column in ${target}: ${oldName} -> ${newName}`);
                }
            } else {
                // Column is new
                const query = `ALTER TABLE \`${target}\` ADD COLUMN \`${safeNewName}\` TEXT NULL`;
                await db.execute(query);
                console.log(`Added column to ${target}: ${newName}`);
            }
        }

        // SOFT DELETE: We strictly DO NOT execute ALTER TABLE DROP COLUMN.
        // Columns remain permanently in the database table so historical data is NEVER lost!
    }
};

const dropFormatTable = async (variationId) => {
    const tableName = `price_list_format_${variationId}`;
    const historyTableName = `price_list_format_history_${variationId}`;
    await db.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
    await db.execute(`DROP TABLE IF EXISTS \`${historyTableName}\``);
    console.log(`Dropped dynamic tables: ${tableName}, ${historyTableName}`);
};

const mapVariationStates = async (variations) => {
    const [states] = await db.execute("SELECT id, name FROM state_master");
    const stateMap = new Map(states.map(s => [s.id, s.name]));

    const processVariation = (v) => {
        if (!v) return null;
        let stateIds = [];
        if (v.state_ids) {
            try {
                stateIds = typeof v.state_ids === 'string' ? JSON.parse(v.state_ids) : v.state_ids;
            } catch (e) {
                stateIds = [];
            }
        }
        if (!Array.isArray(stateIds) || stateIds.length === 0) {
            stateIds = v.state_id ? [v.state_id] : [];
        }

        const names = stateIds.map(id => stateMap.get(id)).filter(Boolean);
        v.state_ids = stateIds;
        v.state_name = names.join(", ") || v.state_name || "Unknown";
        return v;
    };

    if (Array.isArray(variations)) {
        return variations.map(processVariation);
    } else {
        return processVariation(variations);
    }
};

const createVariation = async (stateId, formatName, columns, brandConfigs, addedBy, deviceId, stateIds) => {
    const { newColumns } = deduplicateColumns(columns);
    const query = `
        INSERT INTO variation_master (state_id, format_name, columns, brand_configs, added_by, device_id, state_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [
        stateId,
        formatName,
        JSON.stringify(newColumns),
        brandConfigs ? JSON.stringify(brandConfigs) : null,
        addedBy,
        deviceId,
        stateIds ? JSON.stringify(stateIds) : JSON.stringify([stateId])
    ]);

    const insertedId = result.insertId;
    await createFormatTable(insertedId, newColumns);

    return result;
};

const getAllVariations = async (includeDeleted = false) => {
    let whereClause = `WHERE (vm.is_deleted IS NULL OR vm.is_deleted = FALSE)`;
    if (includeDeleted === true || includeDeleted === 'true') {
        whereClause = `WHERE vm.is_deleted = TRUE`;
    } else if (includeDeleted === 'all') {
        whereClause = ``;
    }

    const query = `
        SELECT
            vm.id,
            vm.state_id,
            vm.state_ids,
            sm.name AS state_name,
            vm.format_name,
            vm.brand_configs,
            vm.columns,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            vm.device_id,
            vm.timestamp,
            vm.is_deleted,
            vm.deleted_at
        FROM variation_master vm
        LEFT JOIN state_master sm ON vm.state_id = sm.id
        LEFT JOIN users u ON vm.added_by = u.id
        ${whereClause}
        ORDER BY vm.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return await mapVariationStates(results);
};

const getVariationById = async (id) => {
    const query = `
        SELECT
            vm.id,
            vm.state_id,
            vm.state_ids,
            sm.name AS state_name,
            vm.format_name,
            vm.brand_configs,
            vm.columns,
            vm.added_by,
            vm.device_id,
            vm.timestamp,
            vm.is_deleted,
            vm.deleted_at
        FROM variation_master vm
        LEFT JOIN state_master sm ON vm.state_id = sm.id
        WHERE vm.id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    if (!rows[0]) return null;
    return (await mapVariationStates(rows))[0];
};

const updateVariation = async (id, stateId, formatName, newColumns, brandConfigs, stateIds) => {
    // Get old columns to preserve soft deleted columns
    const [rows] = await db.execute("SELECT columns FROM variation_master WHERE id = ?", [id]);
    const oldColumns = rows[0] && rows[0].columns
        ? (typeof rows[0].columns === "string" ? JSON.parse(rows[0].columns) : rows[0].columns)
        : [];

    const newColIds = new Set(newColumns.map(c => c.column_id));
    const mergedColumns = [...newColumns];

    // Preserve old columns missing from current request by marking them soft-deleted
    oldColumns.forEach(oldCol => {
        if (!newColIds.has(oldCol.column_id)) {
            mergedColumns.push({
                ...oldCol,
                is_deleted: true,
                deleted_at: oldCol.deleted_at || new Date().toISOString()
            });
        }
    });

    const { newColumns: deduplicatedColumns } = deduplicateColumns(mergedColumns);

    const query = `
        UPDATE variation_master
        SET state_id = ?, format_name = ?, columns = ?, brand_configs = ?, state_ids = ?
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [
        stateId,
        formatName,
        JSON.stringify(deduplicatedColumns),
        brandConfigs ? JSON.stringify(brandConfigs) : null,
        stateIds ? JSON.stringify(stateIds) : JSON.stringify([stateId]),
        id
    ]);

    // Sync table schema (Add new columns, rename columns, BUT NEVER DROP COLUMNS)
    const tableName = `price_list_format_${id}`;
    const exists = await checkTableExists(tableName);
    if (exists) {
        await syncFormatTableSchema(id, oldColumns, deduplicatedColumns);
    } else {
        await createFormatTable(id, deduplicatedColumns);
    }

    return result;
};

const deleteVariation = async (id) => {
    // Soft delete: Mark is_deleted = TRUE and record deleted_at timestamp
    const query = `UPDATE variation_master SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const restoreVariation = async (id) => {
    // Restore soft-deleted variation rule
    const query = `UPDATE variation_master SET is_deleted = FALSE, deleted_at = NULL WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const checkFormatNameExists = async (formatName, excludeId = null) => {
    if (!formatName || !formatName.trim()) return false;
    let query = `SELECT id FROM variation_master WHERE LOWER(TRIM(format_name)) = LOWER(TRIM(?)) AND (is_deleted IS NULL OR is_deleted = FALSE)`;
    const params = [formatName.trim()];
    if (excludeId) {
        query += ` AND id != ?`;
        params.push(excludeId);
    }
    const [rows] = await db.execute(query, params);
    return rows.length > 0;
};

module.exports = {
    createVariationTable,
    createVariation,
    getAllVariations,
    getVariationById,
    updateVariation,
    deleteVariation,
    restoreVariation,
    checkFormatNameExists
};

const db = require('../config/db.js');

const getPriceListData = async (variationId) => {
    const tableName = `price_list_format_${variationId}`;
    const query = `SELECT * FROM \`${tableName}\` ORDER BY brand ASC, model_name ASC`;
    const [results] = await db.execute(query);
    return results;
};

const upsertPriceListData = async (variationId, columnsList, records, addedBy, deviceId) => {
    const tableName = `price_list_format_${variationId}`;
    const connection = await db.getConnection();
    
    try {
        // Ensure device_id column exists
        try {
            await connection.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN device_id VARCHAR(100) NULL`);
        } catch (e) {
            // Already exists or table doesn't exist
        }

        await connection.beginTransaction();
        
        const sanitize = (name) => name.replace(/`/g, '');
        const customFields = columnsList.map(c => sanitize(c.column_name));
        
        const insertFields = [
            'product_code', 'brand', 'icat_name', 'model_group_name', 'model_name',
            ...customFields,
            'added_by', 'device_id'
        ];
        
        const placeholders = insertFields.map(() => '?').join(', ');
        
        const updateClause = [
            'brand = VALUES(brand)',
            'icat_name = VALUES(icat_name)',
            'model_group_name = VALUES(model_group_name)',
            'model_name = VALUES(model_name)',
            ...customFields.map(f => `\`${f}\` = VALUES(\`${f}\`)`),
            'added_by = VALUES(added_by)',
            'device_id = VALUES(device_id)'
        ].join(', ');
        
        const sql = `
            INSERT INTO \`${tableName}\` (${insertFields.map(f => `\`${f}\``).join(', ')})
            VALUES (${placeholders})
            ON DUPLICATE KEY UPDATE ${updateClause}
        `;
        
        for (const rec of records) {
            const params = [
                rec.product_code,
                rec.brand,
                rec.icat_name,
                rec.model_group_name,
                rec.model_name,
                ...customFields.map(f => rec[f] !== undefined ? rec[f] : null),
                addedBy,
                deviceId
            ];
            await connection.execute(sql, params);
        }
        
        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
};

module.exports = {
    getPriceListData,
    upsertPriceListData
};

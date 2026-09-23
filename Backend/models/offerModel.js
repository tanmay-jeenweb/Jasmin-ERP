const db = require('../config/db.js');

const createOffersTable = async () => {
    // Offers table (model_group_name set to NULL to avoid compatibility problems)
    const createOffersQuery = `
        CREATE TABLE IF NOT EXISTS offers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            brand_name VARCHAR(150) NOT NULL,
            model_group_name VARCHAR(255) NULL,
            state_id INT NOT NULL,
            offer_type VARCHAR(100) NOT NULL,
            from_date DATE NOT NULL,
            to_date DATE NOT NULL,
            added_by INT NULL,
            device_id VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (state_id) REFERENCES state_master(id) ON DELETE CASCADE,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `;
    await db.execute(createOffersQuery);

    // Migration to allow NULL in model_group_name if it exists
    try {
        await db.execute(`ALTER TABLE offers MODIFY COLUMN model_group_name VARCHAR(255) NULL`);
    } catch (err) {
        // column modification may fail if schema is already modified
    }

    // Migration to add state_ids JSON column if not present
    try {
        const [stateIdsCol] = await db.execute(`SHOW COLUMNS FROM offers LIKE 'state_ids'`);
        if (!stateIdsCol || stateIdsCol.length === 0) {
            console.log("Migrating offers schema: adding state_ids column...");
            await db.execute(`ALTER TABLE offers ADD COLUMN state_ids JSON NULL`);
            await db.execute(`UPDATE offers SET state_ids = JSON_ARRAY(state_id) WHERE state_ids IS NULL`);
        }
    } catch (err) {
        console.error("Migration of offers table failed:", err.message);
    }

    // Offer model groups junction table
    const createOfferModelGroupsQuery = `
        CREATE TABLE IF NOT EXISTS offer_model_groups (
            id INT AUTO_INCREMENT PRIMARY KEY,
            offer_id INT NOT NULL,
            model_group_name VARCHAR(255) NOT NULL,
            FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
        )
    `;
    await db.execute(createOfferModelGroupsQuery);

    // Dynamic offer transaction records
    const createOfferTransactionsQuery = `
        CREATE TABLE IF NOT EXISTS offer_transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            offer_id INT NOT NULL,
            transaction_type VARCHAR(100) NOT NULL,
            value_type VARCHAR(50) NOT NULL,
            offer_type_value VARCHAR(255) NULL,
            upto_value DECIMAL(10,2) NULL,
            offer_text TEXT NULL,
            relative_offer VARCHAR(255) NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
        )
    `;
    await db.execute(createOfferTransactionsQuery);
    console.log("Offers, Offer Model Groups and Offer Transactions tables ready");
};

const createOffer = async (offerData, modelGroups, transactions, addedBy, deviceId) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const insertOfferQuery = `
            INSERT INTO offers (
                brand_name, model_group_name, state_id, offer_type, from_date, to_date, added_by, device_id, state_ids
            ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [offerResult] = await conn.execute(insertOfferQuery, [
            offerData.brand_name,
            offerData.state_id,
            offerData.offer_type,
            offerData.from_date,
            offerData.to_date,
            addedBy,
            deviceId,
            offerData.state_ids ? JSON.stringify(offerData.state_ids) : JSON.stringify([offerData.state_id])
        ]);

        const offerId = offerResult.insertId;

        // Insert model groups
        if (modelGroups && modelGroups.length > 0) {
            const insertGroupQuery = `
                INSERT INTO offer_model_groups (offer_id, model_group_name) VALUES (?, ?)
            `;
            for (const mg of modelGroups) {
                await conn.execute(insertGroupQuery, [offerId, mg]);
            }
        }

        // Insert transaction rows
        if (transactions && transactions.length > 0) {
            const insertTxQuery = `
                INSERT INTO offer_transactions (
                    offer_id, transaction_type, value_type, offer_type_value, upto_value, offer_text, relative_offer
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            for (const tx of transactions) {
                await conn.execute(insertTxQuery, [
                    offerId,
                    tx.transaction_type,
                    tx.value_type,
                    tx.offer_type_value || null,
                    tx.upto_value !== undefined && tx.upto_value !== "" ? tx.upto_value : null,
                    tx.offer_text || null,
                    tx.relative_offer || null
                ]);
            }
        }

        await conn.commit();
        return offerId;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const mapOfferStates = async (offers) => {
    const [states] = await db.execute("SELECT id, name FROM state_master");
    const stateMap = new Map(states.map(s => [s.id, s.name]));

    const processOffer = (o) => {
        if (!o) return null;
        let stateIds = [];
        if (o.state_ids) {
            try {
                stateIds = typeof o.state_ids === 'string' ? JSON.parse(o.state_ids) : o.state_ids;
            } catch (e) {
                stateIds = [];
            }
        }
        if (!Array.isArray(stateIds) || stateIds.length === 0) {
            stateIds = o.state_id ? [o.state_id] : [];
        }

        const names = stateIds.map(id => stateMap.get(id)).filter(Boolean);
        o.state_ids = stateIds;
        o.state_name = names.join(", ") || o.state_name || "Unknown";
        return o;
    };

    if (Array.isArray(offers)) {
        return offers.map(processOffer);
    } else {
        return processOffer(offers);
    }
};

const getAllOffers = async () => {
    const query = `
        SELECT
            o.id,
            o.brand_name,
            GROUP_CONCAT(omg.model_group_name ORDER BY omg.model_group_name SEPARATOR ', ') AS model_group_name,
            o.state_id,
            o.state_ids,
            sm.name AS state_name,
            o.offer_type,
            DATE_FORMAT(o.from_date, '%Y-%m-%d') AS from_date,
            DATE_FORMAT(o.to_date, '%Y-%m-%d') AS to_date,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            o.device_id,
            o.timestamp
        FROM offers o
        LEFT JOIN offer_model_groups omg ON o.id = omg.offer_id
        LEFT JOIN state_master sm ON o.state_id = sm.id
        LEFT JOIN users u ON o.added_by = u.id
        GROUP BY o.id
        ORDER BY o.timestamp DESC
    `;
    const [results] = await db.execute(query);
    const mappedOffers = await mapOfferStates(results);

    if (mappedOffers.length === 0) return [];

    // Fetch all transactions for these offers
    const offerIds = mappedOffers.map(o => o.id);
    const placeholders = offerIds.map(() => '?').join(',');
    const txQuery = `
        SELECT *
        FROM offer_transactions
        WHERE offer_id IN (${placeholders})
    `;
    const [txRows] = await db.execute(txQuery, offerIds);

    // Group transactions by offer_id
    const txMap = {};
    for (const tx of txRows) {
        if (!txMap[tx.offer_id]) {
            txMap[tx.offer_id] = [];
        }
        txMap[tx.offer_id].push(tx);
    }

    // Attach transactions to each offer
    return mappedOffers.map(o => ({
        ...o,
        transactions: txMap[o.id] || []
    }));
};

const getOfferById = async (id) => {
    const offerQuery = `
        SELECT 
            o.id,
            o.brand_name,
            o.model_group_name,
            o.state_id,
            o.state_ids,
            o.offer_type,
            DATE_FORMAT(o.from_date, '%Y-%m-%d') AS from_date,
            DATE_FORMAT(o.to_date, '%Y-%m-%d') AS to_date,
            o.added_by,
            o.device_id,
            o.timestamp,
            o.updated_at,
            sm.name AS state_name
        FROM offers o
        LEFT JOIN state_master sm ON o.state_id = sm.id
        WHERE o.id = ?
    `;
    const [offerRows] = await db.execute(offerQuery, [id]);
    if (offerRows.length === 0) return null;

    const mappedOffers = await mapOfferStates(offerRows);
    const offer = mappedOffers[0];

    // Fetch model groups
    const [mgRows] = await db.execute(
        `SELECT model_group_name FROM offer_model_groups WHERE offer_id = ?`,
        [id]
    );
    const model_groups = mgRows.map(row => row.model_group_name);

    // Fetch transactions
    const txQuery = `
        SELECT *
        FROM offer_transactions
        WHERE offer_id = ?
    `;
    const [txRows] = await db.execute(txQuery, [id]);

    return {
        ...offer,
        model_groups,
        transactions: txRows
    };
};

const updateOffer = async (id, offerData, modelGroups, transactions, deviceId) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const updateOfferQuery = `
            UPDATE offers SET
                brand_name = ?,
                model_group_name = NULL,
                state_id = ?,
                offer_type = ?,
                from_date = ?,
                to_date = ?,
                device_id = ?,
                state_ids = ?
            WHERE id = ?
        `;
        await conn.execute(updateOfferQuery, [
            offerData.brand_name,
            offerData.state_id,
            offerData.offer_type,
            offerData.from_date,
            offerData.to_date,
            deviceId,
            offerData.state_ids ? JSON.stringify(offerData.state_ids) : JSON.stringify([offerData.state_id]),
            id
        ]);

        // Clean and update model groups
        await conn.execute(`DELETE FROM offer_model_groups WHERE offer_id = ?`, [id]);
        if (modelGroups && modelGroups.length > 0) {
            const insertGroupQuery = `
                INSERT INTO offer_model_groups (offer_id, model_group_name) VALUES (?, ?)
            `;
            for (const mg of modelGroups) {
                await conn.execute(insertGroupQuery, [id, mg]);
            }
        }

        // Clean and update transactions
        await conn.execute(`DELETE FROM offer_transactions WHERE offer_id = ?`, [id]);
        if (transactions && transactions.length > 0) {
            const insertTxQuery = `
                INSERT INTO offer_transactions (
                    offer_id, transaction_type, value_type, offer_type_value, upto_value, offer_text, relative_offer
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            for (const tx of transactions) {
                await conn.execute(insertTxQuery, [
                    id,
                    tx.transaction_type,
                    tx.value_type,
                    tx.offer_type_value || null,
                    tx.upto_value !== undefined && tx.upto_value !== "" ? tx.upto_value : null,
                    tx.offer_text || null,
                    tx.relative_offer || null
                ]);
            }
        }

        await conn.commit();
        return true;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const deleteOffer = async (id) => {
    const query = `DELETE FROM offers WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

module.exports = {
    createOffersTable,
    createOffer,
    getAllOffers,
    getOfferById,
    updateOffer,
    deleteOffer
};
 
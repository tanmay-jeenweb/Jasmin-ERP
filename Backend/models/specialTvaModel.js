const db = require('../config/db.js');
const { getAllBranches } = require('./branchModel.js');

/**
 * Creates the master table: special_tva_master
 */
const createSpecialTvaTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS special_tva_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            table_name VARCHAR(100) NOT NULL,
            status ENUM('active', 'archived') DEFAULT 'active',
            added_by INT NOT NULL,
            device_id VARCHAR(255) DEFAULT 'Unknown',
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await db.execute(query);
    console.log("Special TVA Master table ready");
};

/**
 * Creates the dedicated table for a specific Special TVA entry: special_tva_data_${id}
 */
const createSpecialTvaDataTable = async (id) => {
    const tableName = `special_tva_data_${id}`;
    const query = `
        CREATE TABLE IF NOT EXISTS \`${tableName}\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            branch_code VARCHAR(100) NOT NULL,
            branch_name VARCHAR(255) NOT NULL,
            store_type VARCHAR(100) DEFAULT 'branch',
            state_name VARCHAR(150) DEFAULT '',
            zone VARCHAR(150) DEFAULT '',
            mf VARCHAR(100) DEFAULT '',
            target DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            added_by INT NULL,
            device_id VARCHAR(255) DEFAULT 'Unknown',
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY \`uq_branch_code\` (\`branch_code\`),
            KEY \`idx_branch_name\` (\`branch_name\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await db.execute(query);
    console.log(`Dedicated table '${tableName}' ready`);
};

/**
 * Pre-populates the dedicated table with all active branches from branch_master
 */
const seedBranchesForSpecialTva = async (id, addedBy = null, deviceId = 'Unknown') => {
    const tableName = `special_tva_data_${id}`;
    const branches = await getAllBranches();
    if (!branches || branches.length === 0) return;

    const values = [];
    const placeholders = [];

    for (const b of branches) {
        if (!b.code || !b.name) continue;
        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?)');
        values.push(
            b.code,
            b.name,
            b.store_type || 'branch',
            b.state_name || '',
            b.branch_cls_05 || '',
            '', // MF initially blank
            0.00, // target
            addedBy,
            deviceId
        );
    }

    if (placeholders.length === 0) return;

    const sql = `
        INSERT INTO \`${tableName}\` (
            branch_code, branch_name, store_type, state_name, zone, mf, target, added_by, device_id
        ) VALUES ${placeholders.join(', ')}
        ON DUPLICATE KEY UPDATE
            store_type = VALUES(store_type),
            state_name = VALUES(state_name),
            zone = VALUES(zone)
    `;

    await db.execute(sql, values);
    console.log(`Pre-seeded ${placeholders.length} branches for table '${tableName}'`);
};

/**
 * Creates a new Special TVA entry and its dedicated table
 */
const createSpecialTvaEntry = async (title, startDate, endDate, addedBy, deviceId = 'Unknown') => {
    // 1. Insert master record
    const insertSql = `
        INSERT INTO special_tva_master (title, start_date, end_date, table_name, added_by, device_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const tempTableName = 'pending';
    const [result] = await db.execute(insertSql, [title, startDate, endDate, tempTableName, addedBy, deviceId]);
    const insertId = result.insertId;

    // 2. Set actual table name
    const actualTableName = `special_tva_data_${insertId}`;
    await db.execute("UPDATE special_tva_master SET table_name = ? WHERE id = ?", [actualTableName, insertId]);

    // 3. Create dynamic table
    await createSpecialTvaDataTable(insertId);

    // 4. Seed branches
    await seedBranchesForSpecialTva(insertId, addedBy, deviceId);

    return {
        id: insertId,
        title,
        start_date: startDate,
        end_date: endDate,
        table_name: actualTableName
    };
};

/**
 * Retrieves all Special TVA master records with target summaries
 */
const getAllSpecialTvas = async () => {
    const query = `
        SELECT 
            m.id,
            m.title,
            m.start_date,
            m.end_date,
            m.table_name,
            m.status,
            m.added_by,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            m.device_id,
            m.timestamp,
            m.updated_at
        FROM special_tva_master m
        LEFT JOIN users u ON m.added_by = u.id
        ORDER BY m.timestamp DESC
    `;
    const [rows] = await db.execute(query);

    // Enrich with branches count and total target from each dedicated table
    for (const row of rows) {
        try {
            const [sumResult] = await db.execute(
                `SELECT COUNT(*) as branch_count, COALESCE(SUM(target), 0) as total_target FROM \`${row.table_name}\``
            );
            row.branch_count = sumResult[0]?.branch_count || 0;
            row.total_target = parseFloat(sumResult[0]?.total_target) || 0;
        } catch (e) {
            row.branch_count = 0;
            row.total_target = 0;
        }
    }

    return rows;
};

/**
 * Retrieves a single Special TVA master record
 */
const getSpecialTvaById = async (id) => {
    const query = `
        SELECT 
            m.id,
            m.title,
            m.start_date,
            m.end_date,
            m.table_name,
            m.status,
            m.added_by,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            m.device_id,
            m.timestamp,
            m.updated_at
        FROM special_tva_master m
        LEFT JOIN users u ON m.added_by = u.id
        WHERE m.id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

/**
 * Updates a Special TVA master record (title, dates)
 */
const updateSpecialTva = async (id, title, startDate, endDate) => {
    const query = `
        UPDATE special_tva_master 
        SET title = ?, start_date = ?, end_date = ? 
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [title, startDate, endDate, id]);
    return result;
};

/**
 * Deletes a Special TVA entry and drops its dedicated data table
 */
const deleteSpecialTva = async (id) => {
    const master = await getSpecialTvaById(id);
    if (!master) return null;

    // Drop dynamic table
    try {
        await db.execute(`DROP TABLE IF EXISTS \`${master.table_name}\``);
    } catch (e) {
        console.warn(`Could not drop table ${master.table_name}:`, e.message);
    }

    // Delete master record
    const [result] = await db.execute("DELETE FROM special_tva_master WHERE id = ?", [id]);
    return result;
};

/**
 * Bulk upserts targets into special_tva_data_${id}
 * records: array of { branch_name, branch_code, target, mf }
 */
const upsertSpecialTvaTargets = async (id, records = [], addedBy = null, deviceId = 'Unknown') => {
    const tableName = `special_tva_data_${id}`;
    if (!records || records.length === 0) return { updated: 0 };

    // Get all branches to ensure correct mapping
    const allBranches = await getAllBranches();
    const branchLookup = {};
    for (const b of allBranches) {
        if (b.name) branchLookup[b.name.trim().toUpperCase()] = b;
        if (b.code) branchLookup[b.code.trim().toUpperCase()] = b;
    }

    let updatedCount = 0;
    for (const rec of records) {
        const rawName = (rec.branch_name || '').trim().toUpperCase();
        const rawCode = (rec.branch_code || '').trim().toUpperCase();
        const branch = branchLookup[rawName] || branchLookup[rawCode];

        if (!branch) continue;

        const targetVal = parseFloat(rec.target) || 0.00;
        const mfVal = rec.mf !== undefined && rec.mf !== null ? String(rec.mf).trim() : '';

        const sql = `
            INSERT INTO \`${tableName}\` (
                branch_code, branch_name, store_type, state_name, zone, mf, target, added_by, device_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                target = VALUES(target),
                mf = IF(VALUES(mf) != '', VALUES(mf), mf),
                added_by = VALUES(added_by),
                device_id = VALUES(device_id)
        `;

        await db.execute(sql, [
            branch.code,
            branch.name,
            branch.store_type || 'branch',
            branch.state_name || '',
            branch.branch_cls_05 || '',
            mfVal,
            targetVal,
            addedBy,
            deviceId
        ]);
        updatedCount++;
    }

    return { updated: updatedCount };
};

/**
 * Helpers for brand resolution & standardizing
 */
const standardizeBrand = (brand) => {
    if (!brand) return 'Other';
    const b = brand.trim().toLowerCase();
    if (b.includes('vivo')) return 'Vivo';
    if (b.includes('oppo')) return 'OPPO';
    if (b.includes('samsung')) return 'Samsung';
    if (b.includes('apple') || b.includes('iphone') || b.includes('ipad')) return 'Apple';
    if (b.includes('realme')) return 'Realme';
    if (b.includes('xiaomi') || b.includes('redmi') || b === 'mi') return 'Xiaomi';
    if (b.includes('oneplus')) return 'OnePlus';
    if (b.includes('infinix')) return 'Infinix';
    if (b.includes('motorola') || b.includes('moto')) return 'Motorola';
    if (b.includes('nokia')) return 'Nokia';
    if (b.includes('tecno') || b.includes('techno')) return 'Tecno';
    if (b.includes('iqoo')) return 'iQOO';
    if (b.includes('poco')) return 'Poco';
    if (b.includes('lava')) return 'Lava';
    if (b.includes('itel')) return 'Itel';
    return brand.trim().charAt(0).toUpperCase() + brand.trim().slice(1).toLowerCase();
};

/**
 * Format Date to YYYY-MM-DD
 */
const formatDate = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val.split('T')[0];
    if (val instanceof Date) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return '';
};

/**
 * Comprehensive Report Data Generator
 * Computes:
 * - Fixed Columns: S.No., Party Name, TYPE, State, Zone, MF, Target
 * - Section 1: Achievement (QTY) for each Brand, Other, Total
 * - Section 2: Achievement % for each Brand, Other, Total
 * - Section 3: Target for each Brand, Other, Total
 */
const getSpecialTvaReportData = async (id, userStateRestriction = null, userAllowedBranches = null, userProfile = null) => {
    const master = await getSpecialTvaById(id);
    if (!master) {
        throw new Error('Special TVA master record not found');
    }

    const tableName = master.table_name;
    const startDate = formatDate(master.start_date);
    const endDate = formatDate(master.end_date);

    // 1. Fetch configured brands for Special TVA from mobile_brand_master
    const [allBrandRows] = await db.execute(
        `SELECT id, mobile_brand, share_percentage, show_in_special_tva, show_individually 
         FROM mobile_brand_master`
    );

    // Brands marked show_in_special_tva = 1 are shown individually.
    // All other brands (show_in_special_tva = 0 or unselected) are grouped into Others.
    const individualBrands = [];
    const otherBrandsList = [];

    for (const b of allBrandRows) {
        const rawName = (b.mobile_brand || '').trim();
        const stdName = standardizeBrand(rawName);
        const share = parseFloat(b.share_percentage) || 0;
        const isSelected = Boolean(b.show_in_special_tva);

        const brandObj = {
            id: b.id,
            raw_name: rawName,
            brand_name: stdName,
            share_percentage: share,
            show_in_special_tva: isSelected,
            show_individually: isSelected
        };

        if (isSelected) {
            // Deduplicate if needed
            if (!individualBrands.some(ib => ib.brand_name.toLowerCase() === stdName.toLowerCase())) {
                individualBrands.push(brandObj);
            }
        } else {
            otherBrandsList.push(brandObj);
        }
    }

    // List of brand columns: Individual brands + "Other" + "Total"
    const brandHeaders = [
        ...individualBrands.map(b => b.brand_name),
        'Other',
        'Total'
    ];

    // 2. Fetch ABM lookup for branches from branch_master and user_branch_mappings
    const branchAbmLookup = {};
    try {
        const [abmMappingRows] = await db.execute(`
            SELECT 
                bm.code AS branch_code,
                bm.name AS branch_name,
                COALESCE(abm_u.name, bm.abm, 'Unassigned') AS abm_name,
                abm_u.id AS abm_user_id
            FROM branch_master bm
            LEFT JOIN user_branch_mappings abm_m ON bm.id = abm_m.branch_id
            LEFT JOIN users abm_u ON (
                abm_m.user_id = abm_u.id AND abm_u.id IN (
                    SELECT u.id FROM users u
                    JOIN user_types ut ON u.user_type_id = ut.id
                    WHERE ut.user_role = 'ABM' OR ut.type_name = 'ABM'
                )
            )
        `);

        for (const row of abmMappingRows) {
            const abmInfo = {
                abm_name: (row.abm_name || '').trim() || 'Unassigned',
                abm_user_id: row.abm_user_id || null
            };
            if (row.branch_code) branchAbmLookup[row.branch_code.trim().toUpperCase()] = abmInfo;
            if (row.branch_name) branchAbmLookup[row.branch_name.trim().toUpperCase()] = abmInfo;
        }
    } catch (e) {
        console.warn("Failed to load ABM mappings for branches:", e.message);
    }

    // 3. Fetch branches from special_tva_data_${id}
    const [dataRows] = await db.execute(
        `SELECT id, branch_code, branch_name, store_type, state_name, zone, mf, target 
         FROM \`${tableName}\` 
         ORDER BY branch_name ASC`
    );

    for (const b of dataRows) {
        const codeKey = (b.branch_code || '').trim().toUpperCase();
        const nameKey = (b.branch_name || '').trim().toUpperCase();
        const abmInfo = branchAbmLookup[codeKey] || branchAbmLookup[nameKey] || { abm_name: 'Unassigned', abm_user_id: null };
        b.abm_name = abmInfo.abm_name;
        b.abm_user_id = abmInfo.abm_user_id;
    }

    // Apply user permissions filter if present
    let filteredBranches = dataRows;
    if (userAllowedBranches !== null && Array.isArray(userAllowedBranches)) {
        if (userAllowedBranches.length === 0) {
            // User is non-admin and not mapped to any branch -> keep it blank
            filteredBranches = [];
        } else {
            // Specific branch mappings explicitly define the user's branch access
            const allowedSet = new Set(userAllowedBranches.map(b => String(b).trim().toUpperCase()));
            filteredBranches = filteredBranches.filter(r => 
                (r.branch_name && allowedSet.has(String(r.branch_name).trim().toUpperCase())) ||
                (r.branch_code && allowedSet.has(String(r.branch_code).trim().toUpperCase()))
            );
        }
    }

    // 3. Build branch code/name lookup
    const branchNameLookup = {};
    for (const b of filteredBranches) {
        if (b.branch_code) branchNameLookup[b.branch_code.toUpperCase()] = b.branch_name;
        if (b.branch_name) branchNameLookup[b.branch_name.toUpperCase()] = b.branch_name;
    }

    // 4. Load item code to brand mapping from item_model_master
    let modelMap = {};
    try {
        const [models] = await db.execute("SELECT item_code, brand_name FROM item_model_master");
        for (const m of models) {
            if (m.item_code) {
                modelMap[m.item_code.trim()] = m.brand_name ? m.brand_name.trim() : null;
            }
        }
    } catch (e) {
        console.warn("Failed to load item_model_master for brand mapping:", e.message);
    }

    const resolveBrand = (itemCode, itemDescription) => {
        const code = (itemCode || '').trim();
        if (code && modelMap[code]) {
            return standardizeBrand(modelMap[code]);
        }
        const desc = (itemDescription || '').toLowerCase();

        // Check if any brand name in mobile_brand_master is mentioned in description
        for (const b of allBrandRows) {
            const bName = (b.mobile_brand || '').trim().toLowerCase();
            if (bName && desc.includes(bName)) {
                return standardizeBrand(b.mobile_brand);
            }
        }

        // Standard brand keyword fallbacks
        if (desc.includes('samsung')) return 'Samsung';
        if (desc.includes('vivo')) return 'Vivo';
        if (desc.includes('oppo')) return 'OPPO';
        if (desc.includes('realme')) return 'Realme';
        if (desc.includes('apple') || desc.includes('iphone') || desc.includes('ipad')) return 'Apple';
        if (desc.includes('oneplus')) return 'OnePlus';
        if (desc.includes('xiaomi') || desc.includes('redmi') || desc.includes(' mi ')) return 'Xiaomi';
        if (desc.includes('infinix')) return 'Infinix';
        if (desc.includes('poco')) return 'Poco';
        if (desc.includes('motorola') || desc.includes('moto ')) return 'Motorola';
        if (desc.includes('nokia')) return 'Nokia';
        if (desc.includes('tecno') || desc.includes('techno')) return 'Tecno';
        if (desc.includes('iqoo')) return 'iQOO';
        if (desc.includes('lava')) return 'Lava';
        if (desc.includes('itel')) return 'Itel';

        return 'Other';
    };

    // Helper to find target column: individual brand name or 'Other' for all unselected brands
    const findMatchingColumn = (rawBrand) => {
        if (!rawBrand) return 'Other';
        const brandLower = rawBrand.trim().toLowerCase();

        // 1. Check if it matches an individual brand (show_in_special_tva = 1)
        const matchInd = individualBrands.find(
            ib => ib.brand_name.toLowerCase() === brandLower ||
                  (ib.raw_name && ib.raw_name.toLowerCase() === brandLower)
        );
        if (matchInd) return matchInd.brand_name;

        // 2. All other brands that are not selected are grouped into Others
        return 'Other';
    };

    // 5. Query sales and sales returns from sales_invoice_cache within date range
    const [invoiceRows] = await db.execute(
        `SELECT branch_code, branch_name, invoice_date, item_code, item_model_name, qty, amount 
         FROM sales_invoice_cache 
         WHERE record_type = 'INVOICE' 
           AND invoice_date BETWEEN ? AND ?`,
        [startDate, endDate]
    );

    const [returnRows] = await db.execute(
        `SELECT branch_code, branch_name, invoice_date, item_code, item_model_name, qty, amount 
         FROM sales_invoice_cache 
         WHERE record_type = 'RETURN' 
           AND invoice_date BETWEEN ? AND ?`,
        [startDate, endDate]
    );

    // Map achievements by branch_name -> brand -> qty
    const branchAchievements = {};
    for (const b of filteredBranches) {
        branchAchievements[b.branch_name] = {};
        for (const bh of brandHeaders) {
            branchAchievements[b.branch_name][bh] = 0;
        }
    }

    // Aggregate Invoices
    for (const row of invoiceRows) {
        const invCode = (row.branch_code || '').toUpperCase();
        const invName = (row.branch_name || '').toUpperCase();
        const bName = branchNameLookup[invCode] || branchNameLookup[invName];
        if (!bName || !branchAchievements[bName]) continue;

        const rawBrand = resolveBrand(row.item_code, row.item_model_name);
        const qty = parseFloat(row.qty) || 0;
        const targetColumn = findMatchingColumn(rawBrand);

        // Only accumulate if brand is participating in Special TVA
        if (targetColumn) {
            branchAchievements[bName][targetColumn] = (branchAchievements[bName][targetColumn] || 0) + qty;
            branchAchievements[bName]['Total'] = (branchAchievements[bName]['Total'] || 0) + qty;
        }
    }

    // Subtract Returns
    for (const row of returnRows) {
        const invCode = (row.branch_code || '').toUpperCase();
        const invName = (row.branch_name || '').toUpperCase();
        const bName = branchNameLookup[invCode] || branchNameLookup[invName];
        if (!bName || !branchAchievements[bName]) continue;

        const rawBrand = resolveBrand(row.item_code, row.item_model_name);
        const qty = parseFloat(row.qty) || 0;
        const targetColumn = findMatchingColumn(rawBrand);

        // Only subtract if brand is participating in Special TVA
        if (targetColumn) {
            branchAchievements[bName][targetColumn] = (branchAchievements[bName][targetColumn] || 0) - qty;
            branchAchievements[bName]['Total'] = (branchAchievements[bName]['Total'] || 0) - qty;
        }
    }

    // 6. Compute row records with all 3 grouped sections
    let serialNo = 1;
    const records = [];

    // Grand total tracking
    const grandTotals = {
        target: 0,
        achievement_qty: {},
        achievement_pct: {},
        brand_targets: {}
    };

    for (const bh of brandHeaders) {
        grandTotals.achievement_qty[bh] = 0;
        grandTotals.brand_targets[bh] = 0;
    }

    for (const branch of filteredBranches) {
        const totalBranchTarget = parseFloat(branch.target) || 0;
        grandTotals.target += totalBranchTarget;

        const achMap = branchAchievements[branch.branch_name] || {};

        // Section 3: Brand Targets
        const brandTargets = {};
        let allocatedTargetSum = 0;

        // Individual brand targets based on share_percentage
        for (const ib of individualBrands) {
            const share = ib.share_percentage;
            const bTgt = share > 0 ? Math.round((totalBranchTarget * share) / 100) : 0;
            brandTargets[ib.brand_name] = bTgt;
            allocatedTargetSum += bTgt;
            grandTotals.brand_targets[ib.brand_name] += bTgt;
        }

        // Other target is 100% - sum of selected brand percentages (remaining target balance)
        const otherTarget = Math.max(0, totalBranchTarget - allocatedTargetSum);
        brandTargets['Other'] = otherTarget;
        grandTotals.brand_targets['Other'] += otherTarget;

        // Total target for Special TVA: sum of all participating Special TVA brand targets
        const totalSpecialTvaTarget = allocatedTargetSum + otherTarget;
        brandTargets['Total'] = totalSpecialTvaTarget;
        grandTotals.brand_targets['Total'] += totalSpecialTvaTarget;

        // Section 1: Achievement QTY
        const achievementQty = {};
        for (const bh of brandHeaders) {
            const q = achMap[bh] || 0;
            achievementQty[bh] = q;
            grandTotals.achievement_qty[bh] += q;
        }

        // Section 2: Achievement %
        const achievementPct = {};
        for (const bh of brandHeaders) {
            const tgt = brandTargets[bh] || 0;
            const q = achievementQty[bh] || 0;
            const pct = tgt > 0 ? Number(((q / tgt) * 100).toFixed(2)) : 0.00;
            achievementPct[bh] = pct;
        }

        records.push({
            s_no: serialNo++,
            branch_code: branch.branch_code,
            party_name: branch.branch_name,
            type: branch.store_type || 'Branch',
            state: branch.state_name || '',
            zone: branch.zone || '',
            mf: branch.mf || '',
            abm_name: branch.abm_name || 'Unassigned',
            period_target: totalBranchTarget,
            achievement_qty: achievementQty,
            achievement_pct: achievementPct,
            brand_targets: brandTargets
        });
    }

    // Calculate grand total achievement %
    for (const bh of brandHeaders) {
        const totTgt = grandTotals.brand_targets[bh] || 0;
        const totAch = grandTotals.achievement_qty[bh] || 0;
        grandTotals.achievement_pct[bh] = totTgt > 0 ? Number(((totAch / totTgt) * 100).toFixed(2)) : 0.00;
    }

    // 7. Compute ABM aggregated records
    const canViewAbmTab = Boolean(userProfile?.canViewAbmTab);
    const isAbm = Boolean(userProfile?.isAbm);
    const isAdmin = Boolean(userProfile?.isAdmin);

    let abmRecords = [];
    const abmTotals = {
        branch_count: 0,
        period_target: 0,
        brand_targets: {},
        achievement_qty: {},
        achievement_pct: {}
    };

    for (const bh of brandHeaders) {
        abmTotals.brand_targets[bh] = 0;
        abmTotals.achievement_qty[bh] = 0;
        abmTotals.achievement_pct[bh] = 0;
    }

    if (canViewAbmTab) {
        const abmGroups = {};

        for (const r of records) {
            // For ABM user, consolidate their mapped branches under their name
            const abmName = isAbm ? (userProfile?.userName || r.abm_name || 'My Report') : (r.abm_name || 'Unassigned');

            if (!abmGroups[abmName]) {
                abmGroups[abmName] = {
                    abm_name: abmName,
                    branch_count: 0,
                    states: new Set(),
                    zones: new Set(),
                    period_target: 0,
                    brand_targets: {},
                    achievement_qty: {}
                };
                for (const bh of brandHeaders) {
                    abmGroups[abmName].brand_targets[bh] = 0;
                    abmGroups[abmName].achievement_qty[bh] = 0;
                }
            }

            const grp = abmGroups[abmName];
            grp.branch_count += 1;
            if (r.state) grp.states.add(r.state.trim());
            if (r.zone) grp.zones.add(r.zone.trim());
            grp.period_target += Number(r.period_target || 0);

            for (const bh of brandHeaders) {
                grp.brand_targets[bh] += Number(r.brand_targets?.[bh] || 0);
                grp.achievement_qty[bh] += Number(r.achievement_qty?.[bh] || 0);
            }
        }

        let serialAbm = 1;
        abmRecords = Object.values(abmGroups).map((g) => {
            const achPct = {};
            for (const bh of brandHeaders) {
                const tgt = g.brand_targets[bh] || 0;
                const ach = g.achievement_qty[bh] || 0;
                achPct[bh] = tgt > 0 ? Number(((ach / tgt) * 100).toFixed(2)) : 0.00;
            }

            const stateList = Array.from(g.states).filter(Boolean);
            const stateStr = stateList.length === 1 ? stateList[0] : (stateList.length > 1 ? stateList.join(', ') : '—');

            const zoneList = Array.from(g.zones).filter(Boolean);
            const zoneStr = zoneList.length === 1 ? zoneList[0] : (zoneList.length > 1 ? zoneList.join(', ') : '—');

            return {
                id: `abm-${serialAbm}`,
                s_no: serialAbm++,
                abm_name: g.abm_name,
                branch_count: g.branch_count,
                state: stateStr,
                zone: zoneStr,
                period_target: g.period_target,
                brand_targets: g.brand_targets,
                achievement_qty: g.achievement_qty,
                achievement_pct: achPct
            };
        });

        // Sort ABMs alphabetically, placing 'Unassigned' at bottom
        abmRecords.sort((a, b) => {
            if (a.abm_name === 'Unassigned') return 1;
            if (b.abm_name === 'Unassigned') return -1;
            return a.abm_name.localeCompare(b.abm_name);
        });
        // Re-index s_no after sort
        abmRecords.forEach((item, idx) => { item.s_no = idx + 1; });

        // Calculate grand totals for ABM records
        for (const r of abmRecords) {
            abmTotals.branch_count += r.branch_count;
            abmTotals.period_target += r.period_target;
            for (const bh of brandHeaders) {
                abmTotals.brand_targets[bh] += r.brand_targets[bh] || 0;
                abmTotals.achievement_qty[bh] += r.achievement_qty[bh] || 0;
            }
        }

        for (const bh of brandHeaders) {
            const tgt = abmTotals.brand_targets[bh] || 0;
            const ach = abmTotals.achievement_qty[bh] || 0;
            abmTotals.achievement_pct[bh] = tgt > 0 ? Number(((ach / tgt) * 100).toFixed(2)) : 0.00;
        }
    }

    return {
        master: {
            id: master.id,
            title: master.title,
            start_date: startDate,
            end_date: endDate,
            status: master.status,
            created_at: master.timestamp
        },
        brand_headers: brandHeaders,
        individual_brands: individualBrands,
        other_brands: otherBrandsList,
        records,
        totals: grandTotals,
        abm_records: abmRecords,
        abm_totals: abmTotals,
        user_context: {
            is_admin: isAdmin,
            is_abm: isAbm,
            can_view_abm_tab: canViewAbmTab,
            user_name: userProfile?.userName || '',
            abm_name: isAbm ? (userProfile?.userName || '') : null
        }
    };
};

module.exports = {
    createSpecialTvaTable,
    createSpecialTvaDataTable,
    seedBranchesForSpecialTva,
    createSpecialTvaEntry,
    getAllSpecialTvas,
    getSpecialTvaById,
    updateSpecialTva,
    deleteSpecialTva,
    upsertSpecialTvaTargets,
    getSpecialTvaReportData
};

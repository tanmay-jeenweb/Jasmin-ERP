const db = require("../config/db.js");

const createUsersTable = async () => {

    const query = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(150) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'user',
            user_type_id INT DEFAULT NULL,
            mob_no VARCHAR(20) DEFAULT NULL,
            date_of_join DATE DEFAULT NULL,
            device_verification_required BOOLEAN DEFAULT TRUE,
            device_id VARCHAR(255) DEFAULT NULL,
            modules JSON DEFAULT NULL,
            active BOOLEAN DEFAULT TRUE,
            state JSON DEFAULT NULL,
            city VARCHAR(255) DEFAULT NULL,
            branch JSON DEFAULT NULL,
            product_type JSON DEFAULT NULL,
            landing_type JSON DEFAULT NULL,
            web_access BOOLEAN DEFAULT TRUE,
            mobile_access BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP
        )
    `;

    await db.execute(query);

    const columnsToEnsure = [
        {
            name: 'user_type_id',
            query: 'ALTER TABLE users ADD COLUMN user_type_id INT DEFAULT NULL'
        },
        {
            name: 'mob_no',
            query: 'ALTER TABLE users ADD COLUMN mob_no VARCHAR(20) DEFAULT NULL'
        },
        {
            name: 'date_of_join',
            query: 'ALTER TABLE users ADD COLUMN date_of_join DATE DEFAULT NULL'
        },
        {
            name: 'device_verification_required',
            query: 'ALTER TABLE users ADD COLUMN device_verification_required BOOLEAN DEFAULT TRUE'
        },
        {
            name: 'username',
            query: 'ALTER TABLE users ADD COLUMN username VARCHAR(50) DEFAULT NULL'
        },
        {
            name: 'active',
            query: 'ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT TRUE'
        },
        {
            name: 'state',
            query: 'ALTER TABLE users ADD COLUMN state JSON DEFAULT NULL'
        },
        {
            name: 'city',
            query: 'ALTER TABLE users ADD COLUMN city VARCHAR(255) DEFAULT NULL'
        },
        {
            name: 'branch',
            query: 'ALTER TABLE users ADD COLUMN branch JSON DEFAULT NULL'
        },
        {
            name: 'product_type',
            query: 'ALTER TABLE users ADD COLUMN product_type JSON DEFAULT NULL'
        },
        {
            name: 'landing_type',
            query: 'ALTER TABLE users ADD COLUMN landing_type JSON DEFAULT NULL'
        },
        {
            name: 'brand',
            query: 'ALTER TABLE users ADD COLUMN brand JSON DEFAULT NULL'
        },
        {
            name: 'plain_password',
            query: 'ALTER TABLE users ADD COLUMN plain_password VARCHAR(255) DEFAULT NULL'
        },
        {
            name: 'web_access',
            query: 'ALTER TABLE users ADD COLUMN web_access BOOLEAN DEFAULT TRUE'
        },
        {
            name: 'mobile_access',
            query: 'ALTER TABLE users ADD COLUMN mobile_access BOOLEAN DEFAULT TRUE'
        }
    ];

    for (const column of columnsToEnsure) {
        const [rows] = await db.execute(`SHOW COLUMNS FROM users LIKE '${column.name}'`);
        if (rows.length === 0) {
            await db.execute(column.query);
        } else if (column.name === 'landing_type' && !rows[0].Type.includes('json')) {
            try {
                // Safely convert any non-JSON string values to array JSON format (e.g. 'GST DP' -> '["GST DP"]')
                await db.execute(`
                    UPDATE users 
                    SET landing_type = CONCAT('["', REPLACE(landing_type, '"', '\\"'), '"]') 
                    WHERE landing_type IS NOT NULL AND landing_type != '' AND (JSON_VALID(landing_type) = 0 OR landing_type NOT LIKE '[%')
                `);
                await db.execute(`
                    UPDATE users 
                    SET landing_type = NULL 
                    WHERE landing_type = ''
                `);
            } catch (err) {
                console.warn("Could not sanitize landing_type values before conversion:", err.message);
            }
            await db.execute('ALTER TABLE users MODIFY COLUMN landing_type JSON DEFAULT NULL');
        }
    }

    // Migrate existing users without landing_type to default '["All"]'
    try {
        await db.execute(`
            UPDATE users 
            SET landing_type = '["All"]' 
            WHERE landing_type IS NULL OR landing_type = '' OR landing_type = '[]'
        `);
    } catch (err) {
        console.warn("Could not migrate null landing_type for existing users:", err.message);
    }

    // Add UNIQUE index on username if not already present
    try {
        const [indexes] = await db.execute(`SHOW INDEX FROM users WHERE Key_name = 'username'`);
        if (indexes.length === 0) {
            await db.execute(`
                UPDATE users
                SET username = CONCAT('user_', id)
                WHERE username IS NULL OR username = ''
            `);
            await db.execute(`ALTER TABLE users ADD UNIQUE INDEX username (username)`);
        }
    } catch (e) {
        console.warn("Could not add username unique index (may already exist):", e.message);
    }

    console.log("Users table ready");
};

const initUserModel = async () => {
    await createUsersTable();
};

const createUser = async (
    name,
    username,
    email,
    hashedPassword,
    userTypeId = null,
    mobNo = null,
    dateOfJoin = null,
    deviceVerificationRequired = true,
    active = true,
    role = 'user',
    state = null,
    city = null,
    branch = null,
    productType = null,
    landingType = null,
    brand = null,
    plainPassword = null,
    webAccess = true,
    mobileAccess = true
) => {

    const query = `
        INSERT INTO users
        (name, username, email, password, user_type_id, mob_no, date_of_join, device_verification_required, active, role, state, city, branch, product_type, landing_type, brand, plain_password, web_access, mobile_access)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(query, [
        name,
        username,
        email,
        hashedPassword,
        userTypeId,
        mobNo,
        dateOfJoin,
        deviceVerificationRequired ? 1 : 0,
        active ? 1 : 0,
        role,
        state ? JSON.stringify(state) : null,
        city,
        branch ? JSON.stringify(branch) : null,
        productType ? JSON.stringify(productType) : null,
        landingType ? JSON.stringify(landingType) : null,
        brand ? JSON.stringify(brand) : null,
        plainPassword,
        webAccess ? 1 : 0,
        mobileAccess ? 1 : 0
    ]);

    return result;
};

const findUserByEmail = async (email) => {

    const query = `
        SELECT * FROM users
        WHERE email = ?
    `;

    const [rows] = await db.execute(query, [email]);

    return rows[0];
};

const findUserByUsername = async (username) => {
    const query = `
        SELECT * FROM users
        WHERE username = ?
    `;

    const [rows] = await db.execute(query, [username]);
    return rows[0];
};

const getAllUsers = async (includeInactive = false) => {
    const whereClause = includeInactive 
        ? "WHERE u.role != 'super admin' OR u.role IS NULL" 
        : "WHERE u.active = TRUE AND (u.role != 'super admin' OR u.role IS NULL)";
    const query = `
        SELECT 
            u.id, u.name, u.username, u.email,
            u.user_type_id, u.mob_no, u.date_of_join, u.device_verification_required,
            ut.type_name AS user_type_name, u.active,
            u.state, u.city, u.branch, u.product_type, u.landing_type, u.brand,
            u.web_access, u.mobile_access
        FROM users u
        LEFT JOIN user_types ut ON u.user_type_id = ut.id
        ${whereClause}
    `;

    const [rows] = await db.execute(query);
    return rows;
};

const updateUserProfile = async (userId, name, email, mob_no) => {
    const query = `UPDATE users SET name = ?, email = ?, mob_no = ? where id = ?`;

    const [result] = await db.execute(query, [
        name,
        email,
        mob_no,
        userId
    ]);

    return result;
};

const getUserById = async (id) => {
    const query = `SELECT * FROM users WHERE id = ?`;
    const [rows] = await db.execute(query, [id]);
    if (rows[0] && rows[0].role === 'super admin') {
        return null;
    }
    return rows[0];
};

const toggleUserActive = async (id, active) => {
    const query = `UPDATE users SET active = ? WHERE id = ?`;
    const [result] = await db.execute(query, [active ? 1 : 0, id]);
    return result;
};

module.exports = {
    initUserModel,
    createUsersTable,
    createUser,
    findUserByEmail,
    findUserByUsername,
    getAllUsers,
    updateUserProfile,
    getUserById,
    toggleUserActive
};
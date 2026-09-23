const db = require('../config/db.js');

const createTicketTypeTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS ticket_type_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL UNIQUE,
            added_by INT NOT NULL,
            device_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);
    console.log("Ticket type master table ready");
};

const createTicketType = async (name, addedBy, deviceId) => {
    const query = `
        INSERT INTO ticket_type_master (name, added_by, device_id)
        VALUES (?, ?, ?)
    `;
    const [result] = await db.execute(query, [name, addedBy, deviceId]);
    return result;
};

const getAllTicketTypes = async () => {
    const query = `
        SELECT
            ttm.id,
            ttm.name,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            ttm.device_id,
            ttm.created_at,
            ttm.updated_at
        FROM ticket_type_master ttm
        LEFT JOIN users u ON ttm.added_by = u.id
        ORDER BY ttm.name ASC
    `;
    const [results] = await db.execute(query);
    return results;
};

const getTicketTypeById = async (id) => {
    const query = `
        SELECT id, name, added_by, device_id, created_at, updated_at
        FROM ticket_type_master
        WHERE id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

const getTicketTypeByName = async (name) => {
    const query = `
        SELECT id, name
        FROM ticket_type_master
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
    `;
    const [rows] = await db.execute(query, [name]);
    return rows[0] || null;
};

const updateTicketType = async (id, name) => {
    const query = `
        UPDATE ticket_type_master
        SET name = ?
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [name, id]);
    return result;
};

const countSubTicketsByTicketTypeId = async (ticketTypeId) => {
    try {
        const query = `SELECT COUNT(*) as count FROM sub_ticket_type_master WHERE ticket_type_id = ?`;
        const [rows] = await db.execute(query, [ticketTypeId]);
        return rows[0]?.count || 0;
    } catch (e) {
        // Table might not exist yet during initialization
        return 0;
    }
};

const deleteTicketType = async (id) => {
    const query = `DELETE FROM ticket_type_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

module.exports = {
    createTicketTypeTable,
    createTicketType,
    getAllTicketTypes,
    getTicketTypeById,
    getTicketTypeByName,
    updateTicketType,
    countSubTicketsByTicketTypeId,
    deleteTicketType
};

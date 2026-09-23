const db = require('../config/db.js');

const verifyExternalApi = async (req, res, next) => {
    try {
        const useridHeader = req.headers['userid'];
        const securitycodeHeader = req.headers['securitycode'];

        const expectedUserid = process.env.EXTERNAL_API_USERID || process.env.MODEL_API_USERID || 'WebSite';
        const expectedSecuritycode = process.env.EXTERNAL_API_SECURITYCODE || process.env.MODEL_API_SECURITYCODE || '1151-8111-6444-4166';

        if (!useridHeader || !securitycodeHeader || useridHeader !== expectedUserid || securitycodeHeader !== expectedSecuritycode) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized. Invalid API headers.'
            });
        }

        // Mock an admin user object to bypass permission checks and provide details for audit logging
        const [rows] = await db.execute(
            "SELECT id, name, username FROM users WHERE (role = 'super admin' OR role = 'admin') AND active = 1 LIMIT 1"
        );

        if (rows.length === 0) {
            return res.status(500).json({
                success: false,
                message: 'System Error: No active administrator found in database to associate with sync transaction.'
            });
        }

        req.user = {
            id: rows[0].id,
            name: 'System Sync (CRM)',
            username: 'crm_sync',
            role: 'super admin', // Gives super admin role to pass is_admin check in controllers
            user_type_id: null
        };

        next();
    } catch (error) {
        console.error('Error verifying external API credentials:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during verification.'
        });
    }
};

module.exports = verifyExternalApi;

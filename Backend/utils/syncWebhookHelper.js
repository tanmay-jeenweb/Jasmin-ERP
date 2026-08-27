/**
 * Sends mapping or code updates asynchronously to Jasmin CRM
 * @param {string|number} branchId - The target Branch ID
 * @param {'mappings' | 'finance-codes'} type - The payload type
 * @param {object} payload - The sync data object
 */
const syncToCrm = async (branchId, type, payload) => {
    try {
        const crmBaseUrl = process.env.CRM_API_URL || 'https://crm-api.jasminmobile.com';
        const expectedUserid = process.env.EXTERNAL_API_USERID || process.env.MODEL_API_USERID || 'WebSite';
        const expectedSecuritycode = process.env.EXTERNAL_API_SECURITYCODE || process.env.MODEL_API_SECURITYCODE || '1151-8111-6444-4166';

        const endpoint = type === 'mappings' 
            ? `${crmBaseUrl}/v1/api/franchise/sync-relations/${branchId}`
            : `${crmBaseUrl}/v1/api/franchise/sync-finance-codes/${branchId}`;

        console.log(`[Sync] Initiating webhook request to CRM: POST ${endpoint}`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'userid': expectedUserid,
                'securitycode': expectedSecuritycode,
                'x-sync-source': 'JASMIN-ERP',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`[Sync Error] Webhook responded with status: ${response.status} ${response.statusText}`);
            const errorText = await response.text().catch(() => '');
            console.error(`[Sync Error Response]: ${errorText}`);
        } else {
            console.log(`[Sync Success] Sync complete for branch ${branchId} (${type})`);
        }
    } catch (error) {
        console.error(`[Sync Error] Failed to sync ${type} for branch ${branchId}:`, error.message);
    }
};

module.exports = { syncToCrm };

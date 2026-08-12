const { getUserById } = require('../models/userModel.js');

const checkUserStateAccess = async (reqUser, targetStateId, targetStateName) => {
    if (!reqUser) return false;

    // Admins and Super Admins have access to everything
    if (reqUser.role === 'admin' || reqUser.role === 'super admin') {
        return true;
    }

    // Fetch latest user details from DB to get state array
    let dbUser = null;
    try {
        dbUser = await getUserById(reqUser.id);
    } catch (e) {
        dbUser = reqUser;
    }

    if (!dbUser) return false;

    if (dbUser.role === 'admin' || dbUser.role === 'super admin') {
        return true;
    }

    let userState = dbUser.state;
    if (typeof userState === 'string') {
        try {
            userState = JSON.parse(userState);
        } catch (e) {
            userState = [userState];
        }
    }

    // If user state is not configured, or contains "All", allow access to all formats
    if (!userState || !Array.isArray(userState) || userState.length === 0 || userState.includes("All")) {
        return true;
    }

    // Normalize user state values to lower-case strings for matching
    const userStateNormalized = userState.map(s => String(s).trim().toLowerCase());

    // Support targetStateName as comma-separated or array
    let targetNames = [];
    if (targetStateName) {
        if (typeof targetStateName === 'string') {
            targetNames = targetStateName.split(',').map(s => s.trim().toLowerCase());
        } else if (Array.isArray(targetStateName)) {
            targetNames = targetStateName.map(s => String(s).trim().toLowerCase());
        }
    }

    // Support targetStateId as JSON array, comma-separated or number/string
    let targetIds = [];
    if (targetStateId !== undefined && targetStateId !== null) {
        if (Array.isArray(targetStateId)) {
            targetIds = targetStateId.map(id => String(id).trim().toLowerCase());
        } else if (typeof targetStateId === 'string' && targetStateId.startsWith('[')) {
            try {
                targetIds = JSON.parse(targetStateId).map(id => String(id).trim().toLowerCase());
            } catch (e) {
                targetIds = [targetStateId.trim().toLowerCase()];
            }
        } else if (typeof targetStateId === 'string') {
            targetIds = targetStateId.split(',').map(id => id.trim().toLowerCase());
        } else {
            targetIds = [String(targetStateId).trim().toLowerCase()];
        }
    }

    // If any of the target states are in user's authorized states, grant access
    const hasNameAccess = targetNames.some(name => userStateNormalized.includes(name));
    const hasIdAccess = targetIds.some(id => userStateNormalized.includes(id));

    return hasNameAccess || hasIdAccess;
};

module.exports = {
    checkUserStateAccess
};

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
    const targetNameLower = targetStateName ? String(targetStateName).trim().toLowerCase() : '';
    const targetIdStr = targetStateId !== undefined && targetStateId !== null ? String(targetStateId).trim().toLowerCase() : '';

    return (
        (targetNameLower && userStateNormalized.includes(targetNameLower)) ||
        (targetIdStr && userStateNormalized.includes(targetIdStr))
    );
};

module.exports = {
    checkUserStateAccess
};

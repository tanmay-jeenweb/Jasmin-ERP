/**
 * Determines whether a user has permission to view a specific column based on landing types.
 *
 * Rules:
 * 1. Admins and Super Admins have unrestricted access to all columns.
 * 2. If a column allows "All" landing types, any user can view it.
 * 3. If a user has "All" in their landing types (or no landing type restrictions), they can view all columns.
 * 4. Otherwise, the column is visible only if the user's landing types overlap with the column's allowed landing types.
 */
const canUserViewColumn = (col, user) => {
    if (!col) return false;

    // Admin / Super Admin always have full access
    if (user && (user.role === 'admin' || user.role === 'super admin')) {
        return true;
    }

    const allowedLandingTypes = col.landing_types && Array.isArray(col.landing_types) && col.landing_types.length > 0
        ? col.landing_types
        : ["All"];

    if (allowedLandingTypes.includes("All")) {
        return true;
    }

    let userLandingTypes = user?.landing_type;
    if (typeof userLandingTypes === "string") {
        try {
            userLandingTypes = JSON.parse(userLandingTypes);
        } catch (e) {
            userLandingTypes = [userLandingTypes];
        }
    }

    if (!userLandingTypes || !Array.isArray(userLandingTypes) || userLandingTypes.length === 0) {
        return true;
    }

    if (userLandingTypes.includes("All")) {
        return true;
    }

    return userLandingTypes.some(ult => allowedLandingTypes.includes(ult));
};

/**
 * Filters dynamic columns and sanitizes data records according to the user's landing type.
 * Ensures unauthorized column definitions and their respective field values in data rows
 * are completely omitted from the API response payload.
 */
const filterPriceListByLandingType = (columns, data, user) => {
    if (!columns || !Array.isArray(columns)) {
        return { columns: [], data: data || [] };
    }

    // Admins and Super Admins bypass column stripping
    if (user && (user.role === 'admin' || user.role === 'super admin')) {
        return { columns, data: data || [] };
    }

    const allowedColumns = columns.filter(col => canUserViewColumn(col, user));
    const forbiddenColumns = columns.filter(col => !canUserViewColumn(col, user));
    const forbiddenColNames = forbiddenColumns.map(col => col.column_name).filter(Boolean);

    let sanitizedData = data;
    if (forbiddenColNames.length > 0 && Array.isArray(data)) {
        sanitizedData = data.map(row => {
            if (!row || typeof row !== 'object') return row;
            const newRow = { ...row };
            for (const colName of forbiddenColNames) {
                delete newRow[colName];
            }
            return newRow;
        });
    }

    return {
        columns: allowedColumns,
        data: sanitizedData
    };
};

module.exports = {
    canUserViewColumn,
    filterPriceListByLandingType
};

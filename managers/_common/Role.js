/**
 * Role enum for role-based access control.
 * Provides static role constants and validation.
 */
class Role {
    static SUPERADMIN = "superadmin";
    static SCHOOL_ADMIN = "school_admin";

    static isValid(role) {
        return [Role.SUPERADMIN, Role.SCHOOL_ADMIN].includes(role);
    }

    static all() {
        return [Role.SUPERADMIN, Role.SCHOOL_ADMIN];
    }
}

module.exports = Role;

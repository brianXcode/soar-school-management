const Role = require('../managers/_common/Role');

module.exports = ({ meta, config, managers }) => {
    return ({ req, res, next, results }) => {
        const decoded = results.__longToken;

        if (!decoded) {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 401,
                message: 'Unauthorized',
            });
        }

        // Superadmin has access to everything
        if (decoded.role === Role.SUPERADMIN) {
            return next({ schoolId: null, role: decoded.role });
        }

        // School admin must have a schoolId
        if (decoded.role === Role.SCHOOL_ADMIN) {
            if (!decoded.schoolId) {
                return managers.responseDispatcher.dispatch(res, {
                    ok: false,
                    code: 403,
                    message: 'Forbidden: no school assigned',
                });
            }
            return next({ schoolId: decoded.schoolId, role: decoded.role });
        }

        return managers.responseDispatcher.dispatch(res, {
            ok: false,
            code: 403,
            message: 'Forbidden: insufficient permissions',
        });
    };
};

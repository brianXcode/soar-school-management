const Role = require('../managers/_common/Role');

module.exports = ({ meta, config, managers }) => {
    return ({ req, res, next, results }) => {
        const decoded = results.__longToken;
        if (!decoded || decoded.role !== Role.SUPERADMIN) {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: 'Forbidden: superadmin access required',
            });
        }
        next(decoded);
    };
};

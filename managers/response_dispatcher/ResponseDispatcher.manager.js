module.exports = class ResponseDispatcher {
    dispatch(res, { ok, data, errors, code, message }) {
        let statusCode;
        if (code) {
            statusCode = code;
        } else if (ok) {
            statusCode = 200;
        } else {
            statusCode = 400;
        }

        const response = {
            ok,
        };

        if (data) response.data = data;
        if (errors) response.errors = errors;
        if (message) response.message = message;

        res.status(statusCode).json(response);
    }
};
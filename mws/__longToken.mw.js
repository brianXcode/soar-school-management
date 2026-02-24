module.exports = ({meta, config, managers})=>{
    return ({req, res, next})=>{
        try {
            const token = req.headers.token;
            if(!token){
                return managers.responseDispatcher.dispatch(res, {
                    ok: false,
                    code: 401,
                    message: 'Missing authorization token',
                });
            }
            let decoded = managers.token.verifyLongToken({token});
            if(!decoded){
                return managers.responseDispatcher.dispatch(res, {
                    ok: false,
                    code: 401,
                    message: 'Invalid or expired token',
                });
            }
            next(decoded);
        } catch(err){
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 401,
                message: 'Token verification failed',
            });
        }
    }
}
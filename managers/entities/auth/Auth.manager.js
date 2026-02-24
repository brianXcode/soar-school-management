const Role = require('../../_common/Role');
const Logger = require('../../logger/Logger.manager');

module.exports = class Auth {
    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.cortex = cortex;
        this.managers = managers;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.tokenManager = managers.token;
        this.logger = new Logger({ config });
        this.httpExposed = ['register', 'login'];
    }

    async register({ username, email, password, role }) {
        const data = { username, email, password };

        // Basic payload validation
        let result = await this.validators.auth.register(data);
        if (result) return { errors: result };

        // Delegate creation to the User manager
        const creationResult = await this.managers.user.createUser({
            username, email, password, role
        });

        // If the User manager returned an error (e.g. duplicate email, invalid role, invalid school)
        if (creationResult.error) {
            return creationResult;
        }

        const user = creationResult.user;

        try {
            // Generate token with role info
            const longToken = this.tokenManager.genLongToken({
                userId: user._id.toString(),
                userKey: user.username,
                role: user.role,
                schoolId: user.schoolId ? user.schoolId.toString() : null,
            });

            this.logger.info('User registered and token generated', { userId: user._id, role });

            return {
                user,
                longToken,
            };
        } catch (err) {
            this.logger.error('Registration token generation failed', err);
            return { error: 'Registration failed during token generation' };
        }
    }

    async login({ email, password }) {
        const data = { email, password };

        // Validate input
        let result = await this.validators.auth.login(data);
        if (result) return { errors: result };

        try {
            const user = await this.mongomodels.User.findOne({ email });
            if (!user) {
                return { error: 'Invalid email or password' };
            }

            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return { error: 'Invalid email or password' };
            }

            const longToken = this.tokenManager.genLongToken({
                userId: user._id.toString(),
                userKey: user.username,
                role: user.role,
                schoolId: user.schoolId ? user.schoolId.toString() : null,
            });

            this.logger.info('User logged in', { userId: user._id });

            return {
                user: user.toJSON(),
                longToken,
            };
        } catch (err) {
            this.logger.error('Login failed', err);
            return { error: 'Login failed' };
        }
    }
};

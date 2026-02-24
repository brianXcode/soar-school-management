const Role = require('../../_common/Role');
const Logger = require('../../logger/Logger.manager');

module.exports = class User {
    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.cortex = cortex;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.logger = new Logger({ config });
        // Expose createUser so it could be called via API if needed (e.g. by a superadmin explicitly creating users)
        this.httpExposed = ['createUser', 'put=assignSchool'];
    }

    /**
     * Handles the actual creation and database insertion of a User.
     * This is called by the Auth manager during registration.
     */
    async createUser({ username, email, password, role, schoolId }) {
        // Enforce basic schema validation
        const data = { username, email, password };
        let result = await this.validators.user.createUser(data);
        if (result) return { errors: result };

        // Enforce role validation
        if (!role || !Role.isValid(role)) {
            return { error: `Invalid role. Must be one of: ${Role.all().join(', ')}` };
        }

        try {
            // Check for existing user
            const existingUser = await this.mongomodels.User.findOne({
                $or: [{ email }, { username }],
            });

            if (existingUser) {
                return { error: 'User with this email or username already exists' };
            }

            // If schoolId is provided, verify school exists
            if (schoolId) {
                const school = await this.mongomodels.School.findById(schoolId);
                if (!school || school.isDeleted) {
                    return { error: 'School not found' };
                }
            }

            // Create user (password hashing handled by mongoose pre-save hook)
            const user = await this.mongomodels.User.create({
                username,
                email,
                password,
                role,
                schoolId: schoolId || null,
            });

            this.logger.info('User created in database', { userId: user._id, role });

            return { user: user.toJSON() };
        } catch (err) {
            this.logger.error('Database failed to create user', err);
            return { error: 'Failed to create user in database' };
        }
    }

    /**
     * Assign a school to a school_admin user. Superadmin only.
     */
    async assignSchool({ __longToken, __superadmin, userId, schoolId }) {
        if (!userId) return { error: 'userId is required' };
        if (!schoolId) return { error: 'schoolId is required' };

        try {
            // Find the target user
            const user = await this.mongomodels.User.findOne({ _id: userId, isDeleted: false });
            if (!user) return { error: 'User not found' };

            // Only school_admin users can be assigned a school
            if (user.role !== Role.SCHOOL_ADMIN) {
                return { error: 'Only school_admin users can be assigned a school' };
            }

            // Verify the school exists
            const school = await this.mongomodels.School.findOne({ _id: schoolId, isDeleted: false });
            if (!school) return { error: 'School not found' };

            // Assign the school
            user.schoolId = schoolId;
            await user.save();

            this.logger.info('School assigned to admin', { userId, schoolId });

            return { user: user.toJSON(), message: 'School assigned successfully' };
        } catch (err) {
            this.logger.error('Failed to assign school', err);
            return { error: 'Failed to assign school' };
        }
    }
};

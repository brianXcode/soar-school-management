const Role = require('../../_common/Role');
const Logger = require('../../logger/Logger.manager');

module.exports = class School {
    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.cortex = cortex;
        this.cache = cache;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.logger = new Logger({ config });
        this.httpExposed = [
            'post=createSchool',
            'get=getSchools',
            'get=getSchool',
            'put=updateSchool',
            'delete=deleteSchool',
        ];
    }

    async createSchool({ __longToken, __superadmin, name, address, phone, email, website, established, description }) {
        const data = { name, address };
        let result = await this.validators.school.createSchool(data);
        if (result) return { errors: result };

        try {
            const school = await this.mongomodels.School.create({
                name,
                address,
                phone,
                email,
                website,
                established,
                description,
                createdBy: __longToken.userId,
            });

            this.logger.info('School created', { schoolId: school._id, createdBy: __longToken.userId });

            // Invalidate list cache
            await this.cache.key.delete({ key: 'schools:list' }).catch(() => {});

            return school;
        } catch (err) {
            this.logger.error('Failed to create school', err);
            return { error: 'Failed to create school' };
        }
    }

    async getSchools({ __longToken, __schoolAdmin, __query, page, limit }) {
        // School admins can only see their assigned school
        if (__longToken.role === Role.SCHOOL_ADMIN) {
            if (!__schoolAdmin || !__schoolAdmin.schoolId) {
                return { error: 'No school assigned to your account' };
            }
            try {
                const school = await this.mongomodels.School.findOne({
                    _id: __schoolAdmin.schoolId,
                    isDeleted: false,
                }).lean();
                if (!school) return { error: 'Assigned school not found' };
                return {
                    schools: [school],
                    pagination: { page: 1, limit: 1, total: 1, pages: 1 },
                };
            } catch (err) {
                this.logger.error('Failed to get school for admin', err);
                return { error: 'Failed to retrieve school' };
            }
        }

        // Superadmin: list all schools
        page = parseInt(page || __query.page) || 1;
        limit = parseInt(limit || __query.limit) || 10;
        const skip = (page - 1) * limit;

        try {
            // Try cache first for page 1
            if (page === 1) {
                const cached = await this.cache.key.get({ key: 'schools:list' });
                if (cached) return JSON.parse(cached);
            }

            const [schools, total] = await Promise.all([
                this.mongomodels.School.find({ isDeleted: false })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                this.mongomodels.School.countDocuments({ isDeleted: false }),
            ]);

            const result = {
                schools,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            };

            // Cache page 1 for 5 minutes
            if (page === 1) {
                await this.cache.key.set({
                    key: 'schools:list',
                    data: JSON.stringify(result),
                    ttl: 300,
                }).catch(() => {});
            }

            return result;
        } catch (err) {
            this.logger.error('Failed to get schools', err);
            return { error: 'Failed to retrieve schools' };
        }
    }

    async getSchool({ __longToken, __schoolAdmin, __query, id }) {
        // Extract id from query if not in body
        id = id || __query.id;
        if (!id) return { error: 'School ID is required' };

        // School admins can only view their own school
        if (__longToken.role === Role.SCHOOL_ADMIN) {
            if (!__schoolAdmin || __schoolAdmin.schoolId !== id) {
                return { error: 'Forbidden: you can only view your assigned school' };
            }
        }

        try {
            // Try cache
            const cached = await this.cache.key.get({ key: `school:${id}` });
            if (cached) return JSON.parse(cached);

            const school = await this.mongomodels.School.findOne({
                _id: id,
                isDeleted: false,
            }).lean();

            if (!school) return { error: 'School not found' };

            // Cache for 5 minutes
            await this.cache.key.set({
                key: `school:${id}`,
                data: JSON.stringify(school),
                ttl: 300,
            }).catch(() => {});

            return school;
        } catch (err) {
            this.logger.error('Failed to get school', err);
            return { error: 'Failed to retrieve school' };
        }
    }

    async updateSchool({ __longToken, __superadmin, __query, id, name, address, phone, email, website, established, description }) {
        // Extract id from query if not in body
        id = id || __query.id;
        if (!id) return { error: 'School ID is required' };

        const updateData = {};
        if (name) updateData.name = name;
        if (address) updateData.address = address;
        if (phone) updateData.phone = phone;
        if (email) updateData.email = email;
        if (website) updateData.website = website;
        if (established) updateData.established = established;
        if (description) updateData.description = description;

        if (Object.keys(updateData).length === 0) {
            return { error: 'No fields to update' };
        }

        try {
            const school = await this.mongomodels.School.findOneAndUpdate(
                { _id: id, isDeleted: false },
                { $set: updateData },
                { new: true, runValidators: true }
            ).lean();

            if (!school) return { error: 'School not found' };

            this.logger.info('School updated', { schoolId: id });

            // Invalidate cache
            await this.cache.key.delete({ key: `school:${id}` }).catch(() => {});
            await this.cache.key.delete({ key: 'schools:list' }).catch(() => {});

            return school;
        } catch (err) {
            this.logger.error('Failed to update school', err);
            return { error: 'Failed to update school' };
        }
    }

    async deleteSchool({ __longToken, __superadmin, __query, id }) {
        // Extract id from query if not in body
        id = id || __query.id;
        if (!id) return { error: 'School ID is required' };

        try {
            // Check for existing classrooms/students
            const [classroomCount, studentCount] = await Promise.all([
                this.mongomodels.Classroom.countDocuments({ school: id, isDeleted: false }),
                this.mongomodels.Student.countDocuments({ school: id, isDeleted: false }),
            ]);

            if (classroomCount > 0 || studentCount > 0) {
                return {
                    error: `Cannot delete school with ${classroomCount} classrooms and ${studentCount} active students. Remove or transfer them first.`,
                };
            }

            const school = await this.mongomodels.School.findOneAndUpdate(
                { _id: id, isDeleted: false },
                { $set: { isDeleted: true } },
                { new: true }
            );

            if (!school) return { error: 'School not found' };

            this.logger.info('School deleted', { schoolId: id });

            // Invalidate cache
            await this.cache.key.delete({ key: `school:${id}` }).catch(() => {});
            await this.cache.key.delete({ key: 'schools:list' }).catch(() => {});

            return { message: 'School deleted successfully' };
        } catch (err) {
            this.logger.error('Failed to delete school', err);
            return { error: 'Failed to delete school' };
        }
    }
};

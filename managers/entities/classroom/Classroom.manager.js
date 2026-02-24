const Role = require('../../_common/Role');
const Logger = require('../../logger/Logger.manager');

module.exports = class Classroom {
    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.cortex = cortex;
        this.cache = cache;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.logger = new Logger({ config });
        this.httpExposed = [
            'post=createClassroom',
            'get=getClassrooms',
            'get=getClassroom',
            'put=updateClassroom',
            'delete=deleteClassroom',
        ];
    }

    _getSchoolScope(__longToken, __schoolAdmin, schoolId) {
        // Superadmins can specify any school; school_admins are limited to theirs
        if (__longToken.role === Role.SUPERADMIN) {
            return schoolId || null;
        }
        return __schoolAdmin.schoolId;
    }

    async createClassroom({ __longToken, __schoolAdmin, name, capacity, resources, grade, section, schoolId }) {
        const data = { name, capacity };
        let result = await this.validators.classroom.createClassroom(data);
        if (result) return { errors: result };

        const targetSchoolId = this._getSchoolScope(__longToken, __schoolAdmin, schoolId);
        if (!targetSchoolId) return { error: 'School ID is required' };

        try {
            // Verify school exists
            const school = await this.mongomodels.School.findOne({ _id: targetSchoolId, isDeleted: false });
            if (!school) return { error: 'School not found' };

            const classroom = await this.mongomodels.Classroom.create({
                name,
                school: targetSchoolId,
                capacity,
                resources: resources || [],
                grade,
                section,
                createdBy: __longToken.userId,
            });

            this.logger.info('Classroom created', { classroomId: classroom._id, schoolId: targetSchoolId });

            return classroom;
        } catch (err) {
            if (err.code === 11000) {
                return { error: 'A classroom with this name already exists in this school' };
            }
            this.logger.error('Failed to create classroom', err);
            return { error: 'Failed to create classroom' };
        }
    }

    async getClassrooms({ __longToken, __schoolAdmin, __query, schoolId, page, limit }) {
        // Extract params from query if not in body
        schoolId = schoolId || __query.schoolId;
        page = parseInt(page || __query.page) || 1;
        limit = parseInt(limit || __query.limit) || 10;

        const targetSchoolId = this._getSchoolScope(__longToken, __schoolAdmin, schoolId);
        if (!targetSchoolId) return { error: 'School ID is required' };
        const skip = (page - 1) * limit;

        try {
            const query = { school: targetSchoolId, isDeleted: false };
            const [classrooms, total] = await Promise.all([
                this.mongomodels.Classroom.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                this.mongomodels.Classroom.countDocuments(query),
            ]);

            return {
                classrooms,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            };
        } catch (err) {
            this.logger.error('Failed to get classrooms', err);
            return { error: 'Failed to retrieve classrooms' };
        }
    }

    async getClassroom({ __longToken, __schoolAdmin, __query, id }) {
        // Extract id from query if not in body
        id = id || __query.id;
        if (!id) return { error: 'Classroom ID is required' };

        try {
            const classroom = await this.mongomodels.Classroom.findOne({
                _id: id,
                isDeleted: false,
            }).lean();

            if (!classroom) return { error: 'Classroom not found' };

            // School admin scope check
            if (__longToken.role === Role.SCHOOL_ADMIN &&
                classroom.school.toString() !== __schoolAdmin.schoolId) {
                return { error: 'Forbidden: classroom belongs to another school' };
            }

            return classroom;
        } catch (err) {
            this.logger.error('Failed to get classroom', err);
            return { error: 'Failed to retrieve classroom' };
        }
    }

    async updateClassroom({ __longToken, __schoolAdmin, __query, id, name, capacity, resources, grade, section }) {
        // Extract id from query if not in body
        id = id || __query.id;
        if (!id) return { error: 'Classroom ID is required' };

        try {
            const classroom = await this.mongomodels.Classroom.findOne({ _id: id, isDeleted: false });
            if (!classroom) return { error: 'Classroom not found' };

            // School admin scope check
            if (__longToken.role === Role.SCHOOL_ADMIN &&
                classroom.school.toString() !== __schoolAdmin.schoolId) {
                return { error: 'Forbidden: classroom belongs to another school' };
            }

            const updateData = {};
            if (name) updateData.name = name;
            if (capacity) updateData.capacity = capacity;
            if (resources) updateData.resources = resources;
            if (grade) updateData.grade = grade;
            if (section) updateData.section = section;

            if (Object.keys(updateData).length === 0) {
                return { error: 'No fields to update' };
            }

            const updated = await this.mongomodels.Classroom.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true, runValidators: true }
            ).lean();

            this.logger.info('Classroom updated', { classroomId: id });
            return updated;
        } catch (err) {
            if (err.code === 11000) {
                return { error: 'A classroom with this name already exists in this school' };
            }
            this.logger.error('Failed to update classroom', err);
            return { error: 'Failed to update classroom' };
        }
    }

    async deleteClassroom({ __longToken, __schoolAdmin, __query, id }) {
        // Extract id from query if not in body
        id = id || __query.id;
        if (!id) return { error: 'Classroom ID is required' };

        try {
            const classroom = await this.mongomodels.Classroom.findOne({ _id: id, isDeleted: false });
            if (!classroom) return { error: 'Classroom not found' };

            // School admin scope check
            if (__longToken.role === Role.SCHOOL_ADMIN &&
                classroom.school.toString() !== __schoolAdmin.schoolId) {
                return { error: 'Forbidden: classroom belongs to another school' };
            }

            // Check for active students
            const studentCount = await this.mongomodels.Student.countDocuments({
                classroom: id,
                isDeleted: false,
            });

            if (studentCount > 0) {
                return { error: `Cannot delete classroom with ${studentCount} active students. Transfer them first.` };
            }

            await this.mongomodels.Classroom.findByIdAndUpdate(id, { $set: { isDeleted: true } });

            this.logger.info('Classroom deleted', { classroomId: id });
            return { message: 'Classroom deleted successfully' };
        } catch (err) {
            this.logger.error('Failed to delete classroom', err);
            return { error: 'Failed to delete classroom' };
        }
    }
};

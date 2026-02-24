const Role = require('../../_common/Role');
const Logger = require('../../logger/Logger.manager');

module.exports = class Student {
    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.cortex = cortex;
        this.cache = cache;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.logger = new Logger({ config });
        this.httpExposed = [
            'post=createStudent',
            'get=getStudents',
            'get=getStudent',
            'put=updateStudent',
            'delete=deleteStudent',
            'post=transferStudent',
        ];
    }

    _getSchoolScope(__longToken, __schoolAdmin, schoolId) {
        if (__longToken.role === Role.SUPERADMIN) {
            return schoolId || null;
        }
        return __schoolAdmin.schoolId;
    }

    async createStudent({ __longToken, __schoolAdmin, firstName, lastName, email, dateOfBirth, classroomId, schoolId, guardianInfo }) {
        const data = { firstName, lastName, email };
        let result = await this.validators.student.createStudent(data);
        if (result) return { errors: result };

        const targetSchoolId = this._getSchoolScope(__longToken, __schoolAdmin, schoolId);
        if (!targetSchoolId) return { error: 'School ID is required' };

        try {
            // Verify school
            const school = await this.mongomodels.School.findOne({ _id: targetSchoolId, isDeleted: false });
            if (!school) return { error: 'School not found' };

            // Verify classroom if provided
            if (classroomId) {
                const classroom = await this.mongomodels.Classroom.findOne({
                    _id: classroomId,
                    school: targetSchoolId,
                    isDeleted: false,
                });
                if (!classroom) return { error: 'Classroom not found in this school' };

                // Check capacity
                const currentCount = await this.mongomodels.Student.countDocuments({
                    classroom: classroomId,
                    isDeleted: false,
                    status: 'active',
                });
                if (currentCount >= classroom.capacity) {
                    return { error: 'Classroom is at full capacity' };
                }
            }

            // Check duplicate email
            const existing = await this.mongomodels.Student.findOne({ email });
            if (existing) return { error: 'Student with this email already exists' };

            const student = await this.mongomodels.Student.create({
                firstName,
                lastName,
                email,
                dateOfBirth,
                school: targetSchoolId,
                classroom: classroomId || null,
                guardianInfo: guardianInfo || {},
                enrolledBy: __longToken.userId,
            });

            this.logger.info('Student enrolled', { studentId: student._id, schoolId: targetSchoolId });
            return student;
        } catch (err) {
            this.logger.error('Failed to create student', err);
            return { error: 'Failed to enroll student' };
        }
    }

    async getStudents({ __longToken, __schoolAdmin, __query, schoolId, classroomId, status, page, limit }) {
        // Extract params from query if not in body
        schoolId = schoolId || __query.schoolId;
        classroomId = classroomId || __query.classroomId;
        status = status || __query.status;
        page = parseInt(page || __query.page) || 1;
        limit = parseInt(limit || __query.limit) || 20;

        const targetSchoolId = this._getSchoolScope(__longToken, __schoolAdmin, schoolId);
        if (!targetSchoolId) return { error: 'School ID is required' };

        const skip = (page - 1) * limit;

        try {
            const query = { school: targetSchoolId, isDeleted: false };
            if (classroomId) query.classroom = classroomId;
            if (status) query.status = status;

            const [students, total] = await Promise.all([
                this.mongomodels.Student.find(query)
                    .populate('classroom', 'name grade section')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                this.mongomodels.Student.countDocuments(query),
            ]);

            return {
                students,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            };
        } catch (err) {
            this.logger.error('Failed to get students', err);
            return { error: 'Failed to retrieve students' };
        }
    }

    async getStudent({ __longToken, __schoolAdmin, __query, id }) {
        // Extract id from query if not in body
        id = id || __query.id;
        if (!id) return { error: 'Student ID is required' };

        try {
            const student = await this.mongomodels.Student.findOne({
                _id: id,
                isDeleted: false,
            })
                .populate('classroom', 'name grade section')
                .populate('school', 'name')
                .lean();

            if (!student) return { error: 'Student not found' };

            // Scope check
            if (__longToken.role === Role.SCHOOL_ADMIN &&
                student.school._id.toString() !== __schoolAdmin.schoolId) {
                return { error: 'Forbidden: student belongs to another school' };
            }

            return student;
        } catch (err) {
            this.logger.error('Failed to get student', err);
            return { error: 'Failed to retrieve student' };
        }
    }

    async updateStudent({ __longToken, __schoolAdmin, __query, id, firstName, lastName, email, dateOfBirth, classroomId, guardianInfo }) {
        // Extract id from query if not in body
        id = id || __query.id;
        if (!id) return { error: 'Student ID is required' };

        try {
            const student = await this.mongomodels.Student.findOne({ _id: id, isDeleted: false });
            if (!student) return { error: 'Student not found' };

            // Scope check
            if (__longToken.role === Role.SCHOOL_ADMIN &&
                student.school.toString() !== __schoolAdmin.schoolId) {
                return { error: 'Forbidden: student belongs to another school' };
            }

            const updateData = {};
            if (firstName) updateData.firstName = firstName;
            if (lastName) updateData.lastName = lastName;
            if (email) updateData.email = email;
            if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
            if (classroomId) updateData.classroom = classroomId;
            if (guardianInfo) updateData.guardianInfo = guardianInfo;

            if (Object.keys(updateData).length === 0) {
                return { error: 'No fields to update' };
            }

            // If changing classroom, check capacity
            if (classroomId && classroomId !== student.classroom?.toString()) {
                const classroom = await this.mongomodels.Classroom.findOne({
                    _id: classroomId,
                    school: student.school,
                    isDeleted: false,
                });
                if (!classroom) return { error: 'Target classroom not found' };

                const currentCount = await this.mongomodels.Student.countDocuments({
                    classroom: classroomId,
                    isDeleted: false,
                    status: 'active',
                });
                if (currentCount >= classroom.capacity) {
                    return { error: 'Target classroom is at full capacity' };
                }
            }

            const updated = await this.mongomodels.Student.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true, runValidators: true }
            ).lean();

            this.logger.info('Student updated', { studentId: id });
            return updated;
        } catch (err) {
            this.logger.error('Failed to update student', err);
            return { error: 'Failed to update student' };
        }
    }

    async deleteStudent({ __longToken, __schoolAdmin, __query, id }) {
        // Extract id from query if not in body
        id = id || __query.id;
        if (!id) return { error: 'Student ID is required' };

        try {
            const student = await this.mongomodels.Student.findOne({ _id: id, isDeleted: false });
            if (!student) return { error: 'Student not found' };

            // Scope check
            if (__longToken.role === Role.SCHOOL_ADMIN &&
                student.school.toString() !== __schoolAdmin.schoolId) {
                return { error: 'Forbidden: student belongs to another school' };
            }

            await this.mongomodels.Student.findByIdAndUpdate(id, { $set: { isDeleted: true } });

            this.logger.info('Student deleted', { studentId: id });
            return { message: 'Student removed successfully' };
        } catch (err) {
            this.logger.error('Failed to delete student', err);
            return { error: 'Failed to delete student' };
        }
    }

    async transferStudent({ __longToken, __schoolAdmin, id, targetSchoolId, targetClassroomId }) {
        if (!id) return { error: 'Student ID is required' };
        if (!targetSchoolId && !targetClassroomId) {
            return { error: 'Target school or classroom is required' };
        }

        try {
            const student = await this.mongomodels.Student.findOne({ _id: id, isDeleted: false });
            if (!student) return { error: 'Student not found' };

            // Scope check — only admin of current school OR superadmin can transfer
            if (__longToken.role === Role.SCHOOL_ADMIN &&
                student.school.toString() !== __schoolAdmin.schoolId) {
                return { error: 'Forbidden: student belongs to another school' };
            }

            // CRITICAL: School admins can only transfer within their own school
            if (__longToken.role === Role.SCHOOL_ADMIN && targetSchoolId) {
                if (targetSchoolId !== __schoolAdmin.schoolId) {
                    return { error: 'Forbidden: school admins can only transfer students within their own school' };
                }
            }

            const updateData = { status: 'transferred' };

            if (targetSchoolId) {
                // Only superadmins can transfer between schools
                if (__longToken.role === Role.SCHOOL_ADMIN) {
                    return { error: 'Forbidden: only superadmins can transfer students between schools' };
                }

                const targetSchool = await this.mongomodels.School.findOne({
                    _id: targetSchoolId,
                    isDeleted: false,
                });
                if (!targetSchool) return { error: 'Target school not found' };
                updateData.school = targetSchoolId;
                updateData.status = 'active'; // Re-enroll at new school
            }

            if (targetClassroomId) {
                const sId = targetSchoolId || student.school;
                const targetClassroom = await this.mongomodels.Classroom.findOne({
                    _id: targetClassroomId,
                    school: sId,
                    isDeleted: false,
                });
                if (!targetClassroom) return { error: 'Target classroom not found' };

                // Check capacity
                const currentCount = await this.mongomodels.Student.countDocuments({
                    classroom: targetClassroomId,
                    isDeleted: false,
                    status: 'active',
                });
                if (currentCount >= targetClassroom.capacity) {
                    return { error: 'Target classroom is at full capacity' };
                }
                updateData.classroom = targetClassroomId;
                updateData.status = 'active';
            }

            const updated = await this.mongomodels.Student.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true }
            ).lean();

            this.logger.info('Student transferred', {
                studentId: id,
                from: student.school,
                to: targetSchoolId || student.school,
            });

            return updated;
        } catch (err) {
            this.logger.error('Failed to transfer student', err);
            return { error: 'Failed to transfer student' };
        }
    }
};

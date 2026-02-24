module.exports = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Soar School Management System API',
            version: '1.0.0',
            description: 'RESTful API for managing schools, classrooms, and students with role-based access control.',
            contact: {
                name: 'API Support',
            },
        },
        servers: (function() {
            const servers = [];
            if (process.env.DEPLOY_URL) {
                servers.push({
                    url: process.env.DEPLOY_URL,
                    description: 'Deployed server',
                });
            }
            servers.push({
                url: `http://localhost:${process.env.USER_PORT || 5111}`,
                description: 'Local development server',
            });
            return servers;
        })(),
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'token',
                    description: 'JWT long token',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        ok: { type: 'boolean', example: false },
                        message: { type: 'string' },
                        errors: { type: 'array', items: { type: 'string' } },
                    },
                },
                Success: {
                    type: 'object',
                    properties: {
                        ok: { type: 'boolean', example: true },
                        data: { type: 'object' },
                    },
                },
                RegisterRequest: {
                    type: 'object',
                    required: ['username', 'email', 'password', 'role'],
                    properties: {
                        username: { type: 'string', minLength: 3, maxLength: 20 },
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string', minLength: 8 },
                        role: { type: 'string', enum: ['superadmin', 'school_admin'] },
                    },
                },
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string' },
                    },
                },
                School: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        name: { type: 'string' },
                        address: { type: 'string' },
                        phone: { type: 'string' },
                        email: { type: 'string' },
                        website: { type: 'string' },
                        established: { type: 'string', format: 'date' },
                        description: { type: 'string' },
                        createdBy: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                Classroom: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        name: { type: 'string' },
                        school: { type: 'string' },
                        capacity: { type: 'integer' },
                        resources: { type: 'array', items: { type: 'string' } },
                        grade: { type: 'string' },
                        section: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                Student: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        firstName: { type: 'string' },
                        lastName: { type: 'string' },
                        email: { type: 'string' },
                        dob: { type: 'string', format: 'date' },
                        school: { type: 'string' },
                        classroom: { type: 'string' },
                        enrollmentDate: { type: 'string', format: 'date' },
                        status: { type: 'string', enum: ['active', 'transferred', 'graduated'] },
                        guardianInfo: { type: 'object' },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
            },
        },
        paths: {
            '/api/auth/register': {
                post: {
                    tags: ['Authentication'],
                    summary: 'Register a new user',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
                    },
                    responses: {
                        200: { description: 'User registered successfully' },
                        400: { description: 'Validation error' },
                    },
                },
            },
            '/api/auth/login': {
                post: {
                    tags: ['Authentication'],
                    summary: 'Login and get JWT token',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
                    },
                    responses: {
                        200: { description: 'Login successful, returns token' },
                        400: { description: 'Invalid credentials' },
                    },
                },
            },
            '/api/user/assignSchool': {
                put: {
                    tags: ['Users'],
                    summary: 'Assign a school to a school_admin user (superadmin only)',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['userId', 'schoolId'],
                                    properties: {
                                        userId: { type: 'string', description: 'ID of the school_admin user' },
                                        schoolId: { type: 'string', description: 'ID of the school to assign' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'School assigned successfully' },
                        403: { description: 'Forbidden - superadmin only' },
                        400: { description: 'Validation error' },
                    },
                },
            },
            '/api/school/createSchool': {
                post: {
                    tags: ['Schools'],
                    summary: 'Create a new school (superadmin only)',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['name', 'address'],
                                    properties: {
                                        name: { type: 'string' },
                                        address: { type: 'string' },
                                        phone: { type: 'string' },
                                        email: { type: 'string' },
                                        website: { type: 'string' },
                                        established: { type: 'string', format: 'date' },
                                        description: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'School created successfully' },
                        403: { description: 'Forbidden - superadmin only' },
                    },
                },
            },
            '/api/school/getSchools': {
                get: {
                    tags: ['Schools'],
                    summary: 'List all schools (paginated)',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    ],
                    responses: { 200: { description: 'List of schools' } },
                },
            },
            '/api/school/getSchool': {
                get: {
                    tags: ['Schools'],
                    summary: 'Get school by ID',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
                    ],
                    responses: {
                        200: { description: 'School details' },
                        404: { description: 'School not found' },
                    },
                },
            },
            '/api/school/updateSchool': {
                put: {
                    tags: ['Schools'],
                    summary: 'Update a school (superadmin only)',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'id', in: 'query', required: true, schema: { type: 'string' }, description: 'School ID' },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        address: { type: 'string' },
                                        phone: { type: 'string' },
                                        email: { type: 'string' },
                                        website: { type: 'string' },
                                        established: { type: 'string', format: 'date' },
                                        description: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { 200: { description: 'School updated' }, 403: { description: 'Forbidden' } },
                },
            },
            '/api/school/deleteSchool': {
                delete: {
                    tags: ['Schools'],
                    summary: 'Delete a school (superadmin only)',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
                    ],
                    responses: { 200: { description: 'School deleted' }, 403: { description: 'Forbidden' } },
                },
            },
            '/api/classroom/createClassroom': {
                post: {
                    tags: ['Classrooms'],
                    summary: 'Create a classroom (school_admin)',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['name', 'capacity'],
                                    properties: {
                                        name: { type: 'string' },
                                        capacity: { type: 'integer' },
                                        resources: { type: 'array', items: { type: 'string' } },
                                        grade: { type: 'string' },
                                        section: { type: 'string' },
                                        schoolId: { type: 'string', description: 'For superadmin targeting specific school' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { 200: { description: 'Classroom created' }, 403: { description: 'Forbidden' } },
                },
            },
            '/api/classroom/getClassrooms': {
                get: {
                    tags: ['Classrooms'],
                    summary: 'List classrooms (school-scoped)',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'schoolId', in: 'query', schema: { type: 'string' } },
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    ],
                    responses: { 200: { description: 'List of classrooms' } },
                },
            },
            '/api/classroom/getClassroom': {
                get: {
                    tags: ['Classrooms'],
                    summary: 'Get classroom by ID',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
                    ],
                    responses: { 200: { description: 'Classroom details' }, 404: { description: 'Not found' } },
                },
            },
            '/api/classroom/updateClassroom': {
                put: {
                    tags: ['Classrooms'],
                    summary: 'Update a classroom',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
                    ],
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        capacity: { type: 'integer' },
                                        resources: { type: 'array', items: { type: 'string' } },
                                        grade: { type: 'string' },
                                        section: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { 200: { description: 'Classroom updated' }, 403: { description: 'Forbidden' } },
                },
            },
            '/api/classroom/deleteClassroom': {
                delete: {
                    tags: ['Classrooms'],
                    summary: 'Delete a classroom',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
                    ],
                    responses: { 200: { description: 'Classroom deleted' }, 403: { description: 'Forbidden' } },
                },
            },
            '/api/student/createStudent': {
                post: {
                    tags: ['Students'],
                    summary: 'Enroll a student (school_admin)',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['firstName', 'lastName', 'email'],
                                    properties: {
                                        firstName: { type: 'string' },
                                        lastName: { type: 'string' },
                                        email: { type: 'string' },
                                        dob: { type: 'string', format: 'date' },
                                        classroomId: { type: 'string' },
                                        schoolId: { type: 'string' },
                                        guardianInfo: { type: 'object' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { 200: { description: 'Student enrolled' }, 403: { description: 'Forbidden' } },
                },
            },
            '/api/student/getStudents': {
                get: {
                    tags: ['Students'],
                    summary: 'List students (school-scoped)',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'schoolId', in: 'query', schema: { type: 'string' } },
                        { name: 'classroomId', in: 'query', schema: { type: 'string' } },
                        { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'transferred', 'graduated'] } },
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    ],
                    responses: { 200: { description: 'List of students' } },
                },
            },
            '/api/student/getStudent': {
                get: {
                    tags: ['Students'],
                    summary: 'Get student by ID',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
                    ],
                    responses: { 200: { description: 'Student details' }, 404: { description: 'Not found' } },
                },
            },
            '/api/student/updateStudent': {
                put: {
                    tags: ['Students'],
                    summary: 'Update student details',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
                    ],
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        firstName: { type: 'string' },
                                        lastName: { type: 'string' },
                                        email: { type: 'string' },
                                        dob: { type: 'string', format: 'date' },
                                        classroomId: { type: 'string' },
                                        guardianInfo: { type: 'object' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { 200: { description: 'Student updated' }, 403: { description: 'Forbidden' } },
                },
            },
            '/api/student/deleteStudent': {
                delete: {
                    tags: ['Students'],
                    summary: 'Delete a student (soft delete)',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
                    ],
                    responses: { 200: { description: 'Student deleted' }, 403: { description: 'Forbidden' } },
                },
            },
            '/api/student/transferStudent': {
                post: {
                    tags: ['Students'],
                    summary: 'Transfer a student to another school/classroom',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['id'],
                                    properties: {
                                        id: { type: 'string' },
                                        targetSchoolId: { type: 'string' },
                                        targetClassroomId: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { 200: { description: 'Student transferred' }, 403: { description: 'Forbidden' } },
                },
            },
        },
    },
    apis: [],
};

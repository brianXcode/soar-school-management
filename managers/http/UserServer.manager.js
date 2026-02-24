const http              = require('http');
const express           = require('express');
const cors              = require('cors');
const helmet            = require('helmet');
const compression       = require('compression');
const app               = express();

module.exports = class UserServer {
    constructor({config, managers}){
        this.config        = config;
        this.userApi       = managers.userApi;
    }
    
    /** for injecting middlewares */
    use(args){
        app.use(args);
    }

    /** server configs */
    run(){
        /** Security headers - CSP configured to allow Swagger UI */
        app.use(helmet({
            strictTransportSecurity: false,
            contentSecurityPolicy: {
                directives: {
                    defaultSrc:    ["'self'", 'https:'],
                    scriptSrc:     ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'],
                    scriptSrcAttr: ["'unsafe-inline'"],
                    styleSrc:      ["'self'", "'unsafe-inline'", 'https:'],
                    imgSrc:        ["'self'", 'data:', 'https:'],
                    connectSrc:    ["'self'", 'https:'],
                    fontSrc:       ["'self'", 'https:', 'data:'],
                    objectSrc:     ["'none'"],
                },
            },
            crossOriginOpenerPolicy: false,
        }));

        /** Gzip compression */
        app.use(compression());

        app.use(cors({origin: '*'}));
        app.use(express.json({ limit: '10mb' }));
        app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        app.use('/static', express.static('public'));

        /** Health check */
        app.get('/health', (req, res) => {
            res.status(200).json({ ok: true, message: 'Server is running' });
        });

        /** Swagger documentation (loaded if swagger is configured) */
        try {
            const swaggerJsdoc = require('swagger-jsdoc');
            const swaggerUi = require('swagger-ui-express');
            const swaggerConfig = require('../../config/swagger.config');
            const specs = swaggerJsdoc(swaggerConfig);
            app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
                explorer: true,
                customCss: '.swagger-ui .topbar { display: none }',
            }));
            console.log('📚  Swagger docs available at /api-docs');
        } catch(err) {
            console.log('Swagger not configured, skipping /api-docs');
        }

        /** a single middleware to handle all */
        app.all('/api/:moduleName/:fnName', this.userApi.mw);

        /** an error handler - must be LAST */
        app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).json({
                ok: false,
                message: 'Internal server error',
                errors: [],
            });
        });
        
        let server = http.createServer(app);
        server.listen(this.config.dotEnv.USER_PORT, () => {
            console.log(`${(this.config.dotEnv.SERVICE_NAME).toUpperCase()} is running on port: ${this.config.dotEnv.USER_PORT}`);
        });
    }
}
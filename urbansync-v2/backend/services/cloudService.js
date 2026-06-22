const {minioClient} = require('../config/minio.config');
const rabbitmqConsumer = require('./rabbitmq-consumer');
// ── Models now live at ../models/ (one level up from services/) ───────────
const Notification = require('../models/notification');
const Building = require('../models/building');

const {withRetry} = require('../resilience/retryHelper');
const {minioBreaker} = require('../resilience/circuitBreaker');

// ── REPLACE uploadToMinIO() ────────────────────────────────────────────────
/**
 * uploadToMinIO — stores a file buffer in the MinIO 'receipts' bucket.
 *
 * PATTERN: RETRY
 *   Retries up to 3 times on transient S3 errors (network blips,
 *   temporary MinIO overload). Uses exponential back-off.
 *
 * PATTERN: CIRCUIT BREAKER (minioBreaker)
 *   If MinIO is persistently unreachable, the circuit opens and
 *   uploadToMinIO() fast-fails with a typed error instead of
 *   hanging until the multer-s3 TCP timeout expires.
 */

class CloudService {
    constructor() {
        this.minioClient = minioClient;
        this.rabbitmqConsumer = rabbitmqConsumer;
        this.isInitialized = false;
    }

    /**
     * Initialize all cloud services (MinIO + RabbitMQ)
     */
    async init() {
        try {
            console.log('🚀 Initializing Cloud Services...');
            
            // MinIO is already initialized in minio.config.js
            await this.verifyMinIO();
            
            // Connect to RabbitMQ
            await this.rabbitmqConsumer.connect();
            
            this.isInitialized = true;
            console.log('✅ Cloud Services initialized successfully');
            
        } catch (error) {
            console.error('❌ Cloud Services initialization failed:', error);
            // Don't throw - allow server to start and retry connections
            console.log('⚠️  Server will continue without cloud services');
        }
    }

    /**
     * Verify MinIO connection and bucket
     */
    async verifyMinIO() {
        const bucketName = process.env.MINIO_BUCKET || 'receipts';
        return withRetry(
        async () => {
            const exists = await this.minioClient.bucketExists(bucketName);
            if (exists) {
                console.log(`✅ [MinIO] Bucket '${bucketName}' verified`);
            } else {
                console.warn(`⚠️  [MinIO] Bucket '${bucketName}' not found`);
            }
        },
        { retries: 5, minTimeout: 2000, maxTimeout: 10000 },
        'MinIO-BucketVerify'
        );
    }
    // ── NEW: getPresignedUrl() — used by server.js receipt endpoint ────────────
    /**
        * getPresignedUrl — generates a presigned GET URL for a stored receipt.
        *
        * PATTERN: CIRCUIT BREAKER (minioBreaker)
        *   Protects the HTTP route from hanging when MinIO is down.
        *   Returns a fast 503 via the breaker fallback.
    */
    async getPresignedUrl(bucket, fileName, expirySeconds = 3600) {
    return minioBreaker.fire(async () => {
        return this.minioClient.presignedGetObject(bucket, fileName, expirySeconds);
    });
    }
    /**
     * Start consuming building alarms from Thingsboard
     */
    async consumeBuildingAlarms() {
        console.log('📡 Starting Building Alarms consumer...');
        
        await this.rabbitmqConsumer.consumeAlarms(async (alarm) => {
            try {
                await this.processBuildingAlarm(alarm);
            } catch (error) {
                console.error('Error processing building alarm:', error);
            }
        });
    }

    /**
     * Process building alarm and save to database
     */
    async processBuildingAlarm(alarm) {
        console.log('🔔 Processing alarm:', alarm);
        
        try {
            // Parse alarm data from Thingsboard
            // The structure depends on how Thingsboard sends the data
            const alarmType = this.determineAlarmType(alarm);
            const severity = this.determineSeverity(alarm);
            const message = alarm.message || alarm.alarmType || 'Building alarm triggered';
            
            // Find the building based on device/entity info in alarm
            // This is a placeholder - adjust based on your Thingsboard setup
            const building = await this.findBuildingFromAlarm(alarm);
            
            if (building) {
                // Find building administrator to notify
                // ── Path fixed: ../models/building (was ../../models/building) ──
                const buildingData = await Building.findById(building).populate({
                    path: 'profile',
                    populate: { path: 'user' }
                });
                
                if (buildingData && buildingData.profile && buildingData.profile.user) {
                    // Create notification
                    const notification = new Notification({
                        user: buildingData.profile.user._id,
                        building: building,
                        type: alarmType,
                        severity: severity,
                        message: message,
                        thingsboardData: alarm,
                        isRead: false
                    });
                    
                    await notification.save();
                    console.log('✅ Notification saved to database');
                } else {
                    console.log('⚠️  No administrator found for building');
                }
            } else {
                console.log('⚠️  Building not found for alarm');
            }
            
        } catch (error) {
            console.error('Error saving notification:', error);
            throw error;
        }
    }

    /**
     * Start consuming MinIO events
     */
    async consumeMinIOEvents() {
        console.log('☁️  Starting MinIO Events consumer...');
        
        await this.rabbitmqConsumer.consumeMinIOEvents(async (event) => {
            try {
                await this.processMinIOEvent(event);
            } catch (error) {
                console.error('Error processing MinIO event:', error);
            }
        });
    }

    /**
     * Process MinIO upload event
     */
    async processMinIOEvent(event) {
        try {
            const record = event.Records?.[0];
            const bucket = record?.s3?.bucket?.name;
            const key = record?.s3?.object?.key;
            const size = record?.s3?.object?.size;
            const eventName = record?.eventName;
            
            console.log('MinIO Event Details:');
            console.log(`Bucket: ${bucket}`);
            console.log(`File: ${key}`);
            console.log(`Size: ${size} bytes`);
            console.log(`Event: ${eventName}`);
            
            // TODO: Add additional processing:
            // - Update expense record with file metadata
            // - Generate thumbnails for images
            // - Extract text from PDFs (OCR)
            // - Send notification to administrators
            
        } catch (error) {
            console.error('Error processing MinIO event:', error);
            throw error;
        }
    }

    /**
     * Upload file to MinIO
     */
    async uploadToMinIO(fileName, fileBuffer, metadata = {}) {
        const bucketName = process.env.MINIO_BUCKET || 'receipts';
        return withRetry(
            async(bail) => {
                if (minioBreaker.opened) {
                    bail(new Error('MinIO circuit OPEN - upload aborted'));
                    return;
            }
            //fire through ciruit breaker
            return minioBreaker.fire(async () => {
                await this.minioClient.putObject(
                    bucketName,
                    fileName,
                    fileBuffer,
                    metadata
                );
                console.log(`[MinIO] File uploaded:: ${fileName}`); 
                return {
                    bucket: bucketName,
                    key: fileName,
                    url: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${bucketName}/${fileName}`
                };
            });
            },
            {
                retries:    3,minTimeout: 2000, maxTimeout: 5000},
                'minIO-Upload'
            );
    }

    /**
     * Helper: Determine alarm type from Thingsboard data
     */
    determineAlarmType(alarm) {
        const alarmType = alarm.alarmType || alarm.type || '';
        
        if (alarmType.includes('fuel') || alarmType.includes('consumption')) {
            return 'low_fuel';
        } else if (alarmType.includes('temperature')) {
            return 'high_temperature';
        } else if (alarmType.includes('battery')) {
            return 'battery_low';
        } else if (alarmType.includes('offline') || alarmType.includes('connection')) {
            return 'sensor_offline';
        }
        
        return 'general_alarm';
    }

    /**
     * Helper: Determine severity from Thingsboard data
     */
    determineSeverity(alarm) {
        const severity = alarm.severity || alarm.level || '';
        
        if (severity.includes('CRITICAL') || severity.includes('critical')) {
            return 'critical';
        } else if (severity.includes('WARNING') || severity.includes('warning')) {
            return 'warning';
        }
        
        return 'info';
    }

    /**
     * Helper: Find building from alarm data
     */
    async findBuildingFromAlarm(alarm) {
        try {
            // This is a placeholder implementation
            // You'll need to adjust based on how Thingsboard identifies buildings
            
            // Option 1: If alarm contains building ID directly
            if (alarm.buildingId) {
                return alarm.buildingId;
            }
            
            // Option 2: If alarm contains device/entity info
            // Query your building model to find matching building
            
            // For now, return null - this needs to be customized
            return null;
            
        } catch (error) {
            console.error('Error finding building from alarm:', error);
            return null;
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('🛑 Shutting down Cloud Services...');
        await this.rabbitmqConsumer.close();
        console.log('✅ Cloud Services shut down complete');
    }
}

// Export singleton instance
module.exports = new CloudService();

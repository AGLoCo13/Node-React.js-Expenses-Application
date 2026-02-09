const Minio = require('minio');

// Create MinIO client for internal operations (backend-to-minio)
const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'password123'
});

// Create MinIO client for presigned URLs (browser access)
// This uses the external endpoint so signatures match
const externalEndpoint = process.env.MINIO_EXTERNAL_ENDPOINT || process.env.MINIO_ENDPOINT || 'localhost:9000';
const [externalHost, externalPort] = externalEndpoint.split(':');

const minioClientExternal = new Minio.Client({
    endPoint: externalHost,
    port: parseInt(externalPort) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'password123'
});

// Initialize bucket if it doesn't exist
const initBucket = async () => {
    const bucketName = process.env.MINIO_BUCKET || 'receipts';
    try {
        const exists = await minioClient.bucketExists(bucketName);
        if (!exists) {
            await minioClient.makeBucket(bucketName, 'us-east-1');
            console.log(`✅ MinIO bucket '${bucketName}' created successfully`);
        } else {
            console.log(`✅ MinIO bucket '${bucketName}' already exists`);
        }
    } catch (error) {
        console.error('❌ Error initializing MinIO bucket:', error);
    }
};

// Call initialization
initBucket();

module.exports = {
    minioClient,           // For internal backend operations (uploads, bucket checks)
    minioClientExternal    // For generating presigned URLs (browser access)
};

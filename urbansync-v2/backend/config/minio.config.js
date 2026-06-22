const Minio = require('minio');
const { S3Client } = require('@aws-sdk/client-s3');

// Native MinIO client — used for presigned URLs, bucket ops, putObject
const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'password123'
});

// AWS SDK S3Client — required by multer-s3 v3
const s3Client = new S3Client({
    endpoint: `http${process.env.MINIO_USE_SSL === 'true' ? 's' : ''}://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || 9000}`,
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'admin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'password123'
    },
    forcePathStyle: true
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

initBucket();

module.exports = { minioClient, s3Client };

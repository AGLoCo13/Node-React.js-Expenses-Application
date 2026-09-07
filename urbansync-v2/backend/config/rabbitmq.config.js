module.exports = {
    url: process.env.RABBITMQ_URL || 'amqp://user:password@localhost:5672',
    queues: {
        alarms: 'building-alarms',
        alarmsDlq: 'building-alarms.dlq',
        receipts: 'receipts-processing'
    },
    exchanges: {
        minioEvents: 'minio-events'
    }
};

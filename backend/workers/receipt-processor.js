const amqp = require('amqplib');
const rabbitmqConfig = require('../config/rabbitmq.config');

async function startReceiptProcessor() {
    try {
        console.log('🚀 Starting Receipt Processor Worker...');
        
        const connection = await amqp.connect(rabbitmqConfig.url);
        const channel = await connection.createChannel();
        
        const queue = rabbitmqConfig.queues.receipts;
        await channel.assertQueue(queue, { durable: true });
        
        console.log(`✅ Receipt Processor connected`);
        console.log(`🎧 Listening on queue: ${queue}`);
        console.log('Waiting for receipt upload events...\n');
        
        channel.consume(queue, (msg) => {
            if (msg !== null) {
                try {
                    const event = JSON.parse(msg.content.toString());
                    
                    // Extract S3 event information
                    const record = event.Records?.[0];
                    const bucket = record?.s3?.bucket?.name;
                    const key = record?.s3?.object?.key;
                    const size = record?.s3?.object?.size;
                    const eventName = record?.eventName;
                    
                    console.log('┌─────────────────────────────────────────────┐');
                    console.log('│  📄 NEW RECEIPT UPLOADED                    │');
                    console.log('├─────────────────────────────────────────────┤');
                    console.log(`│  Bucket:    ${bucket || 'N/A'}`.padEnd(46) + '│');
                    console.log(`│  File:      ${key || 'N/A'}`.padEnd(46) + '│');
                    console.log(`│  Size:      ${size ? (size + ' bytes') : 'N/A'}`.padEnd(46) + '│');
                    console.log(`│  Event:     ${eventName || 'N/A'}`.padEnd(46) + '│');
                    console.log(`│  Time:      ${new Date().toLocaleString()}`.padEnd(46) + '│');
                    console.log('└─────────────────────────────────────────────┘\n');
                    
                    // TODO: Add advanced processing here:
                    // - OCR for text extraction from PDF/Images
                    // - Extract amount, date, vendor from receipt
                    // - Store metadata in MongoDB
                    // - Send notification to admins
                    // - Generate thumbnails for images
                    
                    channel.ack(msg);
                } catch (error) {
                    console.error('❌ Error processing receipt event:', error);
                    channel.ack(msg); // Ack anyway to prevent infinite loop
                }
            }
        });
        
        // Handle connection errors
        connection.on('error', (err) => {
            console.error('❌ Connection error:', err);
        });
        
        connection.on('close', () => {
            console.log('Connection closed. Reconnecting in 5 seconds...');
            setTimeout(startReceiptProcessor, 5000);
        });
        
    } catch (error) {
        console.error('❌ Receipt Processor error:', error);
        console.log('Retrying in 5 seconds...');
        setTimeout(startReceiptProcessor, 5000);
    }
}

// Start the worker if run directly
if (require.main === module) {
    console.log('═══════════════════════════════════════════════');
    console.log('  UrbanSync Receipt Processor Worker');
    console.log('═══════════════════════════════════════════════\n');
    startReceiptProcessor();
}

module.exports = startReceiptProcessor;

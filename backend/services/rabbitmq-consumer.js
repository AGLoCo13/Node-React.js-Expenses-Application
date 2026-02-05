const amqp = require('amqplib');
const rabbitmqConfig = require('../config/rabbitmq.config');

class RabbitMQConsumer {
    constructor() {
        this.connection = null;
        this.channel = null;
    }

    async connect() {
        try {
            this.connection = await amqp.connect(rabbitmqConfig.url);
            this.channel = await this.connection.createChannel();
            console.log('Connected to RabbitMQ');
            
            // Handle connection errors
            this.connection.on('error', (err) => {
                console.error('RabbitMQ connection error:', err);
            });
            
            this.connection.on('close', () => {
                console.log('RabbitMQ connection closed. Reconnecting...');
                setTimeout(() => this.connect(), 5000);
            });
            
            return this.channel;
        } catch (error) {
            console.error('RabbitMQ connection error:', error);
            console.log('Retrying connection in 5 seconds...');
            setTimeout(() => this.connect(), 5000);
            throw error;
        }
    }

    async consumeAlarms(callback) {
        if (!this.channel) await this.connect();
        
        const queue = rabbitmqConfig.queues.alarms;
        await this.channel.assertQueue(queue, { durable: true });
        
        console.log(`Listening for alarms on queue: ${queue}`);
        
        this.channel.consume(queue, async (msg) => {
            if (msg !== null) {
                const content = msg.content.toString();
                console.log(' Alarm received:', content);
                
                try {
                    const alarm = JSON.parse(content);
                    await callback(alarm);
                    this.channel.ack(msg);
                } catch (error) {
                    console.error('Error processing alarm:', error);
                    this.channel.nack(msg, false, false); // Don't requeue
                }
            }
        });
    }

    async consumeReceipts(callback) {
        if (!this.channel) await this.connect();
        
        const queue = rabbitmqConfig.queues.receipts;
        await this.channel.assertQueue(queue, { durable: true });
        
        console.log(`Listening for receipt events on queue: ${queue}`);
        
        this.channel.consume(queue, async (msg) => {
            if (msg !== null) {
                const content = msg.content.toString();
                console.log('Receipt event received');
                
                try {
                    const event = JSON.parse(content);
                    await callback(event);
                    this.channel.ack(msg);
                } catch (error) {
                    console.error('Error processing receipt event:', error);
                    this.channel.nack(msg, false, false);
                }
            }
        });
    }

    async consumeMinIOEvents(callback) {
        if (!this.channel) await this.connect();
        
        const exchange = rabbitmqConfig.exchanges.minioEvents;
        
        // Assert the exchange (should already exist from MinIO configuration)
        await this.channel.assertExchange(exchange, 'fanout', { durable: true });
        
        // Create an exclusive queue for this consumer instance
        const q = await this.channel.assertQueue('', { exclusive: true });
        
        // Bind the queue to the exchange
        await this.channel.bindQueue(q.queue, exchange, '');
        
        console.log(`Listening for MinIO events from exchange: ${exchange}`);
        
        this.channel.consume(q.queue, async (msg) => {
            if (msg !== null) {
                const content = msg.content.toString();
                console.log('MinIO event received');
                
                try {
                    const event = JSON.parse(content);
                    await callback(event);
                    this.channel.ack(msg);
                } catch (error) {
                    console.error('Error processing MinIO event:', error);
                    this.channel.nack(msg, false, false);
                }
            }
        }, { noAck: false });
    }

    async close() {
        try {
            await this.channel?.close();
            await this.connection?.close();
            console.log('RabbitMQ connection closed');
        } catch (error) {
            console.error('Error closing RabbitMQ connection:', error);
        }
    }
}

module.exports = new RabbitMQConsumer();

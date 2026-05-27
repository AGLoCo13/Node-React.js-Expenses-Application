const amqp = require('amqplib');
const rabbitmqConfig = require('../config/rabbitmq.config');

// ── Design Patterns ─────────────────────────────────────────────────────────
const { withRetry }                      = require('../resilience/retryHelper');
const { createBreaker, rabbitMQBreaker } = require('../resilience/circuitBreaker');

class RabbitMQConsumer {
    constructor() {
        this.connection      = null;
        this.channel         = null;
        this._retryScheduled = false; // Guard: prevent concurrent reconnect loops
    }

    /**
     * connect — establishes AMQP connection and channel.
     *
     * PATTERN: CIRCUIT BREAKER (rabbitMQBreaker)
     *   If RabbitMQ is persistently down, rabbitMQBreaker transitions to OPEN
     *   and connect() fast-fails immediately (no TCP timeout wait).
     *
     * PATTERN: RETRY (withRetry inside _scheduleReconnect)
     *   On connection loss, _scheduleReconnect() retries with exponential
     *   back-off (2s → 4s → 8s … 30s) instead of a flat 5s interval.
     */
    async connect() {
        try {
            console.log('🔌 [RabbitMQ] Connecting via circuit breaker...');

            // ── CIRCUIT BREAKER: fast-fail if broker is persistently down ──
            this.connection = await rabbitMQBreaker.fire(rabbitmqConfig.url);
            this.channel    = await this.connection.createChannel();

            console.log('✅ [RabbitMQ] Connected successfully');
            this._retryScheduled = false;

            // ── Connection-level error handling ───────────────────────────
            this.connection.on('error', (err) => {
                console.error('[RabbitMQ] Connection error:', err.message);
                this.connection = null;
                this.channel    = null;
                this._scheduleReconnect();
            });

            this.connection.on('close', () => {
                console.warn('[RabbitMQ] Connection closed — scheduling reconnect...');
                this.connection = null;
                this.channel    = null;
                this._scheduleReconnect();
            });

            return this.channel;
        } catch (error) {
            console.error('[RabbitMQ] connect() failed:', error.message);
            this.connection = null;
            this.channel    = null;
            throw error; // Let caller (_scheduleReconnect / init) handle it
        }
    }

    /**
     * _scheduleReconnect — debounced exponential-backoff reconnection.
     *
     * PATTERN: RETRY
     *   Uses withRetry() with exponential back-off + jitter.
     *   Won't start a second loop if one is already in progress (_retryScheduled guard).
     *   Bails immediately if the circuit breaker is OPEN (no point retrying).
     */
    _scheduleReconnect() {
        if (this._retryScheduled) return;
        this._retryScheduled = true;
        console.log('[RabbitMQ] Scheduling reconnect with exponential back-off...');

        withRetry(
            async (bail) => {
                // If circuit is OPEN, bail early — no point retrying
                if (rabbitMQBreaker.opened) {
                    bail(new Error('RabbitMQ circuit breaker is OPEN — aborting retry loop'));
                    return;
                }
                await this.connect();
            },
            {
                retries:    10,
                minTimeout: 2000,  // 2s initial wait
                maxTimeout: 30000, // 30s cap
                factor:     2,     // Exponential back-off multiplier
                randomize:  true,  // Add jitter to prevent thundering-herd
            },
            'RabbitMQ-Reconnect'
        ).catch((err) => {
            console.error('[RabbitMQ] All reconnect attempts exhausted:', err.message);
            this._retryScheduled = false; // Allow future attempts if CB state changes
        });
    }

    async consumeAlarms(callback) {
        if (!this.channel) await this.connect();

        const queue = rabbitmqConfig.queues.alarms;
        await this.channel.assertQueue(queue, { durable: true });
        console.log(`🎧 [RabbitMQ] Listening for alarms on queue: ${queue}`);

        this.channel.consume(queue, async (msg) => {
            if (msg !== null) {
                try {
                    const alarm = JSON.parse(msg.content.toString());
                    await callback(alarm);
                    this.channel.ack(msg);
                } catch (error) {
                    console.error('[RabbitMQ] Error processing alarm:', error);
                    this.channel.nack(msg, false, false); // Don't requeue
                }
            }
        });
    }

    async consumeReceipts(callback) {
        if (!this.channel) await this.connect();

        const queue = rabbitmqConfig.queues.receipts;
        await this.channel.assertQueue(queue, { durable: true });
        console.log(`🎧 [RabbitMQ] Listening for receipt events on: ${queue}`);

        this.channel.consume(queue, async (msg) => {
            if (msg !== null) {
                try {
                    const event = JSON.parse(msg.content.toString());
                    await callback(event);
                    this.channel.ack(msg);
                } catch (error) {
                    console.error('[RabbitMQ] Error processing receipt event:', error);
                    this.channel.nack(msg, false, false);
                }
            }
        });
    } // ← closing brace for consumeReceipts

    async consumeMinIOEvents(callback) {
        if (!this.channel) await this.connect();

        const exchange = rabbitmqConfig.exchanges.minioEvents;

        // Assert the exchange (should already exist from MinIO configuration)
        await this.channel.assertExchange(exchange, 'topic', { durable: true });

        // Create an exclusive queue for this consumer instance
        const q = await this.channel.assertQueue('', { exclusive: true });

        // Bind the queue to the exchange
        await this.channel.bindQueue(q.queue, exchange, '');
        console.log(`🎧 [RabbitMQ] Listening for MinIO events from exchange: ${exchange}`);

        this.channel.consume(q.queue, async (msg) => {
            if (msg !== null) {
                try {
                    const event = JSON.parse(msg.content.toString());
                    await callback(event);
                    this.channel.ack(msg);
                } catch (error) {
                    console.error('[RabbitMQ] Error processing MinIO event:', error);
                    this.channel.nack(msg, false, false); // Don't requeue
                }
            }
        }, { noAck: false });
    }

    /**
     * Readiness check — returns true when both connection AND channel are live.
     * Used by the /ready probe in server.js (synchronous, no async overhead).
     */
    get isConnected() {
        return !!(this.connection && this.channel);
    }

    async close() {
        try {
            this._retryScheduled = true; // Prevent reconnects during shutdown
            await this.channel?.close();
            await this.connection?.close();
            console.log('✅ [RabbitMQ] Connection closed gracefully');
        } catch (error) {
            console.error('[RabbitMQ] Error closing connection:', error.message);
        }
    }
}

module.exports = new RabbitMQConsumer();

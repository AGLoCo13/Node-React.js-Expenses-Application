# UrbanSync IoT - Integration Guide

## 📊 Current Status

✅ All Docker services are running:
- **RabbitMQ** - http://localhost:15672 (user/password)
- **MinIO** - http://localhost:9001 (admin/password123)
- **MongoDB** - mongodb://localhost:27017
- **Thingsboard** - http://localhost:9090 (tenant@thingsboard.org/tenant)
- **Node-RED** - http://localhost:1880

---

## 🔄 Integration Roadmap

### Phase 1: MinIO + RabbitMQ Event Notification ⚡

**Goal:** When a file is uploaded to MinIO, automatically send a notification to RabbitMQ.

#### Step 1: Configure MinIO Client

Access the MinIO container:
```bash
docker exec -it urbansync-minio sh
```

Install and configure MinIO Client (`mc`):
```bash
# Set alias for the MinIO server
mc alias set myminio http://localhost:9000 admin password123

# Configure RabbitMQ as notification target
mc admin config set myminio notify_amqp:1 \
  url="amqp://user:password@rabbitmq:5672" \
  exchange="minio-events" \
  exchange_type="fanout" \
  routing_key="" \
  mandatory=off \
  durable=on

# Restart MinIO to apply config
mc admin service restart myminio
```

#### Step 2: Create Bucket and Event Subscription

```bash
# Create the receipts bucket
mc mb myminio/receipts

# Add event notification for PUT operations
mc event add myminio/receipts arn:minio:sqs::1:amqp --event put

# Verify the event is configured
mc event list myminio/receipts
```

#### Step 3: Create RabbitMQ Exchange and Queue

Access RabbitMQ Management UI (http://localhost:15672):

1. Go to **Exchanges** tab
2. Create new exchange:
   - Name: `minio-events`
   - Type: `fanout`
   - Durability: `Durable`
3. Go to **Queues** tab
4. Create new queue:
   - Name: `receipts-processing`
   - Durability: `Durable`
5. Bind the queue to the exchange:
   - Go to the exchange → Bindings
   - Destination: `receipts-processing`
   - Click "Bind"

#### Step 4: Test the Integration

Upload a test file to MinIO:
```bash
# From your local machine (outside container)
echo "Test receipt" > test-receipt.txt

# Using mc (if installed locally) or MinIO Console UI
mc cp test-receipt.txt myminio/receipts/
```

Check RabbitMQ:
- Go to http://localhost:15672
- Navigate to **Queues** → `receipts-processing`
- You should see 1 message ready

---

### Phase 2: Thingsboard + RabbitMQ Integration 📡

**Goal:** When Thingsboard detects an alarm (e.g., low fuel), send it to RabbitMQ.

#### Step 1: Create RabbitMQ Queue for Alarms

In RabbitMQ Management UI:
1. Go to **Queues** tab
2. Create new queue:
   - Name: `building-alarms`
   - Durability: `Durable`

#### Step 2: Login to Thingsboard

1. Go to http://localhost:9090
2. Login with: `tenant@thingsboard.org` / `tenant`
3. Wait for full initialization (may take 1-2 minutes)

#### Step 3: Create Devices

1. Navigate to **Devices** in the sidebar
2. Click **+** to add a new device
3. Create 3 devices:
   - Name: `Apartment-1-Meter`
   - Name: `Apartment-2-Meter`
   - Name: `Apartment-3-Meter`
4. For each device, copy the **Access Token** (you'll need it for Node-RED)

#### Step 4: Create Rule Chain for Alarms

1. Navigate to **Rule Chains** in sidebar
2. Open the **Root Rule Chain**
3. Add a **Filter Script** node:
   - Name: "Low Fuel Alert"
   - Script:
   ```javascript
   return msg.fuel_usage < 200;
   ```
4. Add a **RabbitMQ** node:
   - Name: "Send to RabbitMQ"
   - Host: `rabbitmq`
   - Port: `5672`
   - Username: `user`
   - Password: `password`
   - Queue: `building-alarms`
5. Connect: **Message Type Switch** → (Post telemetry) → **Filter Script** → (True) → **RabbitMQ**
6. Save the Rule Chain

#### Step 5: Create Dashboard

1. Navigate to **Dashboards**
2. Create a new dashboard: "Building Consumption"
3. Add widgets:
   - **Latest Values** - Temperature
   - **Latest Values** - Fuel Usage
   - **Latest Values** - Battery Level
   - **Time Series** - Fuel consumption over time

---

### Phase 3: Node-RED Device Simulation 🎮

**Goal:** Simulate 3 smart meters sending telemetry data to Thingsboard.

#### Step 1: Access Node-RED

1. Go to http://localhost:1880
2. You should see the Node-RED editor

#### Step 2: Install Required Nodes

1. Click the hamburger menu (≡) → **Manage palette**
2. Go to **Install** tab
3. Search and install:
   - `node-red-contrib-mqtt-broker` (if not already installed)

#### Step 3: Create the Flow

Import this flow (Menu → Import → Clipboard):

```json
[
  {
    "id": "inject1",
    "type": "inject",
    "name": "Every 10 sec",
    "props": [],
    "repeat": "10",
    "crontab": "",
    "once": true,
    "topic": "",
    "x": 130,
    "y": 100,
    "wires": [["function1"]]
  },
  {
    "id": "function1",
    "type": "function",
    "name": "Generate Apartment 1 Data",
    "func": "msg.payload = {\n    temperature: 18 + Math.random() * 6,\n    fuel_usage: 150 + Math.random() * 100,\n    battery_level: 70 + Math.random() * 30\n};\nreturn msg;",
    "outputs": 1,
    "x": 360,
    "y": 100,
    "wires": [["mqtt1"]]
  },
  {
    "id": "mqtt1",
    "type": "mqtt out",
    "name": "MQTT to Thingsboard",
    "topic": "v1/devices/me/telemetry",
    "qos": "1",
    "retain": "",
    "broker": "mqtt-broker",
    "x": 600,
    "y": 100,
    "wires": []
  },
  {
    "id": "mqtt-broker",
    "type": "mqtt-broker",
    "name": "Thingsboard MQTT",
    "broker": "thingsboard",
    "port": "1883",
    "clientid": "",
    "autoConnect": true,
    "usetls": false,
    "protocolVersion": "4",
    "keepalive": "60",
    "cleansession": true,
    "birthTopic": "",
    "birthQos": "0",
    "birthPayload": "",
    "birthMsg": {},
    "closeTopic": "",
    "closeQos": "0",
    "closePayload": "",
    "closeMsg": {},
    "willTopic": "",
    "willQos": "0",
    "willPayload": "",
    "willMsg": {}
  }
]
```

**Note:** You need to configure the MQTT node with the device access token from Thingsboard:
- Double-click the MQTT node
- In "Server", configure:
  - Server: `thingsboard`
  - Port: `1883`
  - Username: `<DEVICE_ACCESS_TOKEN>` (from Thingsboard device)
  - Password: (leave empty)

Duplicate this flow for Apartment 2 and Apartment 3 with different device tokens.

#### Step 4: Deploy and Test

1. Click **Deploy** in the top-right corner
2. Go back to Thingsboard Dashboard
3. You should see data flowing in!

---

### Phase 4: UrbanSync Backend Integration 💻

**Goal:** Integrate UrbanSync backend with MinIO and RabbitMQ.

#### Dependencies to Install

Navigate to the backend directory and install:
```bash
cd backend
npm install minio amqplib dotenv
```

#### Create Configuration Files

**backend/config/minio.config.js:**
```javascript
const Minio = require('minio');

const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'password123'
});

module.exports = minioClient;
```

**backend/config/rabbitmq.config.js:**
```javascript
module.exports = {
    url: process.env.RABBITMQ_URL || 'amqp://user:password@localhost:5672',
    queues: {
        alarms: 'building-alarms',
        receipts: 'receipts-processing'
    }
};
```

#### Create RabbitMQ Consumer Service

**backend/services/rabbitmq-consumer.js:**
```javascript
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
            console.log('✅ Connected to RabbitMQ');
            return this.channel;
        } catch (error) {
            console.error('❌ RabbitMQ connection error:', error);
            throw error;
        }
    }

    async consumeAlarms(callback) {
        if (!this.channel) await this.connect();
        
        const queue = rabbitmqConfig.queues.alarms;
        await this.channel.assertQueue(queue, { durable: true });
        
        console.log(`🎧 Listening for alarms on queue: ${queue}`);
        
        this.channel.consume(queue, async (msg) => {
            if (msg !== null) {
                const content = msg.content.toString();
                console.log('📢 Alarm received:', content);
                
                try {
                    await callback(JSON.parse(content));
                    this.channel.ack(msg);
                } catch (error) {
                    console.error('Error processing alarm:', error);
                    this.channel.nack(msg);
                }
            }
        });
    }

    async close() {
        await this.channel?.close();
        await this.connection?.close();
        console.log('RabbitMQ connection closed');
    }
}

module.exports = new RabbitMQConsumer();
```

#### Create Receipt Processor Worker

**backend/workers/receipt-processor.js:**
```javascript
const amqp = require('amqplib');
const rabbitmqConfig = require('../config/rabbitmq.config');

async function startReceiptProcessor() {
    try {
        const connection = await amqp.connect(rabbitmqConfig.url);
        const channel = await connection.createChannel();
        
        const queue = rabbitmqConfig.queues.receipts;
        await channel.assertQueue(queue, { durable: true });
        
        console.log(`🎧 Receipt Processor listening on queue: ${queue}`);
        
        channel.consume(queue, (msg) => {
            if (msg !== null) {
                const event = JSON.parse(msg.content.toString());
                console.log('📄 New receipt uploaded:', {
                    bucket: event.Records?.[0]?.s3?.bucket?.name,
                    key: event.Records?.[0]?.s3?.object?.key,
                    size: event.Records?.[0]?.s3?.object?.size,
                    timestamp: new Date().toISOString()
                });
                
                // TODO: Add OCR processing here
                // TODO: Update database with receipt metadata
                
                channel.ack(msg);
            }
        });
    } catch (error) {
        console.error('Receipt Processor error:', error);
    }
}

// Start the worker if run directly
if (require.main === module) {
    startReceiptProcessor();
}

module.exports = startReceiptProcessor;
```

#### Update Backend Environment Variables

**backend/.env:** (add these lines)
```env
# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password123
MINIO_BUCKET=receipts

# RabbitMQ Configuration
RABBITMQ_URL=amqp://user:password@localhost:5672
```

---

## 🎯 Next Steps

1. ✅ Docker services running
2. ⏳ Configure MinIO → RabbitMQ notification (Phase 1)
3. ⏳ Setup Thingsboard devices and Rule Chain (Phase 2)
4. ⏳ Create Node-RED flows (Phase 3)
5. ⏳ Integrate UrbanSync backend (Phase 4)
6. ⏳ Create Kubernetes manifests
7. ⏳ Write comprehensive documentation
8. ⏳ Prepare demo presentation

---

## 📝 Testing Checklist

- [ ] Upload file to MinIO → Check RabbitMQ queue has message
- [ ] Node-RED sends telemetry → Check Thingsboard dashboard shows data
- [ ] Low fuel alarm triggered → Check RabbitMQ alarms queue
- [ ] Backend consumes alarm → Check MongoDB has notification
- [ ] Receipt uploaded → Worker logs the event

---

## 🆘 Troubleshooting

### Services not communicating?

Check the Docker network:
```bash
docker network inspect cloud-net
```

All containers should be on the same network and can reach each other by container name.

### RabbitMQ connection refused?

Make sure to use container hostnames when inside Docker network:
- From container: `rabbitmq:5672`
- From host machine: `localhost:5672`

### MinIO event not working?

Check MinIO logs:
```bash
docker-compose logs -f minio
```

Restart MinIO after configuration changes:
```bash
docker restart urbansync-minio
```

### Need to reset everything?

```bash
docker-compose down -v
# Delete data directories
# Recreate and start fresh
docker-compose up -d
```

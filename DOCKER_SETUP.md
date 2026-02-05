# UrbanSync IoT - Docker Setup Guide

## 📋 Overview

This docker-compose setup includes all the cloud services needed for the UrbanSync IoT Smart Building platform:

- **RabbitMQ** - Message Broker for event-driven communication
- **MinIO** - S3-compatible Object Storage for receipts/files
- **MongoDB** - Database for application data
- **Thingsboard** - IoT Platform for device management and telemetry
- **Node-RED** - IoT Device Simulator and flow orchestration

All services run on a shared Docker network called `cloud-net`.

---

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- At least 4GB of available RAM
- Ports available: 5672, 15672, 9000, 9001, 27017, 9090, 1883, 1880

### Start All Services

```bash
docker-compose up -d
```

### Check Service Status

```bash
docker-compose ps
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f rabbitmq
docker-compose logs -f minio
docker-compose logs -f thingsboard
```

### Stop All Services

```bash
docker-compose down
```

### Stop and Remove Data (Clean Reset)

```bash
docker-compose down -v
```

---

## 🔗 Service Access Points

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| **RabbitMQ Management** | http://localhost:15672 | user / password |
| **MinIO Console** | http://localhost:9001 | admin / password123 |
| **Thingsboard** | http://localhost:9090 | tenant@thingsboard.org / tenant |
| **Node-RED** | http://localhost:1880 | No auth (by default) |
| **MongoDB** | mongodb://localhost:27017 | root / rootpassword |

---

## 📂 Data Persistence

Data is persisted in local directories:

```
./rabbitmq/data     - RabbitMQ data
./minio/data        - MinIO objects/buckets
./mongodb/data      - MongoDB database files
./thingsboard/data  - Thingsboard data
./thingsboard/logs  - Thingsboard logs
./node-red/data     - Node-RED flows and settings
```

⚠️ **Note:** These directories are in `.gitignore` and will not be committed to Git.

---

## 🔧 Configuration

### Environment Variables

You can customize the services by editing the `docker-compose.yml` file:

**RabbitMQ:**
```yaml
RABBITMQ_DEFAULT_USER: user
RABBITMQ_DEFAULT_PASS: password
```

**MinIO:**
```yaml
MINIO_ROOT_USER: admin
MINIO_ROOT_PASSWORD: password123
```

**MongoDB:**
```yaml
MONGO_INITDB_ROOT_USERNAME: root
MONGO_INITDB_ROOT_PASSWORD: rootpassword
```

---

## 🧪 Testing the Setup

### 1. Check RabbitMQ
- Go to http://localhost:15672
- Login with `user` / `password`
- You should see the RabbitMQ dashboard

### 2. Check MinIO
- Go to http://localhost:9001
- Login with `admin` / `password123`
- You should see the MinIO console

### 3. Check Thingsboard
- Go to http://localhost:9090
- Login with `tenant@thingsboard.org` / `tenant`
- You should see the Thingsboard dashboard
- ⏰ **Note:** Thingsboard takes ~2 minutes to fully start

### 4. Check Node-RED
- Go to http://localhost:1880
- You should see the Node-RED editor

### 5. Check MongoDB
```bash
# Using mongosh (if installed locally)
mongosh mongodb://root:rootpassword@localhost:27017

# Or connect from inside the container
docker exec -it urbansync-mongodb mongosh -u root -p rootpassword
```

---

## 🐛 Troubleshooting

### Service won't start

Check logs:
```bash
docker-compose logs [service-name]
```

### Port already in use

If you get a "port already allocated" error:
1. Check which process is using the port:
   ```bash
   # Windows
   netstat -ano | findstr :[PORT]
   
   # Kill the process
   taskkill /PID [PID] /F
   ```
2. Or change the port in `docker-compose.yml`

### Thingsboard not accessible

Thingsboard takes time to initialize (up to 2 minutes). Check:
```bash
docker-compose logs -f thingsboard
```

Wait until you see: `Thingsboard started successfully`

### Reset everything

```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Remove data directories
rmdir /s /q rabbitmq minio mongodb thingsboard node-red

# Recreate directories
powershell -Command "New-Item -ItemType Directory -Force -Path rabbitmq/data, minio/data, thingsboard/data, thingsboard/logs, mongodb/data, node-red/data"

# Start fresh
docker-compose up -d
```

---

## 📦 Network

All services communicate via the `cloud-net` bridge network.

To inspect the network:
```bash
docker network inspect cloud-net
```

Services can reach each other using their container names:
- `rabbitmq:5672` (AMQP)
- `minio:9000` (S3 API)
- `mongodb:27017` (MongoDB)
- `thingsboard:9090` (HTTP)
- `nodered:1880` (HTTP)

---

## 🔄 Next Steps

1. ✅ Services are running
2. 📝 Configure MinIO bucket and RabbitMQ notification
3. 🔗 Setup Thingsboard devices and Rule Chain
4. 🎨 Create Node-RED flows for device simulation
5. 💻 Integrate UrbanSync backend with these services

See `INTEGRATION_GUIDE.md` for detailed integration steps.

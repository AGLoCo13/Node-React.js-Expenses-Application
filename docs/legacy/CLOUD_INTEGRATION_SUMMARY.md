# 🚀 Cloud Integration - Implementation Summary

## ✅ Completed Implementation

### 1. **MongoDB Notification Model** (`models/notification.js`)
Schema για αποθήκευση alarms/notifications από Thingsboard:
- Σύνδεση με User, Building, Apartment
- Τύποι alarms: `low_fuel`, `high_temperature`, `battery_low`, `sensor_offline`, `general_alarm`
- Severity levels: `info`, `warning`, `critical`
- Αποθήκευση raw Thingsboard data
- Read/Unread status

### 2. **CloudService Class** (`backend/services/cloudService.js`)
Centralized service που διαχειρίζεται:
- ✅ MinIO client initialization
- ✅ RabbitMQ connection management
- ✅ Building alarms consumer (από `building-alarms` queue)
- ✅ MinIO events consumer (από `minio-events` exchange)
- ✅ Automatic notification creation στο MongoDB
- ✅ Graceful shutdown handling

**Key Methods:**
```javascript
cloudService.init()                    // Initialize all services
cloudService.consumeBuildingAlarms()   // Listen to Thingsboard alarms
cloudService.consumeMinIOEvents()      // Listen to MinIO file uploads
cloudService.uploadToMinIO()           // Upload helper method
cloudService.shutdown()                // Graceful cleanup
```

### 3. **RabbitMQ Consumer Updates** (`backend/services/rabbitmq-consumer.js`)
Νέα μέθοδος για consuming από exchange αντί για queue:
```javascript
async consumeMinIOEvents(callback)
```
- Δημιουργεί exclusive queue
- Bind στο `minio-events` exchange (fanout type)
- Κάθε server instance έχει το δικό του queue

### 4. **Server.js Integration**
**Νέα Imports:**
```javascript
const multerS3 = require('multer-s3');
const cloudService = require('./services/cloudService');
```

**MinIO Storage Configuration:**
```javascript
const minioStorage = multerS3({
    s3: cloudService.minioClient,
    bucket: process.env.MINIO_BUCKET || 'receipts',
    // ... configuration
});
const uploadToMinio = multer({ storage: minioStorage });
```

**Νέο API Route:**
```
POST /api/upload-receipt
- Authentication required (authenticateUser middleware)
- Direct upload to MinIO (όχι local disk)
- Returns file metadata και URL
```

**Startup Integration:**
- Αρχικοποίηση cloudService μετά το MongoDB connection
- Έναρξη building alarms consumer
- Έναρξη MinIO events consumer
- Graceful shutdown handler (SIGINT)

---

## 🎯 API Endpoints

### Existing (Local Storage)
```
POST /api/expenses
- Multer local disk storage
- Saves to backend/receipts/ folder
```

### New (MinIO Cloud Storage)
```
POST /api/upload-receipt
- Requires authentication
- Direct upload to MinIO
- Body: multipart/form-data with 'receipt' field

Response:
{
    "message": "Receipt uploaded successfully to MinIO",
    "file": {
        "filename": "1770123456789-receipt.pdf",
        "bucket": "receipts",
        "size": 123456,
        "url": "http://localhost:9000/receipts/1770123456789-receipt.pdf",
        "mimetype": "application/pdf"
    }
}
```

---

## 🔧 Testing Guide

### 1. Start Docker Services
```bash
docker-compose up -d
```

### 2. Start Backend Server
```bash
cd backend
npm start
```

**Expected Console Output:**
```
Successfully connected to MongoDB.
🚀 Initializing Cloud Services...
✅ MinIO bucket 'receipts' verified
✅ Connected to RabbitMQ
✅ Cloud Services initialized successfully
📡 Starting Building Alarms consumer...
🎧 Listening for alarms on queue: building-alarms
☁️  Starting MinIO Events consumer...
🎧 Listening for MinIO events from exchange: minio-events
✅ All cloud services initialized and consumers started
Server started on port 5000
```

### 3. Test MinIO Upload

**Using cURL:**
```bash
curl -X POST http://localhost:5000/api/upload-receipt \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "receipt=@/path/to/receipt.pdf"
```

**Using Postman:**
1. Method: POST
2. URL: `http://localhost:5000/api/upload-receipt`
3. Headers: `Authorization: Bearer YOUR_JWT_TOKEN`
4. Body: form-data
   - Key: `receipt` (type: File)
   - Value: Select file

### 4. Verify Upload
- Check MinIO Console: http://localhost:9001
  - Login: admin / password123
  - Navigate to `receipts` bucket
  - File should be visible

- Check Backend Console:
  - Should see MinIO event received log

### 5. Test Thingsboard Alarms

**Simulate Alarm from Thingsboard:**
```bash
# Send test message to RabbitMQ
docker exec -it urbansync-rabbitmq rabbitmqadmin publish \
  exchange=amq.default \
  routing_key=building-alarms \
  payload='{"alarmType":"low_fuel","severity":"CRITICAL","message":"Low fuel detected","buildingId":"BUILDING_ID_HERE"}'
```

**Expected Backend Output:**
```
📢 Alarm received: {"alarmType":"low_fuel","severity":"CRITICAL",...}
🔔 Processing alarm: {...}
✅ Notification saved to database
```

**Verify in MongoDB:**
```bash
docker exec -it urbansync-mongodb mongosh commons-db
db.notifications.find().pretty()
```

---

## 📦 Dependencies Added

```json
{
  "multer-s3": "^3.0.1"
}
```

---

## 🔗 Integration Flow

### MinIO Upload Flow
```
Client → POST /api/upload-receipt → multer-s3 → MinIO
                                              ↓
                                        RabbitMQ (minio-events exchange)
                                              ↓
                                        CloudService.consumeMinIOEvents()
                                              ↓
                                        Log event details
```

### Thingsboard Alarm Flow
```
Thingsboard → RabbitMQ (building-alarms queue)
                    ↓
        CloudService.consumeBuildingAlarms()
                    ↓
        Process alarm + Determine type/severity
                    ↓
        Find building → Find administrator
                    ↓
        Create Notification in MongoDB
                    ↓
        Admin can query notifications (future API)
```

---

## ⚠️ Important Notes

1. **Building-Alarm Mapping:**
   - Το `cloudService.findBuildingFromAlarm()` είναι placeholder
   - Πρέπει να το customize based on πώς το Thingsboard στέλνει building info

2. **Authentication:**
   - Το `/api/upload-receipt` endpoint απαιτεί valid JWT token
   - Use existing authentication system

3. **Error Handling:**
   - Αν MinIO/RabbitMQ δεν είναι available κατά το startup
   - Server θα συνεχίσει χωρίς cloud services
   - Logged as warning

4. **Scalability:**
   - MinIO events consumer χρησιμοποιεί exclusive queue
   - Κάθε server instance παίρνει copy των events
   - Ideal για horizontal scaling

---

## 🎨 Future Enhancements

### API Endpoints to Add:
```javascript
// Get notifications for logged-in user
GET /api/notifications
GET /api/notifications/:id
PUT /api/notifications/:id/read
DELETE /api/notifications/:id

// Admin: Get all notifications for their buildings
GET /api/admin/notifications
```

### Additional Processing:
- OCR για text extraction από receipts
- Thumbnail generation για images
- Email notifications σε administrators
- WebSocket για real-time notifications
- Expense auto-creation από uploaded receipt

---

## 📝 Configuration Summary

**Environment Variables (`.env`):**
```env
# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password123
MINIO_BUCKET=receipts

# RabbitMQ
RABBITMQ_URL=amqp://user:password@localhost:5672
```

**RabbitMQ Configuration (`config/rabbitmq.config.js`):**
```javascript
{
    queues: {
        alarms: 'building-alarms',
        receipts: 'receipts-processing'
    },
    exchanges: {
        minioEvents: 'minio-events'
    }
}
```

---

## ✨ Summary

Έχει ολοκληρωθεί πλήρως η ενσωμάτωση:
- ✅ MinIO για cloud file storage
- ✅ RabbitMQ consumers για alarms και MinIO events
- ✅ MongoDB notifications για Thingsboard alarms
- ✅ Νέο API endpoint για direct MinIO uploads
- ✅ Centralized CloudService class
- ✅ Graceful shutdown handling

Το backend είναι έτοιμο να δεχθεί:
1. File uploads στο MinIO
2. Thingsboard alarms
3. MinIO event notifications

Όλα τα services είναι loosely coupled και μπορούν να λειτουργήσουν ανεξάρτητα!

---

**Next Steps:**
1. Test με real Thingsboard data
2. Customize το building mapping logic
3. Προσθήκη notification API endpoints
4. Frontend integration για file uploads
5. Real-time notifications με WebSockets (optional)

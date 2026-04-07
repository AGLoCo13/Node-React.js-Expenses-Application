module.exports = {
  apps : [{
    name   : "server",
    script : "./server.js",
    env: {
      PORT: 5000,
      MONGO_URI: "mongodb://root:rootpassword@localhost:27017/urbansync?authSource=admin",
      JWT_SECRET: "secret_key_urbansync_123"
    }
  }]
}

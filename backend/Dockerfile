# backend/Dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app/backend

# Install dependencies
COPY backend/package*.json ./
RUN npm install --only=production

# Production stage
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built dependencies
COPY --from=builder /app/backend/node_modules /app/backend/node_modules

# Copy backend source
COPY --chown=nodejs:nodejs backend/ /app/backend/

# Copy controllers, middleware, models (referenced via ../ from backend/)
COPY --chown=nodejs:nodejs controllers/ /app/controllers/
COPY --chown=nodejs:nodejs middleware/ /app/middleware/
COPY --chown=nodejs:nodejs models/ /app/models/

WORKDIR /app/backend

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if(r.statusCode!==200)throw new Error()})"

# Start the app
CMD ["node", "server.js"]

# ─────────────────────────────────────────────────────────────────────────────
# urbansync-v2 — backend/Dockerfile
# Self-contained: controllers/, models/, middleware/ are NOW inside this context.
# No external volume mounts required (Kubernetes-ready).
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Install production dependencies ──────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

# ── Stage 2: Production image ─────────────────────────────────────────────
FROM node:18-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy all application source (server.js, controllers/, models/, middleware/,
# services/, workers/, config/) — everything is self-contained in this folder
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose API port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if(r.statusCode!==200)throw new Error()})"

# Start the application
CMD ["node", "server.js"]

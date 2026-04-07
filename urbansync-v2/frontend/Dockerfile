# ─────────────────────────────────────────────────────────────────────────────
# urbansync-v2 — frontend/Dockerfile
# Strict multi-stage build:
#   Stage 1 (builder): Node.js 16 Alpine — runs `npm install` + `npm run build`
#   Stage 2 (serve):   Nginx Alpine     — serves ONLY the /build output folder
#
# CONSTRAINT: The target Azure VM is too small for `npm install` at runtime.
# All Node.js tooling is discarded after Stage 1. The final image contains
# only Nginx + the compiled static assets (~25 MB vs ~350 MB single-stage).
#
# ROOT CAUSE FIX: @testing-library/* are in devDependencies so they are
# excluded by --omit=dev, preventing jest@30 from poisoning the ajv resolution
# tree that react-scripts@5 needs (ajv-keywords@5 → ajv@8/dist/compile/codegen).
# Node 16 (npm 8) is used for the build stage for CRA 5 compatibility.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Node.js 16 builder ───────────────────────────────────────────
FROM node:16-alpine AS builder

WORKDIR /app

# Copy only dependency manifest (layer-cache optimisation: rebuilds on change)
COPY package.json ./

# Install production + build dependencies.
RUN npm install --omit=dev --legacy-peer-deps

# ── ajv hoisting fix ──────────────────────────────────────────────────────
# react-scripts@5 depends on @testing-library/jest-dom (even as a runtime dep),
# which has a "jest>=27" peer dep that resolves to jest@30. jest@30's packages
# pull in ajv@6 which npm hoists to /app/node_modules/ajv, displacing the
# ajv@8 that ajv-keywords@5 → terser-webpack-plugin needs for its
# 'ajv/dist/compile/codegen' import. This step forces ajv@8 back to the top
# level so the require() resolution finds the correct version.
RUN npm install ajv@^8.12.0 --no-save --legacy-peer-deps

# Copy the full React source tree
COPY . .

# Disable sourcemap generation to save ~40% memory during Webpack compilation.
ENV GENERATE_SOURCEMAP=false
# Allow Webpack up to 4 GB of heap — prevents OOM on memory-constrained hosts.
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Treat ESLint warnings as warnings (not errors) in this non-interactive env.
ENV CI=false

# Compile the production build
RUN npm run build

# ── Stage 2: Nginx — serve only the compiled /build folder ────────────────
FROM nginx:alpine

# Remove default Nginx placeholder content
RUN rm -rf /usr/share/nginx/html/*

# Copy ONLY the compiled assets from Stage 1 — no Node.js, no source code
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom Nginx config (React Router support + API proxy + security headers)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

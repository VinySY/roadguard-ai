# ==============================================================
# RoadGuard AI — Backend Production Dockerfile
# Provides native Linux FFmpeg & FFprobe for fast, robust video processing
# ==============================================================

# Build Stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json tsconfig.json ./

# Install dependencies (including devDependencies for TypeScript compilation)
RUN npm ci

# Copy source files
COPY server/ ./server/
COPY test-detection.ts ./

# Compile TypeScript to dist/
RUN npm run build

# Production Runtime Stage
FROM node:20-slim

WORKDIR /app

# Install native Linux FFmpeg and FFprobe
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JavaScript from builder
COPY --from=builder /app/dist ./dist

# Copy static assets and SQL schema
COPY server/db/schema.sql ./server/db/schema.sql
COPY test/ ./test/

# Ensure runtime directories exist
RUN mkdir -p uploads/inspections uploads/videos uploads/frames

# Default environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001

CMD ["node", "dist/server/index.js"]

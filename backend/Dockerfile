# ==============================================================
# RoadGuard AI — Backend Production Dockerfile
# Native Linux FFmpeg & FFprobe for video processing
# ==============================================================

# Build Stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy backend dependency files
COPY backend/package*.json backend/tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy backend source
COPY backend/server/ ./server/
COPY backend/test-detection.ts ./

# Compile TypeScript
RUN npm run build


# ==============================================================
# Production Runtime Stage
# ==============================================================
FROM node:20-slim

WORKDIR /app

# Install FFmpeg and FFprobe
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install production dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy compiled application
COPY --from=builder /app/dist ./dist

# Copy SQL schema
COPY backend/server/db/schema.sql ./server/db/schema.sql

# Copy tests if required by the application
COPY backend/test/ ./test/

# Runtime directories
RUN mkdir -p uploads/inspections uploads/videos uploads/frames

# Production environment
ENV NODE_ENV=production
ENV PORT=10000
ENV HOST=0.0.0.0

EXPOSE 10000

CMD ["node", "dist/server/index.js"]
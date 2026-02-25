# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install serve + wget for healthcheck
RUN apk add --no-cache wget \
    && npm install -g serve

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 8080

# Start serve
CMD ["serve", "-s", "dist", "-l", "8080"]


# Use Node.js 22
FROM node:22-bookworm-slim

# Install tools required for SQLite native module
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci --omit=dev

# Copy backend source code
COPY backend/src ./src

# Copy frontend files
COPY frontend /app/frontend

# Create database directory
RUN mkdir -p /app/backend/database

# Application port
EXPOSE 3000

# Start application
CMD ["node", "src/server.js"]

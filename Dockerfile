# Multi-stage build for Guardian Tauri Desktop App
# Stage 1: Build environment with Rust + Node.js
FROM node:20-slim AS builder

# Install Rust and system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    libssl-dev \
    pkg-config \
    libgtk-3-dev \
    libwebkit2gtk-4.0-dev \
    libappindicator3-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run tauri build

# Stage 2: Final minimal image
FROM debian:bookworm-slim

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    libgtk-3-0 \
    libwebkit2gtk-4.0-37 \
    libappindicator3-1 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# Copy built binary from builder
COPY --from=builder /app/src-tauri/target/release/bundle/deb/*.deb /tmp/
COPY --from=builder /app/src-tauri/target/release/Guardian /usr/local/bin/

# Create non-root user
RUN useradd -m -u 1000 guardian
USER guardian

ENTRYPOINT ["Guardian"]

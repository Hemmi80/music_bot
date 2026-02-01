# Use Node.js LTS with full Debian for native module support
FROM node:20-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    build-essential \
    libtool \
    autoconf \
    automake \
    && pip3 install --break-system-packages yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN ffmpeg -version && yt-dlp --version

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install Node.js dependencies (needs build tools for native modules)
RUN npm ci

# Copy the rest of the application
COPY . .

# Start the bot
CMD ["node", "index.js"]

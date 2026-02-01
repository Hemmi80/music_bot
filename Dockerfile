# Use Node.js LTS with Debian for better compatibility
FROM node:20-slim

# Install system dependencies: ffmpeg, yt-dlp, python3
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    && pip3 install --break-system-packages yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN ffmpeg -version && yt-dlp --version

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Start the bot
CMD ["node", "index.js"]

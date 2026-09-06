FROM node:20-slim

# Install system dependencies: fonts, canvas native libs, ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    fontconfig \
    fonts-liberation \
    fonts-dejavu-core \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgif7 \
    libjpeg62-turbo \
    librsvg2-2 \
    ffmpeg \
    ca-certificates \
    && fc-cache -f -v \
    && rm -rf /var/lib/apt/lists/*

# Set fontconfig path so canvas/node-canvas finds fonts in container
ENV FONTCONFIG_PATH=/etc/fonts
ENV FONTCONFIG_FILE=/etc/fonts/fonts.conf

WORKDIR /app

# Copy package files and install node dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled TypeScript dist and licensed music bed
COPY dist/ ./dist/
COPY assets/ ./assets/

# Copy any static assets (optional - create placeholder if not found)
RUN touch ./base_reel.mp4

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "dist/api/server.js"]

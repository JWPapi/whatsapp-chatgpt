FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y \
  libgbm-dev libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
  libdbus-1-3 libexpat1 libfontconfig1 libgdk-pixbuf-2.0-0 \
  libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
  libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
  libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates \
  fonts-liberation libnss3 xdg-utils wget gosu libdrm2 libxkbcommon0 \
  && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user
RUN useradd -m -s /bin/bash botuser

WORKDIR /app/

# Let puppeteer use its bundled Chrome by default

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

# Install Puppeteer's bundled Chrome (compatible version)
ENV PUPPETEER_CACHE_DIR=/opt/puppeteer-cache
RUN npx puppeteer browsers install chrome && \
    npx puppeteer browsers install chrome@144.0.7559.96 && \
    chmod -R 755 /opt/puppeteer-cache

# Create directories with correct ownership
RUN mkdir -p /app/.wwebjs_auth && chown -R botuser:botuser /app

COPY --chown=botuser:botuser . .

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

FROM node:22-bullseye-slim

RUN apt update && apt install -y \
  gconf-service libgbm-dev libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
  libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 \
  libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
  libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
  libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates \
  fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget gosu \
  && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.29.2 --activate

# Create non-root user
RUN useradd -m -s /bin/bash botuser

WORKDIR /app/

# Let puppeteer download its own compatible Chrome
ENV PUPPETEER_CACHE_DIR="/app/.cache/puppeteer"

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

# Download puppeteer's compatible Chrome
RUN npx puppeteer browsers install chrome

# Patch whatsapp-web.js: change waitUntil from 'load' to 'domcontentloaded'
# The 'load' event never fires on some Chrome/headless combinations with WhatsApp Web
RUN find /app/node_modules -path '*/whatsapp-web.js/src/Client.js' -exec \
  sed -i "s/waitUntil: 'load'/waitUntil: 'domcontentloaded'/" {} \;

# Create directories with correct ownership
RUN mkdir -p /app/.wwebjs_auth && chown -R botuser:botuser /app

COPY --chown=botuser:botuser . .

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

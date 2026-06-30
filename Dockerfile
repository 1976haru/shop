FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY . .
ENV APP_HOST=0.0.0.0
ENV APP_PORT=3000
ENV DATA_ROOT=/data
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "--experimental-strip-types", "apps/local-web/src/server.ts"]

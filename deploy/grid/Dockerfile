FROM node:24-bookworm-slim
WORKDIR /app
COPY LICENSE NOTICE package.json ./
COPY deploy/grid/package*.json ./deploy/grid/
RUN npm ci --prefix deploy/grid --omit=dev --ignore-scripts
COPY deploy/grid/server.js deploy/grid/registration.json ./deploy/grid/
COPY server/dashboard-assets.js ./server/
COPY docs/ ./docs/
USER node
EXPOSE 8080
CMD ["node", "deploy/grid/server.js"]

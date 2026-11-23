FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54

WORKDIR /app
COPY LICENSE NOTICE package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && npm install --prefix /opt/gift-agent --no-audit --no-fund \
        @anthropic-ai/claude-code@2.1.331 @agentclientprotocol/claude-agent-acp@0.109.0
ENV PATH=/opt/gift-agent/node_modules/.bin:$PATH DISABLE_AUTOUPDATER=1
COPY server/ ./server/
COPY skills/ ./skills/
COPY docs/ ./docs/
COPY deploy/grid/live-proxy.js deploy/grid/worker-relay.js ./deploy/grid/

USER node
CMD ["node", "server/index.js", "--claude-acp"]

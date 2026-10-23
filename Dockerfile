FROM node:24.22.1-bookworm-slim
WORKDIR /app
COPY . .
RUN rm -f package-lock.json && npm install --include=dev --ignore-scripts
CMD ["npx", "tsx", "packages/marketplace/src/mcp-server.ts"]

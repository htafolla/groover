# Minimal Dockerfile for Groover MCP Registry on Railway
# Exposes the self-verification registry as MCP tools for AI agents.
# Governed under proposal groover-mcp-registry-railway-024 (approved).

FROM node:20

WORKDIR /app

# Copy package files 
COPY package*.json ./
COPY packages ./packages
COPY tsconfig.json ./

# Install without workspaces flag (file: paths + no node:crypto now in pkgs)
RUN npm install --include=dev 2>&1 || npm install 2>&1 || true

# Build 
RUN npm run build --if-present || true

# Manual @groover links for runtime resolve (tsx on src + cross imports in mcp-server/index)
RUN mkdir -p node_modules/@groover && \
    ln -s ../packages/xray node_modules/@groover/xray && \
    ln -s ../packages/core node_modules/@groover/core && \
    ln -s ../packages/identity node_modules/@groover/identity && \
    ln -s ../packages/marketplace node_modules/@groover/marketplace && \
    ln -s ../packages/chrono node_modules/@groover/chrono || true

# Default: run the registry MCP server with modern npx tsx 
CMD ["npx", "tsx", "packages/marketplace/src/mcp-server.ts"]

EXPOSE 3000
# For MCP over HTTP/SSE in future: listen on $PORT

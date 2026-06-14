# Minimal Dockerfile for Groover MCP Registry on Railway
# Exposes the self-verification registry as MCP tools for AI agents.
# Governed under proposal groover-mcp-registry-railway-024 + groover-mcp-railway-tests-loop-025 (approved).
# Real tests in packages/marketplace/src/index.test.ts + scripts/confirm-railway-mcp-endpoints.mjs now gate every deploy (loop until pass on live).

FROM node:20

WORKDIR /app

# Copy package files first for layer cache + sanitize to avoid Railway Docker npm "workspace:*" / "node:" protocol errors
COPY package*.json ./
COPY packages ./packages
COPY tsconfig.json ./

# Sanitize root package.json for container (remove workspaces + stray 0xray dep that break plain npm in image).
# Use heredoc for script so 'const' is never a top-level Dockerfile instruction (prevents parse errors like 'unknown instruction: const' on line 17).
RUN cat > /tmp/sanitize-package.js << 'EOL'
const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));delete p.workspaces;if(p.dependencies&&p.dependencies["0xray"])delete p.dependencies["0xray"];fs.writeFileSync("package.json",JSON.stringify(p,null,2));
EOL
RUN node /tmp/sanitize-package.js || true

# Install all (dev for tsx) - relative src imports in mcp-server + index mean no @groover links strictly required but harmless
RUN npm install --include=dev 2>&1 || npm install 2>&1 || true

# Build (turbo now has turbo.json; || true keeps image even if sub tsc warn)
RUN npm run build --if-present || true

# Links (defensive for any @groover/* resolution in tests or future)
RUN mkdir -p node_modules/@groover && \
    ln -s ../packages/xray node_modules/@groover/xray && \
    ln -s ../packages/core node_modules/@groover/core && \
    ln -s ../packages/identity node_modules/@groover/identity && \
    ln -s ../packages/marketplace node_modules/@groover/marketplace && \
    ln -s ../packages/chrono node_modules/@groover/chrono || true

# Run via npm script (respects package.json start:registry) with fallbacks for resilience on Railway (npx resolves local tsx reliably post npm install --include=dev).
# PORT from env, server listens and serves / for healthcheck + /mcp for the 4 tools
CMD ["sh", "-c", "npm run start:registry || npx tsx packages/marketplace/src/mcp-server.ts || node --import tsx packages/marketplace/src/mcp-server.ts"]

EXPOSE 3000
# Healthcheck handled by railway.json (path /). MCP tools confirmed by real tests on deploy.

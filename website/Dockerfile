FROM node:24.22.1-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY . .
RUN npm run build
CMD ["npx", "docusaurus", "serve", "--host", "0.0.0.0", "--port", "8080"]

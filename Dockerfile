# ビルドステージ (ホストCPUで高速にビルドし、成果物は全アーキテクチャで共有)
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

WORKDIR /app

# ラズパイ等ARM環境でのElectronバイナリダウンロードをスキップして高速化
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src

RUN npx tsc --noEmit && npx vite build

# 実行ステージ (軽量なNginxで静的ファイルを配信)
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/25-embed-headers.sh /tmp/25-embed-headers.sh
RUN tr -d '\r' < /tmp/25-embed-headers.sh > /docker-entrypoint.d/25-embed-headers.sh \
    && rm -f /tmp/25-embed-headers.sh \
    && chmod +x /docker-entrypoint.d/25-embed-headers.sh
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

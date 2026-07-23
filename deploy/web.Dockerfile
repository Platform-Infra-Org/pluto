# Build context: repo root. Build with:
#   docker build -f deploy/web.Dockerfile -t platform-web .
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
WORKDIR /app
COPY apps/web/package.json apps/web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY apps/web ./
RUN pnpm build

FROM nginx:1.27-alpine
COPY deploy/web.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

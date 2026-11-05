# syntax=docker/dockerfile:1
# Build context: repository root.  docker build -f apps/api/Dockerfile -t synthwire-api .
FROM node:26-alpine AS build
RUN npm install -g pnpm@12.16.1
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @aimag/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @aimag/shared build && pnpm --filter @aimag/api build
# Production-only dependencies + built output, without the rest of the monorepo.
RUN pnpm --filter @aimag/api deploy --prod --legacy /out

FROM node:26-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/health >/dev/null || exit 1
CMD ["node", "dist/server.js"]

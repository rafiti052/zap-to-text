# zap-to-text — multi-stage lean image (TypeScript → dist)
FROM node:20-alpine AS build

WORKDIR /app

# WhatsApp client deps may resolve packages via git URLs
RUN apk add --no-cache git

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS run

WORKDIR /app

RUN apk add --no-cache git

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV AUTH_DIR=/app/data/auth
ENV SEEN_IDS_PATH=/app/data/seen-ids.json
ENV TRANSCRIPTS_DIR=/app/transcripts

CMD ["node", "dist/index.js"]

FROM node:20-alpine

WORKDIR /app

# WhatsApp client deps may resolve packages via git URLs
RUN apk add --no-cache git

COPY package.json ./
RUN npm install --omit=dev

COPY index.js ./

ENV NODE_ENV=production
ENV AUTH_DIR=/app/data/auth
ENV SEEN_IDS_PATH=/app/data/seen-ids.json
ENV TRANSCRIPTS_DIR=/app/transcripts

CMD ["node", "index.js"]

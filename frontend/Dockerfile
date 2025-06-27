# Build stage
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install

# ✅ ここで直接環境変数を定義（最も確実）
ENV NEXT_PUBLIC_FASTAPI_HOST=webrtc.kishiserver.com
ENV NODE_ENV=production

COPY . .

RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "start"]

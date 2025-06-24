# Build stage
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install

# ⬇️ 本番用の環境変数ファイルをコピー
COPY .env.production .env.production

# ⬇️ 残りのソースをコピー
COPY . .

# ⬇️ 本番ビルド時に .env.production を読み込ませる
ENV NODE_ENV=production
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "start"]

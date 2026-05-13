FROM node:18-alpine AS builder
RUN apk add --no-cache openssl openssl-dev
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:18-alpine
RUN apk add --no-cache openssl openssl-dev
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
COPY --from=builder /app/dist ./dist
RUN npm ci
RUN npx prisma generate
EXPOSE 3000
CMD ["node", "dist/index.js"]

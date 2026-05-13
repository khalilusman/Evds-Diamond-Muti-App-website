FROM node:18-alpine
RUN apk add --no-cache openssl openssl-dev
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production
RUN npx prisma generate
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]

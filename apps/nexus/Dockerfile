FROM node:18-alpine AS builder
WORKDIR /app
COPY apps/nexus/package*.json ./
RUN npm ci
COPY apps/nexus/ .
COPY assets/ /assets/
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build
RUN cp /assets/* /app/dist/

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY apps/nexus/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

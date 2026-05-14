FROM node:18-alpine AS builder
WORKDIR /app
COPY apps/dashboard/package*.json ./
RUN npm ci
COPY apps/dashboard/ .
COPY assets/ /assets/
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_ADMIN_SECRET
ENV VITE_ADMIN_SECRET=$VITE_ADMIN_SECRET
RUN npm run build
RUN cp /assets/* /app/dist/

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# Static build of the PWA, served by nginx. The Convex backend is deployed separately
# (`npx convex deploy`) — pass its URL at build time:
#   docker build --build-arg VITE_CONVEX_URL=https://<your-deployment>.convex.cloud -t pawlog .
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_CONVEX_URL
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL
RUN test -n "$VITE_CONVEX_URL" || (echo "VITE_CONVEX_URL build arg is required" && exit 1)
RUN npx vite build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --workspace=apps/api
COPY apps/api apps/api
RUN npm run build -w @minime/api

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --workspace=apps/api --omit=dev

FROM node:22-alpine
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
RUN chown -R node:node /app
USER node
EXPOSE 8744
CMD ["node", "dist/index.js"]

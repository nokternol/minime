FROM node:22-alpine AS build
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=apps/web
COPY apps/web apps/web
RUN npm run build -w @minime/web

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/apps/web/build ./build
RUN chown -R node:node /app
USER node
EXPOSE 8743
CMD ["node", "build"]

FROM node:24-slim
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json", "./"]
RUN npm ci
COPY --chown=node . .
EXPOSE 8081
USER node
ENV NODE_ENV=production
ARG BUILD_VERSION=dev
ENV BUILD_VERSION=$BUILD_VERSION
# Apply any pending DB migrations before booting; a migration failure keeps the
# container from starting (and the restart policy retries it).
CMD ["sh", "-c", "node scripts/migrate.js && exec npm start"]

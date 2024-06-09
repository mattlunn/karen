FROM node:14-slim
WORKDIR /usr/src/app
COPY ["dist/package.json", "dist/package-lock.json", "./"]
RUN npm ci
COPY . .
EXPOSE 8081
RUN npm run build
RUN chown -R node /usr/src/app
USER node
ENV NODE_ENV=production
CMD ["npm", "start"]

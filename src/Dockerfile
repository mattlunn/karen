FROM node:14-slim
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json", "./"]
RUN npm ci
COPY . .
EXPOSE 8081
RUN chown -R node /usr/src/app
USER node
ENV NODE_ENV=production
CMD ["npm", "start"]

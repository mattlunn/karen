FROM node:20-slim
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json", "./"]
RUN npm ci
COPY --chown=node . .
EXPOSE 8081
USER node
ENV NODE_ENV=production
CMD ["npm", "start"]

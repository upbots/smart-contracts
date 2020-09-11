# Stage 1 - building node_modules
FROM node:12.16.3
WORKDIR /usr/src/app
COPY contracts contracts
COPY migrations migrations
COPY utils utils
COPY package*.json ./
COPY yarn.lock ./
COPY truffle-config.js ./
COPY docker/start.sh ./

RUN yarn install --frozen-lockfile --silent
ENV NETWORK goerli
RUN chown node:node ./
USER node

CMD ["sh", "-c", "/usr/src/app/start.sh ${NETWORK}"]

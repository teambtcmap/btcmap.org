FROM node:18
WORKDIR /app
COPY package.json /app
COPY yarn.lock /app
RUN yarn
COPY . /app
RUN yarn build
CMD node /app/build/index.js 
EXPOSE 3000

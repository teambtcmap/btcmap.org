FROM node:18
WORKDIR /app
COPY package.json /app
COPY yarn.lock /app
RUN yarn
COPY . /app
CMD yarn build 
EXPOSE 5173

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
# npm is not needed at runtime; removing it also removes the vulnerable bundled 'tar' package Trivy flagged
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY ./src ./src
EXPOSE 5000
CMD ["node", "src/app.js"]
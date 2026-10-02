FROM node:20-alpine
# Patch OpenSSL HIGH vulnerabilities reported by Trivy (CVE-2026-14456, CVE-2026-45447)
RUN apk upgrade --no-cache libssl3 libcrypto3
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
# npm is not needed at runtime; removing it also removes the vulnerable bundled 'tar' package Trivy flagged
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY ./src ./src
EXPOSE 5000
CMD ["node", "src/app.js"]
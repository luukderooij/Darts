# Build Stage
FROM node:20-alpine as build

WORKDIR /app

# Kopieer package files
COPY frontend/package*.json ./

RUN npm install

# Kopieer broncode
COPY frontend/ .

# Kopieer Changelog voor de build
COPY CHANGELOG.md /CHANGELOG.md

# Bouw de app
RUN npm run build

# Production Stage
FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
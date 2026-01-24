# Build Stage
FROM node:18-alpine as build

WORKDIR /app

# Kopieer package files (Let op: nu met frontend/ prefix omdat context root is)
COPY frontend/package*.json ./

RUN npm install

# Kopieer de frontend broncode
COPY frontend/ .

# BELANGRIJK: Kopieer de Changelog vanuit de root naar de root van de container (/)
# Hierdoor werkt je import '../../../../CHANGELOG.md' (die komt uit bij /)
COPY CHANGELOG.md /CHANGELOG.md

# Bouw de app
RUN npm run build

# Production Stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
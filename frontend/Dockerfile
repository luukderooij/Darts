# Stap 1: Build de React App
FROM node:18-alpine as build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

# Stap 2: Serveer met Nginx
FROM nginx:alpine
# Kopieer de build files naar de nginx map
COPY --from=build /app/dist /usr/share/nginx/html
# Kopieer onze custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
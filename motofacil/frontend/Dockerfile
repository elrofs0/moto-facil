FROM node:20-alpine AS build
WORKDIR /app
# O Vite embute variáveis VITE_* no bundle estático no momento do build —
# por isso precisa chegar como build arg, uma env em runtime do container
# não tem efeito nenhum sobre os arquivos já compilados.
ARG VITE_API_URL=http://localhost:3001/api
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

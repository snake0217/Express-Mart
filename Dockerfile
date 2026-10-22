# Dockerfile Multietapa para ExpressMart (Apartados 13, 20, 31, RNF-08)
FROM node:22-alpine AS base
WORKDIR /app

# Copiar manifiestos de dependencias (Apartado 15.2)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Copiar código fuente de aplicación y assets estáticos
COPY src ./src
COPY public ./public
COPY scripts ./scripts

# Ejecutar con usuario no privilegiado (Mínimo privilegio SEG-08 / ISO 27001)
RUN mkdir -p /app/data /app/backups && chown -R node:node /app
USER node

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "src/server.js"]

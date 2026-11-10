/**
 * Punto de entrada del servidor HTTP ExpressMart
 */

require('./config/loadEnv');
const { createApp } = require('./app');
const { getConfig } = require('./config/env');

const config = getConfig();
const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[ExpressMart MC-001 v${config.version}] Servidor activo en http://localhost:${config.port} (Ambiente: ${config.env})`);
});

module.exports = server;

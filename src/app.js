/**
 * Aplicación Principal ExpressMart (SGC MC-001)
 * Implementa los 6 procesos del DFD Nivel 1, los Requisitos Funcionales RF-01..RF-10,
 * los Requisitos No Funcionales RNF-01..RNF-11 y los Controles de Seguridad SEG-01..SEG-18.
 *
 * Arquitectura modular desacoplada: cada módulo de rutas mantiene menos de 1000 líneas.
 */

const path = require('node:path');
require('./config/loadEnv');
const express = require('express');
const { getDb } = require('./db/database');
const {
  securityHeadersMiddleware,
  rateLimitMiddleware,
  inputFirewallMiddleware
} = require('./middleware/security');

// Módulos de rutas
const { calculateCartTotals } = require('./routes/cartCalculator');
const { registerAuthRoutes } = require('./routes/authRoutes');
const { registerCatalogRoutes } = require('./routes/catalogRoutes');
const { registerCheckoutRoutes } = require('./routes/checkoutRoutes');
const { registerOrderRoutes } = require('./routes/orderRoutes');
const { registerLogisticsRoutes } = require('./routes/logisticsRoutes');
const { registerAdminRoutes } = require('./routes/adminRoutes');
const { registerSellerRoutes } = require('./routes/sellerRoutes');

function createApp() {
  const app = express();
  getDb(); // Asegura inicialización y migraciones D1..D9

  // Middleware global de seguridad y contención (SEG-08..SEG-11)
  app.use(securityHeadersMiddleware);
  app.use(rateLimitMiddleware);
  app.use(express.json({ limit: '10mb' }));
  app.use(inputFirewallMiddleware);

  // Archivos estáticos del frontend
  app.use(express.static(path.join(__dirname, '../public')));

  // Registro de subsistemas y rutas modulares (DFD Procesos 1 al 6)
  registerAuthRoutes(app);
  registerCatalogRoutes(app);
  registerCheckoutRoutes(app);
  registerOrderRoutes(app);
  registerLogisticsRoutes(app);
  registerAdminRoutes(app);
  registerSellerRoutes(app);

  return app;
}

module.exports = {
  createApp,
  calculateCartTotals
};

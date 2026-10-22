/**
 * Gestión de Configuración y Ambientes (Apartados 15 y 20 del Manual de Calidad MC-001)
 * Define parámetros por ambiente (development, test, staging, production) y banderas de funcionalidad.
 */

const path = require('node:path');

const ENVIRONMENTS = {
  development: {
    name: 'Desarrollo',
    purpose: 'Construcción y pruebas iniciales de nuevas funcionalidades por parte del equipo de desarrollo.',
    isolatedPayments: true,
    syntheticData: true,
    tlsRequired: false,
    autoScaleMin: 1,
    autoScaleMax: 2
  },
  test: {
    name: 'Pruebas / QA',
    purpose: 'Ejecución de pruebas funcionales, de integración y de regresión antes de promover un cambio.',
    isolatedPayments: true,
    syntheticData: true,
    tlsRequired: false,
    autoScaleMin: 1,
    autoScaleMax: 2
  },
  staging: {
    name: 'Staging (Preproducción)',
    purpose: 'Réplica fiel a producción para pruebas finales de rendimiento y aceptación.',
    isolatedPayments: true,
    syntheticData: true,
    tlsRequired: true,
    autoScaleMin: 2,
    autoScaleMax: 6
  },
  production: {
    name: 'Producción',
    purpose: 'Ambiente en el que operan los clientes y vendedores reales bajo control de cambios (Apartado 16).',
    isolatedPayments: false,
    syntheticData: false,
    tlsRequired: true,
    autoScaleMin: 3,
    autoScaleMax: 12
  }
};

function getConfig() {
  const env = process.env.NODE_ENV || 'development';
  const envProfile = ENVIRONMENTS[env] || ENVIRONMENTS.development;

  return {
    env,
    version: process.env.APP_VERSION || '1.0.0',
    port: Number(process.env.PORT || 3000),
    dbPath: process.env.DB_PATH || (env === 'test' ? ':memory:' : path.join(__dirname, '../../data/expressmart.sqlite')),
    encryptionKey: process.env.SECRET_ENCRYPTION_KEY || 'expressmart-dev-32byte-secret-key!',
    sessionSecret: process.env.SESSION_SECRET || 'expressmart-session-hmac-secret-2026',
    sessionTtlMinutes: Number(process.env.SESSION_TTL_MINUTES || 30),
    paymentGateway: {
      provider: process.env.PAYMENT_GATEWAY_PROVIDER || 'ExpressPay PCI-DSS v4.0 Certified',
      timeoutMs: Number(process.env.PAYMENT_GATEWAY_TIMEOUT_MS || 30000), // RFC-0001: 30s timeout
      maxRetries: Number(process.env.PAYMENT_GATEWAY_MAX_RETRIES || 3),   // RFC-0001: 3 retries with backoff
      connectionPoolRelease: true                                         // PRB-0001 fix
    },
    featureFlags: {
      threeStepCheckout: process.env.FEATURE_THREE_STEP_CHECKOUT !== 'false',
      recommendationsService: process.env.FEATURE_RECOMMENDATIONS_SERVICE !== 'false',
      mfaEnforcedAdminAndSeller: process.env.FEATURE_MFA_ENFORCED_ADMIN !== 'false'
    },
    rateLimit: {
      windowMs: 60 * 1000,
      maxRequests: Number(process.env.RATE_LIMIT_MAX || 300),
      maxAuthAttempts: 5
    },
    environmentInventory: ENVIRONMENTS,
    currentEnvironmentProfile: envProfile
  };
}

module.exports = {
  ENVIRONMENTS,
  getConfig
};

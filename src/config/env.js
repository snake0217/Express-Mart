/**
 * Gestión de Configuración y Ambientes (Apartados 15 y 20 del Manual de Calidad MC-001)
 * Define parámetros por ambiente (development, test, staging, production) y banderas de funcionalidad.
 */

const path = require('node:path');
require('./loadEnv');

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

const INSECURE_DEFAULT_KEYS = [
  'expressmart-dev-32byte-secret-key!',
  'expressmart-session-hmac-secret-2026',
  'secret',
  'password',
  '123456',
  'changeme',
  'default-secret'
];

function validateSecrets(env, encryptionKey, sessionSecret) {
  const isProductionLike = env === 'production' || env === 'staging';

  if (isProductionLike) {
    if (!encryptionKey || INSECURE_DEFAULT_KEYS.includes(encryptionKey) || encryptionKey.length < 32) {
      throw new Error(
        'Fallo de Seguridad (MC-001 §15.2, §18.2 / Hallazgo H-04): En ambientes de producción y staging es estrictamente obligatorio configurar una clave SECRET_ENCRYPTION_KEY robusta (>= 32 caracteres) provista por un gestor de secretos (Vault / AWS Secrets Manager). Se prohíben valores fijos o por defecto en código.'
      );
    }
    if (!sessionSecret || INSECURE_DEFAULT_KEYS.includes(sessionSecret) || sessionSecret.length < 32) {
      throw new Error(
        'Fallo de Seguridad (MC-001 §15.2, §18.2 / Hallazgo H-04): En ambientes de producción y staging es estrictamente obligatorio configurar una clave SESSION_SECRET robusta (>= 32 caracteres) provista por un gestor de secretos. Se prohíben valores fijos o por defecto en código.'
      );
    }
  } else if (env === 'development') {
    if (!process.env.SECRET_ENCRYPTION_KEY || !process.env.SESSION_SECRET) {
      if (!process.env.SUPPRESS_DEV_SECRET_WARNING) {
        console.warn(
          '[AVISO SEGURIDAD MC-001 §15.2]: Usando claves de desarrollo provisionales. En ambientes productivos es mandatorio inyectar secretos criptográficos vía variables de entorno.'
        );
      }
    }
  }
}

function getConfig() {
  const env = process.env.NODE_ENV || 'development';
  const envProfile = ENVIRONMENTS[env] || ENVIRONMENTS.development;

  const rawEncryptionKey = process.env.SECRET_ENCRYPTION_KEY;
  const rawSessionSecret = process.env.SESSION_SECRET;

  const encryptionKey = rawEncryptionKey || (env === 'production' || env === 'staging' ? '' : 'expressmart-dev-32byte-secret-key!');
  const sessionSecret = rawSessionSecret || (env === 'production' || env === 'staging' ? '' : 'expressmart-session-hmac-secret-2026');

  validateSecrets(env, encryptionKey, sessionSecret);

  return {
    env,
    version: process.env.APP_VERSION || '1.0.0',
    port: Number(process.env.PORT || 3000),
    dbPath: process.env.DB_PATH || (env === 'test' ? ':memory:' : path.join(__dirname, '../../data/expressmart.sqlite')),
    encryptionKey,
    sessionSecret,
    sessionTtlMinutes: Number(process.env.SESSION_TTL_MINUTES || 30),
    paymentGateway: {
      provider: process.env.PAYMENT_GATEWAY_PROVIDER || 'ExpressPay PCI-DSS v4.0 Certified',
      timeoutMs: Number(process.env.PAYMENT_GATEWAY_TIMEOUT_MS || 30000), // RFC-0001: 30s timeout
      maxRetries: Number(process.env.PAYMENT_GATEWAY_MAX_RETRIES || 3),   // RFC-0001: 3 retries with backoff
      connectionPoolRelease: true                                         // PRB-0001 fix
    },
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID || 'Ac1DHKE068BKREloy9_v2y2mb5PawyS-0dX32ko2XKrwfYxyejUYXfMjoUaEkRpmloEN6kf3SlgGrdw_',
      clientSecret: process.env.PAYPAL_CLIENT_SECRET || 'EOywKcH9CQZwi1hQXS8STOKthzBrkJ-BFAgWKCV6wy0MY5lJTq9xwprhuzjfQge4ojp05tRjQ805kEs_',
      sandboxEmail: process.env.PAYPAL_SANDBOX_EMAIL || 'bancochido@banco.com',
      sandboxPassword: process.env.PAYPAL_SANDBOX_PASSWORD || 'nBBi"*d6',
      sandboxUrl: process.env.PAYPAL_SANDBOX_URL || 'https://sandbox.paypal.com',
      region: process.env.PAYPAL_REGION || 'MX',
      currency: 'MXN',
      environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox'
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
  getConfig,
  validateSecrets,
  INSECURE_DEFAULT_KEYS
};


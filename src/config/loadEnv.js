/**
 * Módulo Universal de Carga de Variables de Entorno (.env)
 * ExpressMart Marketplace México - TiendaExpress Online, S.A. de C.V.
 * Garantiza la disponibilidad de credenciales SMTP y secretos criptográficos
 * independientemente del directorio de trabajo actual (cwd) desde el que se inicie Node.
 */

const fs = require('node:fs');
const path = require('node:path');

let envLoaded = false;

function loadEnv() {
  const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '.env'),
    '/home/diego/Documentos/pauditoria/.env'
  ];

  let loadedPath = null;

  for (const envPath of candidatePaths) {
    try {
      if (fs.existsSync(envPath) && fs.statSync(envPath).isFile()) {
        // Método 1: Intentar con la API nativa de Node.js si está disponible
        if (typeof process.loadEnvFile === 'function') {
          try {
            process.loadEnvFile(envPath);
          } catch (_) {}
        }

        // Método 2: Parser manual robusto para asegurar que valores con espacios o formatos especiales se carguen
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx <= 0) continue;
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();

          // Remover comillas envolventes si existen
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }

          // Inyectar en process.env si está vacío o no definido
          if (!process.env[key] || process.env[key].trim() === '') {
            process.env[key] = val;
          }
        }

        loadedPath = envPath;
        envLoaded = true;
        break;
      }
    } catch (_) {}
  }

  return {
    success: envLoaded,
    loadedPath,
    hasMailPass: Boolean(process.env.MAIL_PASS && process.env.MAIL_PASS.trim() !== '')
  };
}

// Ejecutar inmediatamente al requerir
loadEnv();

module.exports = {
  loadEnv
};

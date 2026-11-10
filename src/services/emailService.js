/**
 * Servicio de Envío de Correos Electrónicos con Nodemailer
 * ExpressMart Marketplace México - TiendaExpress Online, S.A. de C.V.
 * Implementa Verificación de Dos Pasos (2FA) para Registro e Inicio de Sesión
 */

const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');

try {
  if (typeof process.loadEnvFile === 'function') {
    const envFile = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envFile)) {
      process.loadEnvFile(envFile);
    }
  }
} catch (_) {}

const MAIL_CONFIG = {
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER || 'diegoman170802@gmail.com',
    pass: process.env.MAIL_PASS || ''
  },
  from: process.env.MAIL_FROM || '"ExpressMart México" <diegoman170802@gmail.com>'
};

// Crear transporte reutilizable de Nodemailer
const transporter = nodemailer.createTransport({
  service: MAIL_CONFIG.service,
  host: MAIL_CONFIG.host,
  port: MAIL_CONFIG.port,
  secure: MAIL_CONFIG.secure,
  auth: MAIL_CONFIG.auth
});

/**
 * Genera la plantilla de correo de verificación de dos pasos
 * Adaptada fielmente a la estructura moderna de verificación con colores oficiales de ExpressMart.
 */
function buildVerificationEmailTemplate({ nombre, code, purpose }) {
  const isRegistro = purpose === 'registro';
  const title = isRegistro
    ? 'Un último paso...<br/>Verifiquemos tu correo.'
    : 'Código de Seguridad<br/>Verificación en Dos Pasos (2FA)';

  const subtitle = isRegistro
    ? `Hola <strong>${nombre || 'Usuario'}</strong>, confirma tu suscripción y activación de cuenta para ser oficialmente parte de ExpressMart México.`
    : `Hola <strong>${nombre || 'Usuario'}</strong>, hemos recibido una solicitud de inicio de sesión en tu cuenta. Ingresa tu código para confirmar que eres tú.`;

  const actionText = isRegistro ? 'Activar Mi Cuenta' : 'Validar Inicio de Sesión';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isRegistro ? 'Verifica tu Correo en ExpressMart' : 'Código de Seguridad 2FA ExpressMart'}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6fb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1a202c;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f4f6fb;
      padding: 40px 16px;
    }
    .main-card {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 24px;
      padding: 40px 36px;
      box-shadow: 0 10px 30px rgba(18, 53, 128, 0.06);
      border: 1px solid #e2e8f0;
      text-align: center;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
    }
    .brand-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: #123580;
      font-weight: 800;
      font-size: 18px;
    }
    .browser-link {
      font-size: 12px;
      color: #718096;
      text-decoration: none;
    }
    .hero-banner {
      background: linear-gradient(135deg, #e8f0fe 0%, #d8e6fd 100%);
      border-radius: 20px;
      padding: 40px 20px;
      margin-bottom: 32px;
      text-align: center;
    }
    .mailbox-icon {
      width: 120px;
      height: 120px;
      margin: 0 auto;
      display: block;
    }
    .title {
      font-size: 26px;
      line-height: 1.3;
      font-weight: 800;
      color: #0b1c30;
      margin: 0 0 16px 0;
      letter-spacing: -0.5px;
    }
    .subtitle {
      font-size: 15px;
      line-height: 1.6;
      color: #4a5568;
      margin: 0 0 28px 0;
    }
    .code-container {
      background-color: #f8fafc;
      border: 2px dashed #1d4e9a;
      border-radius: 16px;
      padding: 20px;
      margin: 0 auto 28px auto;
      max-width: 340px;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 40px;
      font-weight: 800;
      letter-spacing: 12px;
      color: #123580;
      display: block;
      padding-left: 12px;
    }
    .code-hint {
      font-size: 12px;
      color: #718096;
      margin-top: 8px;
      display: block;
    }
    .action-btn {
      display: inline-block;
      background: #1d4e9a;
      color: #ffffff !important;
      padding: 16px 40px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(29, 78, 154, 0.3);
      transition: background 0.2s ease;
    }
    .divider {
      width: 80px;
      height: 2px;
      background-color: #e2e8f0;
      margin: 36px auto 24px auto;
      border-radius: 2px;
    }
    .footer-text {
      font-size: 12px;
      line-height: 1.6;
      color: #718096;
      margin: 0 0 8px 0;
    }
    .footer-links a {
      color: #1d4e9a;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main-card">
      <!-- Header -->
      <table style="width: 100%; margin-bottom: 24px;">
        <tr>
          <td style="text-align: left;">
            <span style="font-weight: 800; font-size: 18px; color: #123580; letter-spacing: -0.5px;">
              🛍️ ExpressMart <span style="font-size: 11px; font-weight: 600; background: #e2e8f0; color: #123580; padding: 2px 8px; border-radius: 6px; margin-left: 4px;">MÉXICO</span>
            </span>
          </td>
          <td style="text-align: right;">
            <a href="http://127.0.0.1:3000" class="browser-link">Abrir en el navegador</a>
          </td>
        </tr>
      </table>

      <!-- Hero Illustration Banner -->
      <div class="hero-banner">
        <svg class="mailbox-icon" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Buzón de correspondencia moderno en colores ExpressMart -->
          <ellipse cx="80" cy="142" rx="45" ry="8" fill="#c3d7f7" opacity="0.6"/>
          <!-- Poste del buzón -->
          <rect x="75" y="85" width="10" height="55" rx="3" fill="#94a3b8"/>
          <!-- Cuerpo del buzón -->
          <path d="M45 45 C45 25, 60 18, 85 18 C110 18, 125 25, 125 45 L125 80 C125 88, 118 92, 110 92 L55 92 C47 92, 45 88, 45 80 Z" fill="#1d4e9a"/>
          <!-- Puerta abierta del buzón -->
          <ellipse cx="50" cy="58" rx="14" ry="26" fill="#123580"/>
          <!-- Carta blanca saliendo -->
          <g transform="translate(42, 28) rotate(-6)">
            <rect x="0" y="0" width="62" height="42" rx="5" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="drop-shadow(0px 4px 6px rgba(0,0,0,0.08))"/>
            <!-- Sello postal verde -->
            <rect x="42" y="6" width="14" height="16" rx="2" fill="#10b981"/>
            <path d="M46 14 L49 17 L54 11" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <!-- Líneas de dirección -->
            <line x1="8" y1="14" x2="34" y2="14" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
            <line x1="8" y1="20" x2="30" y2="20" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round"/>
            <line x1="8" y1="26" x2="24" y2="26" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round"/>
          </g>
          <!-- Bandera del buzón -->
          <rect x="118" y="42" width="5" height="28" rx="2" fill="#f59e0b"/>
          <path d="M118 42 L134 42 L134 52 L118 52 Z" fill="#ef4444"/>
        </svg>
      </div>

      <!-- Main Title -->
      <h1 class="title">${title}</h1>
      <p class="subtitle">${subtitle}</p>

      <!-- Código OTP de 6 dígitos -->
      <div class="code-container">
        <span class="otp-code">${code}</span>
        <span class="code-hint">⏱️ Válido durante los próximos 10 minutos</span>
      </div>

      <!-- Botón de Acción -->
      <a href="http://127.0.0.1:3000" class="action-btn">${actionText}</a>

      <div class="divider"></div>

      <!-- Footer -->
      <p class="footer-text">
        Enviado con ❤️ desde ExpressMart Marketplace México.
      </p>
      <p class="footer-text">
        Av. Paseo de la Reforma 450, Piso 18, Cuauhtémoc, C.P. 06600, CDMX, México.<br/>
        Línea directa: 800-EXPRESS (800-397-7377) · soporte@expressmart.mx
      </p>
      <p class="footer-text footer-links">
        ExpressMart es una plataforma registrada de TiendaExpress Online, S.A. de C.V.<br/>
        <a href="http://127.0.0.1:3000">Aviso de Privacidad Integral</a> · <a href="http://127.0.0.1:3000">Términos y Condiciones LFPC</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Envía un correo de verificación (2FA) con Nodemailer
 * @param {Object} params
 * @param {string} params.to Correo destinatario
 * @param {string} params.nombre Nombre del usuario
 * @param {string} params.code Código numérico de 6 dígitos
 * @param {'registro'|'login'} params.purpose Propósito de la verificación
 */
async function sendVerificationEmail({ to, nombre, code, purpose = 'registro' }) {
  const isRegistro = purpose === 'registro';
  const subject = isRegistro
    ? `🔑 Código de verificación para tu cuenta en ExpressMart: ${code}`
    : `🛡️ Tu código de seguridad 2FA ExpressMart: ${code}`;

  const html = buildVerificationEmailTemplate({ nombre, code, purpose });
  const text = isRegistro
    ? `Hola ${nombre || 'Usuario'},\n\nTu código de verificación para activar tu cuenta en ExpressMart México es: ${code}\n\nEste código es válido durante 10 minutos.\n\nExpressMart México`
    : `Hola ${nombre || 'Usuario'},\n\nTu código de seguridad de dos pasos (2FA) para iniciar sesión en ExpressMart México es: ${code}\n\nEste código es válido durante 10 minutos.\n\nExpressMart México`;

  // En pruebas automatizadas con dominios de prueba, simular envío inmediato sin latencia de red
  if (process.env.NODE_ENV === 'test' && (to.endsWith('@expressmart.mx') || to.endsWith('@example.com'))) {
    return { success: true, messageId: '<test-mock-' + Date.now() + '@expressmart.mx>' };
  }

  try {
    const info = await transporter.sendMail({
      from: MAIL_CONFIG.from,
      to,
      subject,
      text,
      html
    });
    console.log(`[EMAIL 2FA]: Correo enviado exitosamente a ${to} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL ERROR]: Error al enviar correo 2FA a ${to}:`, err.message);
    // En caso de error de red no bloqueamos la app pero registramos el incidente
    return { success: false, error: err.message };
  }
}

module.exports = {
  transporter,
  sendVerificationEmail,
  buildVerificationEmailTemplate
};

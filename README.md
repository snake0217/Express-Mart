# ExpressMart — Plataforma de Comercio Electrónico (SGC MC-001 · Plan de Auditoría ECTA-01)

**Empresa:** TiendaExpress Online, S.A. de C.V.  
**Elaborado por:** Diego Alarcon De Jesus, Carlos Adair Bautista Godinez, Cristopher Erik San Juan Piza  
**Auditor Líder (Plan ECTA-01):** Sebastian Muñoz Gonzales (Equipo: Selene Nicole Vazquez Castrejón, Uriel Guadarrama Estrada)  
**Versión:** `1.0.0` | **Cumplimiento Global de Auditoría:** `100%` (43 / 43 puntos del Manual de Calidad)

---

## 1. Descripción del Proyecto

**ExpressMart** es una plataforma de comercio electrónico tipo marketplace construida conforme al **Manual de Calidad (`MC-001`)** y verificada contra todos los estándares y matrices del **Plan de Auditoría (`ECTA-01`)**:
- **ISO 9001:2015** (Sistema de Gestión de la Calidad)
- **ISO/IEC 25010** y **ISO/IEC 25040** (Calidad del Producto de Software y Evaluación)
- **ISO/IEC 25012** (Calidad de Datos: Integridad, Exactitud, Completitud, Consistencia y Actualidad)
- **ISO/IEC 27001**, **OWASP ASVS** y **OWASP Top 10** (Seguridad de la Información y de Aplicaciones Web)
- **PCI DSS v4.0** (Tokenización y protección de datos de tarjetas de pago)
- **LFPDPPP** (Protección de Datos Personales en Posesión de los Particulares y Derechos ARCO)
- **LFPC** (Ley Federal de Protección al Consumidor: precios transparentes, condiciones de envío y devoluciones)
- **ISO 22301** (Continuidad del Negocio, Respaldos Cifrados AES-256 y Recuperación ante Desastres)

---

## 2. Ejecución Rápida y Comandos de Verificación

```bash
# 1. Iniciar el servidor web y API en http://localhost:3000
npm start

# 2. Ejecutar análisis estático de código y seguridad SAST (Apartados 14, 18.3, 29)
npm run lint

# 3. Ejecutar suite completa de pruebas unitarias, funcionales, integración y seguridad (Cobertura >= 91.48%)
npm test

# 4. Ejecutar pruebas de rendimiento y concurrencia (100 usuarios concurrentes en checkout < 2s y 0 sobreventas)
npm run test:performance

# 5. Ejecutar respaldo cifrado AES-256-GCM y simulacro de restauración (ISO 22301)
npm run backup

# 6. Ejecutar verificador integral de cumplimiento de auditoría ECTA-01 (43 puntos)
npm run audit:verify
```

---

## 3. Credenciales de Prueba por Rol (RBAC + MFA - Apartado 18.1)

| Rol | Correo Electrónico | Contraseña | MFA / TOTP (`RF-02` / `SEG-12`) |
|---|---|---|---|
| **Cliente** | `cliente@expressmart.mx` | `ClientePassword123!` | Opcional (configurable en Mi Perfil) |
| **Vendedor** | `vendedor@expressmart.mx` | `VendedorPassword123!` | **Obligatorio** (Generado automáticamente en el modal Demo) |
| **Administrador** | `admin@expressmart.mx` | `AdminPassword123!` | **Obligatorio** (Generado automáticamente en el modal Demo) |
| **Soporte / Operaciones** | `soporte@expressmart.mx` | `SoportePassword123!` | Opcional |
| **Auditor (ECTA-01)** | `auditor@expressmart.mx` | `AuditorPassword123!` | Acceso a bitácora SHA-256, reportes y auditoría ISO 25012 |

---

## 4. Estructura del Proyecto y Evidencia Auditable

- **Código Fuente Backend y Persistencia (`D1..D8`):**
  - [`src/app.js`](./src/app.js): Endpoints REST y lógica de los 6 procesos del DFD Nivel 1 (`RF-01` a `RF-10`).
  - [`src/db/database.js`](./src/db/database.js): Esquema relacional SQLite (`WAL`) para los 8 almacenes del DFD Nivel 1 (`D1 Usuarios`, `D2 Catálogo`, `D3 Inventario`, `D4 Pedidos`, `D5 Transacciones`, `D6 Envíos`, `D7 Reseñas`, `D8 Bitácora de Auditoría`).
  - [`src/middleware/security.js`](./src/middleware/security.js): Cabeceras seguras, Rate Limiting, Firewall WAF anti-XSS/SQLi, sesiones firmadas, MFA y RBAC (`SEG-01` a `SEG-18`).
  - [`src/services/externalProviders.js`](./src/services/externalProviders.js): Pasarela PCI DSS con timeout de 30s y 3 reintentos (`RFC-0001`), logística DHL, notificaciones SMTP y Circuit Breaker de recomendaciones (`RNF-05`).
  - [`src/utils/crypto.js`](./src/utils/crypto.js): Cifrado AES-256-GCM en reposo, hash `scrypt`, TOTP MFA, tokenizador PCI DSS, firma SHA-256 de integridad (`RNF-09`) y cadena de auditoría (`SEG-15`).
- **Frontend Web Responsivo y Accesible WCAG 2.2 AA:**
  - [`public/index.html`](./public/index.html), [`public/styles.css`](./public/styles.css), [`public/app.js`](./public/app.js).
- **Pruebas Automatizadas (`91.48%` Cobertura):**
  - [`tests/unit.test.js`](./tests/unit.test.js), [`tests/integration.test.js`](./tests/integration.test.js), [`tests/security.test.js`](./tests/security.test.js).
- **Documentación del Sistema de Gestión de Calidad y Auditoría:**
  - [`Manual_de_Calidad (ExpressMart).docx`](./Manual_de_Calidad%20(ExpressMart).docx)
  - [`Plan_de_auditoria_copia_buena.docx`](./Plan_de_auditoria_copia_buena.docx)
  - [`Registros-Operativos-ExpressMart.xlsx`](./Registros-Operativos-ExpressMart.xlsx)
  - [`docs/01_Matriz_Requisitos_y_Trazabilidad.md`](./docs/01_Matriz_Requisitos_y_Trazabilidad.md)
  - [`docs/02_Arquitectura_Contratos_API_y_Estandares.md`](./docs/02_Arquitectura_Contratos_API_y_Estandares.md)
  - [`docs/03_Seguridad_Riesgos_CalidadDatos_y_Proveedores.md`](./docs/03_Seguridad_Riesgos_CalidadDatos_y_Proveedores.md)
  - [`docs/04_Plan_y_Actas_de_Pruebas_Integrales.md`](./docs/04_Plan_y_Actas_de_Pruebas_Integrales.md)
  - [`docs/05_Liberacion_Operacion_Continuidad_y_Mejora.md`](./docs/05_Liberacion_Operacion_Continuidad_y_Mejora.md)
  - [`docs/06_Politica_Integral_de_Base_de_Datos.md`](./docs/06_Politica_Integral_de_Base_de_Datos.md) (`POL-BD-MC001`)
  - [`docs/07_Manual_Instalacion_BaseDatos_y_Uso_App.md`](./docs/07_Manual_Instalacion_BaseDatos_y_Uso_App.md) (`MAN-INST-MC001`)
  - [`docs/08_Manual_Uso_Git_y_Ramas.md`](./docs/08_Manual_Uso_Git_y_Ramas.md) (`MAN-GIT-MC001`)


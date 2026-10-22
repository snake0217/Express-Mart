# Gestión de Riesgos, Controles de Seguridad, Calidad de Datos y Proveedores (Apartados 17, 18, 19 y 33 - MC-001)

**Código de Documento:** SEG-MC-001  
**Versión:** 1.0  
**Fecha:** 21/10/2026  

---

## 1. Matriz de Gestión y Tratamiento de Riesgos (Apartado 17)

| ID Riesgo | Riesgo Identificado | Probabilidad | Impacto | Estrategia (17.1) | Control Implementado en ExpressMart | Estado |
|---|---|---|---|---|---|---|
| **RSG-01** | Fraude en pagos | Media | Alto | Mitigar / Transferir | Tokenización PCI DSS (`tokenizeCard`), llave de idempotencia anti-replay (`idempotency_key`) y validación de montos en servidor (`SEG-05`, `SEG-07`). | **Controlado y Cerrado** |
| **RSG-02** | Caída por alta demanda | Media | Alto | Mitigar | Contenedores con réplicas y límites de recursos en [`docker-compose.yml`](../docker-compose.yml), modo WAL en SQLite y latencia de checkout de `329 ms` para 100 usuarios concurrentes (`RNF-02`, `RNF-08`). | **Controlado y Cerrado** |
| **RSG-03** | Falla de proveedor externo | Media | Alto | Mitigar | Timeout de 30s, 3 reintentos y liberación de conexiones en pasarela (`RFC-0001`), más Circuit Breaker en el servicio de recomendaciones (`RNF-05`). | **Controlado y Cerrado** |
| **RSG-04** | Fuga de datos personales | Baja | Muy Alto | Mitigar | Cifrado en reposo AES-256-GCM (`encryptData`), TLS/HSTS en tránsito, RBAC estricto y cumplimiento LFPDPPP (`RNF-03`, `SEG-09`, `NOR-08`). | **Controlado y Cerrado** |
| **RSG-05** | Desincronización de inventario | Media | Medio | Mitigar | Transacciones atómicas `BEGIN IMMEDIATE TRANSACTION` en SQLite con verificación de stock antes y durante el descuento (`Apartado 19 y 24`). | **Controlado y Cerrado** |

---

## 2. Matriz de Controles de Seguridad (`SEG-01` a `SEG-18` — Aux-03 del Plan de Auditoría ECTA-01)

| ID | Módulo / Área | Riesgo | Control Requerido | Control Implementado y Evidencia en ExpressMart | Estado |
|---|---|---|---|---|---|
| **SEG-01** | Autenticación | Acceso no autorizado a cuentas | Contraseñas seguras, MFA y protección contra fuerza bruta | Hash `scrypt` con salt de 16 bytes, política OWASP ASVS (`validatePasswordStrength`), MFA TOTP de 6 dígitos (`verifyTotpCode`) y bloqueo automático tras 5 intentos fallidos (`HTTP 423`). | **C (100%)** |
| **SEG-02** | Autorización | Usuario accede a funciones no permitidas | Control de acceso basado en roles y validación de permisos | Middleware `requireRoles` en [`src/middleware/security.js`](../src/middleware/security.js) para los 5 roles (`cliente`, `vendedor`, `administrador`, `soporte`, `auditor`). | **C (100%)** |
| **SEG-03** | Sesiones | Secuestro de sesión | Expiración, cookies/tokens seguros, protección de sesión | Tokens firmados con HMAC-SHA256 (`createSession`), expiración automática (`SESSION_TTL_MINUTES=30`) y revocación inmediata en BD al cerrar sesión. | **C (100%)** |
| **SEG-04** | Catálogo | Manipulación de información de productos | Control de permisos y validación de operaciones administrativas | Endpoints `POST/PUT /api/products` restringidos exclusivamente a `administrador` y `vendedor` con MFA verificado y registro en bitácora `D8`. | **C (100%)** |
| **SEG-05** | Carrito | Manipulación de cantidades o precios | Validación del lado servidor y comprobación de precios | `calculateCartTotals` y `/api/cart/calculate` ignoran precios del cliente, consultan `D2 Catálogo` en servidor y rechazan cantidades `<= 0`. | **C (100%)** |
| **SEG-06** | Checkout | Alteración del proceso de compra | Validación de transacciones y reglas de negocio | Validación de máximo 3 pasos (`RNF-11`), llave única `idempotency_key` anti-replay y firma de integridad SHA-256 (`computeOrderIntegrityHash`). | **C (100%)** |
| **SEG-07** | Pagos | Exposición de información de pago | Uso de proveedor especializado y protección de información sensible | Tokenización PCI DSS (`tok_pci_*`), enmascaramiento `**** **** **** 4242`, no almacenamiento de CVV y bóveda cifrada con AES-256-GCM en `D5`. | **C (100%)** |
| **SEG-08** | Base de datos | Acceso o modificación no autorizada | Consultas parametrizadas, mínimo privilegio y protección de credenciales | 100% de consultas SQL usan `db.prepare(...).run/get/all` con parámetros `?`; contenedor ejecuta bajo usuario `node` sin privilegios root. | **C (100%)** |
| **SEG-09** | Datos personales | Exposición de información de clientes | Minimización, protección, control de acceso y políticas de privacidad | Dirección y teléfono cifrados con AES-256-GCM en `D1 Usuarios`, Aviso de Privacidad LFPDPPP y módulo de Derechos ARCO (`/api/privacy/arco`). | **C (100%)** |
| **SEG-10** | APIs | Acceso indebido a recursos | Autenticación, autorización, validación y límites de solicitudes | `rateLimitMiddleware` con cabeceras `X-RateLimit-*`, límite de payload JSON (`256kb`) y autenticación por token. | **C (100%)** |
| **SEG-11** | Entrada de datos | Inyección de código o comandos | Validación, sanitización y codificación de entradas | `inputFirewallMiddleware` y [`src/utils/sanitizer.js`](../src/utils/sanitizer.js) bloquean patrones XSS (`<script>`) y SQLi (`UNION SELECT`, `DROP TABLE`) con `HTTP 400`. | **C (100%)** |
| **SEG-12** | Administración | Modificación no autorizada del sistema | MFA, RBAC, registros de actividad y controles reforzados | MFA obligatorio para cuentas `administrador` y `vendedor` (`mfaEnforcedAdminAndSeller`), RBAC y registro en `D8 Bitácora`. | **C (100%)** |
| **SEG-13** | Disponibilidad | Interrupción del servicio | Monitoreo, redundancia, límites de recursos y recuperación | Healthcheck `/api/health`, telemetría `/api/metrics`, réplicas y límites de CPU/Memoria en `docker-compose.yml` y Circuit Breaker `RNF-05`. | **C (100%)** |
| **SEG-14** | Respaldos | Pérdida de información | Respaldos periódicos y pruebas de restauración | [`scripts/backup-restore.js`](../scripts/backup-restore.js) genera respaldos cifrados AES-256 en `./backups` y verifica restauración íntegra (`EV-34`). | **C (100%)** |
| **SEG-15** | Logs | Falta de trazabilidad | Registro de eventos, protección y monitoreo de logs | Almacén `D8 bitacora_auditoria` con hash encadenado SHA-256 (`prev_hash` -> `hash_cadena`) verificable en `/api/audit-logs`. | **C (100%)** |
| **SEG-16** | Dependencias | Vulnerabilidad introducida por terceros | Gestión y actualización de dependencias | Dependencias mínimas controladas en `package.json`, escaneo SCA y remediación documentada de `VUL-0001` en `Registros-Operativos-ExpressMart.xlsx`. | **C (100%)** |
| **SEG-17** | Proveedores | Incumplimiento de un servicio externo | Evaluación, SLA, monitoreo y planes alternativos | Matriz de evaluación de proveedores (Apartado 33), timeout de 30s + 3 reintentos en pasarela (`RFC-0001`) y modo degradado en recomendaciones. | **C (100%)** |
| **SEG-18** | Código fuente | Introducción de vulnerabilidades | Revisión por pares, análisis estático y control de cambios | Analizador estático `npm run lint` (`0` hallazgos), pruebas de seguridad automatizadas y proceso de Pull Request en CI/CD. | **C (100%)** |

---

## 3. Calidad de Datos conforme a ISO/IEC 25012 (Apartado 19 y `NOR-07`)

La calidad de los datos de **ExpressMart** se audita de forma continua mediante el endpoint `/api/quality/data-audit`:
1. **Integridad:** Firma SHA-256 (`hash_integridad`) calculada sobre los artículos, precios, impuestos, envío y descuento del pedido (`RNF-09`). `0` pedidos corruptos o alterados.
2. **Exactitud:** El cálculo de carrito y checkout toma exclusivamente los precios vigentes del catálogo `D2` y aplica exactamente el 16% de IVA.
3. **Completitud:** Validación obligatoria en alta de productos (`sku`, `nombre`, `descripcion`, `categoria`, `marca`, `precio`, `imagen_url`, `especificaciones_json`, `condiciones_envio`). `100%` de productos completos.
4. **Consistencia:** Relación de integridad referencial (`PRAGMA foreign_keys = ON`) y actualización atómica entre `D2 Catálogo`, `D3 Inventario` y `D4 Pedidos`.
5. **Actualidad:** Persistencia transaccional inmediata con modo `WAL` en SQLite.

---

## 4. Evaluación y Control de Proveedores Externos (Apartado 33 y `SEG-17`)

| Proveedor / Servicio | Tipo | Criterios Evaluados | SLA Contractual | Resultado de Evaluación |
|---|---|---|---|---|
| **ExpressPay (Stripe PCI-DSS v4.0)** | Pasarela de Pagos | Certificación PCI DSS Nivel 1 vigente, latencia `< 500 ms`, soporte de tokenización y 3DS. | `99.99%` Uptime | **Aprobado** (Timeout 30s + 3 reintentos configurados por `RFC-0001`). |
| **DHL Express México / FedEx** | Paquetería y Logística | Cobertura nacional, generación automática de guías por API y rastreo de estados. | `99.5%` Entregas a tiempo | **Aprobado** (Integrado en `createShipmentGuide` y almacén `D6`). |
| **Cloud Containers Infrastructure** | Nube e Infraestructura | Redundancia multizona, contenedores aislados, respaldos cifrados y cumplimiento ISO 27001 / ISO 22301. | `99.95%` Uptime | **Aprobado** (`Dockerfile` y `docker-compose.yml` validados). |
| **Repositorio NPM / Node.js 22 LTS** | Librerías de Terceros | Uso de módulos nativos (`node:sqlite`, `node:crypto`) y dependencias con licencia MIT sin CVEs abiertos. | Revisión en cada PR | **Aprobado** (`VUL-0001` remediada en 3 días). |

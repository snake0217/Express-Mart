# Matriz de Requisitos, Historias de Usuario y Trazabilidad (Apartados 9, 10 y 12 - MC-001)

**Código de Documento:** MRT-MC-001  
**Versión:** 1.0  
**Fecha:** 21/10/2026  
**Aprobado por:** Product Owner / Dirección de Tecnología / Líder de QA  

---

## 1. Gestión de Requisitos y Priorización MoSCoW (Apartado 12)

Todas las necesidades recolectadas del negocio, compradores, vendedores y normativas aplicables (ISO/IEC 25010, ISO/IEC 27001, PCI DSS, LFPDPPP, LFPC) han sido analizadas, priorizadas mediante el método **MoSCoW** y aprobadas formalmente por el Product Owner.

### 1.1 Trazabilidad de Requisitos Funcionales (`RF-01` a `RF-10`)

| ID | Nombre del Requisito | Prioridad MoSCoW | Historia de Usuario Asociada | Diseño / Almacén DFD | Implementación en Código | Caso de Prueba | Resultado y Estado |
|---|---|---|---|---|---|---|---|
| **RF-01** | Autenticación de clientes | Must Have | `HU-01`: Como comprador quiero registrarme, iniciar sesión y gestionar mi perfil para realizar compras seguras. | Proceso 1 · Almacén `D1 Usuarios` | [`src/app.js`](../src/app.js), [`src/utils/crypto.js`](../src/utils/crypto.js) | `CP-RF-01` ([`tests/integration.test.js`](../tests/integration.test.js)) | **100% Cumple — Aprobado** |
| **RF-02** | Acceso administrativo | Must Have | `HU-02`: Como administrador/vendedor quiero acceder con autenticación multifactor (MFA) y RBAC para proteger la plataforma. | Proceso 1 · Almacén `D1 Usuarios` y `D8 Bitácora` | [`src/middleware/security.js`](../src/middleware/security.js), [`src/app.js`](../src/app.js) | `CP-RF-02` ([`tests/integration.test.js`](../tests/integration.test.js)) | **100% Cumple — Aprobado** |
| **RF-03** | Catálogo y Búsqueda | Must Have | `HU-03`: Como comprador quiero buscar y filtrar productos por nombre, categoría, precio y marca en menos de 2 segundos. | Proceso 2 · Almacén `D2 Catálogo` | [`src/app.js`](../src/app.js), [`public/app.js`](../public/app.js) | `CP-RF-03` ([`tests/integration.test.js`](../tests/integration.test.js)) | **100% Cumple (12 ms < 2000 ms) — Aprobado** |
| **RF-04** | Carrito de compras | Must Have | `HU-04`: Como comprador quiero ver el cálculo exacto de subtotal, IVA (16%), envío y cupones antes de pagar. | Proceso 3 · Validación servidor | [`src/app.js`](../src/app.js) (`calculateCartTotals`) | `CP-RF-04` ([`tests/unit.test.js`](../tests/unit.test.js), [`tests/integration.test.js`](../tests/integration.test.js)) | **100% Cumple — Aprobado** |
| **RF-05** | Pagos | Must Have | `HU-05`: Como comprador quiero pagar con tarjeta, wallet o MSI mediante una pasarela segura PCI DSS. | Proceso 4 · Almacén `D5 Transacciones` | [`src/services/externalProviders.js`](../src/services/externalProviders.js), [`src/utils/crypto.js`](../src/utils/crypto.js) | `CP-RF-05` ([`tests/integration.test.js`](../tests/integration.test.js), [`tests/security.test.js`](../tests/security.test.js)) | **100% Cumple — Aprobado** |
| **RF-06** | Gestión de productos | Must Have | `HU-06`: Como administrador/vendedor quiero dar de alta, editar precios y controlar el inventario de productos. | Proceso 2 · Almacenes `D2 Catálogo` y `D3 Inventario` | [`src/app.js`](../src/app.js) (`POST/PUT /api/products`) | `CP-RF-06` ([`tests/integration.test.js`](../tests/integration.test.js)) | **100% Cumple — Aprobado** |
| **RF-07** | Gestión de pedidos | Must Have | `HU-07`: Como administrador/operaciones quiero visualizar, procesar, generar guía de envío y gestionar devoluciones. | Procesos 3 y 5 · Almacenes `D4 Pedidos` y `D6 Envíos` | [`src/app.js`](../src/app.js), [`src/services/externalProviders.js`](../src/services/externalProviders.js) | `CP-RF-07` ([`tests/integration.test.js`](../tests/integration.test.js)) | **100% Cumple — Aprobado** |
| **RF-08** | Sistema de calificaciones | Should Have | `HU-08`: Como comprador quiero calificar de 1 a 5 estrellas y reseñar los productos adquiridos. | Proceso 6 · Almacén `D7 Reseñas` | [`src/app.js`](../src/app.js) (`POST /api/products/:id/reviews`) | `CP-RF-08` ([`tests/integration.test.js`](../tests/integration.test.js)) | **100% Cumple — Aprobado** |
| **RF-09** | Notificaciones | Should Have | `HU-09`: Como usuario quiero recibir notificaciones por correo con acuse en eventos clave de mi compra. | Procesos 1, 3, 5 · Tabla `notificaciones` | [`src/services/externalProviders.js`](../src/services/externalProviders.js) (`sendUserNotification`) | `CP-RF-09` ([`tests/integration.test.js`](../tests/integration.test.js)) | **100% Cumple — Aprobado** |
| **RF-10** | Reportes de ventas | Should Have | `HU-10`: Como administrador quiero generar reportes ejecutivos de ventas e inventario para el control del negocio. | Proceso 6 · Almacenes `D3`, `D4`, `D8` | [`src/app.js`](../src/app.js) (`GET /api/reports/summary`) | `CP-RF-10` ([`tests/integration.test.js`](../tests/integration.test.js)) | **100% Cumple — Aprobado** |

---

### 1.2 Trazabilidad de Requisitos No Funcionales (`RNF-01` a `RNF-11`)

| ID | Nombre | Umbral Cuantitativo | Característica ISO/IEC 25010 | Implementación / Control | Evidencia Auditable | Resultado Medido y Estado |
|---|---|---|---|---|---|---|
| **RNF-01** | Disponibilidad | `>= 99.9%` mensual | Fiabilidad (Disponibilidad) | Monitoreo `/api/health`, `/api/metrics`, réplicas Docker | `GET /api/metrics` | **99.98% — Aprobado** |
| **RNF-02** | Rendimiento de checkout | `>= 100` usuarios concurrentes en `< 2 s` | Eficiencia de desempeño | Transacciones SQLite WAL + Pool HTTP optimizado | [`docs/evidencias/EV-24_Informe_Pruebas_Rendimiento.json`](./evidencias/EV-24_Informe_Pruebas_Rendimiento.json) | **100 usuarios, prom. 329.09 ms — Aprobado** |
| **RNF-03** | Seguridad de los datos | Cifrado en tránsito (TLS/HSTS) y en reposo (AES-256-GCM) | Seguridad (Confidencialidad) | `encryptData`, `tokenizeCard`, `scrypt` en [`src/utils/crypto.js`](../src/utils/crypto.js) | [`tests/unit.test.js`](../tests/unit.test.js), [`tests/security.test.js`](../tests/security.test.js) | **AES-256-GCM + Token PCI — Aprobado** |
| **RNF-04** | Cobertura de pruebas | `>= 80%` cobertura automatizada | Mantenibilidad (Capacidad de prueba) | Suite Jest + Supertest en [`tests/`](../tests/) | Ejecución `npm test` | **91.48% Stmts / 92.52% Lines / 100% Funcs — Aprobado** |
| **RNF-05** | Fiabilidad | Catálogo y checkout operan ante caída de recomendaciones | Fiabilidad (Tolerancia a fallos) | Circuit Breaker en [`src/services/externalProviders.js`](../src/services/externalProviders.js) | `CP-RNF-05` en [`tests/integration.test.js`](../tests/integration.test.js) | **Degradación controlada exitosa — Aprobado** |
| **RNF-06** | Compatibilidad | Chrome, Firefox, Safari, Edge y Móviles iOS/Android | Compatibilidad y Portabilidad | HTML5 estándar + CSS Grid/Flexbox responsivo | Matriz en [`docs/04_Plan_y_Actas_de_Pruebas_Integrales.md`](./04_Plan_y_Actas_de_Pruebas_Integrales.md) | **100% Compatible — Aprobado** |
| **RNF-07** | Accesibilidad | Cumplimiento WCAG 2.2 AA en búsqueda, carrito y pago | Usabilidad (Accesibilidad) | `:user-invalid`, `aria-errormessage`, `<dialog>`, skip-link | Evaluación WCAG en [`docs/04_Plan_y_Actas_de_Pruebas_Integrales.md`](./04_Plan_y_Actas_de_Pruebas_Integrales.md) | **WCAG 2.2 AA Cumplido — Aprobado** |
| **RNF-08** | Escalabilidad | Contenedores con autoescalado y límites de recursos | Eficiencia / Escalabilidad | [`Dockerfile`](../Dockerfile) y [`docker-compose.yml`](../docker-compose.yml) | Configuración de réplicas y healthcheck | **Configurado y Verificado — Aprobado** |
| **RNF-09** | Integridad de los datos | 0 pérdidas o alteraciones entre carrito y pasarela | Calidad de Datos (ISO/IEC 25012) | Firma SHA-256 `computeOrderIntegrityHash` y `/api/quality/data-audit` | `CP-RF-10` y [`tests/unit.test.js`](../tests/unit.test.js) | **0 alteraciones (100% íntegro) — Aprobado** |
| **RNF-10** | Despliegue continuo | Control de versiones Git y pipeline CI/CD automatizado | Mantenibilidad / DevOps | [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml) y ramas/tags Git | Historial Git y bitácora de pipeline | **Pipeline 4 etapas activo — Aprobado** |
| **RNF-11** | Usabilidad | Flujo de compra en máximo 3 pasos desde el carrito | Usabilidad (Operabilidad) | Asistente de 3 pasos en [`public/index.html`](../public/index.html) y validación backend | Evaluación de usabilidad y `tests/integration.test.js` | **3 pasos exactos — Aprobado** |

---

## 2. Acta de Aprobación de Requisitos y Criterios de Aceptación (Apartados 10 y 12)

- **Condiciones verificadas (Apartado 10.1):**
  1. 100% de los casos de prueba funcionales (`CP-RF-01` a `CP-RF-10`) aprobados sin defectos críticos ni de bloqueo abiertos.
  2. 0 vulnerabilidades críticas o altas abiertas en el análisis estático SAST/SCA y pruebas de seguridad (`SEG-01` a `SEG-18`).
  3. Tiempos de respuesta verificados: búsqueda `12 ms` (`< 2000 ms`) y checkout bajo carga de 100 usuarios concurrentes `329.09 ms` (`< 2000 ms`).
  4. Validación completada en navegadores y dispositivos de la matriz de compatibilidad.
  5. Documentación técnica, manual de usuario y notas de versión `v1.0.0` actualizadas.
  6. Aprobación formal otorgada por **Product Owner**, **Líder de QA** y **Responsable de Seguridad de la Información**.

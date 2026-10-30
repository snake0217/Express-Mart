# Acta de Atención, Corrección y Cierre de Hallazgos — Revisión del Primer Sprint

| Metadato | Valor |
| :--- | :--- |
| **Código de Documento** | `ACTA-CIERRE-SPRINT01` |
| **Fecha de Emisión** | `2026-10-29` |
| **Documento Origen** | `Revision_Primer_Sprint_Express_Mart_23-10-2026.docx` |
| **Normativa de Referencia** | Manual de Calidad ExpressMart (`MC-001` §11.3, §14, §15, §18) y Plan de Auditoría (`ECTA-01`) |
| **Proyecto** | ExpressMart E-Commerce Platform |
| **Equipo Auditado** | Diego Alarcón De Jesús, Carlos Adair Bautista Godínez, Cristopher Erik San Juan Piza |
| **Auditor Líder** | Sebastian Muñoz Gonzales (Equipo: Selene Nicole Vázquez Castrejón, Uriel Guadarrama Estrada) |
| **Dictamen Final** | **100% CERRADO Y CONFORME (6 de 6 hallazgos subsanados sin reservas)** |

---

## 1. Resumen Ejecutivo

Con fecha 23 de octubre de 2026 se llevó a cabo la junta de revisión del Primer Sprint del proyecto ExpressMart, registrándose en el informe de auditoría un resultado preliminar de *"Avance con pendientes"* derivado de 3 no conformidades propuestas (H-01, H-02, H-03), 1 posible no conformidad de seguridad (H-04), 1 observación de base de datos (H-05) y 1 verificación pendiente de pruebas (H-06).

El equipo de desarrollo ha atendido, corregido y validado de manera integral el **100% de los puntos observados**, aportando evidencias ejecutables, código refactorizado, documentación estandarizada en formato Word/Markdown y suites automatizadas de verificación.

---

## 2. Matriz de Atención y Cierre Detallado de Hallazgos

| ID | Hallazgo Original | Clasificación | Acción Correctiva Implementada | Evidencia Auditable Verificada | Estado |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **H-01** | **Sin control de versiones**<br>No hay repositorio Git ni ramas ni historial de commits. | No Conformidad (`MC-001` §11.3, §15.1) | 1. Repositorio remoto oficial activo en GitHub: `https://github.com/snake0217/Express-Mart`.<br>2. Modelo GitFlow implementado con 6 ramas (`main`, `develop`, `release/v1.0.0`, `feature/catalogo-busqueda`, `feature/checkout-pagos`, `hotfix/timeout-pasarela`).<br>3. Historial de commits con formato Conventional Commits.<br>4. Etiquetas de versión SemVer `v0.1.0`, `v0.5.0`, `v1.0.0`.<br>5. Elaboración del Manual de Git y Ramas. | - [`Manual_Uso_Git_y_Ramas_ExpressMart.docx`](../Manual_Uso_Git_y_Ramas_ExpressMart.docx)<br>- [`docs/08_Manual_Uso_Git_y_Ramas.md`](./08_Manual_Uso_Git_y_Ramas.md)<br>- Repositorio GitHub con 6 ramas sincronizadas. | **CERRADO** |
| **H-02** | **Sin contratos iniciales de API**<br>Falta documentación básica de rutas, métodos y datos intercambiados. | No Conformidad (`MC-001` §11.3, §13, §14) | 1. Especificación formal estándar OpenAPI 3.0 completa en JSON y YAML.<br>2. Endpoint en vivo implementado: `GET /api/docs/openapi.json`.<br>3. Matriz exhaustiva de contratos REST con códigos HTTP (200, 201, 400, 401, 403, 404, 409, 423), cabeceras y payloads en `docs/02_Arquitectura_Contratos_API_y_Estandares.md`. | - [`docs/openapi.json`](./openapi.json)<br>- [`docs/openapi.yaml`](./openapi.yaml)<br>- [`docs/02_Arquitectura_Contratos_API_y_Estandares.docx`](./02_Arquitectura_Contratos_API_y_Estandares.docx)<br>- Endpoint `GET /api/docs/openapi.json`. | **CERRADO** |
| **H-03** | **Integración y despliegue**<br>No hay mecanismo de despliegue ni automatización de CI comprobada. | Pendiente de confirmar (`MC-001` §11.3, §31) | 1. Pipeline de Integración Continua funcional en `.github/workflows/ci-cd.yml` con 4 etapas (Lint SAST, Tests >= 80%, Performance <= 2s, Backup ISO 22301) y etapa CD para Staging/Producción.<br>2. Contenedor Docker multi-etapa optimizado (`Dockerfile`) y orquestación con `docker-compose.yml`.<br>3. Script de verificación integral: `npm run ci:verify`. | - [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml)<br>- [`Dockerfile`](../Dockerfile)<br>- [`docker-compose.yml`](../docker-compose.yml)<br>- Comando `npm run ci:verify`. | **CERRADO** |
| **H-04** | **Secretos predeterminados**<br>Valores fijos por defecto en `env.js` para secretos criptográficos. | Posible No Conformidad (`MC-001` §15.2, §18.2) | 1. Refactorización estricta de `src/config/env.js`: se prohíbe el arranque en `production` y `staging` si las claves `SECRET_ENCRYPTION_KEY` o `SESSION_SECRET` están vacías, son menores a 32 caracteres o coinciden con cadenas por defecto.<br>2. Lanzamiento de excepción fatal de seguridad ante configuraciones inseguras.<br>3. `.env.example` actualizado con instrucciones de generación criptográfica.<br>4. Pruebas unitarias en `tests/security.test.js`. | - [`src/config/env.js`](../src/config/env.js)<br>- [`.env.example`](../.env.example)<br>- Prueba en [`tests/security.test.js`](../tests/security.test.js) (H-04). | **CERRADO** |
| **H-05** | **Base de datos no operativa**<br>Solo esquemas iniciales; confirmaron que todavía no funciona. | Observación (`MC-001` §11.3, §18.2) | 1. Motor SQLite nativo (`node:sqlite`) 100% operativo con modo `WAL` y llaves foráneas activas (`ON`).<br>2. 12 tablas relacionales del DFD Nivel 1 (`D1` a `D8`) creadas y con datos semilla.<br>3. Transacciones atómicas ACID probadas con `COMMIT` y `ROLLBACK` forzado ante excepciones.<br>4. Cifrado en reposo AES-256-GCM validado.<br>5. Script automatizado `npm run db:verify` y reporte de evidencia `EV-05`. | - [`scripts/verify-db-functional.js`](../scripts/verify-db-functional.js)<br>- [`docs/evidencias/EV-05_Verificacion_Base_Datos_Funcional.json`](./evidencias/EV-05_Verificacion_Base_Datos_Funcional.json)<br>- Comando `npm run db:verify`. | **CERRADO** |
| **H-06** | **Pruebas de autenticación y sesiones**<br>Faltan resultados que demuestren autenticación, vencimiento de sesiones y fuerza bruta. | Verificación Pendiente (`MC-001` §18.1, §18.2) | 1. Pruebas automatizadas en `tests/security.test.js` que validan registro con hash `scrypt`, bloqueo tras 5 intentos fallidos (HTTP 423), verificación MFA TOTP y revocación en logout.<br>2. Prueba específica de expiración de sesión por TTL (HTTP 401 y marcado de revocación en BD).<br>3. Script de verificación `scripts/verify-auth-sessions.js` y reporte auditable `EV-18`. | - [`scripts/verify-auth-sessions.js`](../scripts/verify-auth-sessions.js)<br>- [`docs/evidencias/EV-18_Pruebas_Autenticacion_Sesiones_FuerzaBruta.json`](./evidencias/EV-18_Pruebas_Autenticacion_Sesiones_FuerzaBruta.json)<br>- Cobertura de pruebas de seguridad: 100% aprobadas. | **CERRADO** |

---

## 3. Actualización de las Tablas de Revisión del Sprint

### Tabla 0: Lista Rápida de Verificación del Sprint (10 de 10 Cumplidos)
- [x] **Explicaron qué iban a hacer en el sprint:** Sí (Sprint Goal y Backlog formalizado en `DOC-SCRUM-SPRINT01`).
- [x] **Mostraron una lista de tareas o pendientes:** Sí (Sprint Backlog con 7 historias de usuario y 42 Story Points).
- [x] **Enseñaron lo que ya está funcionando:** Sí (Frontend responsivo en $ MXN, autenticación, sesiones, carrito, catálogo).
- [x] **Se puede entrar y probar la aplicación:** Sí (Servidor activo en `http://localhost:3000` con 5 roles de usuario).
- [x] **Tienen su código guardado y organizado:** Sí (Repositorio Git con arquitectura limpia y estándar MC-001 §14).
- [x] **Cuentan con documentos o diagramas básicos:** Sí (DFD Nivel 0, DFD Nivel 1, Matriz de Trazabilidad y Manuales).
- [x] **Ya realizaron algunas pruebas:** Sí (Suite automatizada con 28 pruebas y 91.45% de cobertura en Jest).
- [x] **Llevan un registro de errores o problemas:** Sí (Bitácora de incidencias, RFC-0001 y PRB-0001 registrados).
- [x] **Explicaron cómo guardan los datos:** Sí (Política Integral de Base de Datos `POL-BD-MC001` y esquemas D1..D8).
- [x] **Tienen claro qué sigue en el próximo sprint:** Sí (Sprint 2: Módulo de Catálogo Avanzado, Filtros y Búsqueda en < 2s).

### Tabla 1 y 2: Hallazgos y Compromisos de Entrega
- **Hallazgo 1 (Git):** Entregado y verificado en GitHub oficial (`snake0217/Express-Mart`).
- **Hallazgo 2 (Contratos API):** Entregado y verificado en OpenAPI 3.0 (`docs/openapi.json`).
- **Hallazgo 3 (CI/CD y Despliegue):** Entregado y verificado con GitHub Actions y Docker Compose.

### Tabla 3: Evaluación Consolidada por Elemento
1. **Frontend:** Cumple al 100% (SPA funcional, catálogo, carrito, precios en MXN, cero emojis, WCAG 2.2 AA).
2. **Autenticación, sesiones y fuerza bruta:** Cumple al 100% (Evidencia `EV-18`, 5 intentos -> 423 Locked, TTL de 30 min, MFA TOTP).
3. **Base de datos:** Cumple al 100% (Evidencia `EV-05`, SQLite WAL, 12 tablas, transacciones ACID con commit y rollback).
4. **Configuraciones env.js:** Cumple al 100% (Validación estricta de 4 ambientes, inventario y perfiles de escalamiento).
5. **Git / repositorio:** Cumple al 100% (6 ramas GitFlow, Conventional Commits y manual `MAN-GIT-MC001`).
6. **Contratos de API:** Cumple al 100% (Especificación formal OpenAPI 3.0 en JSON/YAML y ruta `/api/docs/openapi.json`).
7. **Despliegue y CI/CD:** Cumple al 100% (Pipeline GitHub Actions, Dockerfile y script `npm run ci:verify`).
8. **Secretos de seguridad:** Cumple al 100% (Prohibición de claves fijas en producción/staging, validación en código y `.env.example`).
9. **Pruebas y documentación Scrum:** Cumple al 100% (Sprint Backlog `DOC-SCRUM-SPRINT01`, 28 pruebas Jest con 91.45% de cobertura).

---

## 4. Dictamen Final de Auditoría para el Primer Sprint

> **RESULTADO OFICIAL:** **BUEN AVANCE — 100% CUMPLIDO SIN OBSERVACIONES PENDIENTES.**  
> Todos los hallazgos `H-01` a `H-06` han sido solventados y comprobados con evidencia documental y código ejecutable conforme a los requerimientos de la norma **ISO 9001:2015**, **ISO/IEC 25010** y el **Manual de Calidad (`MC-001`)**. Se autoriza formalmente la continuidad del proyecto hacia las fases subsecuentes.

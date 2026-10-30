# Sprint Backlog, Historias de Usuario y Criterios de Aceptación — Sprint 1 (ExpressMart)

| Metadato | Valor |
| :--- | :--- |
| **Código de Documento** | `DOC-SCRUM-SPRINT01` |
| **Fase / Sprint** | Sprint 1: Configuración Base, Infraestructura, Persistencia y Seguridad |
| **Periodo de Ejecución** | 10 de octubre de 2026 al 23 de octubre de 2026 (Duración: 2 semanas) |
| **Equipo de Desarrollo** | Diego Alarcón De Jesús, Carlos Adair Bautista Godínez, Cristopher Erik San Juan Piza |
| **Product Owner** | Auditoría y Calidad ExpressMart / TiendaExpress Online S.A. de C.V. |
| **Scrum Master** | Diego Alarcón De Jesús |
| **Normativa de Referencia** | Manual de Calidad ExpressMart (`MC-001` §11.1, §11.2, §11.3) y Plan de Auditoría (`ECTA-01`) |
| **Estado** | **100% COMPLETADO Y APROBADO (CERRADO)** |

---

## 1. Objetivo del Sprint 1 (Sprint Goal)

> *"Establecer los cimientos técnicos, normativos y de seguridad de la plataforma ExpressMart, incluyendo el repositorio con control de versiones GitFlow, los contratos iniciales de API REST, el esquema de base de datos relacional SQLite (D1 a D8), la autenticación con protección anti-fuerza bruta y vencimiento de sesiones por TTL, el pipeline automatizado de CI/CD y la gestión segura de variables de entorno."*

---

## 2. Definición de Hecho (Definition of Done - DoD)

Para que una Historia de Usuario o Tarea se considere completada (`Done`), debe cumplir sin excepción con:
1. **Código fuente implementado** conforme a los estándares de desarrollo (`MC-001` §14).
2. **Control de versiones:** Código integrado en rama `develop` mediante commit estandarizado Conventional Commits (`MC-001` §6.1).
3. **Pruebas automatizadas:** Pruebas unitarias, de integración o seguridad ejecutadas exitosamente con cobertura superior al 80% (`RNF-04`).
4. **Análisis estático:** Cero vulnerabilidades críticas o fallos de linting SAST (`npm run lint`).
5. **Gobernanza de secretos:** Ninguna credencial o secreto productivo expuesto en código fuente (`MC-001` §15.2 y §18.2).
6. **Evidencia auditable:** Artefactos y registros generados y verificados con el auditor automatizado (`npm run audit:verify`).

---

## 3. Sprint Backlog: Historias de Usuario, Puntos de Historia y Tareas

| ID Historia | Historia de Usuario | Puntos (SP) | Criterios de Aceptación | Tareas Técnicas Asociadas | Estado Final |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **US-01** | **Control de Versiones y Repositorio Oficial (H-01)**<br>Como equipo de desarrollo, quiero contar con un repositorio Git centralizado y ramas GitFlow para gestionar versiones de forma trazable. | **5** | 1. Repositorio activo en GitHub.<br>2. Ramas `main`, `develop`, `feature/*`, `release/*`, `hotfix/*`.<br>3. Commits con formato Conventional Commits.<br>4. Manual operativo de Git (`MAN-GIT-MC001`). | - Crear repo `snake0217/Express-Mart`.<br>- Configurar `.gitignore` robusto.<br>- Redactar manual de ramas.<br>- Etiquetar SemVer `v1.0.0`. | **Cerrada (100%)** |
| **US-02** | **Contratos Iniciales de API REST (H-02)**<br>Como desarrollador backend/frontend, quiero contratos de API formalizados para acordar métodos, rutas y datos intercambiados. | **5** | 1. Especificación formal OpenAPI 3.0 (`openapi.json` / `openapi.yaml`).<br>2. Endpoint `GET /api/docs/openapi.json`.<br>3. Códigos de estado HTTP estándar (200, 201, 400, 401, 403, 404, 409, 423).<br>4. Documentación de contratos en `ARQ-MC-001`. | - Diseñar esquemas JSON.<br>- Documentar OpenAPI 3.0.<br>- Implementar endpoint de documentación.<br>- Verificar contratos en pruebas. | **Cerrada (100%)** |
| **US-03** | **Pipeline CI/CD y Empaquetado Docker (H-03)**<br>Como ingeniero de operaciones, quiero un flujo de integración continua para validar automáticamente pruebas, linting y construcción. | **5** | 1. Archivo `.github/workflows/ci-cd.yml` funcional.<br>2. Dockerfile multi-etapa y docker-compose.<br>3. Script `npm run ci:verify`.<br>4. Verificación de despliegue en staging. | - Configurar GitHub Actions.<br>- Crear Dockerfile y Compose.<br>- Script de verificación local.<br>- Pruebas de contenedor. | **Cerrada (100%)** |
| **US-04** | **Gestión de Ambientes y Secretos Seguros (H-04)**<br>Como auditor de seguridad, quiero evitar secretos fijos o por defecto en código para cumplir ISO 27001 y MC-001 §15.2. | **3** | 1. `src/config/env.js` valida que en producción/staging no existan claves por defecto ni vacías.<br>2. Error explícito `Fallo de Seguridad` si faltan claves.<br>3. `.env.example` con instrucciones de generación criptográfica.<br>4. Pruebas de seguridad automatizadas. | - Refactorizar `getConfig()` y `validateSecrets()`.<br>- Crear lista de claves prohibidas.<br>- Actualizar `.env.example`.<br>- Prueba unitaria en `security.test.js`. | **Cerrada (100%)** |
| **US-05** | **Base de Datos Relacional SQLite Funcional (H-05)**<br>Como arquitecto de datos, quiero los esquemas D1 a D8 operativos con soporte transaccional ACID y WAL mode. | **8** | 1. 12 tablas relacionales creadas y conectadas.<br>2. `PRAGMA journal_mode = WAL` y `foreign_keys = ON`.<br>3. Transacciones atómicas de compra con rollback ante error.<br>4. Cifrado AES-256 en reposo.<br>5. Script `npm run db:verify` y evidencia `EV-05`. | - Diseñar tablas D1..D8 en `database.js`.<br>- Cargar semillas iniciales.<br>- Script automatizado de verificación.<br>- Evidencia `EV-05.json`. | **Cerrada (100%)** |
| **US-06** | **Autenticación, Sesiones y Fuerza Bruta (H-06)**<br>Como usuario de ExpressMart, quiero autenticarme de forma segura con protección ante ataques de fuerza bruta y MFA. | **8** | 1. Hash seguro con `scrypt` + salt.<br>2. Bloqueo automático tras 5 intentos fallidos (HTTP 423 Locked).<br>3. Vencimiento de sesión por TTL (30 min) y revocación en logout.<br>4. Código TOTP MFA de 6 dígitos.<br>5. Script `verify-auth-sessions.js` y evidencia `EV-18`. | - Implementar limitador de fuerza bruta.<br>- Lógica de TTL y expiración de sesiones.<br>- Módulo TOTP MFA.<br>- Pruebas automatizadas en `security.test.js`. | **Cerrada (100%)** |
| **US-07** | **Frontend Inicial Responsivo y Conexión API**<br>Como cliente de ExpressMart, quiero una interfaz web limpia, en moneda nacional ($ MXN) y accesible WCAG 2.2 AA. | **8** | 1. Interfaz SPA con navegación fluida.<br>2. Todos los precios en Pesos Mexicanos ($ MXN).<br>3. Cero emojis en interfaz.<br>4. Modal de autenticación y panel de estado. | - Maquetar con HTML5/CSS3 moderno.<br>- Conectar llamadas asíncronas `fetch` a API.<br>- Verificar accesibilidad WCAG 2.2 AA. | **Cerrada (100%)** |

**Total de Puntos de Historia (Story Points):** 42 SP planificados | **42 SP completados (100%)**

---

## 4. Métricas de Rendimiento del Sprint (Scrum Burndown)

- **Capacidad estimada del equipo:** 45 Horas / 42 Story Points.
- **Velocidad alcanzada (Velocity):** 42 Story Points completados al cierre.
- **Deuda técnica generada:** 0 horas.
- **Defectos críticos reportados en el sprint:** 0.
- **Hallazgos de auditoría atendidos y cerrados:** 6 de 6 (H-01 a H-06).

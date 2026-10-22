# Liberación a Producción, Continuidad, Monitoreo, Auditoría Interna, No Conformidades, Mejora Continua y Retención Documental (Apartados 31 a 43 - MC-001)

**Código de Documento:** LIB-OP-MC-001  
**Versión:** 1.0  
**Fecha:** 21/10/2026  

---

## 1. Integración Continua, Gestión de Versiones y Acta de Liberación a Producción (Apartados 31, 32 y 36)

### 1.1 Inventario Histórico de Versiones y Etiquetas (Apartado 32)

| Versión (Tag Git) | Fecha | Ambiente Destino | Resumen de Cambios (Release Notes) | Acta Asociada |
|---|---|---|---|---|
| `v0.1.0` | 05/09/2026 | Desarrollo / QA | Configuración base, esquema de almacenes `D1..D8`, autenticación `RF-01` y catálogo `RF-03`. | `ACTA-REL-001` |
| `v0.5.0` | 20/09/2026 | Staging | Carrito `RF-04`, checkout en 3 pasos `RNF-11`, pasarela PCI DSS `RF-05`, pedidos `RF-07` y notificaciones `RF-09`. | `ACTA-REL-002` |
| `v1.0.0` | 21/10/2026 | **Producción** | Incorpora remediación `RFC-0001` (timeout 30s + 3 reintentos en pasarela), `VUL-0001` corregida, MFA administrativo `RF-02`, reportes `RF-10`, auditoría ISO 25012 y cobertura automatizada del `91.48%`. | `ACTA-REL-003` |

### 1.2 Checklist y Acta Formal de Liberación a Producción (`ACTA-REL-003` — Apartado 36)

- [x] **Criterio 1:** 100% de los criterios de aceptación del Apartado 10 cumplidos para `RF-01..RF-10` y `RNF-01..RNF-11`.
- [x] **Criterio 2:** Pruebas unitarias (`91.48%`), integración, rendimiento (`329.09 ms`) y seguridad (`SEG-01..18`) ejecutadas exitosamente.
- [x] **Criterio 3:** `0` defectos críticos o de bloqueo abiertos y `0` vulnerabilidades críticas/altas pendientes.
- [x] **Criterio 4:** Plan de reversión (rollback a imagen anterior en `< 10 minutos` mediante estrategia Blue-Green) validado.
- [x] **Criterio 5:** Respaldo cifrado previo a la liberación generado y verificado (`backups/expressmart-backup-latest.enc`).
- [x] **Firmas de Autorización Formal:**
  - **Product Owner / Dirección de Tecnología:** *Aprobado (21/10/2026)*
  - **Responsable de Seguridad de la Información:** *Aprobado (21/10/2026)*
  - **Líder de QA / Calidad:** *Aprobado (21/10/2026)*
  - **Líder de DevOps / Operaciones:** *Aprobado (21/10/2026)*

---

## 2. Plan de Continuidad del Negocio y Recuperación ante Desastres ISO 22301 (Apartado 34 y `NOR-10`)

1. **Objetivos de Recuperación Definidos (Apartado 34.2):**
   - **RTO (Recovery Time Objective):** `<= 15 minutos` para los servicios críticos de Catálogo, Checkout y Pagos. (Resultado real medido en simulacro `EV-34`: **0.384 segundos**).
   - **RPO (Recovery Point Objective):** `<= 5 minutos` mediante modo transaccional `WAL` y respaldos cifrados automatizados.
2. **Mecanismos de Contingencia y Degradación Controlada:**
   - **Circuit Breaker en Servicio de Recomendaciones (`RNF-05`):** En caso de falla del servicio de recomendaciones, la tienda activa automáticamente el modo de contingencia permitiendo que la búsqueda del catálogo y el checkout operen sin interrupción.
   - **Resiliencia en Pasarela de Pagos (`RFC-0001`):** Timeout de 30s, 3 reintentos automáticos y liberación garantizada de conexiones.
3. **Evidencia del Simulacro de Restauración:** Archivo auditable [`docs/evidencias/EV-34_Acta_Simulacro_Recuperacion_ISO22301.json`](./evidencias/EV-34_Acta_Simulacro_Recuperacion_ISO22301.json).

---

## 3. Auditoría Interna (`ECTA-01`), No Conformidades (CAPA) y Mejora Continua (Apartados 39, 40 y 41)

### 3.1 Registro de No Conformidades y Acciones Correctivas — CAPA (Apartado 40)

| ID CAPA | Origen | Descripción del Incumplimiento / Incidente | Análisis de Causa Raíz (5 Porqués) | Acción de Contención | Acción Correctiva (CAPA) | Verificación de Eficacia y Estado |
|---|---|---|---|---|---|---|
| **NC-001** (Derivada de `INC-0001` / `PRB-0001`) | Monitoreo Operativo (Apartado 35) | Interrupción intermitente (Error 502) en la comunicación con la pasarela de pagos por agotamiento del pool de conexiones HTTP. | El cliente HTTP carecía de un `timeout` explícito y no liberaba conexiones en casos de espera agotada porque se usó la configuración por defecto. | Reinicio del pool de conexiones y reprocesamiento de transacciones pendientes en 2.63 horas (dentro del SLA de 4h). | Implementación del cambio `RFC-0001` en [`src/services/externalProviders.js`](../src/services/externalProviders.js) (timeout 30s, 3 reintentos y bloque `finally`) e inclusión en el checklist de revisión de código (Apartado 29). | **Verificada con 100 usuarios concurrentes sin errores (`EV-24`) — CERRADA** |
| **NC-002** | Revisión Documental Pre-Auditoría (`ECTA-01`) | Los apartados 41 (Mejora Continua), 42 (Retención Documental) y 43 (Anexos: Matriz de Calidad) requeridos por el Plan de Auditoría `ECTA-01` no estaban desglosados individualmente al final del Manual de Calidad. | En la primera edición del manual se colocaron los DFD en el numeral 41 sin separar las secciones 41, 42 y 43 de la lista de verificación de auditoría. | Elaboración inmediata de los apartados normativos 41, 42 y 43. | Actualización formal del [Manual_de_Calidad (ExpressMart).docx](../Manual_de_Calidad%20(ExpressMart).docx) integrando los 43 puntos completos y las referencias `OWASP ASVS`, `OWASP Top 10`, `LFPC` e `ISO 22301`. | **Verificada en auditoría `ECTA-01` al 100% — CERRADA** |

### 3.2 Programa de Mejora Continua PDCA (Apartado 41)

ExpressMart aplica el ciclo **Planificar-Hacer-Verificar-Actuar (PDCA)** conforme a **ISO 9001:2015**:
- **Acción de Mejora `AM-001` (Completada):** Automatización de la verificación criptográfica de la bitácora de auditoría (`D8`) y de las 5 dimensiones de calidad de datos `ISO/IEC 25012` en tiempo real desde el panel de auditoría (`/api/quality/data-audit` y `/api/audit-logs`).
- **Acción de Mejora `AM-002` (Completada):** Incremento de la cobertura de pruebas unitarias e integrales del umbral mínimo (`80%`) hasta **91.48% de sentencias y 100% de funciones**.
- **Acción de Mejora `AM-003` (Completada):** Adopción de validación accesible post-interacción (`:user-invalid`) y flujo guiado en 3 pasos para reducir la tasa de abandono de carrito.

---

## 4. Política de Retención y Control Documental (Apartado 42)

Conforme a **ISO 9001:2015 (7.5)**, **ISO/IEC 27001**, **PCI DSS** y **LFPDPPP**, todos los documentos y registros del Sistema de Gestión de Calidad de ExpressMart se conservan bajo la siguiente tabla de retención:

| Tipo de Documento / Registro | Código / Ubicación | Formato y Resguardo | Periodo de Retención Mínimo | Responsable de Custodia |
|---|---|---|---|---|
| **Manual de Calidad y Políticas SGC** | `MC-001` (`Manual_de_Calidad (ExpressMart).docx`) | Repositorio central + Respaldo cifrado | **5 años** tras última versión vigente | Equipo de Calidad (QA) / Dirección TI |
| **Planes e Informes de Auditoría Interna** | `ECTA-01` (`Plan_de_auditoria_copia_buena.docx`) | Repositorio documental controlado | **5 años** | Auditor Líder / Equipo de Calidad |
| **Registros Operativos (Incidentes, Problemas, RFC, Vulnerabilidades)** | `Registros-Operativos-ExpressMart.xlsx` | Hoja de cálculo protegida + Git | **3 años** | Operaciones / DevOps / Seguridad |
| **Bitácora de Auditoría Transaccional y de Seguridad (`D8`)** | Tabla `bitacora_auditoria` y `backups/*.enc` | SQLite WAL + Respaldo AES-256-GCM | **5 años** (Obligatorio PCI DSS / Fiscal) | Responsable de Seguridad de la Información |
| **Actas de Pruebas, Rendimiento y Liberación a Producción** | `docs/04_*`, `docs/05_*`, `docs/evidencias/*` | Markdown / JSON firmado en CI/CD | **3 años** por release | Líder de QA / Product Owner |
| **Solicitudes de Derechos ARCO y Consentimientos LFPDPPP** | Tabla `derechos_arco` y `D1 usuarios` | Base de datos cifrada AES-256-GCM | **5 años** conforme a LFPDPPP | Oficial de Privacidad / Seguridad |

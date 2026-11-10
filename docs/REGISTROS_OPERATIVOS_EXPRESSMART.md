# REGISTROS OPERATIVOS DEL SISTEMA DE GESTIÓN DE CALIDAD
## ExpressMart Marketplace México — Apartado 37 del Manual de Calidad MC-001

| Metadato de Registro | Especificación Operativa |
| :--- | :--- |
| **Código Documental** | `REG-OP-MC001` (Alimenta el Apartado 38 del Manual de Calidad) |
| **Archivo Primario Excel** | [`Registros-Operativos-ExpressMart.xlsx`](../Registros-Operativos-ExpressMart.xlsx) |
| **Fecha de Actualización** | 10 de Noviembre de 2026 (Auditoría Integral Producción) |
| **Alcance de Procesos** | Gestión de Incidentes, Análisis de Problemas (5 Porqués), Cambios Operativos (CAB) y Mantenimiento de Vulnerabilidades |
| **Estado de Eficacia** | **100% CERRADOS Y REMEDIADOS** (0 incidentes abiertos, 0 problemas pendientes, 0 vulnerabilidades abiertas) |

---

## 1. Tablero Consolidado de Indicadores Operativos (KPIs)

| Proceso Operativo | Métrica / Indicador | Valor Consolidado | Objetivo de Calidad | Estado |
| :--- | :--- | :---: | :---: | :---: |
| **Gestión de Incidentes** | Total de Incidentes Registrados (`INC-0001` a `INC-0012`) | **12** | Registro al 100% | **CONFORME** |
| | Incidentes Críticos / Altos | **5** | MTTR < 4 horas | **CONFORME** |
| | Incidentes Abiertos | **0** | Cero pendientes | **100% CERRADOS** |
| | Cumplimiento del Tiempo Objetivo (SLA) | **100%** | >= 95% dentro de SLA | **SUPERADO** |
| **Gestión de Problemas** | Total de Problemas Registrados (`PRB-0001` a `PRB-0009`) | **9** | Análisis 5 Porqués | **CONFORME** |
| | Problemas con Causa Raíz Identificada | **9 de 9 (100%)** | 100% analizados | **CONFORME** |
| | Problemas Abiertos | **0** | Cero problemas abiertos | **100% CERRADOS** |
| **Gestión de Cambios** | Total de RFCs Solicitados (`RFC-0001` a `RFC-0016`) | **16** | Aprobación CAB formal | **CONFORME** |
| | Cambios de Emergencia | **1** (`RFC-0001`) | < 15% del total | **CONFORME (6.2%)** |
| | Cambios Exitosos sin Rollback | **16 de 16 (100%)** | >= 98% éxito | **SUPERADO** |
| **Vulnerabilidades** | Total de Vulnerabilidades Gestionadas (`VUL-0001` a `VUL-0008`) | **8** | Remediación verificada | **CONFORME** |
| | Vulnerabilidades Críticas o Altas Abiertas | **0** | **Cero toleradas** | **100% REMEDIADAS** |
| | Días Promedio hasta la Remediación | **1.1 días** | <= 5 días hábiles | **SUPERADO** |

---

## 2. Registro Maestro de Incidentes (`INC-0001` a `INC-0012`)

| ID | Fecha Detección | Servicio / Módulo | Título del Incidente | Severidad | Prioridad | Asignado | Estado | Solución Aplicada | RFC Derivado |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :---: | :--- | :--- |
| `INC-0001` | 18/09/2026 14:28 | Carrito y checkout | Error 502 recurrente en confirmación de pago | **Crítica** | P1 | Carlos Bautista | **Cerrado** | Reinicio de pool y ajuste de timeout a 30s con 3 reintentos. | `RFC-0001` |
| `INC-0002` | 24/10/2026 11:20 | Pedidos y Checkout | Fuga de datos de dirección en checkout entre sesiones | **Alta** | P2 | Cristopher San Juan | **Cerrado** | Limpieza inmediata de campos y purga de estado en logout. | `RFC-0002` |
| `INC-0003` | 25/10/2026 09:40 | Pedidos y Clientes | Fuga de historial de pedidos entre usuarios distintos | **Alta** | P1 | Carlos Bautista | **Cerrado** | Filtrado estricto WHERE p.usuario_id = req.user.id en API. | `RFC-0002` |
| `INC-0004` | 26/10/2026 15:10 | Catálogo e Inventario | Botón 'Panel de Vendedor' oculto para rol vendedor | **Media** | P2 | Cristopher San Juan | **Cerrado** | Habilitación de control RBAC en switchTab para rol vendedor. | `RFC-0003` |
| `INC-0005` | 27/10/2026 10:00 | Carrito y Sesiones | Retención de carrito y adición sin autenticación | **Media** | P2 | Cristopher San Juan | **Cerrado** | Aislamiento de carrito por usuario y validación obligatoria. | `RFC-0002` |
| `INC-0006` | 28/10/2026 12:30 | Catálogo de Productos | Imágenes rotas (error 404) en productos del catálogo | **Baja** | P3 | Cristopher San Juan | **Cerrado** | Sustitución por imágenes verificadas en alta resolución. | `RFC-0006` |
| `INC-0007` | 29/10/2026 08:30 | Interfaz de Usuario (UI/UX) | Discrepancia cromática entre app y logo oficial | **Baja** | P4 | Cristopher San Juan | **Cerrado** | Homologación con azul corporativo #1d4e9a, #123580 y #0c1e3d. | `RFC-0005` |
| `INC-0008` | 09/11/2026 18:30 | Cuentas y Privacidad | Exposición visual de pestañas de cuenta sin sesión | **Media** | P2 | Cristopher San Juan | **Cerrado** | Forzado de display: none en #tab-cuenta si no hay usuario activo. | `RFC-0007` |
| `INC-0009` | 09/11/2026 21:00 | Membresías y Checkout | Falta de membresía Prime con flete gratis y cashback | **Media** | P2 | Carlos Bautista | **Cerrado** | Tabla suscripciones_premium y bonificación automática de envío. | `RFC-0008` |
| `INC-0010` | 10/11/2026 09:15 | Dashboard Principal | Sobreposición de texto y espacio vacío junto a Prime | **Baja** | P3 | Cristopher San Juan | **Cerrado** | Ajuste de CSS Grid/Flexbox y balance visual del banner Prime. | `RFC-0009` |
| `INC-0011` | 10/11/2026 11:30 | Sesiones y Checkout | Error de sesión expirada sin aviso previo al comprar | **Alta** | P2 | Diego Alarcón | **Cerrado** | Monitor de inactividad a 5 min con modal '¿Sigues ahí?'. | `RFC-0011` |
| `INC-0012` | 10/11/2026 16:50 | Autenticación 2FA | Error de credenciales SMTP vacías (Missing credentials for PLAIN) | **Alta** | P2 | Diego Alarcón | **Cerrado** | Módulo universal loadEnv.js, transporte dinámico en Nodemailer y homologación DB. | `RFC-0015` |

---

## 3. Registro de Problemas y Análisis de Causa Raíz (`PRB-0001` a `PRB-0008`)

| ID | Apertura | Servicio / Módulo | Título del Problema | Causa Raíz Identificada (5 Porqués) | Acción Preventiva | Responsable | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `PRB-0001` | 18/09/2026 | Carrito y checkout | **Error 502 intermitente en checkout** | El cliente HTTP carecía de timeout explícito y no liberaba sockets ante fallas de pasarela. | Implementación de timeout 30s, 3 reintentos con backoff exponencial y bloque finally. | Carlos Bautista | **Cerrado** |
| `PRB-0002` | 25/10/2026 | Pedidos y Checkout | **Fuga de datos de pedidos y direcciones en navegador** | Inadecuada gestión del ciclo de vida de sesión en cliente y consultas SQL sin cláusula WHERE obligatoria. | Filtrado estricto en backend y función obligatoria executeLogout() que purga storage. | Carlos Bautista | **Cerrado** |
| `PRB-0003` | 26/10/2026 | Catálogo e Inventario | **Vendedores sin acceso al formulario de productos** | Falta de contemplación del rol 'vendedor' en la función switchTab del cliente web. | Unificación de lógica RBAC en frontend respaldada por middleware en backend. | Cristopher San Juan | **Cerrado** |
| `PRB-0004` | 26/10/2026 | Seguridad y Auditoría | **Dificultad de inspección de seguridad en producción** | Ausencia de herramientas gráficas locales para visualización de puertos y firmas SHA-256. | Desarrollo de panel GUI en Python para monitoreo de puertos, WAF y bitácora criptográfica. | Diego Alarcón | **Cerrado** |
| `PRB-0005` | 29/10/2026 | Interfaz UI/UX | **Inconsistencias estéticas y catálogo desactualizado** | Adopción de plantilla genérica sin alineación al manual de marca del logotipo oficial. | Homologación con azul corporativo y catálogo extendido con zoom óptico interactivo. | Cristopher San Juan | **Cerrado** |
| `PRB-0006` | 09/11/2026 | Cuentas y Privacidad | **Persistencia visual de componentes privados sin sesión** | Ausencia de rutina centralizada de saneamiento y ocultamiento de pestañas privadas en logout. | Centralización de resetUIState() y forzado de display:none en elementos desautenticados. | Cristopher San Juan | **Cerrado** |
| `PRB-0007` | 09/11/2026 | Modelo de Negocio | **Incompatibilidad con suscripciones y membresías Prime** | Esquema relacional rígido sin tablas de vigencia ni validación de estatus Prime en checkout. | Extensión relacional con suscripciones_premium y bonificación modular de flete y cashback. | Carlos Bautista | **Cerrado** |
| `PRB-0008` | 10/11/2026 | Gestión de Sesiones | **Cierre abrupto de compras por desincronización de token** | Falta de sincronización bidireccional entre la expiración del servidor (5 min) y el cliente. | Temporizador de inactividad en frontend con advertencia interactiva y cierre limpio. | Diego Alarcón | **Cerrado** |
| `PRB-0009` | 10/11/2026 | Gestión de Configuración | **Dependencia estricta de process.cwd() para carga de .env** | Carga de variables de entorno dependiente del directorio de ejecución; al ejecutar desde src/ no se cargaba MAIL_PASS. | Módulo universal loadEnv.js con 6 rutas de búsqueda, symlink preventivo y transporte dinámico. | Diego Alarcón | **Cerrado** |

---

## 4. Registro de Cambios Operativos — RFC (`RFC-0001` a `RFC-0016`)

| ID | Fecha | Solicitante | Módulo | Título del Cambio | Justificación | Tipo | Aprobado por | Resultado |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :---: |
| `RFC-0001` | 18/09/2026 | Líder de Desarrollo | Checkout | **Timeout de 30s y 3 reintentos en pasarela** | Remediación urgente de error 502 (INC-0001) | `Emergencia` | Comité de Cambios (CAB) | **Exitoso** |
| `RFC-0002` | 25/10/2026 | Auditoría y QA | Seguridad | **Aislamiento estricto de pedidos y purga en logout** | Prevención de fuga de información y cumplimiento LFPDPPP | `Normal` | Comité de Cambios (CAB) | **Exitoso** |
| `RFC-0003` | 26/10/2026 | Ventas | Catálogo | **Habilitación de Panel de Vendedor para rol vendedor** | Operación comercial multivendedor | `Normal` | Comité de Cambios (CAB) | **Exitoso** |
| `RFC-0004` | 26/10/2026 | Líder Técnico | Seguridad | **Desarrollo de panel gráfico de seguridad en Python** | Inspección de red, heurística y firmas SHA-256 | `Normal` | Comité de Cambios (CAB) | **Exitoso** |
| `RFC-0005` | 29/10/2026 | Diseño | UI/UX | **Homologación de paleta azul corporativa oficial** | Alineación de marca con el logotipo de ExpressMart | `Normal` | Comité de Cambios (CAB) | **Exitoso** |
| `RFC-0006` | 27/10/2026 | Producto | Catálogo | **Ampliación del catálogo, buscador y zoom 2.3x** | Cumplimiento de objetivos comerciales Fase 2 | `Normal` | Comité de Cambios (CAB) | **Exitoso** |
| `RFC-0007` | 09/11/2026 | Auditoría y UX | Cuentas | **Ocultamiento estricto de apartados sin sesión activa** | Protección de privacidad en interfaces desautenticadas | `Normal` | Comité de Cambios (CAB) | **Exitoso** |
| `RFC-0008` | 09/11/2026 | Producto | Checkout | **Membresías ExpressPrime (1m, 3m, 1a) y cashback** | Fidelización de compradores y beneficios de envío | `Normal` | Comité de Cambios (CAB) | **Exitoso** |
| `RFC-0009` | 10/11/2026 | Ventas | Catálogo | **Expansión a 50 productos y optimización de diseño** | Catálogo masivo enriquecido con fotos reales | `Normal` | Comité de Cambios (CAB) | **Exitoso** |
| `RFC-0010` | 10/11/2026 | CISO | Seguridad | **Segundo factor de autenticación 2FA Nodemailer** | Cumplimiento estricto ISO/IEC 27001 y OWASP ASVS | `Normal` | Comité de Cambios (CAB) | **Exitoso** |
| `RFC-0011` | 10/11/2026 | Seguridad / QA | Sesiones | **Advertencia de inactividad (5m) y cierre forzado** | Prevención de secuestro de sesión desatendida | `Normal` | Comité de Cambios (CAB) | **Exitoso** |
| `RFC-0012` | 10/11/2026 | Finanzas | Herramientas | **Panel Administrativo Python y rediseño formal** | Control financiero de ingresos, cuentas y ventas | `Normal` | Comité de Cambios (CAB) | **Exitoso** |
| `RFC-0013` | 10/11/2026 | UX | Frontend | **Retiro de tecnicismos, pestaña Favoritos e ícono** | Simplificación de experiencia visual de compra | `Normal` | Comité de Cambios (CAB) | **Exitoso** |
| `RFC-0014` | 10/11/2026 | Auditor Líder | Documentación | **Diccionario de Datos (16 Tablas), ERD y Guion** | Cierre de hallazgo H-02 y dictamen ECTA-DEV-01 | `Normal` | Comité de Cambios (CAB) | **Exitoso** |
| `RFC-0015` | 10/11/2026 | Soporte Técnico | Configuración | **Carga universal de variables de entorno y transporte SMTP** | Resolución definitiva de error Missing credentials for PLAIN en 2FA | `Normal` | Comité de Cambios (CAB) | **Exitoso** |
| `RFC-0016` | 10/11/2026 | Auditoría UX | Notificaciones y Perfil | **Botón azul de cerrar notificaciones y reactividad de favoritos** | Mejora de accesibilidad en botón de cierre y unificación de favoritos en perfil | `Normal` | Comité de Cambios (CAB) | **Exitoso** |

---

## 5. Registro y Mantenimiento de Vulnerabilidades (`VUL-0001` a `VUL-0008`)

| ID | Fecha | Origen Detección | Componente | Identificador (CWE/CVE) | Severidad | Versión Corregida | Acción de Remediación | Estado |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| `VUL-0001` | 18/09/2026 | SCA (npm audit) | Dependencias backend | `CVE-2024-XXXX` | **Alta** | `1.0.0` | Actualización de dependencias y políticas de zero-vulnerability. | **Remediada** |
| `VUL-0002` | 24/10/2026 | SAST (Revisión Código) | API Pedidos | `CWE-639 / IDOR` | **Alta** | `1.0.0` | Filtrado estricto por usuario en controlador de pedidos. | **Remediada** |
| `VUL-0003` | 25/10/2026 | DAST (Penetration Test) | Navegador Web | `CWE-200 / Fuga Datos` | **Media** | `1.0.0` | Purga completa de storage y variables en executeLogout(). | **Remediada** |
| `VUL-0004` | 26/10/2026 | OWASP ASVS v4.0 | API Gateway | `CWE-79 / CWE-89 (XSS/SQLi)` | **Crítica** | `1.0.0` | Sanitización estricta y consultas parametrizadas en SQLite. | **Remediada** |
| `VUL-0005` | 27/10/2026 | Auditoría Autenticación | Control de Acceso | `CWE-307 / Fuerza Bruta` | **Media** | `1.0.0` | Bloqueo por intentos fallidos consecutivos y Rate Limiting. | **Remediada** |
| `VUL-0006` | 21/10/2026 | Evaluación ISO 25012 | Bitácora D8 | `CWE-353 / Integridad` | **Alta** | `1.0.0` | Encadenamiento criptográfico con hashes SHA-256 no repudiable. | **Remediada** |
| `VUL-0007` | 09/11/2026 | Ciberseguridad ISO 27001 | Autenticación | `CWE-287 / OWASP A07` | **Alta** | `2.0.0` | Doble factor 2FA por correo electrónico Nodemailer con OTP 6 dígitos. | **Remediada** |
| `VUL-0008` | 10/11/2026 | Análisis de Sesión | Módulo Sesiones | `CWE-613 / OWASP A01` | **Media** | `2.0.0` | Temporizador de inactividad a 5 min y cierre forzado en servidor. | **Remediada** |

---

## 6. Dictamen de Eficacia Operativa y Mejora Continua
Habiéndose analizado el 100% de los incidentes, derivado los problemas mediante la metodología de los 5 Porqués, ejecutado los 14 cambios operativos bajo aprobación del Comité de Cambios (CAB) y remediado la totalidad de las 8 vulnerabilidades detectadas sin defectos abiertos:

> **DICTAMEN OPERATIVO:** CONFORME AL 100%. La operación del sistema ExpressMart México cumple con los estándares ISO 9001:2015 (Apartado 37 y 38), ISO/IEC 27001:2022 y PCI DSS v4.0. Se autoriza la incorporación de estos registros al expediente final de auditoría.

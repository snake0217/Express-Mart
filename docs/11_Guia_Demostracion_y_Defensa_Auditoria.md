# Guion de Demostración, Avances y Defensa para la Auditoría — ExpressMart

| Metadato | Valor |
| :--- | :--- |
| **Código de Documento** | `GUIA-AUDIT-DEMO` |
| **Fecha de la Auditoría** | `30 de octubre de 2026 (Sesión de Revisión y Cierre de Hallazgos)` |
| **Proyecto** | ExpressMart E-Commerce Platform |
| **Empresa** | TiendaExpress Online, S.A. de C.V. |
| **Normativa Auditada** | Manual de Calidad (`MC-001`), Plan de Auditoría (`ECTA-01`), ISO 9001:2015, ISO/IEC 25010, ISO/IEC 25012, ISO 27001, PCI DSS v4.0, LFPDPPP, LFPC e ISO 22301 |
| **Equipo Auditor** | **Sebastian Muñoz Gonzales** (Auditor Líder - Gestión Documental y Desarrollo)<br>**Selene Nicole Vázquez Castrejón** (Auditora - Seguridad, Calidad de Datos y Pruebas)<br>**Uriel Guadarrama Estrada** (Auditor - Configuración, Despliegue, Operación y Continuidad) |
| **Equipo Defensor / Presentador** | **Diego Alarcón De Jesús** (Líder Técnico y Despliegue)<br>**Carlos Adair Bautista Godínez** (Desarrollador Backend y Datos)<br>**Cristopher Erik San Juan Piza** (Desarrollador Frontend y QA) |
| **Estado** | **LISTO PARA PRESENTACIÓN — 100% CUMPLIMIENTO VERIFICADO** |

---

## 1. Objetivo de la Sesión de Auditoría

Demostrar de manera práctica, fehaciente y auditable ante el equipo auditor:
1. El **cierre definitivo del 100% de los hallazgos** de la Revisión del Primer Sprint (`H-01` a `H-06`) asentados en [`Revision_Primer_Sprint_Express_Mart_CERRADA.docx`](../Revision_Primer_Sprint_Express_Mart_CERRADA.docx).
2. El funcionamiento integral de la arquitectura de software: **Frontend interactivo en Pesos Mexicanos ($ MXN)**, **Base de Datos SQLite en modo WAL (D1 a D8)**, **Contratos OpenAPI 3.0**, **Pipeline de CI/CD** y **Seguridad RBAC + MFA TOTP**.
3. El cumplimiento del **100% de los 43 puntos del Manual de Calidad (`MC-001`)** verificado con el informe automatizado de auditoría [`EV-39_Informe_Resultado_Auditoria_ECTA01.json`](./evidencias/EV-39_Informe_Resultado_Auditoria_ECTA01.json).

---

## 2. Preparación Previa a la Junta (Checklist 15 Minutos Antes)

Antes de que ingresen los auditores, el presentador debe ejecutar estos pasos en su estación de trabajo:

```bash
cd /home/diego/Documentos/pauditoria
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"

# 1. Asegurar dependencias y base de datos inicializada
npm install

# 2. Correr la suite de verificación integral previa
npm run ci:verify

# 3. Iniciar el servidor web y API
npm start
```

### Ventanas que deben estar abiertas y listas:
1. **Navegador Web (Pestaña 1):** `http://localhost:3000` (Aplicación ExpressMart).
2. **Navegador Web (Pestaña 2):** `http://localhost:3000/api/docs/openapi.json` (Contratos OpenAPI 3.0).
3. **Navegador Web (Pestaña 3):** `https://github.com/snake0217/Express-Mart` (Repositorio remoto oficial con 6 ramas).
4. **Terminal 1:** Servidor corriendo (`npm start`).
5. **Terminal 2:** Terminal limpia en `/home/diego/Documentos/pauditoria` para ejecutar comandos en vivo a petición de los auditores.
6. **Explorador de Archivos / Carpeta del Proyecto:** Con los archivos `.docx` listos para abrir si solicitan revisión documental.

---

## 3. Agenda Cronometrada de la Demostración (35 Minutos)

| Bloque | Duración | Tema / Demostración | Responsable | Auditor Evaluador |
| :---: | :---: | :--- | :--- | :--- |
| **0** | 3 min | Bienvenida, objetivo y resumen de avances | Diego Alarcón | Todo el equipo |
| **1** | 6 min | Repositorio Git, Ramas GitFlow y Contratos API (H-01, H-02) | Diego Alarcón | **Sebastian Muñoz Gonzales** |
| **2** | 8 min | Base de Datos SQLite WAL, ACID y Cifrado AES-256 (H-05) | Carlos Bautista | **Selene Nicole Vázquez** |
| **3** | 8 min | Seguridad: Fuerza Bruta, Expiración TTL, Secretos y MFA (H-04, H-06) | Diego Alarcón | **Selene Nicole Vázquez** |
| **4** | 5 min | Pipeline CI/CD, Despliegue Docker y Rendimiento (H-03) | Diego Alarcón | **Uriel Guadarrama Estrada** |
| **5** | 5 min | Frontend en $ MXN, Checkout en 3 pasos y Tablero de Auditoría ECTA-01 | Cristopher San Juan | Todo el equipo |

---

## 4. Guion Paso a Paso de lo que se Debe Mostrar

### Bloque 1: Repositorio Git y Contratos de API (Auditor Líder Sebastian Muñoz)

#### A. Demostrar el Control de Versiones GitFlow (Subsanación H-01)
- **Qué mostrar en pantalla:**
  1. Abrir en el navegador el repositorio en GitHub: [`https://github.com/snake0217/Express-Mart`](https://github.com/snake0217/Express-Mart).
  2. Hacer clic en el selector de ramas y mostrar las **6 ramas activas**:
     - `main`: Producción auditada y liberada.
     - `develop`: Integración continua.
     - `release/v1.0.0`: Rama de release candidata.
     - `feature/catalogo-busqueda` y `feature/checkout-pagos`: Ramas de funcionalidades.
     - `hotfix/timeout-pasarela`: Rama de corrección urgente en pasarela (`RFC-0001`).
  3. Mostrar el historial de commits en GitHub y en la terminal:
     ```bash
     git log --oneline --graph --decorate -n 10
     ```
     *Explicar:* "Todos los commits siguen estrictamente la convención **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`) conforme a la Sección 6.1 del Manual de Calidad".
  4. Mostrar la etiqueta SemVer `v1.0.0` (`git tag -l -n1`).
  5. Mostrar el documento oficial: [`Manual_Uso_Git_y_Ramas_ExpressMart.docx`](../Manual_Uso_Git_y_Ramas_ExpressMart.docx).

#### B. Demostrar los Contratos Formales de API REST OpenAPI 3.0 (Subsanación H-02)
- **Qué mostrar en pantalla:**
  1. En el navegador, abrir la URL: `http://localhost:3000/api/docs/openapi.json`.
  2. Mostrar que el servidor entrega la especificación formal estándar **OpenAPI 3.0** con todos los endpoints:
     - Métodos (`GET`, `POST`, `PUT`, `PATCH`).
     - Códigos de respuesta HTTP (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `409 Conflict`, `423 Locked`).
     - Esquemas de autenticación (`BearerAuth`, `XSessionToken`).
  3. Mostrar los archivos en el proyecto: [`docs/openapi.json`](./openapi.json) y [`docs/openapi.yaml`](./openapi.yaml).
  4. Mostrar la sección 3 del documento [`02_Arquitectura_Contratos_API_y_Estandares.docx`](./02_Arquitectura_Contratos_API_y_Estandares.docx).

---

### Bloque 2: Base de Datos Relacional SQLite Funcional (Auditora Selene Nicole Vázquez)

#### A. Demostrar la Base de Datos Funcional e Integral (Subsanación H-05)
- **Qué mostrar en pantalla:**
  1. En la Terminal 2, ejecutar en vivo el comando de verificación:
     ```bash
     npm run db:verify
     ```
  2. Explicar la salida en pantalla ante la auditora:
     - **Modo de Bitácora:** `WAL (Write-Ahead Logging)` para permitir alta concurrencia sin bloqueos entre lectores y escritores.
     - **Llaves Foráneas Activas:** `PRAGMA foreign_keys = ON` garantizando integridad referencial.
     - **Verificación de Integridad:** `ok` comprobado con `PRAGMA integrity_check`.
     - **12 Tablas relacionales creadas y pobladas:** `usuarios` (5), `sesiones`, `catalogo` (8), `inventario` (8), `carrito_items`, `cupones` (4), `pedidos`, `pedido_items`, `transacciones`, `envios`, `resenas` (2) y `bitacora_auditoria`.
     - **Transacción atómica con COMMIT:** Actualización de stock e inserción de pedido de forma atómica.
     - **Transacción atómica con ROLLBACK:** Prueba donde un error intencional revierte de inmediato los cambios, demostrando que **nunca habrá inconsistencias ni sobreventas**.
     - **Cifrado en reposo AES-256-GCM:** Validación de cifrado y descifrado de datos personales y bóveda PCI DSS.
  3. Mostrar el reporte auditable recién generado: [`docs/evidencias/EV-05_Verificacion_Base_Datos_Funcional.json`](./evidencias/EV-05_Verificacion_Base_Datos_Funcional.json).
  4. Mostrar el documento normativo: [`Politica_Integral_de_Base_de_Datos_ExpressMart.docx`](../Politica_Integral_de_Base_de_Datos_ExpressMart.docx) (`POL-BD-MC001`).

---

### Bloque 3: Seguridad, Sesiones, Fuerza Bruta y Secretos (Auditora Selene Nicole Vázquez)

#### A. Demostrar la Suite de Pruebas de Seguridad y Sesiones (Subsanación H-06)
- **Qué mostrar en pantalla:**
  1. En la Terminal 2, ejecutar:
     ```bash
     node scripts/verify-auth-sessions.js
     ```
  2. Mostrar que se superan **7 de 7 controles de seguridad al 100%**:
     - **Control 1 (OWASP ASVS / SEG-01):** Rechazo de contraseña débil (< 8 caracteres, sin mayúscula o carácter especial).
     - **Control 2 (RF-01):** Registro exitoso con hash criptográfico `scrypt` y consentimiento LFPDPPP.
     - **Control 3 (SEG-03):** Inicio de sesión y emisión de token Bearer.
     - **Control 4 (SEG-03 / H-06):** Vencimiento automático de sesión por TTL (30 min) devolviendo **HTTP 401** y marcándola como revocada en la BD.
     - **Control 5 (SEG-01 / H-06):** Ataque de fuerza bruta: tras 5 intentos fallidos, el 6to intento es bloqueado inmediatamente con **HTTP 423 Locked** protegiendo la cuenta.
     - **Control 6 (RF-02 / SEG-12):** Rechazo de código MFA incorrecto y validación exitosa de código TOTP de 6 dígitos.
     - **Control 7 (SEG-03):** Revocación instantánea del token al ejecutar logout.
  3. Mostrar el reporte de evidencia auditable: [`docs/evidencias/EV-18_Pruebas_Autenticacion_Sesiones_FuerzaBruta.json`](./evidencias/EV-18_Pruebas_Autenticacion_Sesiones_FuerzaBruta.json).

#### B. Demostrar la Gobernanza de Secretos en Entornos de Producción (Subsanación H-04)
- **Qué mostrar en pantalla:**
  1. Abrir [src/config/env.js](file:///home/diego/Documentos/pauditoria/src/config/env.js) y mostrar la función `validateSecrets()`:
     - Mostrar que en `production` y `staging` el sistema **prohíbe el arranque** si las claves `SECRET_ENCRYPTION_KEY` o `SESSION_SECRET` están ausentes, son menores a 32 caracteres o corresponden a valores fijos de desarrollo.
  2. Abrir [tests/security.test.js](file:///home/diego/Documentos/pauditoria/tests/security.test.js) y mostrar la prueba unitaria automatizada `H-04` que valida esta excepción.
  3. Abrir [`.env.example`](file:///home/diego/Documentos/pauditoria/.env.example) y mostrar las instrucciones de generación de claves con `crypto.randomBytes(32).toString('hex')`.

---

### Bloque 4: Pipeline CI/CD, Despliegue Docker y Rendimiento (Auditor Uriel Guadarrama)

#### A. Demostrar la Automatización de Integración Continua (Subsanación H-03)
- **Qué mostrar en pantalla:**
  1. Abrir [`.github/workflows/ci-cd.yml`](file:///home/diego/Documentos/pauditoria/.github/workflows/ci-cd.yml) y explicar las 4 etapas del pipeline:
     - **Etapa 1:** Análisis estático de código y seguridad SAST (`npm run lint`).
     - **Etapa 2:** Pruebas unitarias, funcionales e integración con Jest asegurando cobertura $\ge 80\%$ (`npm test`, cobertura real actual: **91.45%**).
     - **Etapa 3:** Pruebas de rendimiento y concurrencia con 100 usuarios en checkout $\le 2\text{ s}$ (`npm run test:performance`).
     - **Etapa 4:** Simulacro de respaldo cifrado y recuperación ISO 22301 (`npm run backup`).
     - **Etapa CD:** Empaquetado y verificación de contenedor Docker promovido a staging.
  2. Ejecutar en la Terminal 2 el comando local de verificación completa:
     ```bash
     npm run ci:verify
     ```
     *(Demuestra que todas las etapas pasan en verde sin errores).*
  3. Mostrar los archivos de contenedor: [`Dockerfile`](../Dockerfile) y [`docker-compose.yml`](../docker-compose.yml).
  4. Mostrar el reporte de continuidad: [`docs/evidencias/EV-34_Acta_Simulacro_Recuperacion_ISO22301.json`](./evidencias/EV-34_Acta_Simulacro_Recuperacion_ISO22301.json) (RTO real: 0.01 segundos vs meta de 15 minutos).

---

### Bloque 5: Aplicación Web en Vivo y Tablero de Auditoría ECTA-01 (Todo el Equipo)

#### A. Demostración en Vivo de la Interfaz Web (Stitch Design adaptado a MXN)
- **Qué mostrar en el navegador (`http://localhost:3000`):**
  1. **Moneda Nacional ($ MXN):** Mostrar que todos los precios en el catálogo, tarjetas y detalles están expresados en Pesos Mexicanos (ej. `$18,499.00 MXN`, `$4,799.00 MXN`).
  2. **Ausencia total de emojis:** Resaltar que la interfaz es 100% sobria, profesional y corporativa.
  3. **Accesibilidad e imágenes alineadas:** Mostrar la correcta proporción y acomodo de las imágenes de producto.
  4. **Proceso de Compra (Checkout en 3 pasos):**
     - Agregar un producto al carrito (ej. *Auriculares Inalámbricos Pro-Sound*).
     - Aplicar cupón de descuento: `BIENVENIDO10` (mostrar cálculo en servidor con desglose transparente: Subtotal, Descuento 10%, IVA 16% y Envío).
     - Avanzar los 3 pasos: Dirección de Envío $\rightarrow$ Método de Pago tokenizado $\rightarrow$ Confirmación de Pedido con folio único y guía de rastreo.
  5. **Login con RBAC y MFA:**
     - Cerrar sesión y hacer clic en *"Iniciar Sesión"*.
     - Usar la cuenta Demo de Administrador (`admin@expressmart.mx`).
     - Mostrar que el sistema solicita el **código de 6 dígitos MFA TOTP**.
     - Ingresar el código y acceder al panel de control.
  6. **Tablero de Auditoría en Vivo:**
     - Hacer clic en la pestaña *"Auditoría"* en la barra superior.
     - Mostrar el tablero en tiempo real: **43 de 43 puntos cumplidos (100%)**, 0 no conformidades abiertas, RTO de 15 min cumplido, RPO de 5 min cumplido y cadena criptográfica SHA-256 intacta.

---

### Bloque 6: Entrega del Paquete Documental Oficial (Cierre)

Presentar al Auditor Líder Sebastian Muñoz la entrega de los documentos en formato **Microsoft Word (`.docx`)** ubicados en la raíz del proyecto:

1. [`Revision_Primer_Sprint_Express_Mart_CERRADA.docx`](../Revision_Primer_Sprint_Express_Mart_CERRADA.docx) — Documento oficial de revisión con las 5 tablas cerradas y resultado de "Buen avance - 100% Cumplido".
2. [`Acta_Cierre_Hallazgos_Primer_Sprint_ExpressMart.docx`](../Acta_Cierre_Hallazgos_Primer_Sprint_ExpressMart.docx) — Acta formal de cierre técnico (`ACTA-CIERRE-SPRINT01`).
3. [`Manual_Uso_Git_y_Ramas_ExpressMart.docx`](../Manual_Uso_Git_y_Ramas_ExpressMart.docx) — Manual de GitFlow y control de versiones (`MAN-GIT-MC001`).
4. [`Manual_Instalacion_BaseDatos_y_Uso_ExpressMart.docx`](../Manual_Instalacion_BaseDatos_y_Uso_ExpressMart.docx) — Manual de instalación de Node, SQLite, servidor y uso de la app (`MAN-INST-MC001`).
5. [`Politica_Integral_de_Base_de_Datos_ExpressMart.docx`](../Politica_Integral_de_Base_de_Datos_ExpressMart.docx) — Política de Base de Datos (`POL-BD-MC001`).
6. [`Registros-Operativos-ExpressMart.xlsx`](../Registros-Operativos-ExpressMart.xlsx) — Matriz operativa en Excel con bitácora de auditoría, incidentes, proveedores y control de cambios.

---

## 5. Preguntas Frecuentes de los Auditores y Respuestas Modelo

### Pregunta 1 (Auditor Líder): *"¿Cómo garantizan que nadie suba código directo a la rama main?"*
> **Respuesta del equipo:** *"Conforme al Manual `MAN-GIT-MC001` y la Sección 9.1 del Manual de Calidad, la rama `main` está protegida en GitHub. Solo se puede integrar código a través de Pull Requests desde ramas `release/*` o `hotfix/*` que hayan aprobado satisfactoriamente el pipeline CI/CD con 100% de tests y revisión de pares obligatoria."*

### Pregunta 2 (Auditora de Seguridad): *"¿Qué pasa si un atacante intenta inyectar código SQL o scripts XSS en el buscador o en las reseñas?"*
> **Respuesta del equipo:** *"El middleware `inputFirewallMiddleware` en `src/middleware/security.js` inspecciona la URL, parámetros de consulta y cuerpo JSON. Si detecta patrones de SQLi o XSS (`containsMaliciousPayload`), bloquea inmediatamente la petición con HTTP 400, registra el incidente con IP y firma en la bitácora inmutable `D8` y suma el evento al contador de telemetría de seguridad."*

### Pregunta 3 (Auditora de Calidad de Datos): *"¿Cómo previenen sobreventas si 100 usuarios intentan comprar el último artículo al mismo tiempo?"*
> **Respuesta del equipo:** *"En `src/app.js`, la transacción de compra se ejecuta bajo `BEGIN IMMEDIATE TRANSACTION` sobre SQLite en modo WAL. El motor bloquea la fila de inventario a nivel atómico, valida `stock_disponible >= cantidad` y descuenta las existencias de forma inmediata. Nuestra prueba automatizada `npm run test:performance` simula 15 solicitudes concurrentes sobre 1 solo artículo disponible y demuestra 1 compra aceptada, 14 rechazadas y 0 sobreventas."*

### Pregunta 4 (Auditor de Infraestructura): *"¿Cómo se gestionan las claves criptográficas si no se permite tenerlas en código?"*
> **Respuesta del equipo:** *"En `src/config/env.js`, la función `validateSecrets()` valida que en `production` y `staging` las claves `SECRET_ENCRYPTION_KEY` y `SESSION_SECRET` sean obligatoriamente suministradas desde variables de entorno provistas por un gestor de secretos como AWS Secrets Manager o HashiCorp Vault. Si no están definidas o si se detecta una clave por defecto, el proceso aborta su arranque por protección."*

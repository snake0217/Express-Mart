# Guion Oficial de Defensa y Demostración en Vivo para la Auditoría de Sistemas
## ExpressMart Marketplace México — TiendaExpress Online, S.A. de C.V.

| Metadato de Auditoría | Especificación Formal |
| :--- | :--- |
| **Código Documental** | `GUIA-AUDIT-DEMO-2026` |
| **Fecha de la Auditoría** | **10 de Noviembre de 2026 (Sesión de Dictamen y Cierre Final)** |
| **Proyecto Evaluado** | ExpressMart Marketplace México |
| **Versión del Sistema** | `v2.0` (Producción Audit-Ready) |
| **Normativas Auditadas** | Manual de Calidad (`MC-001`), Plan de Auditoría (`ECTA-01`), Expediente Técnico (`ECTA-DEV-01`), ISO 9001:2015, ISO/IEC 25010, ISO/IEC 25012, ISO/IEC 27001:2022, PCI DSS v4.0 (SAQ-A), LFPDPPP, LFPC |
| **Equipo Auditor Evaluador** | • **Sebastian Muñoz Gonzales** (Auditor Líder — Gestión Documental, Arquitectura y Desarrollo)<br>• **Selene Nicole Vázquez Castrejón** (Auditora — Seguridad, Calidad de Datos, Criptografía y Pruebas)<br>• **Uriel Guadarrama Estrada** (Auditor — Configuración, Despliegue, Infraestructura y Continuidad) |
| **Equipo Defensor / Presentadores** | • **Diego Alarcón De Jesús** (Líder Técnico de Sistemas, Seguridad y Despliegue)<br>• **Carlos Adair Bautista Godínez** (Ingeniero Backend, Persistencia y Rendimiento)<br>• **Cristopher Erik San Juan Piza** (Ingeniero Frontend, UI/UX y Aseguramiento de Calidad) |
| **Calificación Pre-Auditoría** | **100% CUMPLIMIENTO VERIFICADO (43/43 Puntos Conforme — 33/33 Tests en Verde)** |

---

## 1. Preparación Previa a la Sesión (15 Minutos Antes)

Antes de que ingresen los auditores, preparar la estación de trabajo con este entorno:

### A. Terminales y Servicios
Abrir **4 pestañas de terminal**:

* **Terminal 1 (Servidor Web ExpressMart):**
  ```bash
  cd /home/diego/Documentos/pauditoria
  npm start
  # Debe indicar: Servidor ExpressMart escuchando en puerto 3000
  ```

* **Terminal 2 (Pruebas y Verificador de Auditoría):**
  ```bash
  cd /home/diego/Documentos/pauditoria
  # Lista para ejecutar 'npm test' y 'npm run audit:verify' en vivo
  ```

* **Terminal 3 (Panel de Gestión Administrativa y Finanzas):**
  ```bash
  cd /home/diego/Documentos/pauditoria
  ./run_admin_panel.sh
  # Despliega la ventana gráfica en Python con balance financiero, cuentas y log de ventas
  ```

* **Terminal 4 (Panel de Seguridad y Auditoría Criptográfica):**
  ```bash
  cd /home/diego/Documentos/pauditoria
  python3 scripts/security_panel.py
  # Despliega la ventana gráfica de escaneo de puertos, heurística y verificación SHA-256
  ```

### B. Pestañas del Navegador Web (Google Chrome / Firefox)
1. **Pestaña 1:** `http://localhost:3000` (Tienda Principal ExpressMart).
2. **Pestaña 2:** `http://localhost:3000/api/health` (Telemetría de salud y cabeceras HTTP de seguridad).
3. **Pestaña 3:** `http://localhost:3000/api/docs/openapi.json` (Contratos OpenAPI 3.0 estándar).
4. **Pestaña 4:** `https://github.com/snake0217/Express-Mart` (Repositorio remoto oficial en GitHub, rama `main`).
5. **Pestaña 5:** Abrir el documento formal [docs/DICCIONARIO_DE_DATOS_Y_DIAGRAMAS_DESARROLLO.docx](file:///home/diego/Documentos/pauditoria/docs/DICCIONARIO_DE_DATOS_Y_DIAGRAMAS_DESARROLLO.docx) o su versión Markdown [docs/DICCIONARIO_DE_DATOS_Y_DIAGRAMAS_DESARROLLO.md](file:///home/diego/Documentos/pauditoria/docs/DICCIONARIO_DE_DATOS_Y_DIAGRAMAS_DESARROLLO.md).

---

## 2. Agenda Cronometrada de la Demostración (35 Minutos)

| Bloque | Minutos | Tema / Evidencia Práctica | Responsable | Auditor Principal |
| :---: | :---: | :--- | :--- | :--- |
| **0** | **00 - 03** (3 min) | Bienvenida, estado del proyecto y presentación del expediente `ECTA-DEV-01`. | Diego Alarcón | Sebastian Muñoz |
| **1** | **03 - 10** (7 min) | Arquitectura General, Diagramas C4 (N2/N3), Casos de Uso y GitFlow en GitHub. | Diego Alarcón | Sebastian Muñoz |
| **2** | **10 - 17** (7 min) | Diccionario de Datos (16 Tablas), ERD, Almacenes D1 a D8 y Calidad ISO/IEC 25012. | Carlos Bautista | Selene Vázquez |
| **3** | **17 - 25** (8 min) | Ciberseguridad: 2FA Nodemailer, Cifrado AES-256-GCM, Tokenización PCI DSS y Tests (33/33). | Diego Alarcón | Selene Vázquez |
| **4** | **25 - 32** (7 min) | Demostración en Vivo: Marketplace, Checkout Prime, Timeout (5 min) y Paneles GUI Python. | Cristopher San Juan | Uriel Guadarrama |
| **5** | **32 - 35** (3 min) | Ejecución en vivo de `npm run audit:verify` (43/43 puntos) y Cierre con Dictamen Favorable. | Todo el equipo | Todo el equipo auditor |

---

## 3. Guion Paso a Paso: Qué Decir y Qué Mostrar en Pantalla

### BLOQUE 0: Bienvenida e Introducción Ejecutiva (Minuto 00:00 a 03:00)
**Ponente:** Diego Alarcón  
**Enfoque:** Establecer el tono profesional y presentar el índice de evidencias.

> **Palabras de inicio (Qué decir):**  
> *"Estimado equipo auditor — Sebastian, Selene, Uriel—, buenos días. Bienvenidos a la sesión de evaluación y dictamen final del sistema de comercio electrónico de **ExpressMart México**, desarrollado bajo la razón social TiendaExpress Online, S.A. de C.V.*  
>  
> *El día de hoy presentaremos el cumplimiento exhaustivo del Manual de Calidad `MC-001` y del Plan de Auditoría `ECTA-01`. Nos complace reportar que, tras atender todos los hallazgos previos, el sistema alcanza un **100% de conformidad en los 43 puntos auditables**, respaldado por una suite automatizada de **33 pruebas unitarias e integrales en verde** y el expediente maestro de arquitectura y datos **`ECTA-DEV-01`** recién incorporado.*  
>  
> *A lo largo de los próximos 30 minutos, demostraremos en vivo la arquitectura de software, los modelos de base de datos, los controles de ciberseguridad bajo PCI DSS y LFPDPPP, y la operación en tiempo real del Marketplace y nuestros paneles de administración. Comenzamos con la gestión de desarrollo y arquitectura."*

---

### BLOQUE 1: Arquitectura de Software, Diagramas C4, Casos de Uso y GitFlow (Minuto 03:00 a 10:00)
**Ponente:** Diego Alarcón  
**Auditor de Referencia:** Sebastian Muñoz Gonzales (Auditor Líder — Checklist `CL-03 Desarrollo`)  
**Pantallas a mostrar:** Pestaña con [docs/DICCIONARIO_DE_DATOS_Y_DIAGRAMAS_DESARROLLO.docx](file:///home/diego/Documentos/pauditoria/docs/DICCIONARIO_DE_DATOS_Y_DIAGRAMAS_DESARROLLO.docx) y repositorio en GitHub.

#### 1.1 Diagrama de Arquitectura General y Modelo C4 Nivel 2 (Contenedores)
* **Qué mostrar en pantalla:** Mostrar la **Ilustración 4.1** (`diagrama_arquitectura_general.png`) y la **Ilustración 4.2** (`media_1794341493473.png`).
* **Qué decir:**  
  > *"Para dar respuesta formal al criterio `DEV-01`, hemos formalizado la arquitectura integral de ExpressMart dividida en 5 niveles de aislamiento estricto:*  
  > *1. **Capa de Interfaces:** Aplicación web cliente SPA, portal de vendedores y dos paneles gráficos de control nativos en Python (Admin y Seguridad).*  
  > *2. **Perímetro Seguro:** Un API Gateway con terminación TLS 1.3, Rate Limiting de 100 peticiones por minuto por IP, sanitización preventiva contra XSS y SQL Injection, y cabeceras de seguridad Helmet.*  
  > *3. **Microservicios de Dominio:** Servicios desacoplados para Cuentas/Auth, Catálogo con motor de búsqueda menor a 2 segundos, Carrito con reglas de negocio ExpressPrime, Pedidos con reserva atómica de inventario, Pagos tokenizados, Logística de paquetería y Auditoría forense.*  
  > *4. **Persistencia Transaccional:** Motor SQLite configurado en modo WAL con claves foráneas estrictas y cifrado AES-256-GCM para datos sensibles.*  
  > *5. **Servicios Externos Certificados:** Conexión con pasarela PCI DSS Nivel 1, servidor SMTP TLS y APIs de paquetería como DHL y FedEx."*

#### 1.2 Diagrama C4 Nivel 3 (Componentes) y Casos de Uso UML
* **Qué mostrar en pantalla:** Mostrar la **Ilustración 4.3** (`media_1794341503697.png`) y la **Ilustración 4.5** (`diagrama_casos_de_uso.png`).
* **Qué decir:**  
  > *"Atendiendo al criterio `DEV-02`, el C4 Nivel 3 muestra la separación interna en tres capas bajo Clean Architecture:*  
  > *- **Presentación:** `CheckoutController` y `CatalogController` respaldados por middleware de JWT y RBAC.*  
  > *- **Negocio:** El `Motor de Cálculo` matemático para subtotales, IVA al 16% y beneficios Prime; el `Orquestador de Checkout` transaccional; y manejadores CQRS de comando y consulta.*  
  > *- **Acceso a Datos:** `OrderRepository`, `InventoryRepository` y el adaptador seguro `PaymentGatewayAdapter`.*  
  >  
  > *Asimismo, el **Diagrama UML de Casos de Uso** estructura los 18 casos de uso del sistema (`CU-01` a `CU-18`), delimitando las fronteras entre el Comprador, el Vendedor, el Administrador y el Auditor, con relaciones `«include»` indispensables como la validación de doble factor por correo y la tokenización en iframe."*

#### 1.3 Control de Versiones y GitFlow (`DEV-08`, `DEV-09`)
* **Qué mostrar en pantalla:** Pestaña de GitHub `https://github.com/snake0217/Express-Mart`.
* **Qué decir:**  
  > *"Como exige el criterio `DEV-08`, mostramos en GitHub el árbol de ramas GitFlow formal: rama principal `main` protegida, rama de integración `develop`, ramas de características `feature/catalogo-busqueda` y `feature/checkout-pagos`, rama de estabilización `release/v1.0.0` y rama de emergencia `hotfix/timeout-pasarela`. Cada paso a producción requiere Pull Request con revisión de pares y paso exitoso del pipeline de integración continua."*

---

### BLOQUE 2: Diccionario de Datos (16 Tablas), ERD y Calidad ISO/IEC 25012 (Minuto 10:00 a 17:00)
**Ponente:** Carlos Adair Bautista Godínez  
**Auditora de Referencia:** Selene Nicole Vázquez Castrejón (Checklist `CL-04 Seguridad y Calidad de Datos`)  
**Pantallas a mostrar:** Sección 2 y Sección 3 del documento [docs/DICCIONARIO_DE_DATOS_Y_DIAGRAMAS_DESARROLLO.md](file:///home/diego/Documentos/pauditoria/docs/DICCIONARIO_DE_DATOS_Y_DIAGRAMAS_DESARROLLO.md) y la **Ilustración 3.0** (`diagrama_entidad_relacion.png`).

#### 2.1 Modelo Entidad-Relación y Almacenes DFD Nivel 1
* **Qué decir:**  
  > *"Buenos días, Selene. En cumplimiento de `DEV-04` y `DEV-05`, el modelo de datos de ExpressMart fue diseñado en Tercera Forma Normal (3FN) con integridad referencial activa mediante `PRAGMA foreign_keys = ON;`.*  
  >  
  > *El DFD Nivel 1 define 8 almacenes funcionales (D1 a D8), los cuales se implementan a nivel físico en 16 tablas perfectamente normalizadas:*  
  > *- **D1 Usuarios y Privacidad:** Tabla principal `usuarios` (con RBAC, sal Scrypt, versionado de aviso legal y campos de membresía Prime), `suscripciones_premium`, `sesiones` (tokens UUID revocables), `mfa_email_codes` (tokens temporales OTP de 6 dígitos) y `derechos_arco` (atención legal de solicitudes LFPDPPP).*  
  > *- **D2 Catálogo:** Tabla `catalogo` con SKU único, especificaciones en JSON estructurado y validación estricta de completitud conforme a ISO/IEC 25012.*  
  > *- **D3 Inventario:** Tabla `inventario` con discriminación de `stock_disponible` y `stock_reservado` para eliminar sobreventas, vinculada con `carrito_items` persistente en servidor.*  
  > *- **D4 Pedidos:** Tabla `pedidos` con folio `EXP-2026-XXXX`, desglose de impuestos, costo de flete, cupones y el sello inmutable `hash_integridad` en SHA-256; complementada por `pedido_items` con congelamiento histórico de precios, y tabla `notificaciones`.*  
  > *- **D5 Transacciones:** Tabla `transacciones` bajo alcance PCI DSS SAQ-A. Almacena únicamente `token_pci`, `tarjeta_enmascarada` (patrón `**** 1234`) y la llave única `idempotency_key`.*  
  > *- **D6 Envíos:** Tabla `envios` con número de guía oficial DHL/FedEx y vector cronológico de hitos `historial_rastreo_json`.*  
  > *- **D7 Reseñas:** Tabla `resenas` con filtro estricto de compra auténtica (`pedido_id`) y moderación activa.*  
  > *- **D8 Bitácora:** Tabla `bitacora_auditoria` con encadenamiento criptográfico estricto SHA-256 (`prev_hash`)."*

#### 2.2 Calidad de Datos según ISO/IEC 25012
* **Qué decir:**  
  > *"En cada una de las 16 tablas, el diccionario de datos formaliza 7 dimensiones de calidad de datos ISO/IEC 25012: exactitud sintáctica (tipos de dato INTEGER, REAL, TEXT), completitud (restricciones NOT NULL), consistencia lógica (restricciones CHECK de rangos y enums), unicidad (índices UNIQUE en SKUs, emails, folios y guías) y confidencialidad en reposo."*

---

### BLOQUE 3: Ciberseguridad, 2FA Nodemailer, Cifrado AES-256 y Alcance PCI DSS (Minuto 17:00 a 25:00)
**Ponente:** Diego Alarcón  
**Auditora de Referencia:** Selene Nicole Vázquez Castrejón (Checklist `CL-04` — `SEG-08`, `SEG-11`, `SEG-15`)  
**Pantallas a mostrar:** Código en `src/services/emailService.js`, Diagrama de Secuencia de Pagos (**Ilustración 4.4**), y ejecución de `npm test` en Terminal 2.

#### 3.1 Protección de Datos Personales (LFPDPPP) y Cifrado AES-256-GCM (`SEG-08`)
* **Qué decir:**  
  > *"Para dar cumplimiento a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), el sistema no almacena direcciones postales ni números telefónicos en texto plano. Cada dato sensible se cifra en reposo utilizando **AES-256-GCM** con un vector de inicialización (IV) único de 96 bits y etiqueta de autenticación (AuthTag) de 128 bits, garantizando tanto confidencialidad como integridad matemática contra manipulaciones."*

#### 3.2 Doble Factor de Autenticación (2FA) con Nodemailer
* **Qué decir:**  
  > *"Hemos robustecido el control de acceso integrando verificación de dos pasos por correo electrónico vía Nodemailer:*  
  > *- Al registrarse o iniciar sesión, el sistema genera un código numérico criptográfico de 6 dígitos con expiración forzada a 5 minutos (`mfa_email_codes`).*  
  > *- El correo se transmite por canal seguro TLS hacia el servidor SMTP de Google Gmail.*  
  > *- El usuario debe confirmar el código antes de recibir el token de sesión bearer. Las credenciales de la app residen de forma segura en variables de entorno locales, cumpliendo con la política de no exposición de secretos en Git."*

#### 3.3 Aislamiento de Pagos y Cumplimiento PCI DSS SAQ-A (`SEG-11`, `DEV-03`)
* **Qué mostrar en pantalla:** Ilustración 4.4 (`media_1794341507085.png`).
* **Qué decir:**  
  > *"Mostramos el **Diagrama de Secuencia de Procesamiento de Pago**. ExpressMart aplica el estándar **PCI DSS v4.0 bajo modalidad SAQ-A**:*  
  > *1. El cliente interactúa con un iframe seguro firmado directamente por la pasarela adquirente (Stripe/Openpay).*  
  > *2. El PAN (tarjeta) y el CVV viajan directamente del navegador a la pasarela sobre TLS 1.3.*  
  > *3. El core de ExpressMart jamás toca, procesa ni almacena números de tarjeta completos ni códigos de seguridad.*  
  > *4. La pasarela emite un token efímero `tok_xyz`, el cual se envía al backend junto con una clave de idempotencia única.*  
  > *5. En base de datos únicamente se almacena el token y la máscara `**** **** **** 1234`, quedando nuestra infraestructura fuera del alcance de certificación de almacenamiento de tarjeta."*

#### 3.4 Ejecución de Pruebas Automatizadas en Vivo (`H-02`, 33/33 Tests)
* **Acción en vivo:** Ir a la **Terminal 2** y ejecutar:
  ```bash
  npm test
  ```
* **Qué decir mientras corre:**  
  > *"Ejecutamos en vivo nuestra batería automatizada con Jest y el test runner de Node.js. Incluye pruebas unitarias de criptografía, sanitización y cálculo financiero, así como pruebas de integración de rutas protegidas y seguridad."*
* **Resultado:** Mostrar los **3 suites aprobados, 33 de 33 tests en verde y cobertura superior al 88% en líneas y 100% en funciones críticas.**

---

### BLOQUE 4: Demostración Funcional en Vivo del Marketplace y Paneles GUI (Minuto 25:00 a 32:00)
**Ponentes:** Cristopher San Juan y Diego Alarcón  
**Auditor de Referencia:** Uriel Guadarrama Estrada (Checklist `CL-05 Pruebas` y `CL-06 Despliegue`)  
**Pantallas a mostrar:** Navegador Web `http://localhost:3000` y Paneles en Python.

#### 4.1 Marketplace, Catálogo de 50 Productos y Búsqueda en Vivo
* **Acción en pantalla:**
  1. Abrir `http://localhost:3000`. Mostrar el banner de ExpressPrime y la cuadrícula con los **50 productos organizados por categorías** (Electrónica, Hogar, Celulares, Consolas, Computación).
  2. Probar el buscador escribiendo `"Samsung"` o `"Gears"`. Demostrar cómo aparecen los resultados en tiempo real en menos de 2 segundos.
  3. Hacer clic en un producto para ver la ficha técnica, el zoom interactivo y las opiniones de compradores verificados.

#### 4.2 Membresía ExpressPrime, Cashback y Descuento en Checkout
* **Acción en pantalla:**
  1. Iniciar sesión con un usuario o registrar uno demostrando el envío del código 2FA.
  2. Ir a la sección de **Express Prime México** y mostrar las suscripciones de **1 mes, 3 meses y 1 año**.
  3. Agregar artículos al carrito de compra.
  4. Ir al checkout: mostrar cómo el sistema calcula **Envío Gratis ($0.00)** para miembros Prime y aplica el **Cashback de compra**.
  5. Completar la simulación de pago seguro y mostrar la generación del folio de pedido y la guía logística.

#### 4.3 Control de Inactividad y Cierre de Sesión Automático (Timeout de 5 Minutos)
* **Qué decir:**  
  > *"Para mitigar el riesgo de secuestro de sesión en estaciones desatendidas (OWASP ASVS), implementamos un monitor de actividad. Tras 5 minutos de inactividad, el sistema despliega el diálogo modal: **'¿Sigues ahí?'**. Si el usuario no responde en un lapso de 2 minutos adicionales, la sesión se revoca automáticamente en el servidor y se purga el almacenamiento local para impedir compras no autorizadas."*

#### 4.4 Paneles Gráficos Standalone en Python (Admin y Seguridad)
* **Acción en pantalla:** Mostrar las ventanas de Python abiertas:
  1. **Panel Administrativo (`scripts/admin_panel.py`):**
     - Mostrar la pestaña de **Métricas y Finanzas** con el dinero recaudado en ExpressMart.
     - Mostrar la pestaña de **Cuentas en Sistema** y la interfaz para crear nuevos administradores, vendedores o auditores.
     - Mostrar el **Log de Ventas** y generar el reporte en tiempo real.
  2. **Panel de Seguridad y Auditoría (`scripts/security_panel.py`):**
     - Ejecutar el **Escáner de Puertos** para constatar sockets abiertos y servicios autorizados.
     - Mostrar el monitor de actividad sospechosa (detección de intentos de inyección y fuerza bruta).
     - Ejecutar la **Verificación Matemática de Hashes SHA-256**: Presionar el botón para verificar que la cadena de la bitácora `bitacora_auditoria` (D8) es 100% íntegra y que no ha sufrido alteraciones retroactivas.

---

### BLOQUE 5: Verificación Automatizada del Plan de Auditoría y Cierre (Minuto 32:00 a 35:00)
**Ponente:** Diego Alarcón  
**Audiencia:** Todo el equipo auditor (Sebastian, Selene, Uriel).  
**Acción en vivo:** Ir a la **Terminal 2** y ejecutar:
```bash
npm run audit:verify
```

* **Qué decir mientras se ejecuta:**  
  > *"Para concluir nuestra defensa técnica de manera formal e irrefutable, ejecutamos el script verificador oficial del plan de auditoría `ECTA-01`."*

* **Qué mostrar cuando finalice el script (Resultado JSON en consola):**
  - **Archivos Requeridos:** `30 presentes / 0 faltantes`.
  - **Puntos Auditados:** `43 de 43 cumplidos al 100%`.
  - **Sección 1 (Gestión Documental):** 11/11 (100%).
  - **Sección 2 (Desarrollo y Proyecto):** 8/8 (100%).
  - **Sección 3 (Seguridad y Datos):** 2/2 (100%).
  - **Sección 4 (Calidad y Pruebas):** 9/9 (100%).
  - **Sección 5 (Despliegue y Liberación):** 4/4 (100%).
  - **Sección 6 (Operación y Continuidad):** 4/4 (100%).
  - **Sección 7 (Seguimiento y Mejora):** 5/5 (100%).
  - **Matrices Auxiliares:** `NOR 10/10`, `DEV 12/12`, `SEG 18/18`.

> **Palabras finales de cierre y solicitud de dictamen:**  
> *"Como han podido constatar en vivo, cada uno de los 43 criterios del Manual de Calidad `MC-001`, los requerimientos de la LFPDPPP, las especificaciones de PCI DSS v4.0 SAQ-A y las normas ISO/IEC 25010 y 25012 han sido implementados, probados y documentados en el expediente `ECTA-DEV-01`.*  
>  
> *Por lo anterior, solicitamos formalmente al Comité Auditor su **DICTAMEN FAVORABLE SIN SALVEDADES** y el cierre satisfactorio de esta auditoría de sistemas para ExpressMart México. Quedamos a su entera disposición para cualquier pregunta técnica. Muchas gracias."*

---

## 4. Batería de Preguntas Difíciles y Respuestas Técnicas (Cheat Sheet)

Ten preparadas estas respuestas directas y seguras ante posibles preguntas de los auditores:

### P1: *"¿Por qué tienen 16 tablas en la base de datos si el DFD Nivel 1 solo habla de 8 almacenes (D1 a D8)?"*
* **Respuesta Técnica:**  
  *"El DFD Nivel 1 modela almacenes conceptuales de información. Por principios de normalización relacional en Tercera Forma Normal (3FN), los almacenes complejos se desglosan en tablas relacionales especializadas. Por ejemplo, el almacén D1 (Usuarios) se compone de `usuarios`, `suscripciones_premium`, `sesiones`, `mfa_email_codes` y `derechos_arco` para evitar duplicidad de datos y garantizar atomicidad. Lo mismo aplica para D4 (Pedidos y Detalle de Partidas). Esta correspondencia exacta está documentada en la Sección 3 del expediente `ECTA-DEV-01`."*

### P2: *"¿Cómo demuestran que no almacenan datos de tarjetas y que cumplen con PCI DSS SAQ-A?"*
* **Respuesta Técnica:**  
  *"El código fuente del frontend carga un iframe seguro directamente desde el dominio certificado de la pasarela de pagos. Los números de tarjeta (PAN) y CVV se capturan en ese iframe y nunca tocan nuestros servidores. En la tabla `transacciones` únicamente almacenamos el `token_pci` efímero devuelto por la pasarela, la máscara de 4 dígitos `**** **** **** 1234` y una clave única de idempotencia. Esto nos ubica en la exención SAQ-A de PCI DSS v4.0, como lo certifica el diagrama de secuencia de la Sección 4.4."*

### P3: *"¿Cómo demuestran el no-repudio y que la bitácora de auditoría (D8) no ha sido modificada por un administrador?"*
* **Respuesta Técnica:**  
  *"La tabla `bitacora_auditoria` implementa una cadena de bloques criptográfica. Cada registro calcula un hash SHA-256 que concatena el hash del registro anterior (`prev_hash`), el timestamp en milisegundos, el ID del usuario, la acción y el payload de detalles. Si cualquier usuario o administrador alterara una sola coma de un registro histórico en la base de datos, el hash encadenado se rompería. El panel de seguridad en Python que acabamos de mostrar ejecuta un algoritmo que recalcula la cadena completa desde el bloque génesis y alerta inmediatamente sobre cualquier discrepancia."*

### P4: *"¿Qué ocurre con la sesión si el usuario se desconecta o deja la pantalla abierta?"*
* **Respuesta Técnica:**  
  *"El sistema tiene un temporizador de inactividad de 5 minutos regulado en `public/app.js` y validado del lado servidor en la tabla `sesiones`. A los 5 minutos sin eventos de mouse o teclado, se emite una advertencia interactiva con un contador de 2 minutos. Si no se presiona 'Seguir conectado', el cliente invoca automáticamente el endpoint `/api/auth/logout`, invalidando el token en el servidor y redirigiendo a la pantalla de inicio para proteger los datos personales del comprador."*

### P5: *"¿Qué medidas tomaron para evitar que se filtren contraseñas o credenciales al repositorio público de GitHub?"*
* **Respuesta Técnica:**  
  *"El archivo `.gitignore` excluye estrictamente los archivos locales `.env`, cualquier archivo con prefijo `CONTRASENAS_*` y respaldos temporales. Además, el servicio de correo en `src/services/emailService.js` lee las credenciales en tiempo de ejecución a través de `process.env.MAIL_PASS` cargado dinámicamente desde el entorno local, lo que previene que los escáneres de secretos de GitHub activen alertas de seguridad o bloqueen el despliegue."*

### P6: *"¿Dónde podemos consultar la documentación completa entregada?"*
* **Respuesta Técnica:**  
  *"Está totalmente versionada en el repositorio en la carpeta `docs/`. Disponen tanto del archivo técnico integral en Markdown (`docs/DICCIONARIO_DE_DATOS_Y_DIAGRAMAS_DESARROLLO.md`) como del documento ofimático formal en Word (`docs/DICCIONARIO_DE_DATOS_Y_DIAGRAMAS_DESARROLLO.docx`), el cual incluye las 8 ilustraciones técnicas de arquitectura en alta resolución y el diccionario de datos de las 16 entidades."*

---

## 5. Resumen de Comandos Rápidos de Emergencia

Si durante la auditoría piden ver algún componente de inmediato, tener estos comandos a la mano:

| Acción Requerida | Comando en Terminal |
| :--- | :--- |
| **Correr todas las pruebas unitarias e integración** | `npm test` |
| **Correr el verificador de los 43 puntos del manual** | `npm run audit:verify` |
| **Iniciar la plataforma web** | `npm start` |
| **Abrir Panel Administrativo y Financiero en Python** | `./run_admin_panel.sh` |
| **Abrir Panel de Seguridad y Auditoría en Python** | `python3 scripts/security_panel.py` |
| **Regenerar documentación y diagramas** | `python3 scripts/generate_audit_docs.py` |
| **Verificar estado limpio de Git** | `git status` |

# Guion Oficial de Demostración, Avances y Defensa para la Auditoría — ExpressMart

| Metadato | Valor |
| :--- | :--- |
| **Código de Documento** | `GUIA-AUDIT-DEMO` |
| **Fecha de la Auditoría** | `30 de octubre de 2026 (Sesión de Revisión y Cierre Integral)` |
| **Proyecto** | ExpressMart Marketplace México — TiendaExpress Online, S.A. de C.V. |
| **Versión del Sistema** | `v1.0.0` (Producción Auditada) |
| **Normativa Auditada** | Manual de Calidad (`MC-001`), Plan de Auditoría (`ECTA-01`), ISO 9001:2015, ISO/IEC 25010, ISO/IEC 25012, ISO/IEC 27001, OWASP ASVS v4.0, PCI DSS v4.0, LFPDPPP, LFPC e ISO 22301 |
| **Equipo Auditor** | **Sebastian Muñoz Gonzales** (Auditor Líder - Gestión Documental y Desarrollo)<br>**Selene Nicole Vázquez Castrejón** (Auditora - Seguridad, Calidad de Datos y Pruebas)<br>**Uriel Guadarrama Estrada** (Auditor - Configuración, Despliegue, Operación y Continuidad) |
| **Equipo Defensor / Presentador** | **Diego Alarcón De Jesús** (Líder Técnico, Despliegue y Seguridad)<br>**Carlos Adair Bautista Godínez** (Desarrollador Backend, Datos y Rendimiento)<br>**Cristopher Erik San Juan Piza** (Desarrollador Frontend, UI/UX y QA) |
| **Estado Global** | **LISTO PARA PRESENTACIÓN — 100% CUMPLIMIENTO VERIFICADO (43/43 PUNTOS)** |

---

## 1. Objetivo de la Sesión de Auditoría

Demostrar en vivo, de manera práctica y auditable ante el equipo auditor:
1. El **cierre definitivo del 100% de los hallazgos** (`H-01` a `H-06`) de la revisión previa y la implementación de las fases del cliente y transaccionales (**Fase 2: Catálogo y Búsqueda** y **Fase 3: Núcleo Transaccional**).
2. El funcionamiento del **Marketplace ExpressMart México**:
   * Catálogo con 20 productos reales en **Pesos Mexicanos ($ MXN)** con imágenes verificadas en alta resolución y reseñas de compradores.
   * Ficha técnica estilo Amazon / Mercado Libre con **Zoom interactivo (2.3x)** al pasar el ratón y Buy Box dedicado.
   * Buscador en vivo con **sugerencias con imágenes en tiempo real** y página dedicada de resultados.
   * Flujo de **Checkout en 3 pasos** con cálculo de subtotal, IVA 16%, cupones y validación de dirección y pago seguro.
   * **Aislamiento estricto de usuarios**: carritos independientes, listas de deseos limpias y "Mis Pedidos" con imágenes y detalles propios.
   * **Identidad visual corporativa** alineada al azul oficial del logotipo (`#1d4e9a` / `#123580` / `#0c1e3d`).
3. El **Nuevo Panel de Seguridad y Auditoría en Python** (`./run_security_panel.sh`):
   * Escaneo de puertos del sistema y sockets activos.
   * Análisis heurístico de actividades sospechosas (WAF, Fuerza Bruta, RBAC).
   * Verificación matemática de la cadena criptográfica SHA-256 (D8) de la bitácora inmutable.
4. El cumplimiento del **100% de los 43 puntos del Manual de Calidad MC-001** y el paso del 100% de las pruebas automatizadas (28/28 tests en verde).

---

## 2. Checklist de Preparación Previa (15 Minutos Antes)

Antes de iniciar la sesión de auditoría, ejecutar en la estación de trabajo:

```bash
cd /home/diego/Documentos/pauditoria

# 1. Ejecutar la suite completa de pruebas automatizadas
npm test

# 2. Ejecutar la verificación automatizada del plan de auditoría ECTA-01
npm run audit:verify

# 3. Iniciar el servidor web de ExpressMart (si no está activo)
npm start
```

### Ventanas que deben estar abiertas y listas:
1. **Navegador Web (Pestaña 1):** `http://localhost:3000` (Marketplace ExpressMart en vivo).
2. **Navegador Web (Pestaña 2):** `http://localhost:3000/api/health` (Telemetría y cabeceras de seguridad HTTP).
3. **Navegador Web (Pestaña 3):** `http://localhost:3000/api/docs/openapi.json` (Contratos OpenAPI 3.0 estándar).
4. **Navegador Web (Pestaña 4):** `https://github.com/snake0217/Express-Mart` (Repositorio remoto oficial en GitHub).
5. **Terminal 1:** Servidor ExpressMart en ejecución (`npm start`).
6. **Terminal 2:** Terminal limpia lista para ejecutar comandos en vivo (`./run_security_panel.sh`, `npm test`, etc.).

---

## 3. Agenda Cronometrada de la Demostración (35 Minutos)

| Bloque | Duración | Tema / Demostración en Vivo | Responsable | Auditor Evaluador |
| :---: | :---: | :--- | :--- | :--- |
| **0** | 3 min | Bienvenida, objetivos de la auditoría y estado general | Diego Alarcón | Todo el equipo auditor |
| **1** | 6 min | Repositorio GitFlow, Contratos OpenAPI 3.0 y Gobernanza (H-01, H-02, H-04) | Diego Alarcón | **Sebastian Muñoz Gonzales** |
| **2** | 8 min | Base de Datos SQLite WAL (D1 a D8), Cifrado AES-256 y Transacciones ACID (H-05) | Carlos Bautista | **Selene Nicole Vázquez** |
| **3** | 8 min | Nuevo Panel de Seguridad en Python: Puertos, Logs y Actividades Sospechosas | Diego Alarcón | **Selene Nicole Vázquez** |
| **4** | 7 min | Aplicación Web: Catálogo, Zoom 2.3x, Buscador en Vivo, Checkout MXN y Aislamiento | Cristopher San Juan | Todo el equipo auditor |
| **5** | 3 min | Verificación del Plan ECTA-01 (43/43 puntos) y Cierre de Sesión | Diego Alarcón | **Sebastian Muñoz Gonzales** |

---

## 4. Guion Paso a Paso de Demostración y Defensa

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║ BLOQUE 0: BIENVENIDA Y RESUMEN EJECUTIVO (3 MINUTOS)                         ║
║ Presentador: Diego Alarcón De Jesús                                          ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```
* **Discurso inicial:**
  > *"Buenos días al equipo auditor: Auditor Líder Sebastian Muñoz, Auditora Selene Nicole Vázquez y Auditor Uriel Guadarrama. El equipo de ingeniería de ExpressMart presenta hoy los avances consolidados correspondientes a las Fases 2 y 3 del plan de desarrollo, así como el cierre formal y exhaustivo de las observaciones y hallazgos H-01 a H-06. Demostraremos que la plataforma cuenta con una arquitectura robusta, segura, trazable y respaldada por 28 pruebas automatizadas y un cumplimiento del 100% de los 43 puntos del Manual de Calidad MC-001."*

---

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║ BLOQUE 1: GESTIÓN DE REPOSITORIO, GITFLOW Y CONTRATOS API (6 MINUTOS)         ║
║ Presentador: Diego Alarcón De Jesús                                          ║
║ Auditor Evaluador: Sebastian Muñoz Gonzales (Auditor Líder)                   ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 1.1. Demostrar el Control de Versiones GitFlow (Subsanación H-01)
* **Acción en pantalla:** Abrir el repositorio GitHub `https://github.com/snake0217/Express-Mart`.
* **Puntos a señalar:**
  1. Mostrar la estructura de ramas del flujo **GitFlow**:
     * `main`: Rama de producción auditada y protegida.
     * `develop`: Integración continua de funcionalidades.
     * `release/v1.0.0`: Versión candidata promovida a producción.
     * `feature/catalogo-busqueda` y `feature/checkout-pagos`: Desarrollo modular de Fases 2 y 3.
     * `hotfix/timeout-pasarela`: Corrección de contingencia (`RFC-0001`).
  2. Ejecutar en la Terminal 2:
     ```bash
     git log --oneline -n 6
     ```
     *Explicación:* Todos los commits se apegan a la convención **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`) conforme a la Sección 6.1 del Manual de Calidad.
  3. Mostrar que el repositorio está limpio de archivos temporales u ofimáticos binarios (`.gitignore` ignora bases de datos locales, artefactos de cobertura y temporales).

### 1.2. Demostrar los Contratos Formales de API REST OpenAPI 3.0 (Subsanación H-02)
* **Acción en pantalla:** Abrir en el navegador `http://localhost:3000/api/docs/openapi.json`.
* **Puntos a señalar:**
  1. Mostrar que el endpoint entrega la especificación estándar **OpenAPI 3.0.3** en vivo.
  2. Mostrar la cobertura completa de endpoints: `/api/products`, `/api/checkout`, `/api/orders`, `/api/auth/login`, `/api/audit-logs`, `/api/health`.
  3. Indicar que todos los esquemas de respuesta definen códigos HTTP estándar (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `429 Rate Limit`).

### 1.3. Demostrar la Gobernanza Estricta de Secretos (Subsanación H-04)
* **Acción en pantalla:** Abrir [src/config/env.js](file:///home/diego/Documentos/pauditoria/src/config/env.js#L57-L80) y [tests/security.test.js](file:///home/diego/Documentos/pauditoria/tests/security.test.js).
* **Puntos a señalar:**
  1. Función `validateSecrets()`: En ambientes de `production` y `staging`, el servidor **aborta inmediatamente su arranque** si las claves `SECRET_ENCRYPTION_KEY` o `SESSION_SECRET` están ausentes, son menores a 32 caracteres o corresponden a valores por defecto.
  2. Mostrar la prueba unitaria en Jest que valida que se arroje una excepción de seguridad si se intentan usar claves inseguras.

---

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║ BLOQUE 2: BASE DE DATOS TRANSACCIONAL SQLITE WAL Y SEGURIDAD (8 MINUTOS)      ║
║ Presentador: Carlos Adair Bautista Godínez                                   ║
║ Auditora Evaluadora: Selene Nicole Vázquez Castrejón                         ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 2.1. Demostrar Integridad Transaccional ACID y Modo WAL (Subsanación H-05)
* **Acción en pantalla:** Ejecutar en la Terminal 2 el comando de verificación:
  ```bash
  npm run db:verify
  ```
* **Puntos a señalar en la salida:**
  1. **Modo WAL (Write-Ahead Logging):** Lecturas y escrituras concurrentes sin bloqueo.
  2. **Integridad Referencial:** `PRAGMA foreign_keys = ON`.
  3. **Verificación de Integridad:** `PRAGMA integrity_check = ok`.
  4. **Transacción atómica con COMMIT:** Actualización de stock de inventario e inserción de pedido de forma atómica.
  5. **Transacción con ROLLBACK:** Se demuestra que una falla provocada revierte todos los cambios de inmediato, garantizando cero estados inconsistentes y **cero sobreventas** de inventario.

### 2.2. Demostrar Cifrado en Reposo AES-256-GCM y Protección de Datos
* **Acción en pantalla:** Mostrar las tablas relacionales de datos:
  * Direcciones de envío cifradas en `pedidos` (`direccion_envio_cifrada`).
  * Bóveda de tarjetas tokenizadas PCI DSS en `transacciones` (`boveda_cifrada`, `token_pci`, `tarjeta_enmascarada`).
  * Respaldo cifrado automático:
    ```bash
    npm run backup
    ```
    *(Muestra la creación de respaldo comprimido y cifrado con verificación de hash SHA-256).*

### 2.3. Demostrar la Consola Interactiva de Base de Datos
* **Acción en pantalla:** Ejecutar en Terminal 2:
  ```bash
  npm run db:console
  ```
  * Mostrar cómo un administrador o auditor puede consultar tablas (`usuarios`, `catalogo`, `pedidos`, `bitacora_auditoria`) desde la línea de comandos de forma segura.

---

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║ BLOQUE 3: NUEVO PANEL DE SEGURIDAD EN PYTHON Y AUDITORÍA (8 MINUTOS)          ║
║ Presentador: Diego Alarcón De Jesús                                          ║
║ Auditora Evaluadora: Selene Nicole Vázquez Castrejón                         ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 3.1. Ejecución Rápida del Panel en Bash
* **Acción en pantalla:** En la Terminal 2, ejecutar:
  ```bash
  ./run_security_panel.sh --overview
  ```
* **Puntos a explicar ante la auditora:**
  1. **Estado Web:** Muestra la conexión en tiempo real con el servidor ExpressMart en puerto 3000 con latencia en milisegundos (`~12 ms`) y HTTP 200.
  2. **Nivel de Amenaza (Threat Level):** Cálculo de puntaje de riesgo de 0 a 100 con clasificación por color.
  3. **Integridad Criptográfica D8:** Estado de la cadena de auditoría SHA-256 (59 bloques validados al 100%).
  4. **Cabeceras de Seguridad HTTP:** Verificación en verde de `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security` (HSTS) y `Content-Security-Policy` (CSP).

### 3.2. Inspección de Puertos y Servicios de Red
* **Acción en pantalla:** Ejecutar:
  ```bash
  ./run_security_panel.sh --ports
  ```
* **Puntos a señalar:**
  1. Tabla de puertos abiertos: Puerto `3000` (Node.js ExpressMart API), sockets locales `127.0.0.1` vs `0.0.0.0`.
  2. Clasificación de riesgo de cada servicio para prevenir exposición indebida de bases de datos o servicios administrativos.

### 3.3. Detección de Actividades Sospechosas y Amenazas
* **Acción en pantalla:** Ejecutar:
  ```bash
  ./run_security_panel.sh --threats
  ```
* **Puntos a señalar:**
  1. Detección automática de:
     * **Ataques WAF:** Inyecciones XSS y SQLi bloqueadas (`ATAQUE_BLOQUEADO_WAF`).
     * **Fuerza Bruta:** Cuentas bloqueadas tras 5 intentos fallidos (`BLOQUEO_CUENTA_FUERZA_BRUTA` - SEG-01).
     * **Violaciones RBAC:** Intentos de usuarios sin privilegios para ingresar a auditoría o reportes (`ACCESO_DENEGADO_RBAC`).
  2. Lista de IPs sospechosas rastreadas y recomendaciones de mitigación operativa bajo ISO 27001.

### 3.4. Demostración de Verificación Criptográfica D8 (Blockchain Local)
* **Acción en pantalla:** Ejecutar:
  ```bash
  ./run_security_panel.sh --verify
  ```
* **Puntos a señalar:**
  1. Explicar el encadenamiento: $\text{hash\_cadena}_n = \text{SHA-256}(\text{hash}_{n-1} \parallel \text{datos}_n)$.
  2. Demostrar que el panel verifica matemáticamente bloque por bloque garantizando no-repudio e inmutabilidad (conforme a **ISO/IEC 25012** y requerimiento **SEG-15**).

---

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║ BLOQUE 4: APLICACIÓN WEB EN VIVO — EXPERIENCIA DEL CLIENTE (7 MINUTOS)        ║
║ Presentador: Cristopher Erik San Juan Piza                                   ║
║ Evaluador: Todo el Equipo Auditor                                            ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 4.1. Identidad Visual Corporativa Oficial
* **Acción en pantalla:** En el navegador, ingresar a `http://localhost:3000`.
* **Puntos a señalar:**
  1. **Azul Oficial del Logotipo:** Mostrar cómo el encabezado, navegación y footer incorporan la paleta oficial de ExpressMart (`#1d4e9a` / `#123580` / `#0c1e3d`), alineada armónicamente al logo en alta resolución.
  2. **Moneda Nacional ($ MXN):** Precios, subtotales, IVA y mensualidades calculados estrictamente en Pesos Mexicanos.
  3. **Diseño sobrio y corporativo:** Cero emojis; tipografía profesional y contrastes aprobados bajo WCAG 2.2 AA.

### 4.2. Catálogo y Ficha Técnica de Producto con Zoom Interactivo (Fase 2)
* **Acción en pantalla:**
  1. Hacer clic en **"Catálogo de Productos"** en la barra superior.
  2. Mostrar los 20 productos de diversas categorías (Cómputo, Audio, Telefonía, Accesorios, Hogar) con imágenes en alta calidad.
  3. Hacer clic en un producto (ej. *Apple MacBook Pro 16" M3 Max* o *Cafetera Espresso Nespresso Vertuo*).
  4. **Demostrar el Zoom Interactivo:**
     * Mover el ratón sobre la imagen principal del producto.
     * Mostrar la **magnificación fluida de 2.3x con mouse-tracking**, permitiendo examinar detalles de acabado, teclado o puertos exactamente como en Amazon o Mercado Libre.
     * Mostrar la tira interactiva de vistas alternativas (Principal, Detalle, Empaque).
  5. **Demostrar el Buy Box:**
     * Selector de unidades, indicador de stock en tiempo real, 12 MSI calculados en MXN y garantía legal de 30 días LFPC.

### 4.3. Buscador en Vivo con Sugerencias e Imágenes
* **Acción en pantalla:**
  1. En el buscador superior, comenzar a teclear: `"lap"` o `"sony"`.
  2. Mostrar el menú flotante que aparece de inmediato con miniaturas de producto, categoría, marca y precio en MXN.
  3. Presionar Enter o clic en *"Ver todos los resultados"* para demostrar la **página dedicada de resultados de búsqueda** (`#view-search-results`), indicando cantidad de productos y latencia de búsqueda en ms.

### 4.4. Aislamiento de Sesión y Carrito de Compras
* **Acción en pantalla:**
  1. Mostrar que un usuario **no registrado o anónimo no puede agregar productos sin autenticarse**: al hacer clic en "Agregar", se abre el modal de autenticación invitándolo a ingresar de forma segura.
  2. Cuentas nuevas registradas inician con **cesta y lista de deseos 100% vacías**.

### 4.5. Flujo de Checkout en 3 Pasos y Confirmación de Pedido (Fase 3)
* **Acción en pantalla:**
  1. Iniciar sesión con la cuenta de demostración (`cliente@expressmart.mx` / `ClienteDemo123!`).
  2. Notar el mensaje animado centrado: *"Iniciando sesión... ¡Bienvenido a ExpressMart!"*.
  3. Abrir la cesta y avanzar al **Paso 1**: Resumen con miniaturas de productos, cálculo automático de subtotal, descuento de cupón (`BIENVENIDA10`), IVA trasladado 16% y Envío ExpressPrime Gratis.
  4. **Paso 2:** Dirección de entrega y método de pago (tarjeta/MSI).
  5. **Paso 3:** Resumen final y clic en **"Confirmar y Pagar en MXN"**.
  6. **Confirmación:**
     * Se genera folio único de pedido (ej. `ORD-20261030-XXXX`).
     * Se asigna guía de paquetería DHL/FedEx ExpressPrime.
     * El botón de confirmar cambia dinámicamente a **"Salir"** en color azul primario.

### 4.6. "Mis Pedidos" con Detalles e Imágenes Aislados por Usuario
* **Acción en pantalla:**
  1. Ir a la pestaña **"Mis Pedidos y Devoluciones"**.
  2. Demostrar que el cliente ve **únicamente sus compras personales** (aislamiento estricto por `usuario_id`).
  3. Cada pedido despliega:
     * Nombre y miniatura de cada producto comprado.
     * Categoría, marca y SKU.
     * Cantidad y desglose de precio unitario.
     * Botón *"Ver Producto"* que enlaza directamente a su ficha técnica.
     * Botón legal para solicitar devolución y reembolso conforme a la LFPC.

### 4.7. Control de Privilegios RBAC Dinámico
* **Acción en pantalla:**
  1. Con cuenta de cliente: Mostrar que el botón de Panel de Administrador / Vendedor está **oculto**.
  2. Cerrar sesión (mostrar modal de confirmación *"¿Estás seguro de que deseas salir?"*).
  3. Iniciar sesión como vendedor (`vendedor@expressmart.mx`):
     * El botón superior aparece dinámicamente rotulado como **"Panel de Vendedor"**.
     * Permite dar de alta productos en catálogo.
  4. Iniciar sesión como administrador (`admin@expressmart.mx`):
     * El botón se rotula como **"Panel de Administrador"** y además se habilita la pestaña de **"Panel de Auditoría"**.

---

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║ BLOQUE 5: VERIFICACIÓN AUTOMATIZADA ECTA-01 Y CIERRE (3 MINUTOS)              ║
║ Presentador: Diego Alarcón De Jesús                                          ║
║ Auditor Evaluador: Sebastian Muñoz Gonzales (Auditor Líder)                   ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 5.1. Ejecución del Verificador de Auditoría Automatizado
* **Acción en pantalla:** Ejecutar en Terminal 2:
  ```bash
  npm run audit:verify
  ```
* **Puntos a señalar:**
  1. **Resultado Global:** **43 de 43 puntos cumplidos (100% de cumplimiento)**.
  2. **Matrices Auxiliares:**
     * Auxiliar 01 (Normativas): 10/10 Cumple.
     * Auxiliar 02 (Entregables de Desarrollo): 12/12 Cumple.
     * Auxiliar 03 (Seguridad y Riesgos): 18/18 Cumple.
  3. Cero puntos en proceso, cero puntos no conformes.

### 5.2. Discurso de Cierre
> *"Con esto demostramos que la plataforma ExpressMart México no solo resuelve de forma integral y definitiva los hallazgos H-01 a H-06, sino que entrega un Marketplace moderno, seguro, auditable y con monitoreo en tiempo real conforme a los estándares de calidad más exigentes. Quedamos a su disposición para resolver cualquier duda o realizar pruebas adicionales."*

---

## 5. Preguntas Frecuentes de los Auditores y Respuestas Modelo

### Pregunta 1 (Auditor Líder Sebastian Muñoz):
> *"¿Cómo garantizan que un vendedor no pueda ver ni modificar los pedidos de otros usuarios o acceder a la auditoría técnica?"*
* **Respuesta modelo:**
  > *"Mediante control de acceso RBAC estricto en el middleware `authenticateRequest` y `requireRoles` en `src/middleware/security.js`. En la API de pedidos `GET /api/orders`, el servidor filtra obligatoriamente `WHERE p.usuario_id = req.user.id`, de modo que ni vendedores ni clientes pueden consultar compras ajenas. Los endpoints de auditoría (`/api/audit-logs`) requieren explícitamente el rol `auditor` o `administrador`, y cualquier intento no autorizado es bloqueado y registrado en la bitácora D8 como `ACCESO_DENEGADO_RBAC`."*

### Pregunta 2 (Auditora Selene Nicole Vázquez):
> *"¿Cómo previene el sistema ataques de inyección de código SQL y Cross-Site Scripting (XSS) en las entradas de usuario?"*
* **Respuesta modelo:**
  > *"Implementamos una estrategia de defensa en profundidad: primero, el middleware `inputFirewallMiddleware` intercepta todas las URLs, parámetros de consulta y cuerpos JSON; si detecta patrones peligrosos de XSS o SQLi mediante `containsMaliciousPayload`, bloquea la solicitud de inmediato con HTTP 400, registra el incidente con IP y firma en la bitácora inmutable D8 y lo reporta en nuestro panel de seguridad. Segundo, todas las consultas a base de datos utilizan sentencias preparadas parametrizadas en SQLite (`db.prepare('... WHERE x = ?')`), neutralizando cualquier posibilidad de inyección a nivel de motor."*

### Pregunta 3 (Auditor Uriel Guadarrama):
> *"¿Qué herramientas de monitoreo tiene el equipo de operaciones en caso de un incidente de red o sospecha de ataque?"*
* **Respuesta modelo:**
  > *"Desarrollamos el panel de seguridad en Python ejecutable con `./run_security_panel.sh`. El equipo puede ejecutar `./run_security_panel.sh --watch` para monitoreo continuo en vivo, `--ports` para auditar qué procesos están escuchando en la red y verificar las cabeceras de seguridad HTTP, y `--threats` para auditar intentos de fuerza bruta, bloqueos WAF y violaciones de acceso con cálculo de nivel de amenaza y recomendaciones inmediatas de mitigación."*

### Pregunta 4 (Auditora Selene Nicole Vázquez):
> *"¿Cómo se valida que los registros de auditoría no hayan sido alterados por alguien con acceso al servidor?"*
* **Respuesta modelo:**
  > *"Cada registro en la tabla `bitacora_auditoria` incorpora un hash encadenado SHA-256 (`hash_cadena`) calculado a partir del hash del registro anterior (`prev_hash`) y los datos del evento. Nuestro comando `./run_security_panel.sh --verify` ejecuta una verificación matemática que recalcula toda la cadena desde el bloque génesis. Si un registro fuera modificado, eliminado o insertado fraudulentamente, la cadena se rompe y el panel señala exactamente el ID del bloque corrupto."*

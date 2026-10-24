# Manual de Instalación, Configuración de Base de Datos y Uso de la Aplicación ExpressMart (MC-001)

**Código de Documento:** MAN-INST-MC001  
**Versión:** 1.0  
**Fecha de Emisión:** 24/10/2026  
**Organización:** TiendaExpress Online, S.A. de C.V. (**ExpressMart**)  
**Moneda Oficial del Sistema:** Pesos Mexicanos (`$ MXN` con `16% IVA`)  
**Elaborado por:** Diego Alarcon De Jesus · Carlos Adair Bautista Godinez · Cristopher Erik San Juan Piza  
**Validado por Comité de Auditoría (`ECTA-01`):** Sebastian Muñoz Gonzales · Selene Nicole Vazquez Castrejón · Uriel Guadarrama Estrada  

---

## 1. Propósito del Manual

Este manual describe paso a paso cómo preparar el entorno desde cero, instalar **Node.js v22 LTS**, instalar las **dependencias del proyecto**, inicializar y gestionar la **base de datos relacional SQLite (`D1` a `D8`)**, iniciar el **servidor de la aplicación ExpressMart**, ejecutar las suites de **pruebas, respaldos y auditoría**, y utilizar cada uno de los módulos de la plataforma web con el sistema de diseño **Stitch (`Aura Commerce`)**.

---

## 2. Requisitos del Sistema y Prerrequisitos

| Componente | Requisito Mínimo | Configuración Recomendada (Producción / Auditoría) |
|---|---|---|
| **Sistema Operativo** | Linux (Ubuntu/Debian/Fedora/Arch), macOS o Windows 10/11 (WSL2) | Linux x86_64 (Kernel 6.x) o Contenedor Docker Alpine |
| **Node.js** | **Node.js v22.5.0 o superior** (requerido por el motor nativo `node:sqlite`) | **Node.js v22.14.0 LTS** |
| **Gestor de Paquetes** | `npm` v10.x o superior (incluido con Node.js) | `npm` v10.9+ con `package-lock.json` |
| **Motor de Base de Datos** | SQLite 3 integrado nativamente en Node.js (`node:sqlite`) | Modo `WAL` (`Write-Ahead Logging`) y `PRAGMA foreign_keys = ON` |
| **Memoria RAM y Disco** | 512 MB RAM libres / 250 MB de espacio en disco | 2 GB RAM / 1 GB de espacio en disco para respaldos y logs |
| **Puerto de Red** | Puerto TCP `3000` disponible (configurable mediante `PORT`) | Puerto `3000` (HTTP local) o detrás de proxy inverso TLS 1.3 |

---

## 3. Instalación de Node.js v22 LTS

La aplicación **ExpressMart** utiliza los módulos nativos de alta seguridad de Node.js 22 (`node:sqlite` para persistencia parametrizada y `node:crypto` para cifrado `AES-256-GCM`, `scrypt` y `SHA-256`).

### Opción A: Uso de la instalación local ya incluida en este equipo (Linux)
En este entorno de trabajo, Node.js `v22.14.0` ya se encuentra instalado en `~/.local/node/bin`. Para asegurarse de que la terminal lo reconozca en cualquier sesión, ejecute:

```bash
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"
node -v
npm -v
```
*(Deberá mostrar `v22.14.0` y `10.9.2`).*

### Opción B: Instalación limpia en Linux / macOS mediante NVM o binario oficial
Si desea instalar Node.js v22 en una máquina nueva:

```bash
# Usando NVM (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
```

O bien descargando el binario oficial para Linux x64:

```bash
mkdir -p ~/.local/node
curl -fsSL https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz | tar -xJ -C ~/.local/node --strip-components=1
export PATH="$HOME/.local/node/bin:$PATH"
```

### Opción C: Instalación en Windows
1. Descargue el instalador oficial `.msi` de **Node.js v22 LTS** desde `https://nodejs.org/`.
2. Ejecute el asistente marcando la casilla **"Automatically install the necessary tools"** y agregue Node.js al `PATH`.
3. Verifique en PowerShell o CMD ejecutando `node -v` y `npm -v`.

---

## 4. Instalación de Dependencias del Proyecto (`npm install`)

### 4.1 Estructura de Dependencias (`package.json`)
Siguiendo el principio de minimización de riesgos de terceros (`SEG-16` del Plan de Auditoría `ECTA-01`), ExpressMart emplea únicamente paquetes auditados y sin vulnerabilidades abiertas:

| Paquete | Tipo | Versión | Propósito en ExpressMart |
|---|---|---|---|
| `express` | Producción (`dependencies`) | `^4.21.2` | Servidor HTTP, enrutamiento API REST, cabeceras de seguridad y archivos estáticos. |
| `jest` | Desarrollo (`devDependencies`) | `^29.7.0` | Ejecución de pruebas unitarias, de integración y de seguridad con reporte de cobertura (`>= 80%`). |
| `supertest` | Desarrollo (`devDependencies`) | `^7.0.0` | Pruebas automatizadas de endpoints HTTP sin necesidad de exponer puertos externos. |

### 4.2 Comando de Instalación
Ubíquese en la carpeta raíz del proyecto (`/home/diego/Documentos/pauditoria`) y ejecute:

```bash
cd /home/diego/Documentos/pauditoria
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"
npm install
```

Para una instalación determinista en entornos de integración continua o auditoría (`CI/CD`), utilice:

```bash
npm ci
```

---

## 5. Configuración de Variables de Entorno (`.env`)

El sistema cuenta con configuraciones seguras por defecto en [`src/config/env.js`](../src/config/env.js), pero permite personalizar parámetros mediante variables de entorno basadas en la plantilla [`.env.example`](../.env.example):

```bash
cp .env.example .env
```

| Variable de Entorno | Valor por Defecto | Descripción |
|---|---|---|
| `NODE_ENV` | `development` | Ambiente de ejecución (`development`, `test`, `staging`, `production`). |
| `PORT` | `3000` | Puerto TCP donde escucha el servidor web y la API REST. |
| `DB_PATH` | `./data/expressmart.sqlite` | Ruta del archivo de base de datos relacional SQLite (`:memory:` en pruebas). |
| `ENCRYPTION_KEY` | *(Llave derivada SHA-256)* | Llave maestra para el cifrado en reposo **AES-256-GCM** (`RNF-03`, `LFPDPPP`). |
| `SESSION_SECRET` | *(Secreto HMAC-SHA256)* | Llave de firma para tokens de sesión (`SEG-03`). |
| `SESSION_TTL_MINUTES` | `30` | Tiempo de expiración de sesiones activas en minutos. |
| `PAYMENT_TIMEOUT_MS` | `30000` | Timeout máximo de conexión con pasarela de pagos (`30s` conforme a `RFC-0001`). |
| `PAYMENT_MAX_RETRIES` | `3` | Número máximo de reintentos ante fallos transitorios de red (`RFC-0001`). |

---

## 6. Instalación, Inicialización y Gestión de la Base de Datos

### 6.1 ¿Cómo se instala e inicializa la Base de Datos?
**No se requiere instalar un servidor de base de datos externo** (como MySQL o PostgreSQL por separado), ya que ExpressMart utiliza el motor relacional transaccional **`node:sqlite`** integrado en Node.js v22.

Al iniciar el servidor por primera vez (o al ejecutar el comando de inicialización), el módulo [`src/db/database.js`](../src/db/database.js) realiza automáticamente las siguientes acciones:
1. Crea el directorio `./data/` si no existe.
2. Crea el archivo de base de datos `./data/expressmart.sqlite` y activa:
   * `PRAGMA foreign_keys = ON;` (Integridad referencial estricta).
   * `PRAGMA journal_mode = WAL;` (Escritura concurrente de alto rendimiento).
3. Crea las **12 tablas relacionales** que conforman los **8 Almacenes del DFD Nivel 1 (`D1` a `D8`)**:
   * **D1 Usuarios:** `usuarios`, `sesiones`, `derechos_arco`.
   * **D2 Catálogo:** `catalogo` (con precios en `$ MXN` e imágenes de alta resolución de Stitch).
   * **D3 Inventario:** `inventario` (`CEDIS-CDMX-NORTE`).
   * **D4 Pedidos:** `pedidos`, `pedido_items`, `carrito_items`, `cupones`.
   * **D5 Transacciones:** `transacciones` (pagos tokenizados `PCI DSS`).
   * **D6 Envíos:** `envios`, `notificaciones`.
   * **D7 Reseñas:** `resenas`.
   * **D8 Bitácora de Auditoría:** `bitacora_auditoria` (encadenada con `SHA-256`).
4. Inserta automáticamente los **datos semilla (Seed)** si la base está vacía:
   * Los **5 usuarios oficiales** (`administrador`, `vendedor`, `cliente`, `soporte`, `auditor`) con direcciones y teléfonos cifrados con `AES-256-GCM`.
   * Los **8 productos iniciales del catálogo en MXN** con completitud `ISO/IEC 25012` al 100%.
   * Los **4 cupones promocionales** (`BIENVENIDA10`, `BUENFIN20`, `AHORRA250`, `ENVIOGRATIS`).
   * Reseñas verificadas iniciales y el bloque génesis de auditoría (`GENESIS_EXPRESSMART_MC001`).

### 6.2 Comando para Inicializar o Reiniciar la Base de Datos Manualmente
Si desea crear o reiniciar la base de datos desde cero en cualquier momento antes de arrancar el servidor, ejecute:

```bash
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"
rm -f data/expressmart.sqlite*
node -e "require('./src/db/database').initDatabase(); console.log('Base de datos inicializada correctamente en ./data/expressmart.sqlite');"
```

### 6.3 Comandos de Respaldo Cifrado y Restauración (`ISO 22301`)
Para generar un respaldo cifrado en reposo (`AES-256-GCM`) en `./backups/expressmart-backup-latest.enc` y ejecutar la prueba de restauración con verificación de checksum `SHA-256`:

```bash
# Generar respaldo cifrado y verificar restauración (EV-34)
npm run backup

# Ejecutar únicamente el simulacro de restauración
npm run backup:restore-test
```

---

## 7. Cómo Iniciar el Servidor de ExpressMart

### 7.1 Inicio Directo con Node.js (Modo Local / Desarrollo / Auditoría)
Desde la carpeta raíz `/home/diego/Documentos/pauditoria`, ejecute:

```bash
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"
npm start
```

Al iniciar, verá en la consola un mensaje como el siguiente:

```text
[ExpressMart] Servidor activo en http://localhost:3000 (Ambiente: development, Versión: 1.0.0)
```

Abra su navegador web e ingrese a:
* **Aplicación Web Principal (Diseño Stitch Aura Commerce en MXN):** `http://localhost:3000`
* **Estado de Salud (Healthcheck):** `http://localhost:3000/api/health`
* **Métricas y KPIs en Vivo:** `http://localhost:3000/api/metrics`
* **Política de Base de Datos en Vivo (`POL-BD-MC001`):** `http://localhost:3000/api/quality/database-policy`

### 7.2 Inicio mediante Contenedores Docker (`Dockerfile` y `docker-compose.yml`)
Si desea levantar la plataforma en contenedores aislados conforme al Apartado 30 del Manual de Calidad:

```bash
docker compose up --build -d
```

---

## 8. Comandos de Verificación de Calidad, Pruebas y Auditoría

Antes o después de usar la aplicación, puede ejecutar cualquiera de los siguientes scripts automatizados definidos en `package.json`:

| Comando | Descripción | Estándar / Evidencia |
|---|---|---|
| `npm run lint` | Ejecuta el analizador estático de código y seguridad SAST (`0` hallazgos). | Apartados 14, 18.3, 29, `SEG-18` |
| `npm test` | Ejecuta las 26 pruebas unitarias, de integración y de seguridad con reporte de cobertura (`91.54%`). | Apartados 21 a 25, `RNF-04` |
| `npm run test:performance` | Ejecuta la prueba de estrés de 100 checkouts concurrentes y bloqueo de sobreventa de último artículo. | Apartado 24, `EV-24` |
| `npm run backup` | Genera respaldo cifrado `AES-256-GCM` y ejecuta simulacro de recuperación (`RTO < 1s`). | Apartado 34, `EV-34`, `ISO 22301` |
| `npm run audit:verify` | Verifica la presencia e integridad de todos los artefactos y emite el informe `EV-39` al 100%. | Plan de Auditoría `ECTA-01` |

---

## 9. Guía de Uso de la Aplicación Web ExpressMart

### 9.1 Credenciales de Prueba y Cambio Rápido de Rol (`RBAC + MFA`)
Al pulsar el botón **"Cuenta y Seguridad"** en la esquina superior derecha de la barra de navegación, se abre el **Portal de Acceso y Registro Seguro**. Incluye **4 botones de acceso rápido** que completan automáticamente las credenciales (y el código TOTP de 6 dígitos cuando aplica MFA):

| Rol en el Sistema | Correo Electrónico | Contraseña | Segundo Factor (MFA / TOTP) | Permisos Principales |
|---|---|---|---|---|
| **Cliente Verificado** | `cliente@expressmart.mx` | `ClientePassword123!` | Opcional (configurable en perfil) | Comprar en 3 pasos, aplicar cupones, ver pedidos, solicitar devoluciones LFPC, publicar reseñas y ejercer derechos ARCO. |
| **Vendedor Oficial** | `vendedor@expressmart.mx` | `VendedorPassword123!` | **Obligatorio** (Automático en botón Demo) | Dar de alta y actualizar productos e inventario en `$ MXN` (`RF-06`) y consultar reportes de ventas (`RF-10`). |
| **Administrador** | `admin@expressmart.mx` | `AdminPassword123!` | **Obligatorio** (Automático en botón Demo) | Control total de catálogo, inventario, estados logísticos, simulacro de contingencia, auditoría `ISO 25012` y bitácora `D8`. |
| **Auditor Líder (`ECTA-01`)** | `auditor@expressmart.mx` | `AuditorPassword123!` | No requerido | Inspección de KPIs, reportes ejecutivos, auditoría de calidad de datos `ISO/IEC 25012`, política de BD y verificación de cadena `SHA-256`. |
| **Soporte Operativo** | `soporte@expressmart.mx` | `SoportePassword123!` | No requerido | Seguimiento de pedidos, guías de envío y atención a devoluciones. |

### 9.2 Recorrido por las 5 Vistas Principales (Diseño Stitch `Aura Commerce`)

1. **Vista 1 — Inicio y Catálogo (`MXN`):**
   * **Hero Banner y Tarjetas Bento:** Permite activar con un clic los cupones `BIENVENIDA10` (`-10%`) o `ENVIOGRATIS` y filtrar directamente por categorías (`Cómputo`, `Audio`, `Telefonía`, `Accesorios`, `Hogar`).
   * **Buscador y Filtros (`RF-03`):** Búsqueda por palabra clave, departamento, marca, precio máximo en `$ MXN` y ordenamiento, mostrando en vivo la píldora de latencia (`< 2000 ms`).
   * **Ficha Técnica y Reseñas (`RF-08`):** Al pulsar **"Ficha / Reseñas"** sobre cualquier producto se abre el modal con especificaciones completas `ISO/IEC 25012` y el formulario para publicar reseñas verificadas.

2. **Modal de Cesta y Checkout Seguro en 3 Pasos (`RF-04`, `RF-05`, `RNF-11`):**
   * Al pulsar **"Cesta MXN"** en el encabezado se abre el flujo de compra estructurado en exactamente **3 pasos**:
     * **Paso 1 (Cesta, Cupón y Dirección CDMX):** Muestra las partidas en `$ MXN`, barra de envío gratis ExpressPrime (compras desde `$999.00 MXN`), campo de cupón (`BIENVENIDA10`, `BUENFIN20`, `AHORRA250`, `ENVIOGRATIS`), desglose de **IVA (16%)** y dirección de entrega cifrada.
     * **Paso 2 (Pago Seguro Tokenizado PCI DSS):** Selección de método de pago (`Tarjeta Visa/Mastercard/Amex`, `3, 6 o 12 Meses Sin Intereses` o `Billetera ExpressPay`). Incluye tarjeta de prueba autorizada (`4111111111114242`).
     * **Paso 3 (Confirmación e Integridad SHA-256):** Muestra el resumen final transparente (`LFPC`) y, al confirmar, genera el folio `EM-ORD-*`, la guía `EM-GUIA-*`, el token `tok_pci_*` y la firma de integridad `SHA-256`.

3. **Vista 2 — Mis Pedidos y Devoluciones (`RF-07`):**
   * Muestra todos los pedidos realizados con su estado actual, guía de paquetería DHL/FedEx, hash de integridad `SHA-256` y el botón **"Solicitar Devolución y Reembolso en MXN (LFPC)"**, el cual reintegra automáticamente el stock al almacén `D3` y cambia el estado de la transacción a `reembolsado`.

4. **Vista 3 — Mi Cuenta, Wishlists y Derechos ARCO (`RF-01`, `RF-09`, `NOR-08`):**
   * Permite actualizar nombre, dirección y teléfono (que se guardan cifrados con `AES-256-GCM` en `D1`), activar/desactivar `MFA`, consultar listas de deseos en `MXN`, revisar el **Buzón de Notificaciones y Acuses SMTP (`ACK-SMTP-*`)** y enviar solicitudes de **Derechos ARCO (`LFPDPPP`)** con emisión inmediata de folio `ARCO-*`.

5. **Vista 4 — Panel Vendedor / Admin (`RF-06`, `RF-10`) y Vista 5 — Auditoría SGC (`ECTA-01`):**
   * **Panel Vendedor / Admin:** Formulario para publicar nuevos productos en `$ MXN` validando completitud `ISO/IEC 25012` y generador de **Reporte Ejecutivo de Ventas e Inventario** en tiempo real.
   * **Auditoría SGC (`ECTA-01`):** Muestra los **5 KPIs del Apartado 7**, el botón para simular la caída del servicio de recomendaciones (`Circuit Breaker RNF-05`), la **Auditoría de Calidad de Datos `ISO/IEC 25012`**, el verificador de la **Bitácora Encadenada `SHA-256` (`D8`)** y la **Política Integral de Base de Datos (`POL-BD-MC001`)**.

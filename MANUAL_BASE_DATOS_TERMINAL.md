# Manual Operativo: Cómo Abrir la Base de Datos en Terminal y Consultas Útiles
**Sistema:** ExpressMart Marketplace México  
**Motor de Base de Datos:** SQLite v3 nativo (`node:sqlite`)  
**Archivo de Base de Datos:** `./data/expressmart.sqlite`  
**Moneda Oficial:** Pesos Mexicanos (`$ MXN`)  
**Fecha de Publicación:** Octubre 2026  

---

## 1. Introducción y Arquitectura de la Base de Datos

ExpressMart utiliza un motor de base de datos relacional transaccional embebido basado en **SQLite 3**, gestionado nativamente por Node.js sin controladores binarios externos obsoletos.

### Características técnicas del motor:
* **Archivo único y portable:** `./data/expressmart.sqlite` (acompañado de los archivos temporales `-wal` y `-shm` durante la ejecución).
* **Modo WAL (Write-Ahead Logging):** Permite lecturas y escrituras simultáneas de alta concurrencia sin bloquear las consultas de los compradores.
* **Integridad Referencial Estricta:** Llaves foráneas forzadas en cada conexión (`PRAGMA foreign_keys = ON;`).
* **Seguridad y Cifrado:**
  * Datos confidenciales de clientes (dirección y teléfono) resguardados con cifrado simétrico **AES-256-GCM**.
  * Contraseñas con función de derivación criptográfica **scrypt** y sal aleatoria única.
  * Trazabilidad inmutable mediante bitácora con encadenamiento criptográfico **SHA-256**.

---

## 2. Formas de Abrir la Base de Datos en la Terminal

Dispones de **3 métodos principales** para acceder e interactuar con la base de datos desde la línea de comandos en Linux:

### Método 1: Consola Interactiva ExpressMart CLI (Recomendado - Listo para usar)
No requiere instalar ningún paquete adicional con `sudo`; utiliza el motor integrado del proyecto.

#### Iniciar la consola interactiva:
```bash
npm run db:console
```
o directamente con Node.js:
```bash
node scripts/db-console.js
```

Al iniciar, verás el prompt interactivo `ExpressMart-SQL>`:
```text
================================================================================
          CONSOLA INTERACTIVA SQL - EXPRESSMART MARKETPLACE MÉXICO
================================================================================
Comandos especiales disponibles:
  .tablas               Lista todas las tablas creadas y su número de filas
  .schema [tabla]       Muestra la estructura DDL de una tabla o de todas
  .kpis                 Resumen ejecutivo de ventas, catálogo y usuarios en MXN
  .ejemplos             Muestra una lista de consultas SQL útiles listas para usar
  .ayuda                Muestra esta ayuda
  .salir / .exit        Cierra la consola de base de datos
================================================================================
```

#### Ejecución de consultas directas en una sola línea:
Puedes pasar cualquier sentencia SQL entre comillas directamente como argumento:
```bash
npm run db:query "SELECT id, email, rol, nombre FROM usuarios;"
```
o:
```bash
node scripts/db-console.js "SELECT sku, nombre, precio FROM catalogo LIMIT 5;"
```

---

### Método 2: Utilidad del Sistema Operativo `sqlite3` (CLI Oficial)
Si dispones de privilegios de superusuario (`sudo`) y prefieres la herramienta estándar de SQLite:

#### 1. Instalación en Linux (Ubuntu / Debian):
```bash
sudo apt update
sudo apt install -y sqlite3
```

#### 2. Abrir el archivo de la base de datos:
Desde la carpeta raíz del proyecto (`pauditoria`):
```bash
sqlite3 data/expressmart.sqlite
```

#### 3. Configurar formato visual amigable:
Una vez dentro del prompt `sqlite>`, escribe estas directivas para formatear las salidas en tablas con encabezados:
```sql
.mode table
.headers on
```

#### 4. Comandos útiles propios de `sqlite3`:
* `.tables` : Muestra todas las tablas existentes.
* `.schema catalogo` : Muestra el `CREATE TABLE` de la tabla `catalogo`.
* `.indices` : Muestra los índices creados para acelerar búsquedas.
* `.quit` o `.exit` : Sale de la consola SQLite.

---

### Método 3: Ejecución Rápida vía Node.js One-Liner
Si solo requieres inspeccionar un dato puntual sin abrir una sesión interactiva:
```bash
node -e 'const { getDb } = require("./src/db/database"); console.table(getDb().prepare("SELECT sku, nombre, precio FROM catalogo LIMIT 5").all());'
```

---

## 3. Estructura y Esquema de las Tablas del Sistema

La base de datos cuenta con **12 tablas relacionales normalizadas**:

| Tabla | Propósito de Negocio |
| :--- | :--- |
| `usuarios` | Cuentas de clientes, vendedores, administradores y auditores con roles y MFA. |
| `sesiones` | Tokens JWT y sesiones activas con control de expiración. |
| `catalogo` | Catálogo maestro de 20 productos oficiales con especificaciones ISO 25012 y precios en MXN. |
| `inventario` | Existencias físicas, stock disponible y reservado en almacén CEDIS CDMX Norte. |
| `carrito_items` | Artículos pendientes por comprar vinculados a la sesión del usuario. |
| `cupones` | Códigos promocionales (`BIENVENIDA10`, `ENVIOGRATIS`, etc.) con reglas de compra mínima. |
| `pedidos` | Órdenes confirmadas con folio oficial, cálculo de IVA 16%, subtotal y total en MXN. |
| `pedido_items` | Desglose línea por línea de productos comprados, cantidades y precios unitarios. |
| `transacciones` | Registro de cobros seguros con tokenización PCI DSS (sin almacenar CVV ni PAN en texto plano). |
| `envios` | Guías de paquetería (DHL / FedEx) vinculadas al pedido con estatus de entrega. |
| `resenas` | Calificaciones (1 a 5 estrellas) y opiniones auditadas de compradores verificados. |
| `bitacora_auditoria` | Registro de eventos inmutables encadenados con hashes SHA-256. |

---

## 4. Catálogo de Consultas SQL Útiles

Copia y pega cualquiera de estas consultas en la consola `ExpressMart-SQL>` o en `sqlite3`:

### 4.1. Usuarios, Roles y Seguridad (RBAC)

#### A. Ver todos los usuarios registrados y sus roles:
```sql
SELECT id, email, rol, nombre, mfa_enabled, activo, created_at 
FROM usuarios 
ORDER BY id ASC;
```

#### B. Identificar usuarios con permisos administrativos o de auditoría:
```sql
SELECT id, email, rol, nombre 
FROM usuarios 
WHERE rol IN ('administrador', 'auditor');
```

#### C. Verificar usuarios con Autenticación en Dos Pasos (MFA / TOTP) activa:
```sql
SELECT id, email, rol, mfa_enabled 
FROM usuarios 
WHERE mfa_enabled = 1;
```

---

### 4.2. Catálogo de Productos y Precios en Pesos Mexicanos ($ MXN)

#### A. Listar los 20 productos oficiales con precio en MXN y categoría:
```sql
SELECT sku, nombre, categoria, marca, '$' || printf('%,d', precio) || ' MXN' AS precio_mxn 
FROM catalogo 
ORDER BY precio DESC;
```

#### B. Filtrar productos por departamento específico (Ej. Cómputo):
```sql
SELECT sku, nombre, marca, precio 
FROM catalogo 
WHERE categoria = 'Computo' 
ORDER BY precio ASC;
```

#### C. Simular búsqueda por palabra clave (Buscador del cliente):
```sql
SELECT sku, nombre, precio, marca 
FROM catalogo 
WHERE nombre LIKE '%Laptop%' OR descripcion LIKE '%Laptop%';
```

---

### 4.3. Inventario y Control de Stock en CEDIS CDMX

#### A. Existencias disponibles cruzadas con catálogo:
```sql
SELECT c.sku, c.nombre, c.categoria, i.stock_disponible, i.ubicacion_almacen, i.ultima_conciliacion 
FROM catalogo c 
JOIN inventario i ON c.id = i.producto_id 
ORDER BY i.stock_disponible ASC;
```

#### B. Productos con menor disponibilidad en almacén:
```sql
SELECT c.sku, c.nombre, i.stock_disponible 
FROM catalogo c 
JOIN inventario i ON c.id = i.producto_id 
WHERE i.stock_disponible < 25;
```

---

### 4.4. Transacciones, Pedidos y Envíos

#### A. Resumen general de compras confirmadas con cliente y folio:
```sql
SELECT p.folio, u.nombre AS cliente, '$' || printf('%,d', p.total) || ' MXN' AS total_mxn, 
       p.metodo_pago, p.estado, e.proveedor_paqueteria, e.numero_guia 
FROM pedidos p 
JOIN usuarios u ON p.usuario_id = u.id 
LEFT JOIN envios e ON p.id = e.pedido_id 
ORDER BY p.id DESC;
```

#### B. Desglose detallado de artículos dentro de un pedido:
```sql
SELECT p.folio, c.nombre AS producto, pi.cantidad, 
       '$' || printf('%,d', pi.precio_unitario) AS precio_unitario, 
       '$' || printf('%,d', pi.subtotal) AS subtotal 
FROM pedido_items pi 
JOIN pedidos p ON pi.pedido_id = p.id 
JOIN catalogo c ON pi.producto_id = c.id;
```

#### C. Verificación de transacciones financieras protegidas con token PCI DSS:
```sql
SELECT t.id, t.referencia_pasarela, t.tarjeta_enmascarada, t.monto, t.estado, t.created_at 
FROM transacciones t;
```

---

### 4.5. Cupones Promocionales y Descuentos en MXN

#### A. Consultar todos los cupones activos y condiciones de compra mínima:
```sql
SELECT codigo, tipo, valor, 
       '$' || printf('%,d', compra_minima) || ' MXN' AS compra_minima, 
       limite_usos, usos_actuales, activo 
FROM cupones;
```

---

### 4.6. Opiniones y Reseñas Verificadas de Clientes

#### A. Calificaciones promedio y número total de opiniones por artículo:
```sql
SELECT c.nombre AS producto, 
       round(avg(r.calificacion), 2) AS calificacion_promedio, 
       count(r.id) AS total_resenas 
FROM catalogo c 
LEFT JOIN resenas r ON c.id = r.producto_id 
GROUP BY c.id 
ORDER BY calificacion_promedio DESC;
```

#### B. Ver los comentarios más recientes emitidos por compradores:
```sql
SELECT c.nombre AS producto, r.calificacion || '/5' AS estrellas, r.comentario, r.created_at 
FROM resenas r 
JOIN catalogo c ON r.producto_id = c.id 
ORDER BY r.created_at DESC 
LIMIT 5;
```

---

### 4.7. Auditoría de Seguridad, Calidad e Integridad de Datos

#### A. Revisión de los últimos eventos en la Bitácora de Auditoría SHA-256:
```sql
SELECT id, evento, usuario_email, rol, 
       substr(hash_cadena, 1, 16) || '...' AS hash_sha256, timestamp 
FROM bitacora_auditoria 
ORDER BY id DESC 
LIMIT 10;
```

#### B. Comprobar la integridad física del archivo de base de datos:
```sql
PRAGMA integrity_check;
```
*(Debe retornar `ok`, lo que garantiza que no existen sectores corruptos en el archivo).*

#### C. Comprobar que no existen violaciones de llaves foráneas:
```sql
PRAGMA foreign_key_check;
```
*(Debe retornar 0 filas, lo que certifica la consistencia referencial absoluta).*

---

## 5. Resumen de Comandos Rápidos

| Acción | Comando de Terminal |
| :--- | :--- |
| **Abrir consola interactiva** | `npm run db:console` |
| **Ver resumen de KPIs en MXN** | `npm run db:query .kpis` |
| **Ver todas las tablas y conteo** | `npm run db:query .tablas` |
| **Ver estructura de tabla** | `npm run db:query ".schema catalogo"` |
| **Consultar usuarios** | `npm run db:query "SELECT id, email, rol FROM usuarios;"` |
| **Consultar catálogo** | `npm run db:query "SELECT sku, nombre, precio FROM catalogo LIMIT 10;"` |
| **Verificar integridad SQLite** | `npm run db:query "PRAGMA integrity_check;"` |

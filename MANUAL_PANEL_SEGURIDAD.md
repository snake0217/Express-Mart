# Manual de Operación: Panel de Seguridad y Monitoreo ExpressMart

Este documento detalla el funcionamiento, comandos de ejecución y capacidades técnicas del **Panel de Seguridad y Auditoría** de ExpressMart México, desarrollado en Python y automatizado mediante Bash conforme al Manual de Calidad **MC-001 v1.0**, las normas **ISO/IEC 27001**, **OWASP ASVS** y la **LFPC**.

---

## 1. Ejecución Rápida

El panel cuenta con un script de Bash ejecutable para inicio inmediato desde la terminal:

```bash
# Opción 1: Ejecutar vía script Bash directo
./run_security_panel.sh

# Opción 2: Ejecutar mediante npm
npm run security:panel

# Opción 3: Ejecución directa en Python 3
python3 scripts/security_panel.py
```

---

## 2. Modos de Ejecución y Argumentos CLI

El panel puede utilizarse de forma **interactiva** (menú con opciones numeradas) o en modo **línea de comandos (CLI)** para auditorías automáticas y scripts de CI/CD:

| Comando | Descripción |
|---|---|
| `./run_security_panel.sh` | Abre el **Menú Interactivo** con interfaz de consola a color. |
| `./run_security_panel.sh --overview` | Muestra el **Resumen Ejecutivo** (estado web, nivel de amenaza, indicadores). |
| `./run_security_panel.sh --ports` | Ejecuta el **Escaneo de Puertos** y sockets en escucha + sondeo HTTP. |
| `./run_security_panel.sh --logs` | Muestra los registros recientes de la **Bitácora de Auditoría D8**. |
| `./run_security_panel.sh --logs --limit 50` | Lista los últimos 50 registros de auditoría con detalles y hashes. |
| `./run_security_panel.sh --threats` | Muestra el reporte de **Actividades Sospechosas y Amenazas**. |
| `./run_security_panel.sh --verify` | Comprueba la **Integridad Criptográfica SHA-256** de la bitácora. |
| `./run_security_panel.sh --watch` | Activa el **Modo Monitor en Vivo** con auto-refresco cada 3 segundos. |
| `./run_security_panel.sh --json` | Emite la telemetría y estado de seguridad en formato **JSON** estructurado. |

---

## 3. Módulos y Capacidades del Panel

### A. Inspección de Puertos y Servicios de Red (Network Ports)
* **Detección de sockets:** Analiza sockets locales en estado `LISTEN` (`ss`, `/proc/net/tcp` y sockets TCP).
* **Servicio ExpressMart:** Monitorea el puerto **3000** (`Node.js ExpressMart API`).
* **Sondeo activo HTTP:** Realiza peticiones de diagnóstico a `/api/health`, midiendo:
  * Latencia de respuesta en milisegundos.
  * Código de estado HTTP.
  * Presencia y configuración de cabeceras de seguridad requeridas por OWASP:
    * `X-Content-Type-Options: nosniff`
    * `X-Frame-Options: DENY`
    * `Strict-Transport-Security: max-age=31536000`
    * `Content-Security-Policy (CSP)`
    * `X-XSS-Protection: 0`

### B. Bitácora de Auditoría y Logs de Seguridad (D8)
* Conexión a la base de datos transaccional SQLite (`data/expressmart.sqlite`).
* Consulta la tabla inmutable `bitacora_auditoria` (SEG-15).
* Presenta por cada registro:
  * **ID** y **Fecha/Hora** formateada.
  * **Rol del ejecutor** (`administrador`, `vendedor`, `cliente`, `waf`, `sistema`).
  * **Acción auditada** (`LOGIN_EXITOSO`, `ATAQUE_BLOQUEADO_WAF`, `ACCESO_DENEGADO_RBAC`, etc.).
  * **IP de origen** y entidad afectada.
  * **Detalles específicos** en formato JSON legible.
  * **Firma criptográfica SHA-256** del bloque.

### C. Detección Heurística de Actividades Sospechosas
El motor de detección clasifica automáticamente las anomalías detectadas en 4 niveles de severidad:
1. **Ataques Web / Inyecciones (WAF):** Detecta eventos `ATAQUE_BLOQUEADO_WAF` generados al intentar inyectar código malicioso XSS (`<script>`, `onerror=`) o SQLi (`' OR 1=1`, `UNION SELECT`) bloqueados por el filtro `SEG-11`.
2. **Intentos de Fuerza Bruta:** Detecta intentos reiterados de contraseña incorrecta y bloqueos preventivos de cuentas (`BLOQUEO_CUENTA_FUERZA_BRUTA` conforme a `SEG-01`).
3. **Violaciones de Autorización (RBAC):** Identifica intentos de usuarios clientes o externos queriendo consumir rutas administrativas, de reportes o auditoría sin credenciales suficientes (`ACCESO_DENEGADO_RBAC`).
4. **Alteración de Integridad:** Detecta si algún registro de la bitácora fue modificado, insertado o eliminado arbitrariamente.
5. **Cálculo de Threat Score:** Proporciona un semáforo visual:
   * 🟢 **BAJO (0 - 15 pts):** Operación normal.
   * 🟡 **MEDIO (16 - 25 pts):** Advertencias normales bajo observación.
   * 🟠 **ELEVADO (26 - 60 pts):** Actividades sospechosas recurrentes.
   * 🔴 **CRÍTICO (> 60 pts):** Incidente de seguridad activo o falla de integridad.

### D. Verificación Criptográfica de la Cadena D8 (Blockchain Local)
Calcula matemáticamente el encadenamiento de cada bloque mediante la función:
$$\text{hash\_cadena} = \text{SHA-256}(\text{prev\_hash} \parallel \text{timestamp} \parallel \text{usuario\_id} \parallel \text{rol} \parallel \text{accion} \parallel \text{modulo} \parallel \text{detalles\_json})$$
Verificando que ningún bloque haya sido alterado o eliminado sin que la cadena se rompa.

### E. Simulador de Pruebas de Seguridad
Permite realizar simulaciones controladas directamente desde el menú para corroborar que los mecanismos de defensa (WAF, RBAC, Rate-Limit y registro en bitácora) respondan adecuadamente en tiempo real.

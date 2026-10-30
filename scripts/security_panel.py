#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
Panel de Seguridad y Monitoreo ExpressMart (SGC MC-001 v1.0)
Conforme a ISO/IEC 27001, OWASP ASVS, ISO/IEC 25010 y LFPDPPP / LFPC
==============================================================================
Funcionalidades:
1. Inspección de Puertos y Servicios de Red (Port scanning y sockets activos).
2. Bitácora de Auditoría D8 (Logs de seguridad inmutables con hashes SHA-256).
3. Motor Heurístico de Detección de Actividades Sospechosas (WAF, RBAC, Fuerza Bruta).
4. Verificación Criptográfica de Integridad de Datos (Cadena de bloques local D8).
5. Monitoreo en Tiempo Real (Live Watch Mode) y Reportes en Consola/JSON.
"""

import os
import sys
import time
import json
import socket
import sqlite3
import hashlib
import argparse
import subprocess
import urllib.request
import urllib.error
from datetime import datetime

# ==============================================================================
# CONFIGURACIÓN Y RUTAS DEL PROYECTO
# ==============================================================================
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB_CANDIDATES = [
    os.path.join(BASE_DIR, "data", "expressmart.sqlite"),
    os.path.join(BASE_DIR, "expressmart.db"),
    os.environ.get("DB_PATH", "")
]

DEFAULT_SERVER_URL = os.environ.get("EXPRESSMART_URL", "http://127.0.0.1:3000")
SERVER_PORT = int(os.environ.get("PORT", "3000"))

# Colores ANSI para terminal
class Color:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    UNDERLINE = "\033[4m"
    
    # Texto
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"
    
    # Fondos
    BG_BLUE = "\033[44m"
    BG_DARK = "\033[40m"
    BG_RED = "\033[41m"
    BG_GREEN = "\033[42m"
    BG_YELLOW = "\033[43m"


def find_database_path():
    for p in DB_CANDIDATES:
        if p and os.path.exists(p) and os.path.isfile(p):
            return p
    return os.path.join(BASE_DIR, "data", "expressmart.sqlite")


def get_db_connection():
    db_path = find_database_path()
    if not os.path.exists(db_path):
        return None, db_path
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    return con, db_path


# ==============================================================================
# MÓDULO 1: INSPECCIÓN DE PUERTOS Y SERVICIOS DE RED
# ==============================================================================
COMMON_PORTS = [
    (21, "FTP", "Transferencia de archivos sin cifrar", "PELIGRO si expuesto a internet"),
    (22, "SSH", "Acceso remoto seguro", "NORMAL / Gestión administrativa"),
    (23, "Telnet", "Acceso remoto sin cifrar", "CRÍTICO - No debe utilizarse"),
    (53, "DNS", "Resolución de nombres local", "INFORMATIVO"),
    (80, "HTTP", "Servicio Web Estándar", "NORMAL si redirige a HTTPS"),
    (443, "HTTPS", "Servicio Web Seguro TLS", "RECOMENDADO / Producción"),
    (SERVER_PORT, "ExpressMart Web/API", f"Plataforma Node.js ExpressMart en MXN", "SERVICIO PRINCIPAL"),
    (3306, "MySQL", "Base de datos relacional", "ALERTA si expuesto en 0.0.0.0"),
    (5432, "PostgreSQL", "Base de datos relacional", "ALERTA si expuesto en 0.0.0.0"),
    (6379, "Redis", "Caché en memoria", "ALERTA si no tiene contraseña"),
    (8080, "HTTP-Alt", "Puerto de desarrollo alterno", "INFORMATIVO"),
    (8443, "HTTPS-Alt", "Puerto seguro alterno", "INFORMATIVO"),
    (27017, "MongoDB", "Base de datos NoSQL", "ALERTA si expuesto"),
]


def check_port_open(host, port, timeout=0.3):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        res = s.connect_ex((host, port))
        s.close()
        return res == 0
    except Exception:
        return False


def get_system_listening_ports():
    """
    Obtiene los puertos en estado LISTEN en el sistema usando 'ss' o '/proc/net/tcp'.
    """
    listening = []
    # 1. Intentar con comando 'ss'
    try:
        res = subprocess.run(["ss", "-tulpn"], capture_output=True, text=True, timeout=2)
        if res.returncode == 0:
            lines = res.stdout.strip().split("\n")
            for line in lines[1:]:
                parts = line.split()
                if len(parts) >= 5 and "LISTEN" in line:
                    proto = parts[0]
                    local_addr = parts[4]
                    # Parse local_addr (ej. 127.0.0.1:3000 o *:3000 o [::1]:631)
                    if ":" in local_addr:
                        p_str = local_addr.rsplit(":", 1)[-1]
                        ip_str = local_addr.rsplit(":", 1)[0]
                        try:
                            port = int(p_str)
                            process_info = parts[6] if len(parts) > 6 else "-"
                            listening.append({
                                "proto": proto,
                                "ip": ip_str,
                                "port": port,
                                "process": process_info
                            })
                        except ValueError:
                            pass
            return listening
    except Exception:
        pass

    # 2. Fallback: escaneo activo de puertos comunes
    for p, name, desc, risk in COMMON_PORTS:
        is_open = check_port_open("127.0.0.1", p, timeout=0.2)
        if is_open:
            listening.append({
                "proto": "tcp",
                "ip": "127.0.0.1",
                "port": p,
                "process": name
            })
    return listening


def probe_expressmart_health():
    """
    Realiza una petición al endpoint de salud y telemetría de ExpressMart para evaluar
    disponibilidad, cabeceras de seguridad y tiempos de respuesta.
    """
    url = f"http://127.0.0.1:{SERVER_PORT}/api/health"
    start = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ExpressMart-SecurityPanel/1.0"})
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            latency_ms = round((time.time() - start) * 1000, 2)
            status_code = resp.getcode()
            headers = {k.lower(): v for k, v in resp.headers.items()}
            body_raw = resp.read().decode("utf-8")
            body = json.loads(body_raw)
            return {
                "active": True,
                "status_code": status_code,
                "latency_ms": latency_ms,
                "service": body.get("service", "ExpressMart Platform"),
                "version": body.get("version", "1.0.0"),
                "environment": body.get("environment", "development"),
                "status": body.get("status", "UP"),
                "recommendationsServiceUp": body.get("recommendationsServiceUp", True),
                "security_headers": {
                    "X-Content-Type-Options": headers.get("x-content-type-options", "FALTANTE"),
                    "X-Frame-Options": headers.get("x-frame-options", "FALTANTE"),
                    "Strict-Transport-Security": headers.get("strict-transport-security", "FALTANTE"),
                    "Content-Security-Policy": "PRESENTE (Protección XSS/Inyección)" if "content-security-policy" in headers else "FALTANTE",
                    "X-XSS-Protection": headers.get("x-xss-protection", "FALTANTE"),
                }
            }
    except Exception as e:
        latency_ms = round((time.time() - start) * 1000, 2)
        return {
            "active": False,
            "error": str(e),
            "latency_ms": latency_ms
        }


# ==============================================================================
# MÓDULO 2: BITÁCORA DE AUDITORÍA Y LOGS DE SEGURIDAD (D8)
# ==============================================================================
def get_audit_logs(limit=25, action_filter=None, role_filter=None):
    con, db_path = get_db_connection()
    if not con:
        return {"error": f"Base de datos no encontrada en {db_path}", "logs": [], "total": 0}

    query = "SELECT * FROM bitacora_auditoria"
    params = []
    clauses = []

    if action_filter:
        clauses.append("accion LIKE ?")
        params.append(f"%{action_filter}%")
    if role_filter:
        clauses.append("rol = ?")
        params.append(role_filter)

    if clauses:
        query += " WHERE " + " AND ".join(clauses)

    count_query = query.replace("SELECT *", "SELECT COUNT(*)")
    total = con.execute(count_query, params).fetchone()[0]

    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    rows = con.execute(query, params).fetchall()
    logs = [dict(r) for r in rows]
    con.close()
    return {"logs": logs, "total": total, "db_path": db_path}


def compute_chain_hash(prev_hash, entry):
    """
    Algoritmo exacto de cadena criptográfica definido en src/utils/crypto.js
    data = `${prevHash || 'GENESIS'}|${entry.timestamp}|${entry.usuario_id || 0}|${entry.rol || 'anon'}|${entry.accion}|${entry.modulo}|${entry.detalles_json || ''}`
    """
    prev = prev_hash or "GENESIS"
    uid = entry.get("usuario_id") or 0
    rol = entry.get("rol") or "anon"
    accion = entry.get("accion") or ""
    modulo = entry.get("modulo") or ""
    detalles = entry.get("detalles_json") or ""
    timestamp = entry.get("timestamp") or ""

    payload = f"{prev}|{timestamp}|{uid}|{rol}|{accion}|{modulo}|{detalles}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def verify_audit_chain_integrity():
    """
    Verifica matemáticamente la cadena de bloques local SHA-256 de la tabla bitacora_auditoria.
    """
    con, db_path = get_db_connection()
    if not con:
        return {"valid": False, "error": f"Base de datos no encontrada en {db_path}", "total": 0}

    rows = con.execute("SELECT * FROM bitacora_auditoria ORDER BY id ASC").fetchall()
    con.close()

    total = len(rows)
    if total == 0:
        return {"valid": True, "total": 0, "verified": 0, "broken_at": None, "message": "Bitácora vacía"}

    expected_prev = rows[0]["prev_hash"]

    for idx, r in enumerate(rows):
        entry_dict = dict(r)
        # 1. Validar que prev_hash concuerde con el hash del bloque previo
        if idx > 0 and r["prev_hash"] != expected_prev:
            return {
                "valid": False,
                "total": total,
                "verified": idx,
                "broken_at": r["id"],
                "reason": f"Discrepancia en prev_hash en fila ID {r['id']}. Esperado: {expected_prev}, Encontrado: {r['prev_hash']}"
            }

        # 2. Validar que hash_cadena sea exactamente el SHA-256 de los datos del registro
        computed_hash = compute_chain_hash(r["prev_hash"], entry_dict)
        if computed_hash != r["hash_cadena"]:
            return {
                "valid": False,
                "total": total,
                "verified": idx,
                "broken_at": r["id"],
                "reason": f"Firma SHA-256 alterada en fila ID {r['id']}. Calculado: {computed_hash}, Almacenado: {r['hash_cadena']}"
            }
        expected_prev = r["hash_cadena"]

    return {
        "valid": True,
        "total": total,
        "verified": total,
        "genesis_hash": rows[0]["prev_hash"][:16] + "...",
        "latest_hash": rows[-1]["hash_cadena"][:16] + "...",
        "message": f"Cadena de auditoría 100% íntegra. {total} bloques SHA-256 validados."
    }


# ==============================================================================
# MÓDULO 3: MOTOR HEURÍSTICO DE ACTIVIDADES SOSPECHOSAS Y AMENAZAS
# ==============================================================================
def detect_suspicious_activities():
    """
    Examina los logs de auditoría y el estado del sistema en busca de anomalías:
    - Intentos de inyección bloqueados por WAF (XSS / SQLi).
    - Intentos de acceso denegado por RBAC (violación de privilegios).
    - Intentos reiterados de inicio de sesión fallido o bloqueos por fuerza bruta.
    - Alteraciones criptográficas o anomalías de red.
    """
    con, db_path = get_db_connection()
    threats = []
    summary = {
        "waf_blocks": 0,
        "rbac_denied": 0,
        "failed_logins": 0,
        "brute_force_locks": 0,
        "suspicious_ips": set(),
        "integrity_breaches": 0,
        "exposed_ports": 0
    }

    if not con:
        return {"threats": [], "summary": summary, "threat_level": "DESCONOCIDO", "score": 0}

    # 1. Analizar eventos WAF
    waf_rows = con.execute("""
        SELECT * FROM bitacora_auditoria 
        WHERE accion = 'ATAQUE_BLOQUEADO_WAF' OR rol = 'waf'
        ORDER BY id DESC LIMIT 50
    """).fetchall()

    for r in waf_rows:
        summary["waf_blocks"] += 1
        summary["suspicious_ips"].add(r["ip"])
        threats.append({
            "id": r["id"],
            "timestamp": r["timestamp"],
            "tipo": "ATAQUE_WAF_BLOQUEADO",
            "severidad": "ALTA",
            "ip": r["ip"],
            "descripcion": f"Intento de inyección (XSS / SQLi) interceptado en ruta: {r['entidad_id']}",
            "detalles": r["detalles_json"]
        })

    # 2. Analizar denegaciones RBAC
    rbac_rows = con.execute("""
        SELECT * FROM bitacora_auditoria 
        WHERE accion LIKE '%DENEGADO%' OR accion = 'ACCESO_DENEGADO_RBAC'
        ORDER BY id DESC LIMIT 50
    """).fetchall()

    for r in rbac_rows:
        summary["rbac_denied"] += 1
        summary["suspicious_ips"].add(r["ip"])
        threats.append({
            "id": r["id"],
            "timestamp": r["timestamp"],
            "tipo": "ACCESO_DENEGADO_RBAC",
            "severidad": "MEDIA",
            "ip": r["ip"],
            "descripcion": f"Violación de privilegios RBAC: Intento de acceso a recurso protegido sin permisos (Rol: {r['rol']})",
            "detalles": r["detalles_json"]
        })

    # 3. Analizar intentos fallidos de login y bloqueos por fuerza bruta
    login_rows = con.execute("""
        SELECT * FROM bitacora_auditoria 
        WHERE accion IN ('INTENTO_LOGIN_FALLIDO', 'BLOQUEO_CUENTA_FUERZA_BRUTA')
        ORDER BY id DESC LIMIT 50
    """).fetchall()

    for r in login_rows:
        is_lock = r["accion"] == "BLOQUEO_CUENTA_FUERZA_BRUTA"
        if is_lock:
            summary["brute_force_locks"] += 1
            sev = "CRÍTICA"
            desc = "Cuenta bloqueada preventivamente tras superar límite de 5 intentos fallidos (Protección SEG-01)"
        else:
            summary["failed_logins"] += 1
            sev = "MEDIA"
            desc = "Intento de inicio de sesión con credenciales inválidas"

        summary["suspicious_ips"].add(r["ip"])
        threats.append({
            "id": r["id"],
            "timestamp": r["timestamp"],
            "tipo": r["accion"],
            "severidad": sev,
            "ip": r["ip"],
            "descripcion": desc,
            "detalles": r["detalles_json"]
        })

    # 4. Verificar integridad criptográfica
    integrity = verify_audit_chain_integrity()
    if not integrity["valid"]:
        summary["integrity_breaches"] += 1
        threats.insert(0, {
            "id": 0,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "tipo": "ALTERACION_INTEGRIDAD_D8",
            "severidad": "CRÍTICA",
            "ip": "127.0.0.1",
            "descripcion": f"Fallo de integridad criptográfica en bitácora D8: {integrity.get('reason')}",
            "detalles": json.dumps(integrity)
        })

    con.close()

    # Cálculo de puntaje de amenaza (Threat Score 0 - 100)
    score = 0
    score += summary["integrity_breaches"] * 50
    score += summary["waf_blocks"] * 15
    score += summary["brute_force_locks"] * 20
    score += summary["rbac_denied"] * 10
    score += summary["failed_logins"] * 5
    score = min(100, score)

    if score == 0:
        threat_level = "BAJO (SEGURO)"
        threat_color = Color.GREEN
    elif score <= 25:
        threat_level = "MEDIO (NORMAL / MONITOREADO)"
        threat_color = Color.CYAN
    elif score <= 60:
        threat_level = "ELEVADO (ADVERTENCIAS ACTIVAS)"
        threat_color = Color.YELLOW
    else:
        threat_level = "CRÍTICO (AMENAZA DETECTADA)"
        threat_color = Color.RED

    summary["suspicious_ips"] = list(summary["suspicious_ips"])

    return {
        "threats": threats,
        "summary": summary,
        "threat_score": score,
        "threat_level": threat_level,
        "threat_color": threat_color,
        "integrity_status": integrity["valid"]
    }


# ==============================================================================
# MÓDULO 4: RENDERIZADO VISUAL EN CONSOLA (TERMINAL UI)
# ==============================================================================
def print_banner():
    banner = f"""{Color.BLUE}{Color.BOLD}
  ███████╗██╗  ██╗██████╗ ██████╗ ███████╗███████╗███████╗███╗   ███╗ █████╗ ██████╗ ████████╗
  ██╔════╝╚██╗██╔╝██╔══██╗██╔══██╗██╔════╝██╔════╝██╔════╝████╗ ████║██╔══██╗██╔══██╗╚══██╔══╝
  █████╗   ╚███╔╝ ██████╔╝██████╔╝█████╗  ███████╗███████╗██╔████╔██║███████║██████╔╝   ██║   
  ██╔══╝   ██╔██╗ ██╔═══╝ ██╔══██╗██╔══╝  ╚════██║╚════██║██║╚██╔╝██║██╔══██║██╔══██╗   ██║   
  ███████╗██╔╝ ██╗██║     ██║  ██║███████╗███████║███████║██║ ╚═╝ ██║██║  ██║██║  ██║   ██║   
  ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   
{Color.RESET}{Color.CYAN}              PANEL OFICIAL DE SEGURIDAD, AUDITORÍA Y MONITOREO DE RED{Color.RESET}
{Color.DIM}         Sistema de Calidad MC-001 v1.0 · ISO/IEC 27001 · OWASP ASVS · LFPC México{Color.RESET}
"""
    print(banner)


def format_dt(iso_str):
    if not iso_str:
        return "N/A"
    try:
        clean = iso_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return iso_str[:19].replace("T", " ")


def print_overview():
    print_banner()
    db_path = find_database_path()
    health = probe_expressmart_health()
    threat_data = detect_suspicious_activities()
    integrity = verify_audit_chain_integrity()

    # Tarjetas superiores de resumen
    print(f"{Color.BOLD}┌─[ ESTADO GENERAL DEL SISTEMA & AUDITORÍA ]" + "─" * 43 + "┐" + Color.RESET)
    
    # 1. Estado Web
    if health["active"]:
        web_status = f"{Color.GREEN}● EN LÍNEA{Color.RESET} ({health['latency_ms']} ms · HTTP {health['status_code']})"
        env_info = f"{health['service']} (v{health['version']} · {health['environment']})"
    else:
        web_status = f"{Color.RED}● FUERA DE LÍNEA{Color.RESET} (No responde en puerto {SERVER_PORT})"
        env_info = "Servidor detenido o inaccesible"

    # 2. Nivel de amenaza
    t_level = f"{threat_data['threat_color']}{Color.BOLD}{threat_data['threat_level']}{Color.RESET} (Puntaje: {threat_data['threat_score']}/100)"

    # 3. Integridad D8
    if integrity["valid"]:
        integ_status = f"{Color.GREEN}✓ 100% ÍNTEGRA{Color.RESET} ({integrity['total']} bloques SHA-256 validados)"
    else:
        integ_status = f"{Color.RED}✗ CORRUPTA / ALTERADA{Color.RESET} (Error en ID {integrity.get('broken_at')})"

    print(f"│  Servidor Web ExpressMart:  {web_status:<55} │")
    print(f"│  Perfil de Ambiente:        {env_info:<55} │")
    print(f"│  Nivel de Amenaza Actual:   {t_level:<64} │")
    print(f"│  Integridad Criptográfica:  {integ_status:<64} │")
    print(f"│  Base de Datos SQLite:      {os.path.basename(db_path):<55} │")
    print(f"{Color.BOLD}└" + "─" * 70 + "┘" + Color.RESET)
    print()

    # Resumen de actividad sospechosa
    s = threat_data["summary"]
    print(f"{Color.BOLD}┌─[ INDICADORES CLAVE DE AMENAZAS & INCIDENTES ]" + "─" * 30 + "┐" + Color.RESET)
    print(f"│  • Ataques bloqueados por WAF (XSS/SQLi):   {Color.RED if s['waf_blocks'] > 0 else Color.GREEN}{s['waf_blocks']:<4}{Color.RESET} eventos detectados      │")
    print(f"│  • Intentos fallidos de autenticación:      {Color.YELLOW if s['failed_logins'] > 0 else Color.GREEN}{s['failed_logins']:<4}{Color.RESET} contraseñas incorrectas │")
    print(f"│  • Bloqueos por Fuerza Bruta (SEG-01):      {Color.RED if s['brute_force_locks'] > 0 else Color.GREEN}{s['brute_force_locks']:<4}{Color.RESET} cuentas protegidas      │")
    print(f"│  • Denegaciones de Privilegio (RBAC):       {Color.YELLOW if s['rbac_denied'] > 0 else Color.GREEN}{s['rbac_denied']:<4}{Color.RESET} accesos bloqueados      │")
    print(f"│  • Direcciones IP sospechosas rastreadas:   {len(s['suspicious_ips']):<4} IPs bajo observación     │")
    print(f"{Color.BOLD}└" + "─" * 70 + "┘" + Color.RESET)
    print()

    # Cabeceras de seguridad HTTP
    if health["active"] and "security_headers" in health:
        print(f"{Color.BOLD}┌─[ CABECERAS DE SEGURIDAD HTTP (OWASP ASVS / RFC-6797) ]" + "─" * 21 + "┐" + Color.RESET)
        for h_name, h_val in health["security_headers"].items():
            h_color = Color.GREEN if h_val != "FALTANTE" else Color.RED
            status_badge = f"{h_color}{h_val}{Color.RESET}"
            print(f"│  {h_name:<28}: {status_badge:<45} │")
        print(f"{Color.BOLD}└" + "─" * 70 + "┘" + Color.RESET)
        print()


def print_ports_table():
    print_banner()
    print(f"{Color.BOLD}{Color.CYAN}=== ESCANEO DE PUERTOS Y SERVICIOS DE RED ACTIVOS ==={Color.RESET}")
    print(f"{Color.DIM}Inspección de sockets locales, interfaces de red y estado de exposición.{Color.RESET}\n")

    listening = get_system_listening_ports()
    health = probe_expressmart_health()

    print(f"{Color.BOLD}{'PUERTO':<8} {'PROTO':<6} {'DIRECCIÓN IP':<18} {'SERVICIO / PROCESO':<28} {'ESTADO':<12} {'RIESGO / EVALUACIÓN'}{Color.RESET}")
    print("─" * 95)

    # Ordenar puertos escuchando
    seen_ports = set()
    display_rows = []

    # 1. Agregar ExpressMart primero
    is_app_open = check_port_open("127.0.0.1", SERVER_PORT)
    app_status = f"{Color.GREEN}ABIERTO{Color.RESET}" if is_app_open else f"{Color.RED}CERRADO{Color.RESET}"
    display_rows.append({
        "port": SERVER_PORT,
        "proto": "tcp",
        "ip": "0.0.0.0 / 127.0.0.1",
        "service": "ExpressMart eCommerce API",
        "status": app_status,
        "risk": f"{Color.GREEN}NORMAL / SERVICIO PRODUCTIVO (MXN){Color.RESET}" if is_app_open else f"{Color.RED}ALERTA: Servidor Apagado{Color.RESET}"
    })
    seen_ports.add(SERVER_PORT)

    # 2. Agregar puertos comunes
    for p_num, s_name, desc, risk_note in COMMON_PORTS:
        if p_num in seen_ports:
            continue
        is_open = check_port_open("127.0.0.1", p_num, timeout=0.15)
        if is_open:
            seen_ports.add(p_num)
            risk_color = Color.RED if "PELIGRO" in risk_note or "CRÍTICO" in risk_note else Color.YELLOW if "ALERTA" in risk_note else Color.GREEN
            display_rows.append({
                "port": p_num,
                "proto": "tcp",
                "ip": "127.0.0.1",
                "service": s_name,
                "status": f"{Color.GREEN}ABIERTO{Color.RESET}",
                "risk": f"{risk_color}{risk_note}{Color.RESET}"
            })

    # 3. Agregar puertos adicionales descubiertos por ss
    for item in listening:
        p_num = item["port"]
        if p_num not in seen_ports and p_num < 49151:
            seen_ports.add(p_num)
            p_desc = item.get("process", "-")
            display_rows.append({
                "port": p_num,
                "proto": item["proto"],
                "ip": item["ip"] or "*",
                "service": p_desc[:26],
                "status": f"{Color.CYAN}LISTEN{Color.RESET}",
                "risk": f"{Color.DIM}Proceso local del sistema{Color.RESET}"
            })

    # Imprimir filas
    for row in sorted(display_rows, key=lambda x: x["port"]):
        print(f"{row['port']:<8} {row['proto']:<6} {row['ip']:<18} {row['service']:<28} {row['status']:<21} {row['risk']}")

    print("─" * 95)
    print(f"\n{Color.BOLD}Sondeo HTTP al Servicio Principal:{Color.RESET}")
    if health["active"]:
        print(f"  • URL Verificada:       http://localhost:{SERVER_PORT}/api/health")
        print(f"  • Tiempo de Respuesta:  {Color.GREEN}{health['latency_ms']} ms{Color.RESET}")
        print(f"  • Código HTTP:          {Color.GREEN}{health['status_code']} OK{Color.RESET}")
        print(f"  • Módulo Contingencia:  {Color.GREEN if health.get('recommendationsServiceUp') else Color.YELLOW}{'Activo / Saludable' if health.get('recommendationsServiceUp') else 'Modo Contingencia RNF-05'}{Color.RESET}")
    else:
        print(f"  • {Color.RED}No fue posible conectar con el servidor ExpressMart en el puerto {SERVER_PORT}.{Color.RESET}")
        print(f"    (Ejecute 'npm start' o 'bash run_security_panel.sh' para verificar){Color.RESET}")
    print()


def print_security_logs_table(limit=20, action_filter=None, role_filter=None):
    print_banner()
    title_suffix = ""
    if action_filter:
        title_suffix += f" [Filtro Acción: {action_filter}]"
    if role_filter:
        title_suffix += f" [Filtro Rol: {role_filter}]"

    print(f"{Color.BOLD}{Color.CYAN}=== BITÁCORA DE AUDITORÍA Y LOGS DE SEGURIDAD D8{title_suffix} ==={Color.RESET}")
    print(f"{Color.DIM}Registros inmutables con encadenamiento criptográfico SHA-256 (SEG-15).{Color.RESET}\n")

    res = get_audit_logs(limit=limit, action_filter=action_filter, role_filter=role_filter)
    if "error" in res and res["error"]:
        print(f"{Color.RED}Error:{Color.RESET} {res['error']}")
        return

    logs = res["logs"]
    total = res["total"]

    if not logs:
        print(f"{Color.YELLOW}No se encontraron registros de auditoría coincidentes.{Color.RESET}")
        return

    print(f"{Color.BOLD}{'ID':<5} {'FECHA Y HORA':<19} {'ROL':<14} {'ACCIÓN AUDITADA':<28} {'IP':<15} {'HASH SHA-256'}{Color.RESET}")
    print("─" * 98)

    for l in logs:
        action = l["accion"]
        # Resaltado por tipo de acción
        if "ATAQUE" in action or "BLOQUEO" in action:
            a_col = Color.RED + Color.BOLD
        elif "DENEGADO" in action or "FALLIDO" in action:
            a_col = Color.YELLOW
        elif "LOGIN" in action or "CHECKOUT" in action or "ALTA" in action:
            a_col = Color.GREEN
        else:
            a_col = Color.CYAN

        short_hash = l["hash_cadena"][:16] + "..." if l["hash_cadena"] else "-"
        dt_str = format_dt(l["timestamp"])

        print(f"{l['id']:<5} {dt_str:<19} {l['rol']:<14} {a_col}{action:<28}{Color.RESET} {l['ip'] or '127.0.0.1':<15} {Color.DIM}{short_hash}{Color.RESET}")

        # Mostrar resumen de detalles si existen
        if l["detalles_json"] and l["detalles_json"] != "{}":
            try:
                det = json.loads(l["detalles_json"])
                det_str = " · ".join([f"{k}: {v}" for k, v in det.items() if k not in ("password", "token")])[:75]
                if det_str:
                    print(f"      {Color.DIM}└─ Detalles: {det_str}{Color.RESET}")
            except Exception:
                pass

    print("─" * 98)
    print(f"{Color.DIM}Mostrando {len(logs)} de {total} registros totales en base de datos.{Color.RESET}\n")


def print_threats_table():
    print_banner()
    print(f"{Color.BOLD}{Color.RED}=== ANÁLISIS DE ACTIVIDADES SOSPECHOSAS Y AMENAZAS ==={Color.RESET}")
    print(f"{Color.DIM}Detección proactiva de anomalías, ataques web, fuerza bruta y violaciones RBAC.{Color.RESET}\n")

    data = detect_suspicious_activities()
    threats = data["threats"]
    s = data["summary"]

    print(f"Nivel de Amenaza Global: {data['threat_color']}{Color.BOLD}{data['threat_level']}{Color.RESET} (Puntuación de Riesgo: {data['threat_score']}/100)")
    print()

    if not threats:
        print(f"{Color.GREEN}{Color.BOLD}✓ No se han detectado actividades sospechosas en la bitácora.{Color.RESET}")
        print(f"El sistema opera con normalidad bajo los parámetros de seguridad establecidos (ISO 27001 / OWASP ASVS).")
        print()
        return

    print(f"{Color.BOLD}{'SEV':<8} {'TIPO DE EVENTO':<28} {'FECHA/HORA':<19} {'IP ORIGEN':<15} {'DESCRIPCIÓN DE LA ANOMALÍA'}{Color.RESET}")
    print("─" * 105)

    for t in threats:
        sev = t["severidad"]
        if sev == "CRÍTICA":
            s_col = Color.BG_RED + Color.WHITE + Color.BOLD
        elif sev == "ALTA":
            s_col = Color.RED + Color.BOLD
        elif sev == "MEDIA":
            s_col = Color.YELLOW
        else:
            s_col = Color.CYAN

        dt_str = format_dt(t["timestamp"])
        print(f"{s_col}{sev:<8}{Color.RESET} {t['tipo']:<28} {dt_str:<19} {t['ip']:<15} {t['descripcion'][:55]}")

    print("─" * 105)
    print(f"\n{Color.BOLD}Recomendaciones de Mitigación Operativa:{Color.RESET}")
    if s["waf_blocks"] > 0:
        print(f"  • {Color.YELLOW}[WAF]{Color.RESET} Los intentos de inyección fueron contenidos automáticamente por el Firewall de Entrada (SEG-11).")
    if s["brute_force_locks"] > 0:
        print(f"  • {Color.RED}[FUERZA BRUTA]{Color.RESET} Se activó el bloqueo temporal de cuentas conforme a SEG-01. Monitorear IPs reincidentes.")
    if s["rbac_denied"] > 0:
        print(f"  • {Color.CYAN}[RBAC]{Color.RESET} Se denegó el acceso no autorizado a endpoints administrativos y auditoría. Control de acceso efectivo.")
    if not data["integrity_status"]:
        print(f"  • {Color.BG_RED}{Color.WHITE}[CRÍTICO]{Color.RESET} {Color.RED}Alerta de manipulación de bitácora D8. Iniciar procedimiento de auditoría forense.{Color.RESET}")
    print()


def print_integrity_report():
    print_banner()
    print(f"{Color.BOLD}{Color.CYAN}=== VERIFICACIÓN CRIPTOGRÁFICA DE INTEGRIDAD D8 (SHA-256) ==={Color.RESET}")
    print(f"{Color.DIM}Auditoría matemática de inmutabilidad y no-repudio de la bitácora.{Color.RESET}\n")

    res = verify_audit_chain_integrity()
    if res["valid"]:
        print(f"{Color.GREEN}{Color.BOLD}✓ RESULTADO: INTEGRIDAD 100% VÁLIDA{Color.RESET}")
        print(f"  • Total de bloques verificados:  {res['total']}")
        print(f"  • Hash Génesis inicial:          {res.get('genesis_hash')}")
        print(f"  • Hash del bloque más reciente:  {res.get('latest_hash')}")
        print(f"  • Estado:                        {res['message']}")
        print(f"\n{Color.DIM}Conforme al estándar ISO/IEC 25012 (Integridad de Datos) y requerimiento SEG-15.{Color.RESET}")
    else:
        print(f"{Color.RED}{Color.BOLD}✗ RESULTADO: FALLA DE INTEGRIDAD DETECTADA{Color.RESET}")
        print(f"  • Bloque comprometido:           ID {res.get('broken_at')}")
        print(f"  • Causa técnica:                 {res.get('reason')}")
        print(f"  • Total bloques analizados:      {res.get('verified')} de {res.get('total')}")
    print()


def run_security_test_simulation():
    """
    Realiza una simulación controlada de intento de ataque contra el WAF o login
    para verificar que el sistema de detección y la bitácora registran la anomalía.
    """
    print_banner()
    print(f"{Color.BOLD}{Color.CYAN}=== SIMULADOR DE PRUEBAS DE SEGURIDAD EN VIVO ==={Color.RESET}")
    print("Seleccione la prueba de seguridad a simular contra el servidor ExpressMart:\n")
    print("  1. Simular Intento de Inyección XSS/SQLi (Prueba del WAF SEG-11)")
    print("  2. Simular Intento de Acceso No Autorizado (Prueba RBAC)")
    print("  3. Simular Intento de Autenticación Fallida (Protección SEG-01)")
    print("  0. Cancelar")
    print()

    choice = input(f"{Color.BOLD}Seleccione una opción [0-3]: {Color.RESET}").strip()
    if choice == "1":
        print(f"\n{Color.YELLOW}Enviando payload malicioso <script>alert('xss')</script> al endpoint de búsqueda...{Color.RESET}")
        try:
            url = f"http://127.0.0.1:{SERVER_PORT}/api/products?q=%3Cscript%3Ealert('xss')%3C/script%3E"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                print(f"{Color.RED}Aviso: La solicitud fue respondida con código {resp.getcode()}{Color.RESET}")
        except urllib.error.HTTPError as e:
            if e.code == 400:
                print(f"{Color.GREEN}{Color.BOLD}✓ ÉXITO: El WAF bloqueó la inyección correctamente (HTTP 400 Bad Request).{Color.RESET}")
            else:
                print(f"Respuesta del servidor: HTTP {e.code}")
        except Exception as e:
            print(f"{Color.RED}Error al conectar: {e}{Color.RESET}")

    elif choice == "2":
        print(f"\n{Color.YELLOW}Intentando acceder a /api/audit-logs sin token de autorización...{Color.RESET}")
        try:
            url = f"http://127.0.0.1:{SERVER_PORT}/api/audit-logs"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                print(f"Respuesta: HTTP {resp.getcode()}")
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                print(f"{Color.GREEN}{Color.BOLD}✓ ÉXITO: Control RBAC bloqueó el acceso no autorizado (HTTP {e.code}).{Color.RESET}")
            else:
                print(f"Respuesta del servidor: HTTP {e.code}")
        except Exception as e:
            print(f"{Color.RED}Error al conectar: {e}{Color.RESET}")

    elif choice == "3":
        print(f"\n{Color.YELLOW}Enviando credenciales erróneas a /api/auth/login...{Color.RESET}")
        try:
            url = f"http://127.0.0.1:{SERVER_PORT}/api/auth/login"
            payload = json.dumps({"email": "cliente@expressmart.mx", "password": "ClaveIncorrecta999!"}).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                print(f"Respuesta: HTTP {resp.getcode()}")
        except urllib.error.HTTPError as e:
            if e.code == 401:
                print(f"{Color.GREEN}{Color.BOLD}✓ ÉXITO: Intento fallido registrado y rechazado de forma segura (HTTP 401).{Color.RESET}")
            else:
                print(f"Respuesta del servidor: HTTP {e.code}")
        except Exception as e:
            print(f"{Color.RED}Error al conectar: {e}{Color.RESET}")

    print(f"\n{Color.DIM}Pulse Enter para regresar al menú...{Color.RESET}", end="")
    input()


# ==============================================================================
# MÓDULO 5: MODO WATCH EN VIVO (MONITOREO EN TIEMPO REAL)
# ==============================================================================
def run_live_watch_mode(interval=3):
    try:
        while True:
            os.system("clear" if os.name == "posix" else "cls")
            print(f"{Color.BOLD}{Color.BG_BLUE}{Color.WHITE} MODO MONITOREO EN TIEMPO REAL (Actualización cada {interval}s · Ctrl+C para salir) {Color.RESET}")
            print_overview()
            time.sleep(interval)
    except KeyboardInterrupt:
        print(f"\n{Color.YELLOW}Monitoreo en tiempo real finalizado.{Color.RESET}")


# ==============================================================================
# MENÚ INTERACTIVO
# ==============================================================================
def interactive_menu():
    while True:
        os.system("clear" if os.name == "posix" else "cls")
        print_banner()
        print(f"{Color.BOLD}MENÚ PRINCIPAL DE SEGURIDAD Y AUDITORÍA:{Color.RESET}")
        print("  1. Resumen Ejecutivo de Seguridad y Estado Web")
        print("  2. Escaneo de Puertos y Servicios de Red Activos")
        print("  3. Bitácora de Auditoría y Logs de Seguridad (D8)")
        print("  4. Análisis Heurístico de Actividades Sospechosas")
        print("  5. Verificación Criptográfica de Integridad D8 (SHA-256)")
        print("  6. Simulador de Pruebas de Seguridad en Vivo")
        print("  7. Monitoreo en Vivo Continuo (Live Watch)")
        print("  0. Salir")
        print()

        choice = input(f"{Color.BOLD}Seleccione una opción [0-7]: {Color.RESET}").strip()

        if choice == "1":
            os.system("clear" if os.name == "posix" else "cls")
            print_overview()
            input(f"{Color.DIM}Pulse Enter para volver al menú...{Color.RESET}")
        elif choice == "2":
            os.system("clear" if os.name == "posix" else "cls")
            print_ports_table()
            input(f"{Color.DIM}Pulse Enter para volver al menú...{Color.RESET}")
        elif choice == "3":
            os.system("clear" if os.name == "posix" else "cls")
            print_security_logs_table(limit=25)
            input(f"{Color.DIM}Pulse Enter para volver al menú...{Color.RESET}")
        elif choice == "4":
            os.system("clear" if os.name == "posix" else "cls")
            print_threats_table()
            input(f"{Color.DIM}Pulse Enter para volver al menú...{Color.RESET}")
        elif choice == "5":
            os.system("clear" if os.name == "posix" else "cls")
            print_integrity_report()
            input(f"{Color.DIM}Pulse Enter para volver al menú...{Color.RESET}")
        elif choice == "6":
            os.system("clear" if os.name == "posix" else "cls")
            run_security_test_simulation()
        elif choice == "7":
            run_live_watch_mode(interval=3)
        elif choice in ("0", "q", "exit", "salir"):
            print(f"\n{Color.CYAN}Cerrando panel de seguridad ExpressMart. ¡Buen día!{Color.RESET}\n")
            break


# ==============================================================================
# PUNTO DE ENTRADA CLI
# ==============================================================================
def main():
    parser = argparse.ArgumentParser(description="Panel de Seguridad y Monitoreo ExpressMart (SGC MC-001)")
    parser.add_argument("--overview", action="store_true", help="Muestra el resumen ejecutivo general de seguridad")
    parser.add_argument("--ports", action="store_true", help="Escanea y muestra los puertos y servicios activos")
    parser.add_argument("--logs", action="store_true", help="Muestra los registros recientes de la bitácora de auditoría")
    parser.add_argument("--threats", action="store_true", help="Muestra el análisis de actividades sospechosas")
    parser.add_argument("--verify", action="store_true", help="Ejecuta la verificación de integridad criptográfica D8")
    parser.add_argument("--watch", action="store_true", help="Ejecuta el panel en modo monitor en vivo con auto-refresco")
    parser.add_argument("--json", action="store_true", help="Genera salida estructurada en formato JSON")
    parser.add_argument("--limit", type=int, default=25, help="Límite de registros de logs a mostrar")
    parser.add_argument("--filter-action", type=str, default=None, help="Filtrar logs por acción")
    parser.add_argument("--filter-role", type=str, default=None, help="Filtrar logs por rol")

    args = parser.parse_args()

    if args.json:
        result = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "health": probe_expressmart_health(),
            "ports": get_system_listening_ports(),
            "threats": detect_suspicious_activities(),
            "integrity": verify_audit_chain_integrity(),
            "recent_logs": get_audit_logs(limit=args.limit)["logs"]
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    if args.overview:
        print_overview()
    elif args.ports:
        print_ports_table()
    elif args.logs:
        print_security_logs_table(limit=args.limit, action_filter=args.filter_action, role_filter=args.filter_role)
    elif args.threats:
        print_threats_table()
    elif args.verify:
        print_integrity_report()
    elif args.watch:
        run_live_watch_mode()
    else:
        # Modo interactivo por defecto
        interactive_menu()


if __name__ == "__main__":
    main()

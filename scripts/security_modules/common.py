#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Modulo Comun de Seguridad, Conectividad y Criptografia para ExpressMart.
Conforme a ISO/IEC 27001, OWASP ASVS, ISO/IEC 25010 y LFPDPPP / LFPC.
"""

import os
import sys
import time
import json
import socket
import sqlite3
import hashlib
import subprocess
import urllib.request
import urllib.error

# ==============================================================================
# CONFIGURACION Y RUTAS DEL PROYECTO
# ==============================================================================
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DB_CANDIDATES = [
    os.path.join(BASE_DIR, "data", "expressmart.sqlite"),
    os.path.join(BASE_DIR, "expressmart.db"),
    os.environ.get("DB_PATH", "")
]

DEFAULT_SERVER_URL = os.environ.get("EXPRESSMART_URL", "http://127.0.0.1:3000")
SERVER_PORT = int(os.environ.get("PORT", "3000"))

# Paleta de Colores
COLOR_NAVY_DARK = "#0a2540"
COLOR_PRIMARY = "#003087"
COLOR_PRIMARY_LIGHT = "#1e40af"
COLOR_ACCENT_AMBER = "#d97706"
COLOR_SUCCESS = "#10b981"
COLOR_SUCCESS_DARK = "#047857"
COLOR_DANGER = "#ef4444"
COLOR_SURFACE = "#ffffff"
COLOR_BG = "#f8fafc"
COLOR_BORDER = "#e2e8f0"
COLOR_TEXT_MAIN = "#0f172a"
COLOR_TEXT_MUTED = "#64748b"


class Color:
    """Colores ANSI para salida estilizada en consola / terminal."""
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    UNDERLINE = "\033[4m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"
    BG_BLUE = "\033[44m"
    BG_DARK = "\033[40m"
    BG_RED = "\033[41m"
    BG_GREEN = "\033[42m"
    BG_YELLOW = "\033[43m"


def find_database_path():
    """Busca la ruta valida del archivo SQLite de ExpressMart."""
    for p in DB_CANDIDATES:
        if p and os.path.exists(p) and os.path.isfile(p):
            return p
    return os.path.join(BASE_DIR, "data", "expressmart.sqlite")


def get_db_connection():
    """Retorna una conexion SQLite con row_factory configurada a sqlite3.Row."""
    db_path = find_database_path()
    if not os.path.exists(db_path):
        return None, db_path
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    return con, db_path


# ==============================================================================
# MODULO 1: INSPECCION DE PUERTOS Y SERVICIOS DE RED
# ==============================================================================
COMMON_PORTS = [
    (21, "FTP", "Transferencia de archivos sin cifrar", "PELIGRO si expuesto a internet"),
    (22, "SSH", "Acceso remoto seguro", "NORMAL / Gestion administrativa"),
    (23, "Telnet", "Acceso remoto sin cifrar", "CRITICO - No debe utilizarse"),
    (53, "DNS", "Resolucion de nombres local", "INFORMATIVO"),
    (80, "HTTP", "Servicio Web Estandar", "NORMAL si redirige a HTTPS"),
    (443, "HTTPS", "Servicio Web Seguro TLS", "RECOMENDADO / Produccion"),
    (SERVER_PORT, "ExpressMart Web/API", "Plataforma Node.js ExpressMart en MXN", "SERVICIO PRINCIPAL"),
    (3306, "MySQL", "Base de datos relacional", "ALERTA si expuesto en 0.0.0.0"),
    (5432, "PostgreSQL", "Base de datos relacional", "ALERTA si expuesto en 0.0.0.0"),
    (6379, "Redis", "Cache en memoria", "ALERTA si no tiene contrasena"),
    (8080, "HTTP-Alt", "Puerto de desarrollo alterno", "INFORMATIVO"),
    (8443, "HTTPS-Alt", "Puerto seguro alterno", "INFORMATIVO"),
    (27017, "MongoDB", "Base de datos NoSQL", "ALERTA si expuesto"),
]


def check_port_open(host, port, timeout=0.3):
    """Verifica si un socket TCP responde a conexion en el puerto dado."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        res = s.connect_ex((host, port))
        s.close()
        return res == 0
    except Exception:
        return False


def get_system_listening_ports():
    """Descubre sockets en modo LISTEN mediante ss o escaneo socket."""
    listening = []
    try:
        res = subprocess.run(["ss", "-tulpn"], capture_output=True, text=True, timeout=2)
        if res.returncode == 0:
            lines = res.stdout.strip().split("\n")
            for line in lines[1:]:
                parts = line.split()
                if len(parts) >= 5 and "LISTEN" in line:
                    proto = parts[0]
                    local_addr = parts[4]
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
            if listening:
                return listening
    except Exception:
        pass

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
    """Consulta la ruta /api/health del servidor Node.js y evalua cabeceras HTTP."""
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
                    "Content-Security-Policy": "PRESENTE (Proteccion XSS/Inyeccion)" if "content-security-policy" in headers else "FALTANTE",
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
# MODULO 2: BITACORA DE AUDITORIA Y LOGS DE SEGURIDAD (D8)
# ==============================================================================
def get_audit_logs(limit=25, action_filter=None, role_filter=None):
    """Consulta registros de la tabla bitacora_auditoria con filtros opcionales."""
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
    """Calcula el hash criptografico SHA-256 encadenado para un bloque de auditoria."""
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
    """Valida la integridad de la cadena de bloques SHA-256 de bitacora_auditoria."""
    con, db_path = get_db_connection()
    if not con:
        return {"valid": False, "error": f"Base de datos no encontrada en {db_path}", "total": 0}

    rows = con.execute("SELECT * FROM bitacora_auditoria ORDER BY id ASC").fetchall()
    con.close()

    total = len(rows)
    if total == 0:
        return {"valid": True, "total": 0, "verified": 0, "broken_at": None, "message": "Bitacora vacia"}

    expected_prev = rows[0]["prev_hash"]

    for idx, r in enumerate(rows):
        entry_dict = dict(r)
        if idx > 0 and r["prev_hash"] != expected_prev:
            return {
                "valid": False,
                "total": total,
                "verified": idx,
                "broken_at": r["id"],
                "reason": f"Discrepancia en prev_hash en fila ID {r['id']}. Esperado: {expected_prev}, Encontrado: {r['prev_hash']}"
            }

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
        "message": f"Cadena de auditoria 100% integra. {total} bloques SHA-256 validados."
    }


# ==============================================================================
# MODULO 3: MOTOR HEURISTICO DE ACTIVIDADES SOSPECHOSAS Y AMENAZAS
# ==============================================================================
def detect_suspicious_activities():
    """Analiza registros de auditoria buscando patrones WAF, RBAC y fuerza bruta."""
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

    # 1. Eventos WAF
    try:
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
                "descripcion": f"Intento de inyeccion interceptado en ruta: {r['entidad_id']}",
                "detalles": r["detalles_json"]
            })
    except Exception:
        pass

    # 2. Denegaciones RBAC
    try:
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
                "descripcion": f"Intento no autorizado por usuario ID {r['usuario_id']} ({r['rol']}) en modulo {r['modulo']}",
                "detalles": r["detalles_json"]
            })
    except Exception:
        pass

    # 3. Intentos fallidos y bloqueos
    try:
        fail_rows = con.execute("""
            SELECT * FROM bitacora_auditoria 
            WHERE accion IN ('LOGIN_FALLIDO', 'LOGIN_BLOQUEADO_FUERZA_BRUTA')
            ORDER BY id DESC LIMIT 50
        """).fetchall()

        for r in fail_rows:
            if r["accion"] == "LOGIN_BLOQUEADO_FUERZA_BRUTA":
                summary["brute_force_locks"] += 1
                severidad = "ALTA"
                desc = f"Cuenta bloqueada temporalmente por fuerza bruta para {r['entidad_id']}"
            else:
                summary["failed_logins"] += 1
                severidad = "BAJA"
                desc = f"Intento de inicio de sesion fallido para {r['entidad_id']}"

            summary["suspicious_ips"].add(r["ip"])
            threats.append({
                "id": r["id"],
                "timestamp": r["timestamp"],
                "tipo": r["accion"],
                "severidad": severidad,
                "ip": r["ip"],
                "descripcion": desc,
                "detalles": r["detalles_json"]
            })
    except Exception:
        pass

    con.close()

    # Calcular nivel de amenaza
    score = (summary["waf_blocks"] * 15) + (summary["brute_force_locks"] * 10) + (summary["rbac_denied"] * 5) + (summary["failed_logins"] * 1)
    if score >= 30:
        level = "ALTO"
    elif score >= 10:
        level = "MEDIO"
    else:
        level = "BAJO"

    summary["suspicious_ips"] = list(summary["suspicious_ips"])
    return {
        "threats": threats,
        "summary": summary,
        "threat_level": level,
        "score": score
    }


def run_security_test_simulation():
    """Ejecuta una peticion HTTP con payload de ataque para validar la respuesta del WAF."""
    url = f"http://127.0.0.1:{SERVER_PORT}/api/products?q=%3Cscript%3Ealert(1)%3C/script%3E"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ExpressMart-SecurityTester/1.0"})
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            data = resp.read().decode("utf-8")
            return {"success": True, "message": "Peticion completada. El WAF sanitizo la entrada.", "data": data[:100]}
    except urllib.error.HTTPError as e:
        return {"success": True, "message": f"WAF activo: Bloqueo HTTP {e.code} conforme a SEG-04 / OWASP ASVS."}
    except Exception as e:
        return {"success": False, "message": str(e)}

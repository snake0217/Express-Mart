#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Modo CLI y Terminal para el Panel de Seguridad ExpressMart.
Conforme a ISO/IEC 27001, OWASP ASVS y SGC MC-001.
"""

import subprocess
from .common import (
    BASE_DIR,
    probe_expressmart_health,
    detect_suspicious_activities,
    verify_audit_chain_integrity,
    get_system_listening_ports,
    get_audit_logs,
    run_security_test_simulation
)


def print_overview():
    """Imprime el resumen ejecutivo general de seguridad."""
    health = probe_expressmart_health()
    threats_data = detect_suspicious_activities()
    integrity = verify_audit_chain_integrity()
    ports = get_system_listening_ports()

    print("=" * 80)
    print("EXPRESSMART MEXICO · RESUMEN GENERAL DE SEGURIDAD (MC-001)")
    print("=" * 80)
    print(f"Estado del Servidor:  {'ACTIVO (200 OK)' if health.get('active') else 'INACTIVO'}")
    print(f"Nivel de Amenaza:     {threats_data.get('threat_level')}")
    print(f"Bloqueos WAF:         {threats_data['summary'].get('waf_blocks', 0)}")
    print(f"Denegaciones RBAC:    {threats_data['summary'].get('rbac_denied', 0)}")
    print(f"Logins Fallidos:      {threats_data['summary'].get('failed_logins', 0)}")
    print(f"Integridad D8:        {'100% VALIDA' if integrity.get('valid') else 'COMPROMETIDA'}")
    print(f"Puertos Escuchando:   {len(ports)}")
    print("=" * 80)


def print_ports_table():
    """Imprime la tabla de puertos y servicios escuchando en el sistema."""
    ports = get_system_listening_ports()
    print("\n" + "=" * 80)
    print("PUERTOS Y SERVICIOS EN ESCUCHA EN EL SISTEMA")
    print("=" * 80)
    print(f"{'PROTO':<8} {'IP LOCAL':<16} {'PUERTO':<8} {'PROCESO / SERVICIO':<30}")
    print("-" * 80)
    for p in ports:
        print(f"{p['proto'].upper():<8} {p['ip']:<16} {p['port']:<8} {p['process'][:28]:<30}")
    print("=" * 80)


def print_security_logs_table(limit=25, action_filter=None, role_filter=None):
    """Imprime registros recientes de la bitacora de auditoria D8."""
    res = get_audit_logs(limit=limit, action_filter=action_filter, role_filter=role_filter)
    print("\n" + "=" * 80)
    print(f"BITACORA DE AUDITORIA D8 ({len(res['logs'])} registros)")
    print("=" * 80)
    print(f"{'ID':<4} {'FECHA':<19} {'ROL':<12} {'ACCION':<25} {'IP':<15}")
    print("-" * 80)
    for r in res["logs"]:
        print(f"{r['id']:<4} {r['timestamp'][:19]:<19} {(r['rol'] or '').upper():<12} {r['accion'][:24]:<25} {r['ip']:<15}")
    print("=" * 80)


def print_threats_table():
    """Imprime la tabla de amenazas detectadas por el motor heuristico."""
    res = detect_suspicious_activities()
    print("\n" + "=" * 80)
    print(f"ANALISIS DE ACTIVIDADES SOSPECHOSAS (NIVEL: {res['threat_level']})")
    print("=" * 80)
    for t in res["threats"]:
        print(f"[{t['severidad']}] {t['timestamp'][:19]} · {t['tipo']} · IP: {t['ip']}")
        print(f"       {t['descripcion']}")
    print("=" * 80)


def print_integrity_report():
    """Imprime el reporte de verificacion criptografica de bloques SHA-256."""
    res = verify_audit_chain_integrity()
    print("\n" + "=" * 80)
    print("REPORTE DE INTEGRIDAD CRIPTOGRAFICA DE AUDITORIA D8")
    print("=" * 80)
    print(f"Validez Matematica: {'VALIDA' if res.get('valid') else 'COMPROMETIDA'}")
    print(f"Total Bloques:      {res.get('total', 0)}")
    print(f"Mensaje:            {res.get('message', res.get('reason'))}")
    print("=" * 80)


def interactive_menu():
    """Menu interactivo por consola CLI para administradores de seguridad."""
    while True:
        print("\n" + "=" * 60)
        print("PANEL DE SEGURIDAD EXPRESSMART (MODO CLI)")
        print("=" * 60)
        print("1. Resumen General de Seguridad")
        print("2. Inspeccionar Puertos y Red")
        print("3. Ver Bitacora de Auditoria D8")
        print("4. Analizar Amenazas y Actividades Sospechosas")
        print("5. Verificar Integridad Criptografica SHA-256")
        print("6. Simular Ataque de Prueba WAF")
        print("7. Ejecutar Pruebas Automatizadas y QA (npm test / audit:verify / test:security)")
        print("8. Salir")

        try:
            choice = input("\nSeleccione una opcion (1-8): ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nSaliendo...")
            break

        if choice == "1":
            print_overview()
        elif choice == "2":
            print_ports_table()
        elif choice == "3":
            print_security_logs_table(limit=25)
        elif choice == "4":
            print_threats_table()
        elif choice == "5":
            print_integrity_report()
        elif choice == "6":
            res = run_security_test_simulation()
            print(f"[RESULTADO] {res['message']}")
        elif choice == "7":
            print("\n" + "=" * 60)
            print("EJECUCIÓN DE PRUEBAS AUTOMATIZADAS EXPRESSMART")
            print("=" * 60)
            print("a. Suite Completa Jest (npm test)")
            print("b. Verificador de Auditoría SGC MC-001 (npm run audit:verify)")
            print("c. Pruebas de Seguridad y Resiliencia (npm run test:security)")
            print("d. Análisis Estático y Lint (npm run lint)")
            print("e. Volver")
            try:
                sub = input("Seleccione prueba: ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                continue
            cmd_map = {
                "a": ["npm", "test"],
                "b": ["npm", "run", "audit:verify"],
                "c": ["npm", "run", "test:security"],
                "d": ["npm", "run", "lint"]
            }
            if sub in cmd_map:
                print(f"\n[EJECUTANDO]: {' '.join(cmd_map[sub])} ...\n")
                subprocess.run(cmd_map[sub], cwd=BASE_DIR)
        elif choice in ("8", "q", "salir", "exit"):
            break

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
Panel de Seguridad y Monitoreo ExpressMart (SGC MC-001 v1.0)
Conforme a ISO/IEC 27001, OWASP ASVS, ISO/IEC 25010 y LFPDPPP / LFPC
==============================================================================
Orquestador modular del panel de seguridad.
Submódulos en scripts/security_modules/:
  - common.py: Funciones criptográficas, conexiones DB y verificación de red.
  - tabs_monitoring.py: Pestañas de puertos, amenazas, auditoría D8 e integridad.
  - tab_automated_tests.py: Consola y ejecución de suites de prueba Jest/SGC.
  - cli_mode.py: Interfaz interactiva para terminal CLI.
==============================================================================
"""

import os
import sys
import json
import argparse
from datetime import datetime

# Verificación de entorno gráfico
HAS_GUI = False
try:
    import tkinter as tk
    from tkinter import ttk
    if os.environ.get("DISPLAY") or sys.platform in ("win32", "darwin"):
        HAS_GUI = True
except Exception:
    HAS_GUI = False

# Importaciones de submódulos locales
from security_modules.common import (
    BASE_DIR,
    COLOR_NAVY_DARK,
    COLOR_PRIMARY,
    COLOR_PRIMARY_LIGHT,
    COLOR_BG,
    COLOR_SUCCESS,
    COLOR_TEXT_MAIN,
    probe_expressmart_health,
    get_system_listening_ports,
    detect_suspicious_activities,
    verify_audit_chain_integrity,
    get_audit_logs
)
from security_modules.tabs_monitoring import MonitoringTabsMixin
from security_modules.tab_automated_tests import AutomatedTestsTabMixin
from security_modules.cli_mode import (
    print_overview,
    print_ports_table,
    print_security_logs_table,
    print_threats_table,
    print_integrity_report,
    interactive_menu
)


class SecurityPanelGUI(MonitoringTabsMixin, AutomatedTestsTabMixin):
    """Ventana Principal Tkinter para el Panel de Seguridad ExpressMart."""

    def __init__(self, root):
        self.root = root
        self.root.title("ExpressMart - Panel de Seguridad y Auditoria (ISO/IEC 27001 / OWASP ASVS)")
        self.root.geometry("1120x730")
        self.root.minsize(980, 650)
        self.root.configure(bg=COLOR_BG)

        self.setup_styles()

        self.main_container = tk.Frame(self.root, bg=COLOR_BG)
        self.main_container.pack(fill=tk.BOTH, expand=True)

        self.create_header()

        self.notebook = ttk.Notebook(self.main_container, style="Security.TNotebook")
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=16, pady=(10, 16))

        self.tab_ports = ttk.Frame(self.notebook, style="Security.TFrame")
        self.tab_threats = ttk.Frame(self.notebook, style="Security.TFrame")
        self.tab_audit = ttk.Frame(self.notebook, style="Security.TFrame")
        self.tab_integrity = ttk.Frame(self.notebook, style="Security.TFrame")
        self.tab_automated_tests = ttk.Frame(self.notebook, style="Security.TFrame")

        self.notebook.add(self.tab_ports, text=" [ Puertos y Servicios de Red ] ")
        self.notebook.add(self.tab_threats, text=" [ Actividades Sospechosas y Amenazas ] ")
        self.notebook.add(self.tab_audit, text=" [ Bitacora de Auditoria D8 ] ")
        self.notebook.add(self.tab_integrity, text=" [ Integridad Criptografica ] ")
        self.notebook.add(self.tab_automated_tests, text=" [ Pruebas Automatizadas y QA ] ")

        self.build_ports_tab()
        self.build_threats_tab()
        self.build_audit_tab()
        self.build_integrity_tab()
        self.build_automated_tests_tab()

        self.refresh_all()

    def setup_styles(self):
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except Exception:
            pass

        style.configure("Security.TNotebook", background=COLOR_BG, borderwidth=0)
        style.configure(
            "Security.TNotebook.Tab",
            background="#e2e8f0",
            foreground=COLOR_NAVY_DARK,
            font=("DejaVu Sans", 10, "bold"),
            padding=[16, 8]
        )
        style.map(
            "Security.TNotebook.Tab",
            background=[("selected", COLOR_PRIMARY), ("active", "#cbd5e1")],
            foreground=[("selected", "#ffffff")]
        )

        style.configure("Security.TFrame", background=COLOR_BG)

        style.configure(
            "Security.Treeview",
            background="#ffffff",
            foreground=COLOR_TEXT_MAIN,
            fieldbackground="#ffffff",
            rowheight=26,
            font=("DejaVu Sans", 9)
        )
        style.configure(
            "Security.Treeview.Heading",
            background="#f1f5f9",
            foreground=COLOR_NAVY_DARK,
            font=("DejaVu Sans", 9, "bold"),
            relief="flat",
            padding=[6, 6]
        )
        style.map(
            "Security.Treeview",
            background=[("selected", "#e0e7ff")],
            foreground=[("selected", COLOR_PRIMARY)]
        )

    def create_header(self):
        header = tk.Frame(self.main_container, bg=COLOR_NAVY_DARK, height=75)
        header.pack(fill=tk.X, side=tk.TOP)
        header.pack_propagate(False)

        inner = tk.Frame(header, bg=COLOR_NAVY_DARK)
        inner.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        left = tk.Frame(inner, bg=COLOR_NAVY_DARK)
        left.pack(side=tk.LEFT, fill=tk.Y)

        title_lbl = tk.Label(
            left,
            text="EXPRESSMART MEXICO · SEGURIDAD Y AUDITORIA",
            font=("DejaVu Sans", 15, "bold"),
            fg="#ffffff",
            bg=COLOR_NAVY_DARK
        )
        title_lbl.pack(anchor="w")

        sub_lbl = tk.Label(
            left,
            text="Monitoreo de Red, Bitacora D8 y Deteccion de Amenazas (SGC MC-001 / ISO 27001)",
            font=("DejaVu Sans", 9),
            fg="#94a3b8",
            bg=COLOR_NAVY_DARK
        )
        sub_lbl.pack(anchor="w")

        right = tk.Frame(inner, bg=COLOR_NAVY_DARK)
        right.pack(side=tk.RIGHT, fill=tk.Y)

        self.lbl_server_status = tk.Label(
            right,
            text="[Verificando conexion...]",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_SUCCESS,
            bg=COLOR_NAVY_DARK
        )
        self.lbl_server_status.pack(anchor="e", pady=(2, 4))

        btn_refresh = tk.Button(
            right,
            text="[ Actualizar Inspeccion ]",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_PRIMARY,
            fg="#ffffff",
            activebackground=COLOR_PRIMARY_LIGHT,
            activeforeground="#ffffff",
            relief="flat",
            padx=10,
            pady=3,
            cursor="hand2",
            command=self.refresh_all
        )
        btn_refresh.pack(anchor="e")

    def refresh_all(self):
        self.refresh_ports_data()
        self.refresh_threats_data()
        self.refresh_audit_data()
        self.refresh_integrity_data()


def main():
    parser = argparse.ArgumentParser(description="Panel de Seguridad y Monitoreo ExpressMart (SGC MC-001)")
    parser.add_argument("--gui", action="store_true", help="Fuerza el inicio de la interfaz grafica (GUI Tkinter)")
    parser.add_argument("--cli", action="store_true", help="Fuerza el modo interactivo por consola CLI")
    parser.add_argument("--overview", action="store_true", help="Muestra el resumen ejecutivo general de seguridad")
    parser.add_argument("--ports", action="store_true", help="Escanea y muestra los puertos y servicios activos")
    parser.add_argument("--logs", action="store_true", help="Muestra los registros recientes de la bitacora de auditoria")
    parser.add_argument("--threats", action="store_true", help="Muestra el analisis de actividades sospechosas")
    parser.add_argument("--verify", action="store_true", help="Ejecuta la verificacion de integridad criptografica D8")
    parser.add_argument("--json", action="store_true", help="Genera salida estructurada en formato JSON")
    parser.add_argument("--limit", type=int, default=25, help="Limite de registros de logs a mostrar")

    args = parser.parse_args()

    # Si se solicitan flags específicos de CLI
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
        return
    if args.ports:
        print_ports_table()
        return
    if args.logs:
        print_security_logs_table(limit=args.limit)
        return
    if args.threats:
        print_threats_table()
        return
    if args.verify:
        print_integrity_report()
        return

    # Si se pide explícitamente CLI o no hay GUI disponible
    if args.cli or not HAS_GUI:
        interactive_menu()
    else:
        root = tk.Tk()
        logo_path = os.path.join(BASE_DIR, "public", "assets", "logo.png")
        if os.path.exists(logo_path):
            try:
                icon_img = tk.PhotoImage(file=logo_path)
                root.iconphoto(True, icon_img)
            except Exception:
                pass
        app = SecurityPanelGUI(root)
        root.mainloop()


if __name__ == "__main__":
    main()

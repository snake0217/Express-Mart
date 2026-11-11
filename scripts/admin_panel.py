#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
EXPRESSMART MÉXICO - PANEL ADMINISTRATIVO, FINANCIERO Y DE CUENTAS (GUI)
Conforme a SGC MC-001 v1.0, ISO/IEC 25010, ISO/IEC 27001, LFPDPPP y PCI DSS
==============================================================================
Arquitectura modular: Lógica de pestañas dividida en scripts/admin_modules/
(< 1000 líneas por archivo de código).
==============================================================================
"""

import os
import sys

# Módulos desacoplados del panel administrativo
from admin_modules.common import (
    HAS_GUI, BASE_DIR, COLOR_BG, COLOR_NAVY_DARK, COLOR_PRIMARY,
    COLOR_PRIMARY_LIGHT, COLOR_ACCENT_GOLD, COLOR_SUCCESS,
    find_database_path, get_db, get_financial_summary,
    generate_sales_report_files
)
from admin_modules.tab_finance import FinanceTabMixin
from admin_modules.tab_accounts import AccountsTabMixin
from admin_modules.tab_create_account import CreateAccountTabMixin
from admin_modules.tab_cards import CardsTabMixin
from admin_modules.tab_refunds import RefundsTabMixin
from admin_modules.tab_sales import SalesTabMixin
from admin_modules.tab_logistics import LogisticsTabMixin
from admin_modules.cli_mode import run_cli_mode

if HAS_GUI:
    import tkinter as tk
    from tkinter import ttk


class AdminPanelGUI(
    FinanceTabMixin,
    AccountsTabMixin,
    CreateAccountTabMixin,
    CardsTabMixin,
    RefundsTabMixin,
    SalesTabMixin,
    LogisticsTabMixin
):
    """Interfaz gráfica unificada del Panel de Administración de ExpressMart."""

    def __init__(self, root):
        self.root = root
        self.root.title("ExpressMart - Panel Administrativo y Financiero (SGC MC-001)")
        self.root.geometry("1120x730")
        self.root.minsize(980, 650)
        self.root.configure(bg=COLOR_BG)

        # Configuración de estilos ttk
        self.setup_styles()

        # Marco Principal
        self.main_container = tk.Frame(self.root, bg=COLOR_BG)
        self.main_container.pack(fill=tk.BOTH, expand=True)

        # Encabezado Corporativo
        self.create_header()

        # Cuaderno de Pestañas (Notebook)
        self.notebook = ttk.Notebook(self.main_container, style="Admin.TNotebook")
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=16, pady=(10, 16))

        # Crear las 7 Ventanas / Pestañas principales requeridas:
        self.tab_finance = ttk.Frame(self.notebook, style="Admin.TFrame")
        self.tab_accounts = ttk.Frame(self.notebook, style="Admin.TFrame")
        self.tab_create_account = ttk.Frame(self.notebook, style="Admin.TFrame")
        self.tab_cards = ttk.Frame(self.notebook, style="Admin.TFrame")
        self.tab_refunds = ttk.Frame(self.notebook, style="Admin.TFrame")
        self.tab_sales = ttk.Frame(self.notebook, style="Admin.TFrame")
        self.tab_logistics = ttk.Frame(self.notebook, style="Admin.TFrame")

        self.notebook.add(self.tab_finance, text=" Dinero y Balance ExpressMart ")
        self.notebook.add(self.tab_accounts, text=" Cuentas del Sistema ")
        self.notebook.add(self.tab_create_account, text=" Crear Cuentas (Admin/Vendedor/Auditor) ")
        self.notebook.add(self.tab_cards, text=" Tarjetas y Saldo (Compras) ")
        self.notebook.add(self.tab_refunds, text=" Peticiones de Reembolso ")
        self.notebook.add(self.tab_sales, text=" Log de Ventas y Reportes ")
        self.notebook.add(self.tab_logistics, text=" Envíos y Almacenes (OpenStreetMap) ")

        # Construir cada pestaña modular
        self.build_finance_tab()
        self.build_accounts_tab()
        self.build_create_account_tab()
        self.build_cards_tab()
        self.build_refunds_tab()
        self.build_sales_tab()
        self.build_logistics_tab()

        # Cargar datos iniciales
        self.refresh_all()

    def setup_styles(self):
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except Exception:
            pass

        style.configure("Admin.TNotebook", background=COLOR_BG, borderwidth=0)
        style.configure(
            "Admin.TNotebook.Tab",
            background="#e2e8f0",
            foreground=COLOR_NAVY_DARK,
            font=("DejaVu Sans", 10, "bold"),
            padding=[16, 8]
        )
        style.map(
            "Admin.TNotebook.Tab",
            background=[("selected", COLOR_PRIMARY), ("active", "#cbd5e1")],
            foreground=[("selected", "#ffffff")]
        )

        style.configure("Admin.TFrame", background=COLOR_BG)

        style.configure(
            "Admin.Treeview",
            background="#ffffff",
            foreground="#0f172a",
            fieldbackground="#ffffff",
            rowheight=28,
            font=("DejaVu Sans", 9)
        )
        style.configure(
            "Admin.Treeview.Heading",
            background="#f1f5f9",
            foreground=COLOR_NAVY_DARK,
            font=("DejaVu Sans", 9, "bold"),
            relief="flat",
            padding=[6, 6]
        )
        style.map(
            "Admin.Treeview",
            background=[("selected", "#e0e7ff")],
            foreground=[("selected", COLOR_PRIMARY)]
        )

    def create_header(self):
        header_frame = tk.Frame(self.main_container, bg=COLOR_NAVY_DARK, height=75)
        header_frame.pack(fill=tk.X, side=tk.TOP)
        header_frame.pack_propagate(False)

        inner = tk.Frame(header_frame, bg=COLOR_NAVY_DARK)
        inner.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        left_box = tk.Frame(inner, bg=COLOR_NAVY_DARK)
        left_box.pack(side=tk.LEFT, fill=tk.Y)

        title_lbl = tk.Label(
            left_box,
            text="EXPRESS MART · MÉXICO",
            font=("DejaVu Sans", 16, "bold"),
            fg=COLOR_ACCENT_GOLD,
            bg=COLOR_NAVY_DARK
        )
        title_lbl.pack(anchor="w")

        subtitle_lbl = tk.Label(
            left_box,
            text="Panel Ejecutivo de Gestión Financiera, Auditoría y Control de Accesos",
            font=("DejaVu Sans", 9),
            fg="#cbd5e1",
            bg=COLOR_NAVY_DARK
        )
        subtitle_lbl.pack(anchor="w")

        right_box = tk.Frame(inner, bg=COLOR_NAVY_DARK)
        right_box.pack(side=tk.RIGHT, fill=tk.Y)

        db_path = find_database_path()
        status_lbl = tk.Label(
            right_box,
            text=f"BD Activa: {os.path.basename(db_path)}",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_SUCCESS,
            bg=COLOR_NAVY_DARK
        )
        status_lbl.pack(anchor="e", pady=(2, 4))

        btn_refresh_all = tk.Button(
            right_box,
            text="Actualizar Todo",
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
        btn_refresh_all.pack(anchor="e")


def main():
    if "--cli" in sys.argv or not HAS_GUI:
        run_cli_mode()
    else:
        root = tk.Tk()
        logo_path = os.path.join(BASE_DIR, "public", "assets", "logo.png")
        if os.path.exists(logo_path):
            try:
                icon_img = tk.PhotoImage(file=logo_path)
                root.iconphoto(True, icon_img)
            except Exception:
                pass

        app = AdminPanelGUI(root)
        root.mainloop()


if __name__ == "__main__":
    main()

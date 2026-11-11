# -*- coding: utf-8 -*-
"""
Pestaña de Creación de Cuentas Especiales (Administrador, Vendedor, Auditor, Soporte) (GUI Tkinter)
"""

import os
import random
import string
from datetime import datetime

try:
    import tkinter as tk
    from tkinter import ttk, messagebox
except ImportError:
    pass

from .common import (
    COLOR_NAVY_DARK, COLOR_PRIMARY, COLOR_PRIMARY_LIGHT,
    COLOR_SURFACE, COLOR_TEXT_MUTED,
    get_db, hash_password_scrypt, encrypt_aes_gcm, record_audit_log_entry
)


class CreateAccountTabMixin:
    """Mixin que contiene la lógica y renderizado de la pestaña de Crear Cuentas."""

    def build_create_account_tab(self):
        frame = self.tab_create_account

        card = tk.LabelFrame(
            frame,
            text=" Formulario Seguro de Alta de Cuentas Especiales (SGC MC-001) ",
            font=("DejaVu Sans", 11, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=25,
            pady=18
        )
        card.pack(fill=tk.BOTH, expand=True, padx=25, pady=15)

        tk.Label(
            card,
            text="Crea cuentas de acceso administrativo con hash scrypt y cifrado AES-256-GCM conforme a ISO/IEC 27001.",
            font=("DejaVu Sans", 9),
            fg=COLOR_TEXT_MUTED,
            bg=COLOR_SURFACE
        ).grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 15))

        # 1. Rol de la cuenta
        tk.Label(card, text="Rol Asignado *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=1, column=0, sticky="w", pady=6)
        self.var_new_role = tk.StringVar(value="administrador")
        role_frame = tk.Frame(card, bg=COLOR_SURFACE)
        role_frame.grid(row=1, column=1, sticky="w", pady=6)

        roles = [
            ("Administrador", "administrador"),
            ("Vendedor", "vendedor"),
            ("Auditor", "auditor"),
            ("Soporte", "soporte")
        ]
        for text, val in roles:
            tk.Radiobutton(
                role_frame, text=text, value=val, variable=self.var_new_role,
                bg=COLOR_SURFACE, activebackground=COLOR_SURFACE, font=("DejaVu Sans", 9)
            ).pack(side=tk.LEFT, padx=(0, 12))

        # 2. Nombre Completo
        tk.Label(card, text="Nombre Completo *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=2, column=0, sticky="w", pady=6)
        self.entry_new_name = ttk.Entry(card, width=42, font=("DejaVu Sans", 9))
        self.entry_new_name.grid(row=2, column=1, sticky="w", pady=6)
        self.entry_new_name.insert(0, "Ing. Alejandro Morales (Auditor SGC)")

        # 3. Correo Electrónico
        tk.Label(card, text="Correo Electrónico *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=3, column=0, sticky="w", pady=6)
        self.entry_new_email = ttk.Entry(card, width=42, font=("DejaVu Sans", 9))
        self.entry_new_email.grid(row=3, column=1, sticky="w", pady=6)
        self.entry_new_email.insert(0, "auditor.seguridad@expressmart.mx")

        # 4. Contraseña
        tk.Label(card, text="Contraseña Segura *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=4, column=0, sticky="w", pady=6)
        pwd_box = tk.Frame(card, bg=COLOR_SURFACE)
        pwd_box.grid(row=4, column=1, sticky="w", pady=6)

        self.entry_new_pwd = ttk.Entry(pwd_box, width=28, font=("DejaVu Sans", 9), show="*")
        self.entry_new_pwd.pack(side=tk.LEFT, padx=(0, 6))
        self.entry_new_pwd.insert(0, "Auditor2026!#Segura")

        btn_toggle_p = ttk.Button(pwd_box, text="Ver", width=6, command=self.toggle_pwd_visibility)
        btn_toggle_p.pack(side=tk.LEFT, padx=(0, 6))

        btn_gen_pwd = ttk.Button(pwd_box, text="Generar", width=9, command=self.generate_secure_pwd)
        btn_gen_pwd.pack(side=tk.LEFT)

        # 5. Teléfono
        tk.Label(card, text="Teléfono de Contacto:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=5, column=0, sticky="w", pady=6)
        self.entry_new_tel = ttk.Entry(card, width=42, font=("DejaVu Sans", 9))
        self.entry_new_tel.grid(row=5, column=1, sticky="w", pady=6)
        self.entry_new_tel.insert(0, "+52 55 9876 5432")

        # 6. Dirección Física
        tk.Label(card, text="Dirección Operativa:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=6, column=0, sticky="w", pady=6)
        self.entry_new_dir = ttk.Entry(card, width=42, font=("DejaVu Sans", 9))
        self.entry_new_dir.grid(row=6, column=1, sticky="w", pady=6)
        self.entry_new_dir.insert(0, "Insurgentes Sur 1602, Crédito Constructor, CDMX")

        # 7. Checkbox MFA
        self.var_new_mfa = tk.BooleanVar(value=True)
        cb_mfa = tk.Checkbutton(
            card,
            text="Habilitar Verificación de Dos Pasos (MFA / 2FA) por defecto",
            variable=self.var_new_mfa,
            bg=COLOR_SURFACE,
            activebackground=COLOR_SURFACE,
            font=("DejaVu Sans", 9)
        )
        cb_mfa.grid(row=7, column=1, sticky="w", pady=(8, 15))

        # Botón de Crear Cuenta
        btn_create = tk.Button(
            card,
            text="Crear y Registrar Cuenta en ExpressMart",
            font=("DejaVu Sans", 10, "bold"),
            bg=COLOR_PRIMARY,
            fg="#ffffff",
            activebackground=COLOR_PRIMARY_LIGHT,
            activeforeground="#ffffff",
            padx=18,
            pady=8,
            relief="flat",
            cursor="hand2",
            command=self.submit_create_account
        )
        btn_create.grid(row=8, column=1, sticky="w", pady=5)

    def toggle_pwd_visibility(self):
        cur = self.entry_new_pwd.cget("show")
        self.entry_new_pwd.config(show="" if cur == "*" else "*")

    def generate_secure_pwd(self):
        chars = string.ascii_letters + string.digits + "!@#$%^&*"
        pwd = [
            random.choice(string.ascii_uppercase),
            random.choice(string.ascii_lowercase),
            random.choice(string.digits),
            random.choice("!@#$%^&*")
        ]
        pwd += [random.choice(chars) for _ in range(10)]
        random.shuffle(pwd)
        generated = "".join(pwd)
        self.entry_new_pwd.delete(0, tk.END)
        self.entry_new_pwd.insert(0, generated)
        self.entry_new_pwd.config(show="")

    def submit_create_account(self):
        role = self.var_new_role.get().strip().lower()
        nombre = self.entry_new_name.get().strip()
        email = self.entry_new_email.get().strip().lower()
        pwd = self.entry_new_pwd.get().strip()
        tel = self.entry_new_tel.get().strip()
        direccion = self.entry_new_dir.get().strip()
        mfa_enabled = 1 if self.var_new_mfa.get() else 0

        # Validaciones
        if not nombre or len(nombre) < 3:
            messagebox.showerror("Error de Validación", "El nombre debe tener al menos 3 caracteres.")
            return
        if not email or "@" not in email or "." not in email:
            messagebox.showerror("Error de Validación", "Ingrese un correo electrónico válido.")
            return
        if not pwd or len(pwd) < 8:
            messagebox.showerror("Error de Validación", "La contraseña debe tener al menos 8 caracteres (OWASP ASVS / SEG-01).")
            return

        con, _ = get_db()
        try:
            existing = con.execute("SELECT id FROM usuarios WHERE LOWER(email) = ?", (email,)).fetchone()
            if existing:
                messagebox.showerror("Error", f"El correo '{email}' ya se encuentra registrado.")
                return

            now_iso = datetime.utcnow().isoformat() + "Z"
            pwd_hash = hash_password_scrypt(pwd)
            tel_enc = encrypt_aes_gcm(tel)
            dir_enc = encrypt_aes_gcm(direccion)
            mfa_secret = os.urandom(16).hex().upper() if mfa_enabled else None

            res = con.execute("""
                INSERT INTO usuarios (
                    email, password_hash, nombre, rol, mfa_enabled, mfa_secret,
                    direccion_cifrada, telefono_cifrado, consentimiento_privacidad,
                    aviso_privacidad_version, failed_attempts, locked_until, activo, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'v1.0-2026', 0, 0, 1, ?)
            """, (email, pwd_hash, nombre, role, mfa_enabled, mfa_secret, dir_enc, tel_enc, now_iso))
            con.commit()

            new_user_id = res.lastrowid

            record_audit_log_entry(
                con,
                usuario_id=1,
                rol="administrador",
                accion="CREAR_CUENTA_PRIVILEGIADA",
                modulo="Gestión de Cuentas",
                entidad_id=str(new_user_id),
                detalles={
                    "usuario_creado_id": new_user_id,
                    "nombre": nombre,
                    "email": email,
                    "rol": role,
                    "mfa_habilitado": mfa_enabled
                }
            )

            messagebox.showinfo(
                "¡Cuenta Creada Exitosamente!",
                f"La cuenta ha sido dada de alta correctamente:\n\n"
                f"• ID: {new_user_id}\n"
                f"• Nombre: {nombre}\n"
                f"• Rol: {role.upper()}\n"
                f"• Correo: {email}\n"
                f"• Contraseña: {pwd}\n"
                f"• 2FA / MFA: {'Habilitado' if mfa_enabled else 'Deshabilitado'}\n\n"
                f"Se ha registrado el evento en la bitácora inmutable D8."
            )

            self.refresh_accounts_data()
            self.refresh_finance_data()

        except Exception as e:
            messagebox.showerror("Error al Crear Cuenta", str(e))
        finally:
            con.close()

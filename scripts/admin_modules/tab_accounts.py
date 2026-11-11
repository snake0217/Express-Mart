# -*- coding: utf-8 -*-
"""
Pestaña de Cuentas del Sistema y Modificación / Eliminación (GUI Tkinter)
"""

try:
    import tkinter as tk
    from tkinter import ttk, messagebox
except ImportError:
    pass

from .common import (
    COLOR_BG, COLOR_NAVY_DARK, COLOR_PRIMARY, COLOR_PRIMARY_LIGHT,
    COLOR_ACCENT_GOLD, COLOR_ACCENT_AMBER, COLOR_SUCCESS, COLOR_SUCCESS_DARK,
    COLOR_DANGER, COLOR_SURFACE, COLOR_BORDER, COLOR_TEXT_MAIN, COLOR_TEXT_MUTED,
    get_db, decrypt_aes_gcm, encrypt_aes_gcm, hash_password_scrypt,
    delete_user_cascade, record_audit_log_entry
)


class AccountsTabMixin:
    """Mixin que contiene la lógica y renderizado de la pestaña de Cuentas."""

    def build_accounts_tab(self):
        frame = self.tab_accounts

        # Barra superior con métricas y filtros
        top_box = tk.Frame(frame, bg=COLOR_BG)
        top_box.pack(fill=tk.X, padx=10, pady=(10, 6))

        # Filtros
        tk.Label(top_box, text="Filtrar por Rol:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_BG, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 5))
        self.combo_role_filter = ttk.Combobox(
            top_box,
            values=["Todos", "administrador", "vendedor", "auditor", "cliente", "soporte"],
            state="readonly",
            width=14
        )
        self.combo_role_filter.set("Todos")
        self.combo_role_filter.pack(side=tk.LEFT, padx=(0, 15))
        self.combo_role_filter.bind("<<ComboboxSelected>>", lambda _: self.filter_accounts())

        tk.Label(top_box, text="Buscar:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_BG, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 5))
        self.entry_search_user = ttk.Entry(top_box, width=22)
        self.entry_search_user.pack(side=tk.LEFT, padx=(0, 5))
        self.entry_search_user.bind("<KeyRelease>", lambda _: self.filter_accounts())

        btn_search_clear = ttk.Button(top_box, text="Limpiar", command=self.clear_user_search)
        btn_search_clear.pack(side=tk.LEFT, padx=(0, 10))

        btn_edit_user_top = tk.Button(
            top_box,
            text="Modificar Cuenta Seleccionada",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_PRIMARY,
            fg="#ffffff",
            activebackground=COLOR_PRIMARY_LIGHT,
            activeforeground="#ffffff",
            padx=10,
            pady=2,
            relief="flat",
            cursor="hand2",
            command=self.open_edit_user_dialog
        )
        btn_edit_user_top.pack(side=tk.LEFT, padx=(0, 10))

        btn_delete_user_top = tk.Button(
            top_box,
            text="Eliminar Cuenta",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_DANGER,
            fg="#ffffff",
            activebackground="#dc2626",
            activeforeground="#ffffff",
            padx=10,
            pady=2,
            relief="flat",
            cursor="hand2",
            command=self.delete_selected_user
        )
        btn_delete_user_top.pack(side=tk.LEFT, padx=(0, 15))

        self.lbl_accounts_stats = tk.Label(top_box, text="Total cuentas: 0", font=("DejaVu Sans", 9, "bold"), fg=COLOR_PRIMARY, bg=COLOR_BG)
        self.lbl_accounts_stats.pack(side=tk.RIGHT)

        # Contenedor de Tabla con Scrollbar
        table_container = tk.Frame(frame, bg=COLOR_SURFACE, relief="solid", bd=1)
        table_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        cols = ("id", "nombre", "email", "rol", "membresia", "mfa", "estado", "created_at")
        self.tree_users = ttk.Treeview(
            table_container,
            columns=cols,
            show="headings",
            style="Admin.Treeview",
            selectmode="browse"
        )

        self.tree_users.heading("id", text="ID")
        self.tree_users.heading("nombre", text="Nombre del Usuario")
        self.tree_users.heading("email", text="Correo Electrónico")
        self.tree_users.heading("rol", text="Rol en Sistema")
        self.tree_users.heading("membresia", text="Membresía Prime")
        self.tree_users.heading("mfa", text="2FA / MFA")
        self.tree_users.heading("estado", text="Estado")
        self.tree_users.heading("created_at", text="Fecha de Alta")

        self.tree_users.column("id", width=45, anchor="center")
        self.tree_users.column("nombre", width=190, anchor="w")
        self.tree_users.column("email", width=220, anchor="w")
        self.tree_users.column("rol", width=110, anchor="center")
        self.tree_users.column("membresia", width=110, anchor="center")
        self.tree_users.column("mfa", width=80, anchor="center")
        self.tree_users.column("estado", width=70, anchor="center")
        self.tree_users.column("created_at", width=140, anchor="center")

        sb_y = ttk.Scrollbar(table_container, orient=tk.VERTICAL, command=self.tree_users.yview)
        self.tree_users.configure(yscrollcommand=sb_y.set)
        sb_y.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree_users.pack(fill=tk.BOTH, expand=True)

        self.tree_users.bind("<<TreeviewSelect>>", self.on_user_select)
        self.tree_users.bind("<Double-1>", lambda _: self.open_edit_user_dialog())

        # Panel inferior de detalles del usuario seleccionado
        self.detail_user_frame = tk.LabelFrame(
            frame,
            text=" Detalles del Usuario Seleccionado (Descifrado LFPDPPP) ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=12,
            pady=8
        )
        self.detail_user_frame.pack(fill=tk.X, padx=10, pady=(4, 10))

        detail_content_box = tk.Frame(self.detail_user_frame, bg=COLOR_SURFACE)
        detail_content_box.pack(fill=tk.X)

        self.lbl_user_detail_text = tk.Label(
            detail_content_box,
            text="Selecciona una cuenta en la tabla para inspeccionar sus datos y teléfono/dirección descifrados.",
            font=("DejaVu Sans", 9),
            bg=COLOR_SURFACE,
            fg=COLOR_TEXT_MUTED,
            justify=tk.LEFT
        )
        self.lbl_user_detail_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        btn_edit_detail = tk.Button(
            detail_content_box,
            text="Editar Datos de Cuenta",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_ACCENT_AMBER,
            fg="#ffffff",
            activebackground="#b45309",
            activeforeground="#ffffff",
            padx=12,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=self.open_edit_user_dialog
        )
        btn_edit_detail.pack(side=tk.RIGHT, padx=5)

        btn_delete_detail = tk.Button(
            detail_content_box,
            text="Eliminar Cuenta",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_DANGER,
            fg="#ffffff",
            activebackground="#dc2626",
            activeforeground="#ffffff",
            padx=12,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=self.delete_selected_user
        )
        btn_delete_detail.pack(side=tk.RIGHT, padx=5)

    def refresh_accounts_data(self):
        con, _ = get_db()
        self.all_users = con.execute("""
            SELECT 
                id, email, password_hash, nombre, rol, mfa_enabled, 
                direccion_cifrada, telefono_cifrado, activo, created_at,
                membresia_premium, membresia_plan, membresia_expira
            FROM usuarios
            ORDER BY id ASC
        """).fetchall()
        con.close()

        self.filter_accounts()

    def filter_accounts(self):
        role_filter = self.combo_role_filter.get()
        search_txt = self.entry_search_user.get().strip().lower()

        for item in self.tree_users.get_children():
            self.tree_users.delete(item)

        filtered = []
        for u in getattr(self, "all_users", []):
            if role_filter != "Todos" and u["rol"].lower() != role_filter.lower():
                continue
            if search_txt:
                match_name = search_txt in u["nombre"].lower()
                match_email = search_txt in u["email"].lower()
                if not match_name and not match_email:
                    continue
            filtered.append(u)

        role_icons = {
            "administrador": "ADMIN",
            "vendedor": "VENDEDOR",
            "auditor": "AUDITOR",
            "cliente": "CLIENTE",
            "soporte": "SOPORTE"
        }

        for u in filtered:
            mfa_str = "Activo" if u["mfa_enabled"] else "No"
            estado_str = "Activa" if u["activo"] else "Bloq."
            prime_str = f"{u['membresia_plan'] or 'Prime'}" if u["membresia_premium"] else "Estándar"

            self.tree_users.insert(
                "",
                tk.END,
                values=(
                    u["id"],
                    u["nombre"],
                    u["email"],
                    role_icons.get(u["rol"], u["rol"].upper()),
                    prime_str,
                    mfa_str,
                    estado_str,
                    u["created_at"][:19]
                ),
                tags=(u["rol"],)
            )

        total_count = len(getattr(self, "all_users", []))
        self.lbl_accounts_stats.config(text=f"Total Cuentas: {total_count} (Filtradas: {len(filtered)})")

    def clear_user_search(self):
        self.entry_search_user.delete(0, tk.END)
        self.combo_role_filter.set("Todos")
        self.filter_accounts()

    def on_user_select(self, event):
        selected = self.tree_users.selection()
        if not selected:
            return
        user_id = self.tree_users.item(selected[0])["values"][0]

        user = next((u for u in self.all_users if u["id"] == user_id), None)
        if not user:
            return

        tel_dec = decrypt_aes_gcm(user["telefono_cifrado"]) or "(No registrado)"
        dir_dec = decrypt_aes_gcm(user["direccion_cifrada"]) or "(No registrada)"

        info = (
            f"Nombre: {user['nombre']}  |  Correo: {user['email']}  |  Rol: {user['rol'].upper()}\n"
            f"Teléfono (Descifrado): {tel_dec}  |  Dirección (Descifrada): {dir_dec}\n"
            f"MFA: {'Habilitado' if user['mfa_enabled'] else 'Deshabilitado'}  |  "
            f"Membresía: {'Activa (' + str(user['membresia_plan']) + ')' if user['membresia_premium'] else 'Sin membresía'}  |  "
            f"Hash Pass: {user['password_hash'][:28]}..."
        )
        self.lbl_user_detail_text.config(text=info, fg=COLOR_NAVY_DARK)

    def open_edit_user_dialog(self, target_user_id=None):
        """Abre modal interactivo para modificar todos los datos de una cuenta"""
        if target_user_id is None:
            selected = self.tree_users.selection()
            if not selected:
                messagebox.showwarning("Selección Requerida", "Por favor seleccione una cuenta en la tabla para modificar sus datos.")
                return
            target_user_id = self.tree_users.item(selected[0])["values"][0]

        con, _ = get_db()
        user = con.execute("SELECT * FROM usuarios WHERE id = ?", (target_user_id,)).fetchone()
        con.close()

        if not user:
            messagebox.showerror("Error", f"No se encontró el usuario con ID #{target_user_id}.")
            return

        tel_dec = decrypt_aes_gcm(user["telefono_cifrado"]) if user["telefono_cifrado"] else ""
        dir_dec = decrypt_aes_gcm(user["direccion_cifrada"]) if user["direccion_cifrada"] else ""

        dlg = tk.Toplevel(self.root)
        dlg.title(f"Modificar Cuenta #{user['id']} - ExpressMart")
        dlg.geometry("560x650")
        dlg.minsize(520, 600)
        dlg.configure(bg=COLOR_BG)
        dlg.transient(self.root)
        dlg.grab_set()

        # Encabezado
        header = tk.Frame(dlg, bg=COLOR_NAVY_DARK, padx=16, pady=12)
        header.pack(fill=tk.X)
        tk.Label(
            header,
            text=f"MODIFICAR CUENTA: {user['nombre']}",
            font=("DejaVu Sans", 11, "bold"),
            fg=COLOR_ACCENT_GOLD,
            bg=COLOR_NAVY_DARK
        ).pack(anchor="w")
        tk.Label(
            header,
            text=f"ID #{user['id']}  ·  Correo Actual: {user['email']}",
            font=("DejaVu Sans", 9),
            fg="#cbd5e1",
            bg=COLOR_NAVY_DARK
        ).pack(anchor="w")

        body = tk.Frame(dlg, bg=COLOR_SURFACE, padx=20, pady=15, relief="solid", bd=1)
        body.pack(fill=tk.BOTH, expand=True, padx=16, pady=12)

        # 1. Nombre
        tk.Label(body, text="Nombre Completo *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=0, column=0, sticky="w", pady=5)
        e_nombre = ttk.Entry(body, width=38, font=("DejaVu Sans", 9))
        e_nombre.grid(row=0, column=1, sticky="w", pady=5)
        e_nombre.insert(0, user["nombre"] or "")

        # 2. Email
        tk.Label(body, text="Correo Electrónico *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=1, column=0, sticky="w", pady=5)
        e_email = ttk.Entry(body, width=38, font=("DejaVu Sans", 9))
        e_email.grid(row=1, column=1, sticky="w", pady=5)
        e_email.insert(0, user["email"] or "")

        # 3. Rol
        tk.Label(body, text="Rol en Sistema *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=2, column=0, sticky="w", pady=5)
        combo_rol = ttk.Combobox(body, values=["cliente", "vendedor", "administrador", "soporte", "auditor"], state="readonly", width=22)
        combo_rol.set(user["rol"])
        combo_rol.grid(row=2, column=1, sticky="w", pady=5)

        # 4. Estado de Cuenta
        tk.Label(body, text="Estado de Cuenta *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=3, column=0, sticky="w", pady=5)
        combo_activo = ttk.Combobox(body, values=["1 - Activa", "0 - Inactiva / Bloqueada"], state="readonly", width=22)
        combo_activo.set("1 - Activa" if user["activo"] else "0 - Inactiva / Bloqueada")
        combo_activo.grid(row=3, column=1, sticky="w", pady=5)

        # 5. Teléfono
        tk.Label(body, text="Teléfono de Contacto:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=4, column=0, sticky="w", pady=5)
        e_tel = ttk.Entry(body, width=38, font=("DejaVu Sans", 9))
        e_tel.grid(row=4, column=1, sticky="w", pady=5)
        e_tel.insert(0, tel_dec)

        # 6. Dirección
        tk.Label(body, text="Dirección Operativa:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=5, column=0, sticky="w", pady=5)
        e_dir = ttk.Entry(body, width=38, font=("DejaVu Sans", 9))
        e_dir.grid(row=5, column=1, sticky="w", pady=5)
        e_dir.insert(0, dir_dec)

        # 7. Membresía Prime
        tk.Label(body, text="Membresía ExpressPrime:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=6, column=0, sticky="w", pady=5)
        combo_prime = ttk.Combobox(body, values=["Sin Membresía", "1_mes", "3_meses", "1_ano"], state="readonly", width=22)
        if user["membresia_premium"] and user["membresia_plan"]:
            combo_prime.set(user["membresia_plan"])
        else:
            combo_prime.set("Sin Membresía")
        combo_prime.grid(row=6, column=1, sticky="w", pady=5)

        # 8. 2FA / MFA
        var_mfa = tk.BooleanVar(value=bool(user["mfa_enabled"]))
        cb_mfa = tk.Checkbutton(
            body,
            text="Verificación de Dos Pasos (2FA) Habilitada",
            variable=var_mfa,
            bg=COLOR_SURFACE,
            activebackground=COLOR_SURFACE,
            font=("DejaVu Sans", 9)
        )
        cb_mfa.grid(row=7, column=1, sticky="w", pady=6)

        # 9. Cambiar / Restablecer Contraseña
        tk.Label(body, text="Nueva Contraseña (Opcional):", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=8, column=0, sticky="w", pady=5)
        p_frame = tk.Frame(body, bg=COLOR_SURFACE)
        p_frame.grid(row=8, column=1, sticky="w", pady=5)
        e_pwd = ttk.Entry(p_frame, width=22, font=("DejaVu Sans", 9), show="*")
        e_pwd.pack(side=tk.LEFT, padx=(0, 5))
        btn_show_p = ttk.Button(p_frame, text="Ver", width=5, command=lambda: e_pwd.config(show="" if e_pwd.cget("show") == "*" else "*"))
        btn_show_p.pack(side=tk.LEFT)

        tk.Label(body, text="Deja en blanco para conservar la contraseña actual (mínimo 8 caracteres si se cambia).", font=("DejaVu Sans", 8), fg=COLOR_TEXT_MUTED, bg=COLOR_SURFACE).grid(row=9, column=1, sticky="w", pady=(0, 10))

        # Botones de Acción
        btn_box = tk.Frame(dlg, bg=COLOR_BG, padx=16, pady=10)
        btn_box.pack(fill=tk.X)

        def save_changes():
            new_nombre = e_nombre.get().strip()
            new_email = e_email.get().strip().lower()
            new_rol = combo_rol.get().strip().lower()
            new_activo = 1 if "1" in combo_activo.get() else 0
            new_tel = e_tel.get().strip()
            new_dir = e_dir.get().strip()
            prime_val = combo_prime.get().strip()
            new_mfa = 1 if var_mfa.get() else 0
            new_pwd = e_pwd.get().strip()

            if not new_nombre or len(new_nombre) < 3:
                messagebox.showerror("Validación", "El nombre debe tener al menos 3 caracteres.", parent=dlg)
                return
            if not new_email or "@" not in new_email or "." not in new_email:
                messagebox.showerror("Validación", "Ingrese un correo electrónico válido.", parent=dlg)
                return
            if new_pwd and len(new_pwd) < 8:
                messagebox.showerror("Validación", "La nueva contraseña debe tener mínimo 8 caracteres (OWASP ASVS).", parent=dlg)
                return

            con, _ = get_db()
            try:
                # Comprobar si email ya existe en otra cuenta
                dup = con.execute("SELECT id FROM usuarios WHERE LOWER(email) = ? AND id != ?", (new_email, user["id"])).fetchone()
                if dup:
                    messagebox.showerror("Error", f"El correo '{new_email}' ya pertenece a la cuenta #{dup[0]}.", parent=dlg)
                    return

                new_tel_enc = encrypt_aes_gcm(new_tel) if new_tel else None
                new_dir_enc = encrypt_aes_gcm(new_dir) if new_dir else None
                is_premium = 1 if prime_val != "Sin Membresía" else 0
                prime_plan = prime_val if is_premium else None

                con.execute("""
                    UPDATE usuarios
                    SET nombre = ?, email = ?, rol = ?, activo = ?, mfa_enabled = ?,
                        telefono_cifrado = ?, direccion_cifrada = ?,
                        membresia_premium = ?, membresia_plan = ?
                    WHERE id = ?
                """, (new_nombre, new_email, new_rol, new_activo, new_mfa, new_tel_enc, new_dir_enc, is_premium, prime_plan, user["id"]))

                if new_pwd:
                    pwd_hash = hash_password_scrypt(new_pwd)
                    con.execute("UPDATE usuarios SET password_hash = ? WHERE id = ?", (pwd_hash, user["id"]))

                con.commit()

                record_audit_log_entry(
                    con,
                    usuario_id=1,
                    rol="administrador",
                    accion="MODIFICACION_USUARIO_ADMIN",
                    modulo="Gestión de Cuentas (RF-01)",
                    entidad_id=str(user["id"]),
                    detalles={
                        "usuario_modificado_id": user["id"],
                        "nombre": new_nombre,
                        "email": new_email,
                        "rol": new_rol,
                        "activo": new_activo,
                        "mfa": new_mfa,
                        "membresia": prime_plan,
                        "password_modificada": bool(new_pwd)
                    }
                )

                messagebox.showinfo("Éxito", f"Cuenta #{user['id']} ({new_email}) actualizada correctamente.", parent=dlg)
                dlg.destroy()
                self.refresh_accounts_data()
                self.refresh_finance_data()
            except Exception as e:
                messagebox.showerror("Error al Actualizar", str(e), parent=dlg)
            finally:
                con.close()

        btn_save = tk.Button(
            btn_box,
            text="Guardar Cambios",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_SUCCESS_DARK,
            fg="#ffffff",
            activebackground=COLOR_SUCCESS,
            activeforeground="#ffffff",
            padx=16,
            pady=6,
            relief="flat",
            cursor="hand2",
            command=save_changes
        )
        btn_save.pack(side=tk.RIGHT, padx=5)

        btn_cancel = ttk.Button(btn_box, text="Cancelar", command=dlg.destroy)
        btn_cancel.pack(side=tk.RIGHT, padx=5)

    def delete_selected_user(self):
        selected = self.tree_users.selection()
        if not selected:
            messagebox.showwarning("Atención", "Por favor seleccione una cuenta en la tabla para eliminar.")
            return

        item = self.tree_users.item(selected[0])
        vals = item["values"]
        user_id = int(vals[0])
        nombre = vals[1]
        email = vals[2]

        if user_id == 1:
            messagebox.showerror(
                "Operación Denegada",
                "No es posible eliminar la cuenta principal de Superadministrador (ID 1)."
            )
            return

        confirm = messagebox.askyesno(
            "Confirmar Eliminación Permanente",
            f"ADVERTENCIA DE SEGURIDAD:\n\n"
            f"¿Está completamente seguro de que desea eliminar permanentemente la cuenta:\n"
            f"• Usuario: {nombre}\n"
            f"• Correo: {email} (ID #{user_id})?\n\n"
            f"Esta acción revocará todas sus sesiones activas, cancelará beneficios "
            f"y purgará sus registros asociados de forma irreversible.",
            icon="warning"
        )
        if not confirm:
            return

        try:
            con, _ = get_db()
            deleted_user = delete_user_cascade(con, user_id)
            con.close()

            messagebox.showinfo(
                "Cuenta Eliminada",
                f"La cuenta de '{deleted_user['nombre']}' ({deleted_user['email']}) ha sido eliminada exitosamente del sistema."
            )
            self.refresh_accounts_data()
            self.refresh_finance_data()
        except Exception as e:
            messagebox.showerror("Error al Eliminar Cuenta", f"No se pudo eliminar la cuenta:\n{str(e)}")

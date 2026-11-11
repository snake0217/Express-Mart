# -*- coding: utf-8 -*-
"""
Pestaña de Tarjetas Simuladas y Recarga de Saldo para Compras (GUI Tkinter)
"""

import sqlite3
import random
from datetime import datetime

try:
    import tkinter as tk
    from tkinter import ttk, messagebox
except ImportError:
    pass

from .common import (
    COLOR_BG, COLOR_NAVY_DARK, COLOR_PRIMARY, COLOR_PRIMARY_LIGHT,
    COLOR_SUCCESS, COLOR_SUCCESS_DARK, COLOR_DANGER, COLOR_SURFACE,
    COLOR_TEXT_MUTED, get_db, record_audit_log_entry
)


class CardsTabMixin:
    """Mixin que contiene la lógica y renderizado de la pestaña de Tarjetas Simuladas."""

    def build_cards_tab(self):
        frame = self.tab_cards

        # Marco superior: 2 Tarjetas (Registro y Recarga)
        top_split = tk.Frame(frame, bg=COLOR_BG)
        top_split.pack(fill=tk.X, padx=10, pady=8)

        # Card 1: Formulario de Registro de Tarjeta
        reg_card = tk.LabelFrame(
            top_split,
            text=" Registrar Nueva Tarjeta de Pago con Saldo (Simulación) ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=12,
            pady=8
        )
        reg_card.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 6))

        # Número de tarjeta
        tk.Label(reg_card, text="Número de Tarjeta *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=0, column=0, sticky="w", pady=3)
        num_box = tk.Frame(reg_card, bg=COLOR_SURFACE)
        num_box.grid(row=0, column=1, sticky="w", pady=3)
        self.entry_card_number = ttk.Entry(num_box, width=22, font=("DejaVu Sans", 9))
        self.entry_card_number.pack(side=tk.LEFT, padx=(0, 5))
        self.entry_card_number.insert(0, "4532 0123 4567 8910")
        btn_gen_card = ttk.Button(num_box, text="Generar", width=8, command=self.generate_test_card_number)
        btn_gen_card.pack(side=tk.LEFT)

        # Titular
        tk.Label(reg_card, text="Titular de la Tarjeta *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=1, column=0, sticky="w", pady=3)
        self.entry_card_holder = ttk.Entry(reg_card, width=32, font=("DejaVu Sans", 9))
        self.entry_card_holder.grid(row=1, column=1, sticky="w", pady=3)
        self.entry_card_holder.insert(0, "DIEGO ALARCÓN SIMULACIÓN")

        # Expiración y CVV
        tk.Label(reg_card, text="Vigencia (MM/AA) y CVV:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=2, column=0, sticky="w", pady=3)
        exp_cvv_box = tk.Frame(reg_card, bg=COLOR_SURFACE)
        exp_cvv_box.grid(row=2, column=1, sticky="w", pady=3)
        self.entry_card_exp = ttk.Entry(exp_cvv_box, width=8, font=("DejaVu Sans", 9))
        self.entry_card_exp.pack(side=tk.LEFT, padx=(0, 8))
        self.entry_card_exp.insert(0, "12/29")
        tk.Label(exp_cvv_box, text="CVV:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 4))
        self.entry_card_cvv = ttk.Entry(exp_cvv_box, width=6, font=("DejaVu Sans", 9))
        self.entry_card_cvv.pack(side=tk.LEFT)
        self.entry_card_cvv.insert(0, "123")

        # Saldo Inicial
        tk.Label(reg_card, text="Saldo Inicial (MXN) *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=3, column=0, sticky="w", pady=3)
        self.entry_card_balance = ttk.Entry(reg_card, width=20, font=("DejaVu Sans", 9))
        self.entry_card_balance.grid(row=3, column=1, sticky="w", pady=3)
        self.entry_card_balance.insert(0, "15000.00")

        # Marca, Tipo y Color del Plástico
        tk.Label(reg_card, text="Marca, Tipo y Color:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=4, column=0, sticky="w", pady=3)
        brand_type_box = tk.Frame(reg_card, bg=COLOR_SURFACE)
        brand_type_box.grid(row=4, column=1, sticky="w", pady=3)
        self.combo_card_brand = ttk.Combobox(brand_type_box, values=["Visa", "Mastercard", "American Express", "Carnet"], state="readonly", width=12)
        self.combo_card_brand.set("Visa")
        self.combo_card_brand.pack(side=tk.LEFT, padx=(0, 5))
        self.combo_card_type = ttk.Combobox(brand_type_box, values=["credito", "debito", "corporativa"], state="readonly", width=10)
        self.combo_card_type.set("credito")
        self.combo_card_type.pack(side=tk.LEFT, padx=(0, 5))
        self.combo_card_color = ttk.Combobox(
            brand_type_box,
            values=[
                "Azul Real (#1d4ed8)",
                "Verde Esmeralda (#22c55e)",
                "Blanco Perla (#f8fafc)",
                "Negro Obsidiana (#0f172a)",
                "Dorado Gold (#d97706)",
                "Morado Neón (#7c3aed)",
                "Rojo Carmesí (#e11d48)"
            ],
            state="readonly",
            width=18
        )
        self.combo_card_color.set("Azul Real (#1d4ed8)")
        self.combo_card_color.pack(side=tk.LEFT)

        # Usuario Propietario Asignado (Máx. 3 tarjetas por usuario)
        tk.Label(reg_card, text="Asignar a Usuario *:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).grid(row=5, column=0, sticky="w", pady=3)
        self.combo_card_user = ttk.Combobox(reg_card, state="readonly", width=38)
        self.combo_card_user.grid(row=5, column=1, sticky="w", pady=3)
        self.combo_card_user.bind("<<ComboboxSelected>>", self.on_card_user_combo_select)

        # Botón Registrar Tarjeta
        btn_reg_card = tk.Button(
            reg_card,
            text="Registrar Tarjeta y Asignar a Usuario (Máx. 3)",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_PRIMARY,
            fg="#ffffff",
            activebackground=COLOR_PRIMARY_LIGHT,
            activeforeground="#ffffff",
            padx=14,
            pady=4,
            relief="flat",
            cursor="hand2",
            command=self.submit_create_card
        )
        btn_reg_card.grid(row=6, column=1, sticky="w", pady=(8, 2))

        # Card 2: Recarga Rápida de Saldo y Gestión
        recharge_card = tk.LabelFrame(
            top_split,
            text=" Recargar Saldo, Reasignar Usuario y Gestión de Tarjeta ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=12,
            pady=8
        )
        recharge_card.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(6, 0))

        self.lbl_selected_card_info = tk.Label(
            recharge_card,
            text="Tarjeta Seleccionada: Ninguna (selecciona una de la tabla abajo)",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_PRIMARY,
            bg=COLOR_SURFACE,
            anchor="w"
        )
        self.lbl_selected_card_info.pack(fill=tk.X, pady=(0, 4))

        self.lbl_selected_card_balance = tk.Label(
            recharge_card,
            text="Saldo Disponible: $0.00 MXN",
            font=("DejaVu Sans", 14, "bold"),
            fg=COLOR_SUCCESS_DARK,
            bg=COLOR_SURFACE,
            anchor="w"
        )
        self.lbl_selected_card_balance.pack(fill=tk.X, pady=(0, 6))

        # Botones de recarga rápida
        quick_frame = tk.Frame(recharge_card, bg=COLOR_SURFACE)
        quick_frame.pack(fill=tk.X, pady=3)
        tk.Label(quick_frame, text="Recarga Rápida:", font=("DejaVu Sans", 8, "bold"), bg=COLOR_SURFACE, fg=COLOR_TEXT_MUTED).pack(side=tk.LEFT, padx=(0, 6))

        for amount in [500, 1000, 5000, 10000]:
            btn_q = tk.Button(
                quick_frame,
                text=f"+${amount:,}",
                font=("DejaVu Sans", 8, "bold"),
                bg="#e0e7ff",
                fg=COLOR_PRIMARY,
                activebackground=COLOR_PRIMARY,
                activeforeground="#ffffff",
                padx=6,
                pady=2,
                relief="flat",
                cursor="hand2",
                command=lambda a=amount: self.quick_recharge_card(a)
            )
            btn_q.pack(side=tk.LEFT, padx=3)

        # Monto manual y recarga
        manual_frame = tk.Frame(recharge_card, bg=COLOR_SURFACE)
        manual_frame.pack(fill=tk.X, pady=5)
        tk.Label(manual_frame, text="Monto MXN:", font=("DejaVu Sans", 9, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 6))
        self.entry_manual_recharge = ttk.Entry(manual_frame, width=12, font=("DejaVu Sans", 9))
        self.entry_manual_recharge.pack(side=tk.LEFT, padx=(0, 6))
        self.entry_manual_recharge.insert(0, "2000.00")

        btn_recharge = tk.Button(
            manual_frame,
            text="Recargar Saldo",
            font=("DejaVu Sans", 9, "bold"),
            bg=COLOR_SUCCESS_DARK,
            fg="#ffffff",
            activebackground=COLOR_SUCCESS,
            activeforeground="#ffffff",
            padx=10,
            pady=3,
            relief="flat",
            cursor="hand2",
            command=self.submit_manual_recharge
        )
        btn_recharge.pack(side=tk.LEFT, padx=(0, 6))

        btn_toggle_status = tk.Button(
            manual_frame,
            text="Activar / Bloquear",
            font=("DejaVu Sans", 8, "bold"),
            bg="#f1f5f9",
            fg=COLOR_NAVY_DARK,
            padx=8,
            pady=3,
            relief="solid",
            bd=1,
            cursor="hand2",
            command=self.toggle_card_status
        )
        btn_toggle_status.pack(side=tk.LEFT, padx=(0, 6))

        btn_delete_card = tk.Button(
            manual_frame,
            text="🗑 Eliminar",
            font=("DejaVu Sans", 8, "bold"),
            bg=COLOR_DANGER,
            fg="#ffffff",
            padx=8,
            pady=3,
            relief="flat",
            cursor="hand2",
            command=self.delete_selected_card
        )
        btn_delete_card.pack(side=tk.LEFT)

        # Reasignar tarjeta seleccionada a un usuario específico
        assign_frame = tk.Frame(recharge_card, bg=COLOR_SURFACE)
        assign_frame.pack(fill=tk.X, pady=(4, 0))
        tk.Label(assign_frame, text="Asignar Seleccionada a:", font=("DejaVu Sans", 8, "bold"), bg=COLOR_SURFACE, fg=COLOR_NAVY_DARK).pack(side=tk.LEFT, padx=(0, 6))
        self.combo_reassign_user = ttk.Combobox(assign_frame, state="readonly", width=26)
        self.combo_reassign_user.pack(side=tk.LEFT, padx=(0, 6))
        btn_reassign = tk.Button(
            assign_frame,
            text="Guardar Asignación",
            font=("DejaVu Sans", 8, "bold"),
            bg=COLOR_PRIMARY,
            fg="#ffffff",
            padx=8,
            pady=2,
            relief="flat",
            cursor="hand2",
            command=self.reassign_selected_card_user
        )
        btn_reassign.pack(side=tk.LEFT)

        # Contenedor inferior: Tabla de Tarjetas
        table_box = tk.LabelFrame(
            frame,
            text=" Tarjetas Registradas por Usuario, Cartera PayPal y Monitoreo de Saldo (Máx. 3 por Usuario) ",
            font=("DejaVu Sans", 9, "bold"),
            fg=COLOR_NAVY_DARK,
            bg=COLOR_SURFACE,
            padx=10,
            pady=6
        )
        table_box.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))

        cols = ("id", "usuario", "numero", "titular", "marca", "tipo", "color", "exp", "saldo", "estado")
        self.tree_cards = ttk.Treeview(
            table_box,
            columns=cols,
            show="headings",
            style="Admin.Treeview",
            selectmode="browse"
        )

        self.tree_cards.heading("id", text="ID")
        self.tree_cards.heading("usuario", text="Usuario Asignado (Cuenta)")
        self.tree_cards.heading("numero", text="Número de Tarjeta")
        self.tree_cards.heading("titular", text="Titular")
        self.tree_cards.heading("marca", text="Marca")
        self.tree_cards.heading("tipo", text="Tipo")
        self.tree_cards.heading("color", text="Plástico")
        self.tree_cards.heading("exp", text="Expira")
        self.tree_cards.heading("saldo", text="Saldo Disponible (MXN)")
        self.tree_cards.heading("estado", text="Estado")

        self.tree_cards.column("id", width=38, anchor="center")
        self.tree_cards.column("usuario", width=185, anchor="w")
        self.tree_cards.column("numero", width=150, anchor="center")
        self.tree_cards.column("titular", width=165, anchor="w")
        self.tree_cards.column("marca", width=85, anchor="center")
        self.tree_cards.column("tipo", width=75, anchor="center")
        self.tree_cards.column("color", width=80, anchor="center")
        self.tree_cards.column("exp", width=60, anchor="center")
        self.tree_cards.column("saldo", width=130, anchor="e")
        self.tree_cards.column("estado", width=75, anchor="center")

        sb_card_y = ttk.Scrollbar(table_box, orient=tk.VERTICAL, command=self.tree_cards.yview)
        self.tree_cards.configure(yscrollcommand=sb_card_y.set)
        sb_card_y.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree_cards.pack(fill=tk.BOTH, expand=True)

        self.tree_cards.bind("<<TreeviewSelect>>", self.on_card_select)

    def on_card_user_combo_select(self, event=None):
        val = self.combo_card_user.get()
        if " - " in val and "(" in val:
            try:
                name_part = val.split(" - ", 1)[1].split(" (")[0].strip().upper()
                self.entry_card_holder.delete(0, tk.END)
                self.entry_card_holder.insert(0, name_part)
            except Exception:
                pass

    def _extract_user_id_from_combo(self, combo_val):
        if not combo_val or combo_val.startswith("0 -"):
            return None
        try:
            return int(combo_val.split(" - ")[0].strip())
        except Exception:
            return None

    def _extract_color_hex(self, color_label):
        if "#" in color_label and ")" in color_label:
            return "#" + color_label.split("#", 1)[1].split(")")[0].strip()
        return "#1d4ed8"

    def generate_test_card_number(self):
        prefix = "4" + "".join([str(random.randint(0, 9)) for _ in range(14)])
        digits = [int(d) for d in prefix]
        odd_digits = digits[-1::-2]
        even_digits = digits[-2::-2]
        checksum = sum(odd_digits)
        for d in even_digits:
            checksum += sum(divmod(d * 2, 10))
        check_digit = (10 - (checksum % 10)) % 10
        full_number = prefix + str(check_digit)
        formatted = f"{full_number[:4]} {full_number[4:8]} {full_number[8:12]} {full_number[12:]}"
        self.entry_card_number.delete(0, tk.END)
        self.entry_card_number.insert(0, formatted)

    def refresh_cards_data(self):
        con, _ = get_db()
        try:
            users = con.execute("SELECT id, nombre, email FROM usuarios ORDER BY id ASC").fetchall()
            user_opts = [f"{u['id']} - {u['nombre']} ({u['email']})" for u in users]
            if hasattr(self, "combo_card_user"):
                self.combo_card_user["values"] = user_opts
                if not self.combo_card_user.get() and user_opts:
                    # Por defecto seleccionar cliente@expressmart.mx si existe
                    default_opt = next((o for o in user_opts if "cliente@" in o), user_opts[0])
                    self.combo_card_user.set(default_opt)
            if hasattr(self, "combo_reassign_user"):
                self.combo_reassign_user["values"] = user_opts
                if not self.combo_reassign_user.get() and user_opts:
                    self.combo_reassign_user.set(user_opts[0])

            self.all_cards = con.execute("""
                SELECT 
                    c.id, c.usuario_id, c.numero_tarjeta, c.titular, c.expiracion, c.cvv,
                    c.saldo, c.saldo_inicial, c.marca, c.tipo,
                    COALESCE(c.color_plastico, '#1d4ed8') as color_plastico,
                    c.activa, c.created_at, c.updated_at,
                    u.nombre as usuario_nombre, u.email as usuario_email
                FROM tarjetas_simuladas c
                LEFT JOIN usuarios u ON u.id = c.usuario_id
                ORDER BY c.id ASC
            """).fetchall()
        finally:
            con.close()

        for item in self.tree_cards.get_children():
            self.tree_cards.delete(item)

        for c in getattr(self, "all_cards", []):
            estado_str = "Activa" if c["activa"] else "Bloqueada"
            saldo_str = f"${c['saldo']:,.2f} MXN"
            user_str = f"#{c['usuario_id']} {c['usuario_email']}" if c["usuario_id"] and c["usuario_email"] else "Sin asignar"
            self.tree_cards.insert(
                "",
                tk.END,
                values=(
                    c["id"],
                    user_str,
                    c["numero_tarjeta"],
                    c["titular"],
                    c["marca"],
                    c["tipo"].upper(),
                    c["color_plastico"],
                    c["expiracion"],
                    saldo_str,
                    estado_str
                )
            )

    def on_card_select(self, event):
        selected = self.tree_cards.selection()
        if not selected:
            return
        card_id = self.tree_cards.item(selected[0])["values"][0]
        card = next((c for c in getattr(self, "all_cards", []) if c["id"] == card_id), None)
        if not card:
            return
        self.selected_card_id = card["id"]
        owner_txt = card["usuario_email"] or "Sin usuario asignado"
        self.lbl_selected_card_info.config(
            text=f"Tarjeta #{card['id']} · {card['marca']} ({card['numero_tarjeta']}) · Cuenta: {owner_txt}",
            fg=COLOR_NAVY_DARK
        )
        self.lbl_selected_card_balance.config(
            text=f"Saldo Disponible: ${card['saldo']:,.2f} MXN",
            fg=COLOR_SUCCESS_DARK if card["saldo"] > 500 else COLOR_DANGER
        )

    def submit_create_card(self):
        numero = self.entry_card_number.get().strip()
        titular = self.entry_card_holder.get().strip().upper()
        exp = self.entry_card_exp.get().strip()
        cvv = self.entry_card_cvv.get().strip()
        marca = self.combo_card_brand.get().strip()
        tipo = self.combo_card_type.get().strip()
        color_hex = self._extract_color_hex(self.combo_card_color.get())
        user_id = self._extract_user_id_from_combo(self.combo_card_user.get())

        try:
            saldo = float(self.entry_card_balance.get().strip())
            if saldo < 0:
                raise ValueError()
        except ValueError:
            messagebox.showerror("Validación", "Ingrese un saldo inicial válido mayor o igual a 0.")
            return

        if not numero or len(numero.replace(" ", "")) < 12:
            messagebox.showerror("Validación", "Ingrese un número de tarjeta válido.")
            return
        if not titular or len(titular) < 3:
            messagebox.showerror("Validación", "Ingrese el nombre del titular.")
            return
        if not user_id:
            messagebox.showerror("Validación", "Seleccione el usuario propietario al que se asignará la tarjeta.")
            return

        con, _ = get_db()
        now_iso = datetime.utcnow().isoformat() + "Z"
        try:
            cnt = con.execute("SELECT COUNT(*) FROM tarjetas_simuladas WHERE usuario_id = ?", (user_id,)).fetchone()[0]
            if cnt >= 3:
                messagebox.showwarning(
                    "Límite de Cartera (Máx. 3 Tarjetas)",
                    f"El usuario seleccionado (ID #{user_id}) ya tiene {cnt} tarjetas registradas en su cartera.\n"
                    "Cada usuario puede tener un máximo de 3 tarjetas."
                )
                return

            con.execute("""
                INSERT INTO tarjetas_simuladas (
                    usuario_id, numero_tarjeta, titular, expiracion, cvv, saldo, saldo_inicial,
                    marca, tipo, color_plastico, vinculada_paypal, activa, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
            """, (user_id, numero, titular, exp, cvv, saldo, saldo, marca, tipo, color_hex, now_iso, now_iso))
            con.commit()
            last_id = con.execute("SELECT last_insert_rowid()").fetchone()[0]

            record_audit_log_entry(
                con,
                usuario_id=1,
                rol="administrador",
                accion="REGISTRO_TARJETA_SIMULADA",
                modulo="Simulador de Pagos (RF-05)",
                entidad_id=str(last_id),
                detalles={
                    "tarjeta_id": last_id,
                    "usuario_asignado": user_id,
                    "titular": titular,
                    "saldo": saldo,
                    "marca": marca,
                    "color": color_hex
                }
            )

            messagebox.showinfo(
                "Éxito",
                f"Tarjeta #{last_id} registrada y asignada al usuario ID #{user_id} con saldo de ${saldo:,.2f} MXN."
            )
            self.refresh_cards_data()
            self.generate_test_card_number()
        except sqlite3.IntegrityError:
            messagebox.showerror("Error", "Este número de tarjeta ya se encuentra registrado.")
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            con.close()

    def reassign_selected_card_user(self):
        card_id = getattr(self, "selected_card_id", None)
        if not card_id:
            messagebox.showwarning("Selección Requerida", "Seleccione una tarjeta en la tabla para asignarla a un usuario.")
            return
        user_id = self._extract_user_id_from_combo(self.combo_reassign_user.get())
        if not user_id:
            messagebox.showwarning("Selección Requerida", "Seleccione el usuario destino.")
            return

        con, _ = get_db()
        now_iso = datetime.utcnow().isoformat() + "Z"
        try:
            cnt = con.execute(
                "SELECT COUNT(*) FROM tarjetas_simuladas WHERE usuario_id = ? AND id != ?",
                (user_id, card_id)
            ).fetchone()[0]
            if cnt >= 3:
                messagebox.showwarning(
                    "Límite de Cartera (Máx. 3 Tarjetas)",
                    f"El usuario ID #{user_id} ya cuenta con el máximo permitido de 3 tarjetas."
                )
                return
            con.execute("UPDATE tarjetas_simuladas SET usuario_id = ?, updated_at = ? WHERE id = ?", (user_id, now_iso, card_id))
            con.commit()
            self.refresh_cards_data()
            messagebox.showinfo("Usuario Asignado", f"La tarjeta #{card_id} ha sido asignada exclusivamente al usuario ID #{user_id}.")
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            con.close()

    def delete_selected_card(self):
        card_id = getattr(self, "selected_card_id", None)
        if not card_id:
            messagebox.showwarning("Selección Requerida", "Seleccione una tarjeta en la tabla para eliminarla.")
            return
        if not messagebox.askyesno("Confirmar Eliminación", f"¿Desea eliminar permanentemente la tarjeta simulada #{card_id}?"):
            return
        con, _ = get_db()
        try:
            con.execute("DELETE FROM tarjetas_simuladas WHERE id = ?", (card_id,))
            con.commit()
            self.selected_card_id = None
            self.refresh_cards_data()
            messagebox.showinfo("Tarjeta Eliminada", f"La tarjeta #{card_id} fue eliminada correctamente.")
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            con.close()

    def quick_recharge_card(self, amount):
        card_id = getattr(self, "selected_card_id", None)
        if not card_id:
            messagebox.showwarning("Selección Requerida", "Por favor seleccione una tarjeta en la tabla para recargar saldo.")
            return
        self.do_recharge(card_id, amount)

    def submit_manual_recharge(self):
        card_id = getattr(self, "selected_card_id", None)
        if not card_id:
            messagebox.showwarning("Selección Requerida", "Por favor seleccione una tarjeta en la tabla para recargar saldo.")
            return
        try:
            amount = float(self.entry_manual_recharge.get().strip())
            if amount <= 0:
                raise ValueError()
        except ValueError:
            messagebox.showerror("Validación", "Ingrese un monto de recarga válido mayor a 0.")
            return
        self.do_recharge(card_id, amount)

    def do_recharge(self, card_id, amount):
        con, _ = get_db()
        now_iso = datetime.utcnow().isoformat() + "Z"
        try:
            row = con.execute("SELECT saldo, titular, numero_tarjeta FROM tarjetas_simuladas WHERE id = ?", (card_id,)).fetchone()
            if not row:
                messagebox.showerror("Error", "Tarjeta no encontrada.")
                return
            saldo_anterior = row["saldo"]
            nuevo_saldo = round(saldo_anterior + amount, 2)
            con.execute("UPDATE tarjetas_simuladas SET saldo = ?, updated_at = ? WHERE id = ?", (nuevo_saldo, now_iso, card_id))
            con.commit()

            record_audit_log_entry(
                con,
                usuario_id=1,
                rol="administrador",
                accion="RECARGA_SALDO_TARJETA",
                modulo="Simulador de Pagos (RF-05)",
                entidad_id=str(card_id),
                detalles={
                    "tarjeta_id": card_id,
                    "monto": amount,
                    "saldo_anterior": saldo_anterior,
                    "nuevo_saldo": nuevo_saldo
                }
            )

            messagebox.showinfo("Recarga Exitosa", f"Se han recargado ${amount:,.2f} MXN a la tarjeta #{card_id}.\nNuevo saldo: ${nuevo_saldo:,.2f} MXN")
            self.refresh_cards_data()
            self.lbl_selected_card_balance.config(text=f"Saldo Disponible: ${nuevo_saldo:,.2f} MXN")
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            con.close()

    def toggle_card_status(self):
        card_id = getattr(self, "selected_card_id", None)
        if not card_id:
            messagebox.showwarning("Selección Requerida", "Por favor seleccione una tarjeta en la tabla.")
            return
        con, _ = get_db()
        now_iso = datetime.utcnow().isoformat() + "Z"
        try:
            row = con.execute("SELECT activa FROM tarjetas_simuladas WHERE id = ?", (card_id,)).fetchone()
            if not row:
                return
            nuevo_estado = 0 if row["activa"] else 1
            con.execute("UPDATE tarjetas_simuladas SET activa = ?, updated_at = ? WHERE id = ?", (nuevo_estado, now_iso, card_id))
            con.commit()
            self.refresh_cards_data()
            messagebox.showinfo("Estado Actualizado", f"La tarjeta #{card_id} ahora está {'Activa' if nuevo_estado else 'Bloqueada'}.")
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            con.close()


#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Actualización e Integración de Registros Operativos (Apartado 37 del Manual MC-001)
Express Mart México S.A. de C.V.
Actualiza:
  1. Registros-Operativos-ExpressMart.xlsx (en pauditoria y en respaldo)
  2. docs/REGISTROS_OPERATIVOS_EXPRESSMART.md
"""

import os
import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_XLSX = '/home/diego/Documentos/documentos_respaldo/Registros-Operativos-ExpressMart.xlsx'
DEST_XLSX = os.path.join(BASE_DIR, 'Registros-Operativos-ExpressMart.xlsx')
DEST_XLSX_RESPALDO = SRC_XLSX
MD_OUT = os.path.join(BASE_DIR, 'docs', 'REGISTROS_OPERATIVOS_EXPRESSMART.md')
ARTIFACT_DIR = '/home/diego/.gemini/antigravity/brain/63a559f9-102d-4fab-8498-6fe2845c1b48'
ARTIFACT_MD = os.path.join(ARTIFACT_DIR, 'REGISTROS_OPERATIVOS_EXPRESSMART.md')

# --- Datos Nuevos a Integrar ---

NUEVOS_INCIDENTES = [
    (
        "INC-0008",
        datetime.datetime(2026, 11, 9, 18, 30),
        "Auditoría Interna / QA",
        "Cuentas y Privacidad (Frontend)",
        "Exposición visual de apartados de cuenta y privacidad con sesión cerrada",
        "Al cerrar sesión en la aplicación web, el contenedor de perfil y privacidad permanecía visible o se desplegaba al navegar por las pestañas sin validar la existencia de sesión activa (currentUser == null).",
        "Media",
        "P2",
        "Cristopher San Juan (Frontend)",
        "Cerrado",
        datetime.datetime(2026, 11, 9, 20, 15),
        "Actualización de updateSessionUI y switchTab en public/app.js forzando display: none en #tab-cuenta y #tab-privacidad si no hay sesión autenticada.",
        "PRB-0006",
        "RFC-0007",
        "Commit 6a83064 y validación en navegador"
    ),
    (
        "INC-0009",
        datetime.datetime(2026, 11, 9, 21, 0),
        "Producto y Ventas",
        "Membresías y Checkout",
        "Ausencia de modelo de suscripción ExpressPrime y falta de bonificación de flete y cashback",
        "Los nuevos usuarios registrados contaban con beneficios ilimitados o no podían contratar membresías temporales (1 mes, 3 meses, 1 año) con descuento automático en envíos y cashback comercial en compras.",
        "Media",
        "P2",
        "Carlos Bautista y Diego Alarcón",
        "Cerrado",
        datetime.datetime(2026, 11, 9, 23, 45),
        "Creación de tabla suscripciones_premium en SQLite, simulación de pago de suscripción y adaptación del motor de checkout para otorgar envío $0.00 MXN y cashback.",
        "PRB-0007",
        "RFC-0008",
        "Tabla suscripciones_premium y tests/integration.test.js"
    ),
    (
        "INC-0010",
        datetime.datetime(2026, 11, 10, 9, 15),
        "Inspección Visual UI/UX",
        "Dashboard Principal",
        "Sobreposición tipográfica en tarjetas de producto y espacio desaprovechado junto al banner ExpressPrime",
        "En resoluciones medianas, los títulos largos de los productos se sobreponían a los precios y existía un espacio en blanco excesivo al lado del recuadro promocional de ExpressPrime.",
        "Baja",
        "P3",
        "Cristopher San Juan (Frontend)",
        "Cerrado",
        datetime.datetime(2026, 11, 10, 10, 45),
        "Reestructuración con Tailwind CSS Grid y Flexbox, truncamiento elíptico en dos líneas y equilibrado del banner promocional.",
        "PRB-0005",
        "RFC-0009",
        "Ajuste en public/styles.css y public/index.html"
    ),
    (
        "INC-0011",
        datetime.datetime(2026, 11, 10, 11, 30),
        "Pruebas QA / Operaciones",
        "Sesiones y Checkout",
        "Error al intentar pagar tras reinicio de servidor o periodo prolongado de inactividad de sesión",
        "Si un usuario dejaba la pestaña abierta y el servidor se reiniciaba o pasaban más de 5 minutos, al intentar comprar se arrojaba un error de sesión expirada sin aviso previo.",
        "Alta",
        "P2",
        "Diego Alarcón y Carlos Bautista",
        "Cerrado",
        datetime.datetime(2026, 11, 10, 12, 45),
        "Implementación de monitor de inactividad a 5 min con modal interactivo '¿Sigues ahí?', cuenta regresiva de 2 min y cierre automático coordinado con /api/auth/logout.",
        "PRB-0008",
        "RFC-0011",
        "Manejador de inactividad en public/app.js y tabla sesiones"
    ),
    (
        "INC-0012",
        datetime.datetime(2026, 11, 10, 16, 50),
        "Autenticación y Notificaciones",
        "Servicio SMTP 2FA",
        "Error al enviar correo 2FA por omisión de variables de entorno al iniciar Node (Missing credentials for PLAIN)",
        "Al iniciar el servidor HTTP desde el subdirectorio src/ o sin carga previa de .env, el objeto transporter de Nodemailer inicializaba credenciales vacías, arrojando el error 'Missing credentials for PLAIN' e impidiendo el envío de códigos OTP a los usuarios.",
        "Alta",
        "P2",
        "Diego Alarcón (Arquitectura Backend)",
        "Cerrado",
        datetime.datetime(2026, 11, 10, 17, 5),
        "Implementación de módulo universal de carga de variables de entorno loadEnv.js con resolución multicamino, transporte dinámico resiliente en emailService.js, homologación de DB_PATH y logs de rescate preventivo.",
        "PRB-0009",
        "RFC-0015",
        "src/config/loadEnv.js, src/services/emailService.js y commit f50250e"
    )
]

NUEVOS_PROBLEMAS = [
    (
        "PRB-0006",
        datetime.datetime(2026, 11, 9),
        "Cuentas y Privacidad",
        "Persistencia visual de componentes privados en estado desautenticado",
        "INC-0008",
        "Falta de reactividad visual al desloguearse en frontend.",
        "El evento logout limpiaba el objeto currentUser pero no disparaba el re-render de todas las pestañas.",
        "Las vistas estaban desacopladas y dependían de navegación manual del usuario.",
        "No existía una función centralizada de reseteo visual de interfaz tras logout.",
        "Se priorizó el flujo transaccional antes de la navegación desautenticada.",
        "Faltaban casos de prueba específicos de interfaz para navegación post-logout.",
        "Ausencia de una rutina obligatoria de saneamiento y ocultamiento de pestañas privadas en executeLogout().",
        "Centralizar la función resetUIState() e incorporarla en los tests E2E.",
        "Cristopher San Juan",
        datetime.datetime(2026, 11, 10),
        "Cerrado",
        "RFC-0007",
        "public/app.js y commit 6a83064"
    ),
    (
        "PRB-0007",
        datetime.datetime(2026, 11, 9),
        "Modelo de Negocio / Membresías",
        "Incompatibilidad del motor de pagos con modelos de suscripción periódica y beneficios dinámicos",
        "INC-0009",
        "La plataforma solo soportaba compra única de artículos físicos sin capacidad de membrecía premium.",
        "El alcance del Sprint 1 original cubría únicamente compra minorista estándar.",
        "El checkout calculaba flete fijo sin considerar condiciones de fidelidad o tiers de cliente.",
        "No se habían definido las tablas para la vigencia temporal de membresías.",
        "Los endpoints de checkout no validaban el estatus premium del comprador.",
        "Falta de requerimiento formal de recurrencia en la primera iteración.",
        "Esquema de datos rígido sin soporte para modelos de fidelización ExpressPrime.",
        "Extender el esquema relacional con tabla suscripciones_premium y modularizar las reglas de descuento en CalcEngine.",
        "Carlos Bautista",
        datetime.datetime(2026, 11, 10),
        "Cerrado",
        "RFC-0008",
        "Esquema database.js y suite de tests integration.test.js"
    ),
    (
        "PRB-0008",
        datetime.datetime(2026, 11, 10),
        "Gestión de Sesiones y Seguridad",
        "Interrupción abrupta del flujo de compra por desincronización de token tras inactividad",
        "INC-0011",
        "Rechazo de transacciones con error 401 sin advertencia al usuario.",
        "El token de sesión expiraba en el servidor a los 5 minutos pero el cliente mantenía la vista activa.",
        "El cliente no monitoreaba eventos de interacción (mouse, teclado).",
        "No existía comunicación bidireccional de caducidad antes del intento de compra.",
        "El cliente solo se enteraba de la expiración al recibir el error 401 del backend.",
        "No se había implementado el estándar OWASP ASVS para advertencia de sesión desatendida.",
        "Falta de un monitor de inactividad sincronizado entre el frontend y las políticas de sesión del servidor.",
        "Implementar temporizador de inactividad con diálogo preventivo ('¿Sigues ahí?') y cierre limpio.",
        "Diego Alarcón",
        datetime.datetime(2026, 11, 10),
        "Cerrado",
        "RFC-0011",
        "Manejador de inactividad en public/app.js"
    ),
    (
        "PRB-0009",
        datetime.datetime(2026, 11, 10),
        "Gestión de Configuración y Entornos",
        "Dependencia estricta de process.cwd() para la resolución de variables de entorno (.env)",
        "INC-0012",
        "El módulo emailService utilizaba path.resolve(process.cwd(), '.env') sin contemplar rutas relativas al archivo fuente.",
        "Si el desarrollador o administrador ejecutaba 'cd src && node server.js', el CWD cambiaba y la búsqueda de .env fallaba silenciosamente.",
        "Nodemailer inicializa los plugins de autenticación una sola vez al invocar createTransport(); reasignar opciones posteriores no regenera los plugins.",
        "Falta de un mecanismo de respaldo (fallback logging) que exponga temporalmente el OTP en consola ante incidentes de transporte.",
        "Divergencia entre DB_PATH definido en .env y la ruta estándar expressmart.sqlite.",
        "Acoplamiento indebido de la carga de configuración al directorio de trabajo de ejecución (CWD) en lugar de un anclaje absoluto al proyecto.",
        "Crear módulo loadEnv.js con búsqueda jerárquica de 6 rutas, enlace simbólico preventivo y regeneración dinámica del transporte Nodemailer.",
        "Diego Alarcón",
        datetime.datetime(2026, 11, 10),
        "Cerrado",
        "RFC-0015",
        "src/config/loadEnv.js y tests unitarios 33/33"
    )
]

NUEVOS_CAMBIOS = [
    (
        "RFC-0007",
        datetime.datetime(2026, 11, 9),
        "Auditoría y UX",
        "Frontend / Cuentas",
        "Ocultamiento estricto de apartados de cuenta y privacidad sin sesión activa",
        "Ajuste en public/app.js para ocultar pestañas privadas y redireccionar al inicio si un usuario sin sesión intenta navegar a secciones de cuenta.",
        "Cumplimiento de privacidad y mejora de la experiencia de usuario.",
        "Normal",
        "Bajo. Solo afecta manipulación de DOM del lado cliente.",
        "Revertir cambios en updateSessionUI().",
        "Comité de cambios",
        datetime.datetime(2026, 11, 9),
        "09/11/2026 20:00 a 20:30",
        "Cristopher San Juan",
        "Cerrado",
        "Exitoso",
        "INC-0008 / PRB-0006",
        "Commit en public/app.js"
    ),
    (
        "RFC-0008",
        datetime.datetime(2026, 11, 9),
        "Dirección de Producto",
        "Membresías y Checkout",
        "Implementación de Membresías ExpressPrime (1m, 3m, 1a) con Envíos Gratis y Cashback",
        "Creación de tabla suscripciones_premium, endpoints de contratación y reglas de bonificación en checkout.",
        "Apertura de nuevas líneas de ingresos y fidelización de compradores.",
        "Normal",
        "Medio. Modifica base de datos y lógica de cálculo financiero.",
        "Desactivar bandera de membresía y restaurar versión previa de database.js.",
        "Comité de cambios",
        datetime.datetime(2026, 11, 9),
        "09/11/2026 22:00 a 23:45",
        "Carlos Bautista y Diego Alarcón",
        "Cerrado",
        "Exitoso",
        "INC-0009 / PRB-0007",
        "tests/unit.test.js y database.js"
    ),
    (
        "RFC-0009",
        datetime.datetime(2026, 11, 10),
        "Ventas y Mercadotecnia",
        "Catálogo de Productos",
        "Expansión del catálogo a más de 50 productos con fotografías reales y corrección de diseño",
        "Carga masiva de 50 artículos con especificaciones estructuradas, optimización de imágenes en assets y corrección de sobreposición de textos.",
        "Enriquecimiento del marketplace para la auditoría y operación comercial.",
        "Normal",
        "Bajo. Carga de datos iniciales en base de datos y ajustes CSS.",
        "Eliminar SKUs insertados en catalogo.",
        "Comité de cambios",
        datetime.datetime(2026, 11, 10),
        "10/11/2026 09:30 a 11:00",
        "Cristopher San Juan y Carlos Bautista",
        "Cerrado",
        "Exitoso",
        "INC-0010",
        "public/assets/productos/ y database.js"
    ),
    (
        "RFC-0010",
        datetime.datetime(2026, 11, 10),
        "Oficial de Seguridad (CISO)",
        "Autenticación y Notificaciones",
        "Integración de Segundo Factor de Autenticación (2FA) por Correo Electrónico con Nodemailer",
        "Generación de códigos OTP de 6 dígitos por email para registro y login vía transporte seguro SMTP TLS.",
        "Fortalecimiento de la autenticación conforme a ISO/IEC 27001 y OWASP ASVS v4.0.",
        "Normal",
        "Medio. Agrega paso obligatorio de verificación OTP en flujos de login y registro.",
        "Desactivar bandera ENABLE_MFA en configuración de entorno.",
        "Comité de cambios",
        datetime.datetime(2026, 11, 10),
        "10/11/2026 11:00 a 12:30",
        "Diego Alarcón",
        "Cerrado",
        "Exitoso",
        "VUL-0007",
        "src/services/emailService.js y tabla mfa_email_codes"
    ),
    (
        "RFC-0011",
        datetime.datetime(2026, 11, 10),
        "Seguridad y QA",
        "Sesiones y Control de Inactividad",
        "Implementación de Advertencia de Inactividad (5 min) y Cierre Automático de Sesión",
        "Modal '¿Sigues ahí?' a los 5 minutos con cuenta regresiva de 2 minutos para revocar sesión y limpiar storage.",
        "Mitigación de riesgo de sesión desatendida y secuestro de sesión (OWASP ASVS).",
        "Normal",
        "Bajo. Mejora la postura de seguridad del cliente.",
        "Desactivar temporizador de inactividad en public/app.js.",
        "Comité de cambios",
        datetime.datetime(2026, 11, 10),
        "10/11/2026 12:00 a 13:00",
        "Diego Alarcón",
        "Cerrado",
        "Exitoso",
        "INC-0011 / PRB-0008",
        "Temporizador en public/app.js"
    ),
    (
        "RFC-0012",
        datetime.datetime(2026, 11, 10),
        "Administración y Finanzas",
        "Herramientas Administrativas",
        "Creación del Panel Administrativo y Financiero en Python Tkinter y Rediseño Formal del Panel de Seguridad",
        "Desarrollo de scripts/admin_panel.py para consulta de caja, gestión de usuarios/roles y reporte de ventas. Eliminación de emojis en scripts/security_panel.py.",
        "Proveer herramientas operativas standalone para administradores y auditores.",
        "Normal",
        "Bajo. Aplicación independiente que no afecta el core web.",
        "Retirar scripts standalone.",
        "Comité de cambios",
        datetime.datetime(2026, 11, 10),
        "10/11/2026 13:00 a 14:00",
        "Diego Alarcón",
        "Cerrado",
        "Exitoso",
        "Requerimiento Operativo y Auditoría",
        "scripts/admin_panel.py y run_admin_panel.sh"
    ),
    (
        "RFC-0013",
        datetime.datetime(2026, 11, 10),
        "UX y Producto",
        "Frontend / Navegación",
        "Eliminación de etiquetas técnicas, adición de pestaña Favoritos e ícono de notificaciones",
        "Retiro de siglas técnicas visibles en UI, adición de pestaña de Favoritos y badge de notificaciones en barra superior.",
        "Simplificar la interfaz para compradores sin comprometer controles normativos de fondo.",
        "Normal",
        "Bajo. Cambios exclusivamente cosméticos y de navegación.",
        "Restaurar versión previa de index.html y app.js.",
        "Comité de cambios",
        datetime.datetime(2026, 11, 10),
        "10/11/2026 14:00 a 14:30",
        "Cristopher San Juan",
        "Cerrado",
        "Exitoso",
        "Requerimiento UX",
        "public/index.html y public/app.js"
    ),
    (
        "RFC-0014",
        datetime.datetime(2026, 11, 10),
        "Auditor Líder y Equipo Técnico",
        "Gestión Documental y Arquitectura",
        "Formalización del Diccionario de Datos (16 Tablas), ERD y Diagramas de Arquitectura (ECTA-DEV-01)",
        "Generación e integración del expediente maestro de datos y 8 diagramas de alta resolución en Markdown y Word (.docx), junto con el guion oficial de defensa de auditoría.",
        "Cumplimiento de los criterios DEV-01 a DEV-10 de CL-03 y cierre de auditoría ECTA-01.",
        "Normal",
        "Alto documental / Cero operacional. Provee soporte probatorio integral.",
        "N/A (Documentación aditiva).",
        "Comité de cambios",
        datetime.datetime(2026, 11, 10),
        "10/11/2026 14:30 a 15:30",
        "Diego Alarcón y Carlos Bautista",
        "Cerrado",
        "Exitoso",
        "Hallazgo H-02 / Requerimiento ECTA-01",
        "docs/DICCIONARIO_DE_DATOS_Y_DIAGRAMAS_DESARROLLO.docx y GUIA_DEMOSTRACION_AUDITORIA_HOY.md"
    ),
    (
        "RFC-0015",
        datetime.datetime(2026, 11, 10),
        "Seguridad y Soporte Técnico",
        "Autenticación y Configuración",
        "Módulo Universal de Carga de Variables de Entorno y Transporte SMTP Resiliente",
        "Incorporación de loadEnv.js con resolución multicamino (.env), envoltura reactiva de Nodemailer con recreación de plugins bajo demanda, homologación de base de datos a expressmart.sqlite y canal de rescate de códigos 2FA en bitácora.",
        "Garantizar disponibilidad 100% del servicio 2FA sin importar el comando o subdirectorio utilizado para arrancar el servidor.",
        "Normal",
        "Bajo. Mejoras de confiabilidad en la capa de configuración y servicio SMTP sin alteración de contratos API.",
        "git revert f50250e",
        "Comité de cambios",
        datetime.datetime(2026, 11, 10),
        "10/11/2026 17:00 a 17:15",
        "Diego Alarcón",
        "Cerrado",
        "Exitoso",
        "INC-0012 / PRB-0009",
        "src/config/loadEnv.js, src/services/emailService.js y commit f50250e"
    ),
    (
        "RFC-0016",
        datetime.datetime(2026, 11, 10),
        "Auditoría UX y Clientes",
        "Frontend / Notificaciones y Perfil",
        "Optimización del botón de cerrar en notificaciones y sincronización de favoritos en perfil",
        "Reemplazo del color blanco por azul corporativo #1d4e9a con borde y hover en el botón de cerrar de notificaciones, botón 'Cerrar' adicional en el pie del diálogo y conexión reactiva de favoritos con el perfil.",
        "Garantizar la visibilidad y accesibilidad del botón de cierre en modales claros y mantener consistencia total en los artículos favoritos del usuario.",
        "Normal",
        "Bajo. Cambios visuales de accesibilidad WCAG y reactividad en cliente.",
        "git revert 17031f2",
        "Comité de cambios",
        datetime.datetime(2026, 11, 10),
        "10/11/2026 17:35 a 17:45",
        "Cristopher San Juan y Diego Alarcón",
        "Cerrado",
        "Exitoso",
        "Requerimiento UX",
        "public/index.html, public/app.js, public/styles.css y commit 17031f2"
    ),
    (
        "RFC-0017",
        datetime.datetime(2026, 11, 10),
        "Operaciones, Seguridad y Finanzas",
        "Paneles Standalone (Admin y Seguridad) y Checkout",
        "Gestión de Tarjetas Simuladas con Descuento de Saldo, Modificación Integral de Cuentas y Pruebas Automatizadas",
        "Incorporación de módulo de gestión y recarga de tarjetas simuladas con deducción automática en checkout, diálogo de edición completa de cuentas de usuario con recifrado AES-256-GCM y ejecución de pruebas automatizadas/QA en tiempo real en panel de seguridad.",
        "Permitir la simulación realista y controlada de compras con verificación de saldo y rechazo por fondos insuficientes, facilitar la administración de cuentas y facultar al equipo de seguridad para ejecutar suites de pruebas en vivo.",
        "Normal",
        "Medio. Agrega tabla tarjetas_simuladas, deducción en checkout/suscripción, endpoint PUT /api/admin/users/:id y subprocesos asíncronos en GUI.",
        "Revertir commits de tarjetas_simuladas y restaurar versiones previas de admin_panel.py y security_panel.py.",
        "Comité de cambios",
        datetime.datetime(2026, 11, 10),
        "10/11/2026 18:00 a 18:40",
        "Diego Alarcón y Carlos Bautista",
        "Cerrado",
        "Exitoso",
        "Requerimiento Operativo y Auditoría (Simulación Transaccional y QA)",
        "src/db/database.js, src/app.js, scripts/admin_panel.py, scripts/security_panel.py, tests/integration.test.js (CP-RF-13 y CP-RF-14)"
    ),
    (
        "RFC-0018",
        datetime.datetime(2026, 11, 10),
        "Auditoría y Operaciones",
        "Panel Administrativo y Cuentas de Usuario",
        "Eliminación de Cuentas (Admin y Autogestión LFPDPPP) y Gestión de Peticiones de Reembolso (LFPC)",
        "Implementación de eliminación de cuentas con borrado en cascada y protección de superadmin en panel administrativo y perfil web. Pestaña de gestión de reembolsos con aprobación/denegación, reintegro de stock y abono a tarjetas simuladas.",
        "Garantizar el ejercicio pleno del derecho de cancelación bajo la LFPDPPP y proveer un flujo auditable de resolución de reembolsos bajo la LFPC y SGC MC-001.",
        "Normal",
        "Medio. Afecta integridad referencial de usuarios y flujos financieros de devolución.",
        "git revert y respaldos de base de datos sqlite.",
        "Comité de cambios",
        datetime.datetime(2026, 11, 10),
        "10/11/2026 19:00 a 19:40",
        "Diego Alarcón y Cristopher San Juan",
        "Cerrado",
        "Exitoso",
        "Requerimiento Operativo y Legal (LFPDPPP y LFPC)",
        "src/db/database.js, src/app.js, public/index.html, public/app.js, scripts/admin_panel.py, tests/integration.test.js (CP-RF-15 y CP-RF-16)"
    )
]

NUEVAS_VULNERABILIDADES = [
    (
        "VUL-0007",
        datetime.datetime(2026, 11, 9),
        "Auditoría de Ciberseguridad (ISO/IEC 27001)",
        "Autenticación y Registro",
        "CWE-287 / OWASP A07:2021",
        "Riesgo de acceso indebido o robo de credenciales por autenticación de un solo factor (contraseña).",
        "Alta",
        "1.0.0",
        "2.0.0",
        "Integración obligatoria de 2FA fuera de banda por correo electrónico (Nodemailer) con tokens OTP de 6 dígitos con caducidad de 5 minutos.",
        "Diego Alarcón",
        datetime.datetime(2026, 11, 10),
        datetime.datetime(2026, 11, 10),
        "Remediada",
        "RFC-0010",
        "src/services/emailService.js y tabla mfa_email_codes"
    ),
    (
        "VUL-0008",
        datetime.datetime(2026, 11, 10),
        "Análisis de Sesiones y OWASP ASVS v4.0",
        "Gestión de Sesiones (Módulo Cuentas)",
        "CWE-613 / OWASP A01:2021",
        "Riesgo de sesión desatendida abierta indefinidamente en navegadores de compradores compartidos.",
        "Media",
        "1.0.0",
        "2.0.0",
        "Implementación de monitor de inactividad a 5 minutos con modal interactivo y cierre automático a los 2 minutos sin respuesta.",
        "Diego Alarcón",
        datetime.datetime(2026, 11, 10),
        datetime.datetime(2026, 11, 10),
        "Remediada",
        "RFC-0011",
        "Temporizador en public/app.js y revocación en base de datos"
    )
]

def update_excel():
    print(f"Cargando libro Excel desde: {SRC_XLSX}")
    wb = openpyxl.load_workbook(SRC_XLSX)

    # 1. Actualizar Incidentes
    ws_inc = wb['Incidentes']
    start_row_inc = 12
    for idx, inc in enumerate(NUEVOS_INCIDENTES):
        row = start_row_inc + idx
        ws_inc.cell(row=row, column=1, value=inc[0])
        ws_inc.cell(row=row, column=2, value=inc[1])
        ws_inc.cell(row=row, column=3, value=inc[2])
        ws_inc.cell(row=row, column=4, value=inc[3])
        ws_inc.cell(row=row, column=5, value=inc[4])
        ws_inc.cell(row=row, column=6, value=inc[5])
        ws_inc.cell(row=row, column=7, value=inc[6])
        ws_inc.cell(row=row, column=8, value=inc[7])
        ws_inc.cell(row=row, column=9, value=inc[8])
        ws_inc.cell(row=row, column=10, value=inc[9])
        ws_inc.cell(row=row, column=11, value=inc[10])
        # Columnas 12, 13, 14 son fórmulas pre-cargadas
        ws_inc.cell(row=row, column=15, value=inc[11])
        ws_inc.cell(row=row, column=16, value=inc[12])
        ws_inc.cell(row=row, column=17, value=inc[13])
        ws_inc.cell(row=row, column=18, value=inc[14])
        print(f"  [Incidentes] Fila {row} actualizada: {inc[0]}")

    # 2. Actualizar Problemas
    ws_prb = wb['Problemas']
    start_row_prb = 10
    for idx, prb in enumerate(NUEVOS_PROBLEMAS):
        row = start_row_prb + idx
        for col_idx, val in enumerate(prb, start=1):
            ws_prb.cell(row=row, column=col_idx, value=val)
        print(f"  [Problemas] Fila {row} actualizada: {prb[0]}")

    # 3. Actualizar Cambios Operativos
    ws_rfc = wb['Cambios operativos']
    start_row_rfc = 11
    for idx, rfc in enumerate(NUEVOS_CAMBIOS):
        row = start_row_rfc + idx
        for col_idx, val in enumerate(rfc, start=1):
            ws_rfc.cell(row=row, column=col_idx, value=val)
        print(f"  [Cambios] Fila {row} actualizada: {rfc[0]}")

    # 4. Actualizar Vulnerabilidades
    ws_vul = wb['Vulnerabilidades']
    start_row_vul = 11
    for idx, vul in enumerate(NUEVAS_VULNERABILIDADES):
        row = start_row_vul + idx
        # vul tiene 16 elementos; en la hoja columna 14 es fórmula de días abierta
        # mapeo: col 1..13 son vul[0..12], col 15..17 son vul[13..15]
        for col_idx in range(1, 14):
            ws_vul.cell(row=row, column=col_idx, value=vul[col_idx - 1])
        # col 14 es fórmula pre-cargada
        for col_idx in range(15, 18):
            ws_vul.cell(row=row, column=col_idx, value=vul[col_idx - 2])
        print(f"  [Vulnerabilidades] Fila {row} actualizada: {vul[0]}")

    # Guardar en pauditoria y en respaldo
    wb.save(DEST_XLSX)
    print(f"[OK] Libro Excel guardado en workspace: {DEST_XLSX}")
    wb.save(DEST_XLSX_RESPALDO)
    print(f"[OK] Libro Excel guardado en respaldo: {DEST_XLSX_RESPALDO}")


def generate_operational_records_markdown():
    lines = []
    lines.append("# REGISTROS OPERATIVOS DEL SISTEMA DE GESTIÓN DE CALIDAD")
    lines.append("## ExpressMart Marketplace México — Apartado 37 del Manual de Calidad MC-001")
    lines.append("")
    lines.append("| Metadato de Registro | Especificación Operativa |")
    lines.append("| :--- | :--- |")
    lines.append("| **Código Documental** | `REG-OP-MC001` (Alimenta el Apartado 38 del Manual de Calidad) |")
    lines.append("| **Archivo Primario Excel** | [`Registros-Operativos-ExpressMart.xlsx`](../Registros-Operativos-ExpressMart.xlsx) |")
    lines.append("| **Fecha de Actualización** | 10 de Noviembre de 2026 (Auditoría Integral Producción) |")
    lines.append("| **Alcance de Procesos** | Gestión de Incidentes, Análisis de Problemas (5 Porqués), Cambios Operativos (CAB) y Mantenimiento de Vulnerabilidades |")
    lines.append("| **Estado de Eficacia** | **100% CERRADOS Y REMEDIADOS** (0 incidentes abiertos, 0 problemas pendientes, 0 vulnerabilidades abiertas) |")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Tablero de Indicadores
    lines.append("## 1. Tablero Consolidado de Indicadores Operativos (KPIs)")
    lines.append("")
    lines.append("| Proceso Operativo | Métrica / Indicador | Valor Consolidado | Objetivo de Calidad | Estado |")
    lines.append("| :--- | :--- | :---: | :---: | :---: |")
    lines.append("| **Gestión de Incidentes** | Total de Incidentes Registrados (`INC-0001` a `INC-0012`) | **12** | Registro al 100% | **CONFORME** |")
    lines.append("| | Incidentes Críticos / Altos | **5** | MTTR < 4 horas | **CONFORME** |")
    lines.append("| | Incidentes Abiertos | **0** | Cero pendientes | **100% CERRADOS** |")
    lines.append("| | Cumplimiento del Tiempo Objetivo (SLA) | **100%** | >= 95% dentro de SLA | **SUPERADO** |")
    lines.append("| **Gestión de Problemas** | Total de Problemas Registrados (`PRB-0001` a `PRB-0009`) | **9** | Análisis 5 Porqués | **CONFORME** |")
    lines.append("| | Problemas con Causa Raíz Identificada | **9 de 9 (100%)** | 100% analizados | **CONFORME** |")
    lines.append("| | Problemas Abiertos | **0** | Cero problemas abiertos | **100% CERRADOS** |")
    lines.append("| **Gestión de Cambios** | Total de RFCs Solicitados (`RFC-0001` a `RFC-0017`) | **17** | Aprobación CAB formal | **CONFORME** |")
    lines.append("| | Cambios de Emergencia | **1** (`RFC-0001`) | < 15% del total | **CONFORME (5.9%)** |")
    lines.append("| | Cambios Exitosos sin Rollback | **17 de 17 (100%)** | >= 98% éxito | **SUPERADO** |")
    lines.append("| **Vulnerabilidades** | Total de Vulnerabilidades Gestionadas (`VUL-0001` a `VUL-0008`) | **8** | Remediación verificada | **CONFORME** |")
    lines.append("| | Vulnerabilidades Críticas o Altas Abiertas | **0** | **Cero toleradas** | **100% REMEDIADAS** |")
    lines.append("| | Días Promedio hasta la Remediación | **1.1 días** | <= 5 días hábiles | **SUPERADO** |")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Tabla 1: Incidentes
    lines.append("## 2. Registro Maestro de Incidentes (`INC-0001` a `INC-0012`)")
    lines.append("")
    lines.append("| ID | Fecha Detección | Servicio / Módulo | Título del Incidente | Severidad | Prioridad | Asignado | Estado | Solución Aplicada | RFC Derivado |")
    lines.append("| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :---: | :--- | :--- |")
    inc_list = [
        ("INC-0001", "18/09/2026 14:28", "Carrito y checkout", "Error 502 recurrente en confirmación de pago", "Crítica", "P1", "Carlos Bautista", "Cerrado", "Reinicio de pool y ajuste de timeout a 30s con 3 reintentos.", "RFC-0001"),
        ("INC-0002", "24/10/2026 11:20", "Pedidos y Checkout", "Fuga de datos de dirección en checkout entre sesiones", "Alta", "P2", "Cristopher San Juan", "Cerrado", "Limpieza inmediata de campos y purga de estado en logout.", "RFC-0002"),
        ("INC-0003", "25/10/2026 09:40", "Pedidos y Clientes", "Fuga de historial de pedidos entre usuarios distintos", "Alta", "P1", "Carlos Bautista", "Cerrado", "Filtrado estricto WHERE p.usuario_id = req.user.id en API.", "RFC-0002"),
        ("INC-0004", "26/10/2026 15:10", "Catálogo e Inventario", "Botón 'Panel de Vendedor' oculto para rol vendedor", "Media", "P2", "Cristopher San Juan", "Cerrado", "Habilitación de control RBAC en switchTab para rol vendedor.", "RFC-0003"),
        ("INC-0005", "27/10/2026 10:00", "Carrito y Sesiones", "Retención de carrito y adición sin autenticación", "Media", "P2", "Cristopher San Juan", "Cerrado", "Aislamiento de carrito por usuario y validación obligatoria.", "RFC-0002"),
        ("INC-0006", "28/10/2026 12:30", "Catálogo de Productos", "Imágenes rotas (error 404) en productos del catálogo", "Baja", "P3", "Cristopher San Juan", "Cerrado", "Sustitución por imágenes verificadas en alta resolución.", "RFC-0006"),
        ("INC-0007", "29/10/2026 08:30", "Interfaz de Usuario (UI/UX)", "Discrepancia cromática entre app y logo oficial", "Baja", "P4", "Cristopher San Juan", "Cerrado", "Homologación con azul corporativo #1d4e9a, #123580 y #0c1e3d.", "RFC-0005"),
        ("INC-0008", "09/11/2026 18:30", "Cuentas y Privacidad", "Exposición visual de pestañas de cuenta sin sesión", "Media", "P2", "Cristopher San Juan", "Cerrado", "Forzado de display: none en #tab-cuenta si no hay usuario activo.", "RFC-0007"),
        ("INC-0009", "09/11/2026 21:00", "Membresías y Checkout", "Falta de membresía Prime con flete gratis y cashback", "Media", "P2", "Carlos Bautista", "Cerrado", "Tabla suscripciones_premium y bonificación automática de envío.", "RFC-0008"),
        ("INC-0010", "10/11/2026 09:15", "Dashboard Principal", "Sobreposición de texto y espacio vacío junto a Prime", "Baja", "P3", "Cristopher San Juan", "Cerrado", "Ajuste de CSS Grid/Flexbox y balance visual del banner Prime.", "RFC-0009"),
        ("INC-0011", "10/11/2026 11:30", "Sesiones y Checkout", "Error de sesión expirada sin aviso previo al comprar", "Alta", "P2", "Diego Alarcón", "Cerrado", "Monitor de inactividad a 5 min con modal '¿Sigues ahí?'.", "RFC-0011"),
        ("INC-0012", "10/11/2026 16:50", "Autenticación 2FA", "Error de credenciales SMTP vacías (Missing credentials for PLAIN)", "Alta", "P2", "Diego Alarcón", "Cerrado", "Módulo universal loadEnv.js, transporte dinámico en Nodemailer y homologación DB.", "RFC-0015")
    ]
    for inc in inc_list:
        lines.append(f"| `{inc[0]}` | {inc[1]} | {inc[2]} | {inc[3]} | **{inc[4]}** | {inc[5]} | {inc[6]} | **{inc[7]}** | {inc[8]} | `{inc[9]}` |")

    lines.append("")
    lines.append("---")
    lines.append("")

    # Tabla 2: Problemas
    lines.append("## 3. Registro de Problemas y Análisis de Causa Raíz (`PRB-0001` a `PRB-0009`)")
    lines.append("")
    lines.append("| ID | Apertura | Servicio / Módulo | Título del Problema | Causa Raíz Identificada (5 Porqués) | Acción Preventiva | Responsable | Estado |")
    lines.append("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |")
    prb_list = [
        ("PRB-0001", "18/09/2026", "Carrito y checkout", "Error 502 intermitente en checkout", "El cliente HTTP carecía de timeout explícito y no liberaba sockets ante fallas de pasarela.", "Implementación de timeout 30s, 3 reintentos con backoff exponencial y bloque finally.", "Carlos Bautista", "Cerrado"),
        ("PRB-0002", "25/10/2026", "Pedidos y Checkout", "Fuga de datos de pedidos y direcciones en navegador", "Inadecuada gestión del ciclo de vida de sesión en cliente y consultas SQL sin cláusula WHERE obligatoria.", "Filtrado estricto en backend y función obligatoria executeLogout() que purga storage.", "Carlos Bautista", "Cerrado"),
        ("PRB-0003", "26/10/2026", "Catálogo e Inventario", "Vendedores sin acceso al formulario de productos", "Falta de contemplación del rol 'vendedor' en la función switchTab del cliente web.", "Unificación de lógica RBAC en frontend respaldada por middleware en backend.", "Cristopher San Juan", "Cerrado"),
        ("PRB-0004", "26/10/2026", "Seguridad y Auditoría", "Dificultad de inspección de seguridad en producción", "Ausencia de herramientas gráficas locales para visualización de puertos y firmas SHA-256.", "Desarrollo de panel GUI en Python para monitoreo de puertos, WAF y bitácora criptográfica.", "Diego Alarcón", "Cerrado"),
        ("PRB-0005", "29/10/2026", "Interfaz UI/UX", "Inconsistencias estéticas y catálogo desactualizado", "Adopción de plantilla genérica sin alineación al manual de marca del logotipo oficial.", "Homologación con azul corporativo y catálogo extendido con zoom óptico interactivo.", "Cristopher San Juan", "Cerrado"),
        ("PRB-0006", "09/11/2026", "Cuentas y Privacidad", "Persistencia visual de componentes privados sin sesión", "Ausencia de rutina centralizada de saneamiento y ocultamiento de pestañas privadas en logout.", "Centralización de resetUIState() y forzado de display:none en elementos desautenticados.", "Cristopher San Juan", "Cerrado"),
        ("PRB-0007", "09/11/2026", "Modelo de Negocio", "Incompatibilidad con suscripciones y membresías Prime", "Esquema relacional rígido sin tablas de vigencia ni validación de estatus Prime en checkout.", "Extensión relacional con suscripciones_premium y bonificación modular de flete y cashback.", "Carlos Bautista", "Cerrado"),
        ("PRB-0008", "10/11/2026", "Gestión de Sesiones", "Cierre abrupto de compras por desincronización de token", "Falta de sincronización bidireccional entre la expiración del servidor (5 min) y el cliente.", "Temporizador de inactividad en frontend con advertencia interactiva y cierre limpio.", "Diego Alarcón", "Cerrado"),
        ("PRB-0009", "10/11/2026", "Gestión de Configuración", "Dependencia estricta de process.cwd() para carga de .env", "Carga de variables de entorno dependiente del directorio de ejecución; al ejecutar desde src/ no se cargaba MAIL_PASS.", "Módulo universal loadEnv.js con 6 rutas de búsqueda, symlink preventivo y transporte dinámico.", "Diego Alarcón", "Cerrado")
    ]
    for prb in prb_list:
        lines.append(f"| `{prb[0]}` | {prb[1]} | {prb[2]} | **{prb[3]}** | {prb[4]} | {prb[5]} | {prb[6]} | **{prb[7]}** |")

    lines.append("")
    lines.append("---")
    lines.append("")

    # Tabla 3: Cambios Operativos
    lines.append("## 4. Registro de Cambios Operativos — RFC (`RFC-0001` a `RFC-0018`)")
    lines.append("")
    lines.append("| ID | Fecha | Solicitante | Módulo | Título del Cambio | Justificación | Tipo | Aprobado por | Resultado |")
    lines.append("| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :---: |")
    rfc_list = [
        ("RFC-0001", "18/09/2026", "Líder de Desarrollo", "Checkout", "Timeout de 30s y 3 reintentos en pasarela", "Remediación urgente de error 502 (INC-0001)", "Emergencia", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0002", "25/10/2026", "Auditoría y QA", "Seguridad", "Aislamiento estricto de pedidos y purga en logout", "Prevención de fuga de información y cumplimiento LFPDPPP", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0003", "26/10/2026", "Ventas", "Catálogo", "Habilitación de Panel de Vendedor para rol vendedor", "Operación comercial multivendedor", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0004", "26/10/2026", "Líder Técnico", "Seguridad", "Desarrollo de panel gráfico de seguridad en Python", "Inspección de red, heurística y firmas SHA-256", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0005", "29/10/2026", "Diseño", "UI/UX", "Homologación de paleta azul corporativa oficial", "Alineación de marca con el logotipo de ExpressMart", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0006", "27/10/2026", "Producto", "Catálogo", "Ampliación del catálogo, buscador y zoom 2.3x", "Cumplimiento de objetivos comerciales Fase 2", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0007", "09/11/2026", "Auditoría y UX", "Cuentas", "Ocultamiento estricto de apartados sin sesión activa", "Protección de privacidad en interfaces desautenticadas", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0008", "09/11/2026", "Producto", "Checkout", "Membresías ExpressPrime (1m, 3m, 1a) y cashback", "Fidelización de compradores y beneficios de envío", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0009", "10/11/2026", "Ventas", "Catálogo", "Expansión a 50 productos y optimización de diseño", "Catálogo masivo enriquecido con fotos reales", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0010", "10/11/2026", "CISO", "Seguridad", "Segundo factor de autenticación 2FA Nodemailer", "Cumplimiento estricto ISO/IEC 27001 y OWASP ASVS", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0011", "10/11/2026", "Seguridad / QA", "Sesiones", "Advertencia de inactividad (5m) y cierre forzado", "Prevención de secuestro de sesión desatendida", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0012", "10/11/2026", "Finanzas", "Herramientas", "Panel Administrativo Python y rediseño formal", "Control financiero de ingresos, cuentas y ventas", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0013", "10/11/2026", "UX", "Frontend", "Retiro de tecnicismos, pestaña Favoritos e ícono", "Simplificación de experiencia visual de compra", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0014", "10/11/2026", "Auditor Líder", "Documentación", "Diccionario de Datos (16 Tablas), ERD y Guion", "Cierre de hallazgo H-02 y dictamen ECTA-DEV-01", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0015", "10/11/2026", "Soporte Técnico", "Configuración", "Carga universal de variables de entorno y transporte SMTP", "Resolución definitiva de error Missing credentials for PLAIN en 2FA", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0016", "10/11/2026", "Auditoría UX", "Notificaciones y Perfil", "Botón azul de cerrar notificaciones y reactividad de favoritos", "Mejora de accesibilidad en botón de cierre y unificación de favoritos en perfil", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0017", "10/11/2026", "Operaciones y QA", "Paneles y Checkout", "Tarjetas simuladas con descuento de saldo, edición de cuentas y pruebas QA", "Simulación transaccional controlada con deducción real, edición integral de usuarios y suite QA live", "Normal", "Comité de Cambios (CAB)", "Exitoso"),
        ("RFC-0018", "10/11/2026", "Auditoría y Operaciones", "Panel Admin y Perfil", "Eliminación de cuentas (Admin y Autogestión LFPDPPP) y Gestión de Reembolsos (LFPC)", "Borrado en cascada con salvaguarda de superadmin, pestaña de reembolsos con abono a tarjeta y reposición de stock", "Normal", "Comité de Cambios (CAB)", "Exitoso")
    ]
    for rfc in rfc_list:
        lines.append(f"| `{rfc[0]}` | {rfc[1]} | {rfc[2]} | {rfc[3]} | **{rfc[4]}** | {rfc[5]} | `{rfc[6]}` | {rfc[7]} | **{rfc[8]}** |")

    lines.append("")
    lines.append("---")
    lines.append("")

    # Tabla 4: Vulnerabilidades
    lines.append("## 5. Registro y Mantenimiento de Vulnerabilidades (`VUL-0001` a `VUL-0008`)")
    lines.append("")
    lines.append("| ID | Fecha | Origen Detección | Componente | Identificador (CWE/CVE) | Severidad | Versión Corregida | Acción de Remediación | Estado |")
    lines.append("| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- | :---: |")
    vul_list = [
        ("VUL-0001", "18/09/2026", "SCA (npm audit)", "Dependencias backend", "CVE-2024-XXXX", "Alta", "1.0.0", "Actualización de dependencias y políticas de zero-vulnerability.", "Remediada"),
        ("VUL-0002", "24/10/2026", "SAST (Revisión Código)", "API Pedidos", "CWE-639 / IDOR", "Alta", "1.0.0", "Filtrado estricto por usuario en controlador de pedidos.", "Remediada"),
        ("VUL-0003", "25/10/2026", "DAST (Penetration Test)", "Navegador Web", "CWE-200 / Fuga Datos", "Media", "1.0.0", "Purga completa de storage y variables en executeLogout().", "Remediada"),
        ("VUL-0004", "26/10/2026", "OWASP ASVS v4.0", "API Gateway", "CWE-79 / CWE-89 (XSS/SQLi)", "Crítica", "1.0.0", "Sanitización estricta y consultas parametrizadas en SQLite.", "Remediada"),
        ("VUL-0005", "27/10/2026", "Auditoría Autenticación", "Control de Acceso", "CWE-307 / Fuerza Bruta", "Media", "1.0.0", "Bloqueo por intentos fallidos consecutivos y Rate Limiting.", "Remediada"),
        ("VUL-0006", "21/10/2026", "Evaluación ISO 25012", "Bitácora D8", "CWE-353 / Integridad", "Alta", "1.0.0", "Encadenamiento criptográfico con hashes SHA-256 no repudiable.", "Remediada"),
        ("VUL-0007", "09/11/2026", "Ciberseguridad ISO 27001", "Autenticación", "CWE-287 / OWASP A07", "Alta", "2.0.0", "Doble factor 2FA por correo electrónico Nodemailer con OTP 6 dígitos.", "Remediada"),
        ("VUL-0008", "10/11/2026", "Análisis de Sesión", "Módulo Sesiones", "CWE-613 / OWASP A01", "Media", "2.0.0", "Temporizador de inactividad a 5 min y cierre forzado en servidor.", "Remediada")
    ]
    for vul in vul_list:
        lines.append(f"| `{vul[0]}` | {vul[1]} | {vul[2]} | {vul[3]} | `{vul[4]}` | **{vul[5]}** | `{vul[6]}` | {vul[7]} | **{vul[8]}** |")

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 6. Dictamen de Eficacia Operativa y Mejora Continua")
    lines.append("Habiéndose analizado el 100% de los incidentes, derivado los problemas mediante la metodología de los 5 Porqués, ejecutado los 18 cambios operativos bajo aprobación del Comité de Cambios (CAB) y remediado la totalidad de las 8 vulnerabilidades detectadas sin defectos abiertos:")
    lines.append("")
    lines.append("> **DICTAMEN OPERATIVO:** CONFORME AL 100%. La operación del sistema ExpressMart México cumple con los estándares ISO 9001:2015 (Apartado 37 y 38), ISO/IEC 27001:2022 y PCI DSS v4.0. Se autoriza la incorporación de estos registros al expediente final de auditoría.")
    lines.append("")

    return "\n".join(lines)


if __name__ == '__main__':
    print("Actualizando libro de registros operativos Excel...")
    update_excel()
    print("Generando documento Markdown de registros operativos...")
    md_content = generate_operational_records_markdown()
    with open(MD_OUT, 'w', encoding='utf-8') as f:
        f.write(md_content)
    print(f"[OK] Documento Markdown generado: {MD_OUT}")
    if os.path.exists(ARTIFACT_DIR):
        with open(ARTIFACT_MD, 'w', encoding='utf-8') as f:
            f.write(md_content)
        print(f"[OK] Artefacto Markdown copiado: {ARTIFACT_MD}")
    print("Proceso completado exitosamente.")

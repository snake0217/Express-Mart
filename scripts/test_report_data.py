#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Datos estructurados y verificados para el Reporte Word de Casos de Prueba (RF-01 a RF-10)
y Auditoría de Reportes por Requisito No Funcional (RNF-01 a RNF-11).
ExpressMart México - SGC MC-001 v1.0 / Plan de Auditoría ECTA-01.
"""

METADATA = {
    "codigo": "QA-INF-RF-RNF-2026",
    "version": "1.0",
    "fecha": "11 de Noviembre de 2026",
    "empresa": "TiendaExpress Online, S.A. de C.V. (ExpressMart)",
    "normas": "SGC MC-001 v1.0 · ECTA-01 · ISO/IEC 25010 · ISO/IEC 25012 · ISO/IEC 27001 · PCI DSS v4.0 · LFPDPPP · LFPC · WCAG 2.2 AA · ISO 22301",
    "comando_pruebas": "npm test (node --experimental-vm-modules node_modules/.bin/jest --coverage --runInBand)",
    "comando_sast": "npm run lint (node scripts/static-analysis.js)",
    "comando_audit": "npm run audit:verify (node scripts/audit-verifier.js)",
}

EXECUTION_KPIS = [
    ("Suites de Prueba Jest", "4 / 4 PASARON (100%)", "tests/rf-casos-prueba, integration, security, unit", "CONFORME"),
    ("Casos Ejecutados Totales", "61 / 61 APROBADOS", "21 casos RF dedicados + 19 integración + 8 seguridad + 13 unitarios", "APROBADO"),
    ("Tiempo Total de Ejecución", "8.127 segundos", "Ejecución secuencial en memoria SQLite (--runInBand)", "OPTIMO"),
    ("Cobertura Global de Código", "90.35% Stmts / 91.41% Lines", "71.49% Branches / 96.71% Funcs (Meta RNF-04 >= 80%)", "SUPERADO"),
    ("Análisis Estático SAST", "0 hallazgos (40 archivos)", "scripts/static-analysis.js (PASSED)", "CONFORME"),
    ("Auditoría ECTA-01 MC-001", "43 / 43 puntos (100%)", "30 / 30 archivos base verificados (audit-verifier.js)", "CONFORME"),
]

SUITES_SUMMARY = [
    ("tests/rf-casos-prueba.test.js", "Casos Trazables RF-01 a RF-10 (Positivos y Negativos)", "21", "21 / 21 PASSED", "Casos dedicados por cada RF y módulos recientes"),
    ("tests/integration.test.js", "Integración End-to-End (CP-RF-01..17 y RNF-05)", "19", "19 / 19 PASSED", "Flujos E2E, 2FA, PayPal, ExpressPrime, Reembolsos, OSM"),
    ("tests/security.test.js", "Seguridad OWASP ASVS / Top 10 / PCI DSS (SEG-01..18)", "8", "8 / 8 PASSED", "Fuerza bruta 423, RBAC 403, SQLi/XSS 400, SHA-256, TTL"),
    ("tests/unit.test.js", "Pruebas Unitarias (Cripto, Sanitización, Pagos, Logística, Vendedor)", "13", "13 / 13 PASSED", "AES-256-GCM, scrypt, TOTP, PCI tok, Nodemailer, Seller"),
    ("TOTAL CONSOLIDADO", "Suite Automatizada Completa ExpressMart", "61", "61 / 61 PASSED", "0 fallos, 0 pruebas omitidas (skipped)"),
]

COVERAGE_BY_MODULE = [
    ("Global (All files)", "90.35%", "71.49%", "96.71%", "91.41%", "Cumple umbral 85/70/90/85"),
    ("src/app.js", "100.00%", "100.00%", "100.00%", "100.00%", "—"),
    ("src/config/ (env.js, loadEnv.js)", "89.09%", "77.65%", "100.00%", "90.56%", "env: 68,73-75; loadEnv: 48"),
    ("src/db/ (database, schema, seed*)", "93.28%", "70.00%", "100.00%", "93.19%", "schema: 336,366"),
    ("src/middleware/security.js", "92.22%", "73.97%", "100.00%", "94.18%", "96-97,106,232,257"),
    ("src/routes/cartCalculator.js", "100.00%", "92.00%", "100.00%", "100.00%", "10,28"),
    ("src/routes/catalogRoutes.js", "93.39%", "76.47%", "100.00%", "93.33%", "142,145,210,213"),
    ("src/routes/checkoutRoutes.js", "90.28%", "75.17%", "100.00%", "90.61%", "698,703-705"),
    ("src/routes/logisticsRoutes.js", "90.75%", "63.02%", "94.44%", "94.73%", "551,682-683"),
    ("src/routes/orderRoutes.js", "90.41%", "56.70%", "100.00%", "91.03%", "393-395,406,409"),
    ("src/routes/authRoutes.js", "85.96%", "67.54%", "100.00%", "85.96%", "757,770,786"),
    ("src/routes/sellerRoutes.js", "83.83%", "64.44%", "100.00%", "84.04%", "296,307,318"),
    ("src/routes/adminRoutes.js", "82.63%", "67.07%", "92.85%", "83.63%", "483-487,506-508"),
    ("src/services/externalProviders.js", "98.11%", "80.85%", "100.00%", "98.11%", "76"),
    ("src/services/logisticsService.js", "95.26%", "72.50%", "100.00%", "96.00%", "396,400,429"),
    ("src/services/emailService.js", "92.30%", "81.57%", "50.00%", "92.30%", "45-51"),
    ("src/utils/crypto.js", "98.63%", "85.71%", "100.00%", "100.00%", "139-164,184"),
    ("src/utils/sanitizer.js", "78.57%", "77.08%", "100.00%", "87.50%", "17,50-53,61"),
]

RF_GROUPS = [
    {
        "id": "RF-01",
        "nombre": "Autenticación de clientes",
        "prioridad": "Must Have",
        "proceso_dfd": "Proceso 1 · Almacén D1 Usuarios / derechos_arco",
        "descripcion": "Registro de usuarios, inicio de sesión, gestión de perfiles cifrados AES-256-GCM, 2FA por correo, derechos ARCO y autogestión de eliminación (LFPDPPP).",
        "archivos": "src/routes/authRoutes.js, src/routes/adminRoutes.js, src/utils/crypto.js",
        "casos": [
            (
                "RF-01-CP01",
                "Positivo (Alta, Cifrado AES-256-GCM, Perfil y ARCO)",
                "Base de datos SQLite inicializada; endpoint público /api/auth/register.",
                "1. POST /api/auth/register con consentimientoPrivacidad=true.\n2. Consultar usuarios en D1.\n3. PUT /api/auth/profile con dirección y coordenadas lat/lng.\n4. GET /api/auth/profile, POST /api/auth/keep-alive y POST /api/privacy/arco.",
                "HTTP 201 con token; direccion_cifrada y telefono_cifrado con prefijo enc:v1:; perfil descifrado íntegro; folio ARCO-* emitido.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "RF-01-CP02",
                "Negativo y Autogestión LFPDPPP",
                "Usuario registrado y sesión activa Bearer.",
                "1. POST /api/auth/register con consentimientoPrivacidad=false.\n2. POST /api/auth/register con password='123'.\n3. POST /api/auth/register con correo repetido.\n4. DELETE /api/users/me y posterior GET /api/auth/profile.",
                "HTTP 400 sin consentimiento y contraseña débil; HTTP 409 correo duplicado; HTTP 200 al eliminar cuenta propia y HTTP 401 tras revocación.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "CP-RF-01 / CP-RF-12(2FA) / CP-RF-14 / CP-RF-15",
                "Cobertura Complementaria E2E",
                "Suites integration.test.js y security.test.js.",
                "Registro con fotoPerfil Base64, flujo OTP por correo 2FA con reenvío, modificación integral de cuentas por Admin y bloqueo fuerza bruta (423 Locked) + TTL (401).",
                "100% validado sin fugas de sesión ni almacenamiento de contraseñas o PII en texto claro.",
                "PASÓ (integration / security.test.js)"
            ),
        ],
    },
    {
        "id": "RF-02",
        "nombre": "Acceso administrativo y RBAC con MFA",
        "prioridad": "Must Have",
        "proceso_dfd": "Proceso 1 · Almacenes D1 Usuarios y D8 Bitácora",
        "descripcion": "Acceso seguro para administrador y vendedor mediante Autenticación Multifactor (MFA TOTP / correo) y Control de Acceso Basado en Roles (RBAC) en los 5 roles.",
        "archivos": "src/middleware/security.js, src/routes/authRoutes.js, src/utils/crypto.js",
        "casos": [
            (
                "RF-02-CP01",
                "Positivo (Login MFA Admin/Vendedor y Roles Auditor/Soporte)",
                "Cuentas semilla admin@expressmart.mx, vendedor@expressmart.mx, soporte@expressmart.mx, auditor@expressmart.mx.",
                "1. POST /api/auth/login (admin/vendedor) -> obtener mfaRequired=true y demoHintCode.\n2. Reenviar POST /api/auth/login con mfaCode válido.\n3. Verificar rol en GET /api/auth/profile y login de soporte/auditor.",
                "HTTP 200 con mfaRequired=true en paso 1; emisión de token MFA en paso 2; roles administrador, vendedor, soporte y auditor validados.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "RF-02-CP02",
                "Negativo / Seguridad RBAC",
                "Token válido de comprador (rol cliente) y credenciales admin.",
                "1. POST /api/auth/login admin con mfaCode='999999'.\n2. GET /api/audit-logs con token de cliente.\n3. PUT /api/admin/users/:id con token de cliente.\n4. DELETE /api/admin/users/1 como administrador.",
                "HTTP 401 ante MFA inválido; HTTP 403 Forbidden en intentos de escalamiento de cliente; HTTP 400 protegiendo Superadmin ID 1.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "CP-RF-02 / SEG-02 / Prueba #4",
                "Cobertura Complementaria E2E y Unitaria",
                "Suites integration, security y unit.",
                "Verificación matemática TOTP 6 dígitos y bloqueo de operaciones de catálogo/auditoría para roles no autorizados.",
                "Control RBAC + MFA 100% operativo en API y paneles.",
                "PASÓ (integration / security / unit)"
            ),
        ],
    },
    {
        "id": "RF-03",
        "nombre": "Catálogo y Búsqueda (< 2 segundos)",
        "prioridad": "Must Have",
        "proceso_dfd": "Proceso 2 · Almacén D2 Catálogo",
        "descripcion": "Búsqueda y filtrado multicriterio (texto, categoría, marca, precio máximo, orden) y detalle de producto con respuesta menor a 2000 ms.",
        "archivos": "src/routes/catalogRoutes.js, public/js/catalog.js",
        "casos": [
            (
                "RF-03-CP01",
                "Positivo (Búsqueda multicriterio y SLA)",
                "Catálogo semilla con productos y especificaciones JSON.",
                "1. GET /api/products?q=Laptop&categoria=Computo&maxPrecio=35000&orden=precio_asc.\n2. GET /api/products/:id del primer resultado.",
                "HTTP 200, withinSla=true, responseTimeMs < 2000 ms (~14 ms medido) y ficha completa con especificaciones_json.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "RF-03-CP02",
                "Negativo (No encontrado y búsqueda vacía)",
                "Catálogo activo.",
                "1. GET /api/products/999999.\n2. GET /api/products?q=ProductoInexistenteXYZ987.",
                "HTTP 404 para ID inexistente; HTTP 200 con arreglo products vacío [] sin errores.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "CP-RF-03 / SEG-08 WAF",
                "Cobertura Complementaria E2E y WAF",
                "Suites integration y security.",
                "Filtrado exacto por SKU EM-LAP-001 y bloqueo WAF HTTP 400 ante payload SQLi en query string (?q=1' UNION SELECT...).",
                "Cumple tiempo de respuesta < 2s y bloquea inyección SQL.",
                "PASÓ (integration / security.test.js)"
            ),
        ],
    },
    {
        "id": "RF-04",
        "nombre": "Carrito de compras",
        "prioridad": "Must Have",
        "proceso_dfd": "Proceso 3 · Validación servidor (cartCalculator.js)",
        "descripcion": "Cálculo exacto del lado servidor de subtotal, IVA (16%), costo de envío ($99 MXN < $999 MXN; gratis >= $999 MXN o miembro ExpressPrime) y cupones.",
        "archivos": "src/routes/cartCalculator.js, src/routes/checkoutRoutes.js",
        "casos": [
            (
                "RF-04-CP01",
                "Positivo (Envío estándar, envío gratis y cupones)",
                "Producto activo de $300 MXN (stock 10) y cupones ENVIOGRATIS / BIENVENIDA10.",
                "1. POST /api/cart/calculate (1x $300 sin cupón).\n2. POST con cupón ENVIOGRATIS.\n3. POST (4x $300 = $1,200) con BIENVENIDA10 (10%).",
                "A: subtotal=300, IVA=48, envío=99, total=447.\nB: envío=0, total=348.\nC: descuento=120, envío=0, IVA=172.8, total=1252.8.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "RF-04-CP02",
                "Negativo (Validaciones de carrito, cupón y stock)",
                "Catálogo e inventario activos.",
                "1. POST /api/cart/calculate con items=[].\n2. POST con cuponCodigo='NO_EXISTE_CUPON'.\n3. POST con cantidad=9999 en productoId=1.",
                "HTTP 400 para carrito vacío y cupón inválido; HTTP 409 Conflicto de stock insuficiente.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "CP-RF-04 / SEG-05 / Prueba #8",
                "Cobertura Complementaria E2E, Seguridad y Unitaria",
                "Suites integration, security y unit.",
                "Ignora precios alterados enviados por el cliente (toma precio oficial BD), rechaza cantidades negativas (400) y prueba cupón monto fijo + ExpressPrime 5% cashback.",
                "Integridad absoluta en cálculos financieros en servidor.",
                "PASÓ (integration / security / unit)"
            ),
        ],
    },
    {
        "id": "RF-05",
        "nombre": "Pagos, Cartera Digital y Membresía ExpressPrime",
        "prioridad": "Must Have",
        "proceso_dfd": "Proceso 4 · Almacén D5 Transacciones / tarjetas_simuladas",
        "descripcion": "Checkout en máximo 3 pasos con pasarela PCI DSS (tokenización tok_pci_*, idempotencia), cartera de hasta 3 tarjetas simuladas con color de plástico, PayPal Sandbox MXN y ExpressPrime.",
        "archivos": "src/routes/checkoutRoutes.js, src/services/externalProviders.js, src/routes/authRoutes.js",
        "casos": [
            (
                "RF-05-CP01",
                "Positivo (Tarjeta simulada, descuento de saldo e idempotencia)",
                "Comprador autenticado y tarjeta registrada ($20,000 MXN, color #0f766e).",
                "1. POST /api/payments/simulated-cards.\n2. POST /api/checkout con simulatedCardId y idempotencyKey.\n3. Reenviar mismo idempotencyKey.\n4. GET /api/payments/simulated-cards?mine=1.",
                "HTTP 201 con token tok_pci_* y PAN enmascarado; reenvío bloqueado con HTTP 409; saldo descontado y color_plastico preservado.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "RF-05-CP02",
                "Negativo y Reglas de Cartera (Límite 3 tarjetas, saldo, declinación y pasos)",
                "Comprador autenticado.",
                "1. Registrar 3 tarjetas (primera con $50) e intentar crear la 4ª.\n2. Checkout con tarjeta de $50.\n3. Checkout con pasosCheckout=4.\n4. Checkout con tarjeta terminación 0000.",
                "HTTP 400 al superar 3 plásticos por usuario; HTTP 400 por saldo insuficiente; HTTP 400 si pasos > 3 (RNF-11); HTTP 402 tarjeta declinada.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "RF-05-CP03",
                "Positivo Extensión (PayPal Sandbox MXN y ExpressPrime)",
                "Comprador autenticado.",
                "1. GET /api/payment/paypal-config.\n2. POST /api/membership/subscribe (1_mes).\n3. POST /api/checkout metodoPago='paypal'.\n4. POST /api/membership/cancel.",
                "Configuración MXN activa; membresía premium activada (membresiaPremium=true); orden PayPal HTTP 201; cancelación HTTP 200.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "CP-RF-05 / CP-RF-12(PayPal) / CP-RF-13(Prime/Tarjetas) / SEG-07 / #5,#9,#10",
                "Cobertura Complementaria E2E, PCI DSS y Resiliencia",
                "Suites integration, security y unit.",
                "MSI 6 meses, PayPal con tarjeta asignada, verificación de cero PAN/CVV en BD y 3 reintentos de pasarela ante fallos transitorios (RFC-0001).",
                "100% conforme a PCI DSS SAQ-A y resiliencia RFC-0001.",
                "PASÓ (integration / security / unit)"
            ),
        ],
    },
    {
        "id": "RF-06",
        "nombre": "Gestión de productos, inventario y Dashboard de Vendedor",
        "prioridad": "Must Have",
        "proceso_dfd": "Proceso 2 · Almacenes D2 Catálogo y D3 Inventario",
        "descripcion": "Alta y edición de productos/precios/inventario por administrador o vendedor cumpliendo completitud ISO/IEC 25012, y panel aislado del vendedor con sus propios productos.",
        "archivos": "src/routes/catalogRoutes.js, src/routes/sellerRoutes.js",
        "casos": [
            (
                "RF-06-CP01",
                "Positivo (Alta, edición y aislamiento en Dashboard Vendedor)",
                "Sesiones MFA activas de vendedor y administrador.",
                "1. POST /api/products como vendedor.\n2. POST /api/products como admin.\n3. GET /api/seller/dashboard como vendedor.\n4. PUT /api/seller/products/:id/stock (stock=18, precio=1799).",
                "Productos creados (HTTP 201); dashboard vendedor incluye únicamente su producto (excluye el de admin); actualización rápida HTTP 200.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "RF-06-CP02",
                "Negativo / Permisos (ISO 25012, SKU duplicado y bloqueo entre vendedores)",
                "Sesiones vendedor y admin.",
                "1. POST /api/products incompleto.\n2. POST /api/products con SKU 'EM-LAP-001'.\n3. PUT /api/seller/products/:adminProdId/stock usando token vendedor.",
                "HTTP 400 checklist incompleto ISO 25012; HTTP 409 SKU duplicado; HTTP 403 al intentar modificar producto ajeno.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "CP-RF-06 / Prueba #18",
                "Cobertura Complementaria E2E y Unitaria",
                "Suites integration y unit.",
                "Edición global por admin, validaciones de precio/stock negativo y verificación completa de panel web de vendedor.",
                "Control de catálogo e inventario validado al 100%.",
                "PASÓ (integration / unit.test.js)"
            ),
        ],
    },
    {
        "id": "RF-07",
        "nombre": "Gestión de pedidos, logística OSM y devoluciones LFPC",
        "prioridad": "Must Have",
        "proceso_dfd": "Procesos 3 y 5 · Almacenes D4 Pedidos, D6 Envíos y solicitudes_reembolso",
        "descripcion": "Visualización aislada de pedidos, actualización de estado logístico, almacenes CEDIS, simulación OpenStreetMap (camión/auto) y solicitudes de devolución/reembolso LFPC.",
        "archivos": "src/routes/orderRoutes.js, src/routes/logisticsRoutes.js, src/services/logisticsService.js",
        "casos": [
            (
                "RF-07-CP01",
                "Positivo (Ciclo completo de envío OSM y aprobación de reembolso)",
                "Comprador con 2 pedidos pagados y sesión admin MFA.",
                "1. GET /api/orders del comprador (aislamiento IDOR).\n2. CEDIS prepare -> dispatch (camion) -> deliver en Pedido 1.\n3. POST /api/orders/:id/refund-request y POST /api/admin/refund-requests/:reqId/approve en Pedido 2.",
                "Comprador ve solo sus pedidos; ciclo logístico entrega HTTP 200; reembolso aprobado (estado='aprobada'), stock reintegrado y transacción reembolsada.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "RF-07-CP02",
                "Negativo / Denegación (Estado inválido y rechazo de reembolso)",
                "Pedido pagado existente y solicitud de reembolso pendiente.",
                "1. PATCH /api/orders/:id/status con estado='estado_inexistente'.\n2. POST /api/admin/refund-requests/:id/reject con motivo detallado.",
                "HTTP 400 estado inválido; HTTP 200 con estado='denegada' y notificación enviada al comprador.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "CP-RF-07 / CP-RF-16 / CP-RF-17 / Prueba #12",
                "Cobertura Complementaria E2E y Unitaria",
                "Suites integration y unit.",
                "Reverse geocoding OpenStreetMap, rutas por CEDIS (CDMX Norte/Sur, GDL, MTY, PUE), progreso en mapa y autorización panel /envios.",
                "Trazabilidad logística y devoluciones LFPC verificadas.",
                "PASÓ (integration / unit.test.js)"
            ),
        ],
    },
    {
        "id": "RF-08",
        "nombre": "Sistema de calificaciones y reseñas",
        "prioridad": "Should Have",
        "proceso_dfd": "Proceso 6 · Almacén D7 Reseñas",
        "descripcion": "Permite a los clientes calificar productos de 1 a 5 estrellas y comentar, marcando compraVerificada=true cuando el usuario adquirió el artículo.",
        "archivos": "src/routes/catalogRoutes.js",
        "casos": [
            (
                "RF-08-CP01",
                "Positivo (Reseña verificada y reseña sin compra)",
                "Comprador autenticado con compra confirmada en productoId=2.",
                "1. POST /api/products/2/reviews (calificacion=5).\n2. POST /api/products/4/reviews sin compra previa (calificacion=4).",
                "Ambas retornan HTTP 201; producto 2 marca compraVerificada=true; producto 4 marca compraVerificada=false.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "RF-08-CP02",
                "Negativo (Rango, longitud y producto inexistente)",
                "Comprador autenticado.",
                "1. POST con calificacion=6.\n2. POST con comentario='Ok' (<5 caracteres).\n3. POST a /api/products/999999/reviews.",
                "HTTP 400 por rango inválido y comentario corto; HTTP 404 para producto inexistente.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "CP-RF-08 / SEG-11 XSS",
                "Cobertura Complementaria E2E y WAF",
                "Suites integration y security.",
                "Bloqueo HTTP 400 ante intento de XSS (<script>...</script>) en el comentario de reseña.",
                "Reseñas verificadas y protegidas contra XSS.",
                "PASÓ (integration / security.test.js)"
            ),
        ],
    },
    {
        "id": "RF-09",
        "nombre": "Notificaciones y acuses SMTP",
        "prioridad": "Should Have",
        "proceso_dfd": "Procesos 1, 3 y 5 · Tabla notificaciones",
        "descripcion": "Emisión de notificaciones al usuario con acuse criptográfico ACK-SMTP-* en registro, compra, cambio logístico, membresía y resolución de reembolsos.",
        "archivos": "src/services/externalProviders.js, src/services/emailService.js, src/routes/authRoutes.js",
        "casos": [
            (
                "RF-09-CP01",
                "Positivo (Bandeja de notificaciones y acuses ACK-SMTP-*)",
                "Comprador registrado realizando checkout y cambio logístico posterior.",
                "1. Registrar usuario.\n2. Ejecutar POST /api/checkout.\n3. PATCH /api/orders/:id/status estado='enviado'.\n4. Consultar GET /api/auth/profile -> notifications.",
                "Eventos REGISTRO_CUENTA, PEDIDO_CONFIRMADO_Y_PAGADO y ACTUALIZACION_PEDIDO_ENVIADO registrados, todos con acuse_recibo ACK-SMTP-*.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "RF-09-CP02",
                "Negativo (Sin notificaciones ante pedido inexistente)",
                "Sesión admin activa.",
                "1. PATCH /api/orders/999999/status estado='enviado'.",
                "HTTP 404 sin generación espuria de registros de notificación ni bitácora.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "CP-RF-09 / Prueba #11",
                "Cobertura Complementaria E2E y Unitaria SMTP",
                "Suites integration y unit.",
                "Verificación de plantilla HTML 2FA Nodemailer y manejo seguro con código de rescate ante error SMTP.",
                "Notificaciones operativas y tolerantes a fallo SMTP.",
                "PASÓ (integration / unit.test.js)"
            ),
        ],
    },
    {
        "id": "RF-10",
        "nombre": "Reportes de ventas, liquidación de vendedor e ISO 25012",
        "prioridad": "Should Have",
        "proceso_dfd": "Proceso 6 · Almacenes D3, D4, D5 y D8 Bitácora",
        "descripcion": "Reportes ejecutivos de ventas/inventario, consulta y acreditación de ventas simuladas a la tarjeta receptora del vendedor, auditoría ISO/IEC 25012 y bitácora SHA-256.",
        "archivos": "src/routes/adminRoutes.js, src/routes/sellerRoutes.js",
        "casos": [
            (
                "RF-10-CP01",
                "Positivo (Reportes auditor, tarjeta receptora y acreditación vendedor)",
                "Sesiones auditor y vendedor MFA activas.",
                "1. GET /api/reports/summary, /api/audit-logs y /api/quality/data-audit como auditor.\n2. POST /api/seller/receiving-card.\n3. POST /api/seller/credit-sales (monto=2500).",
                "HTTP 200 en reportes, cadena SHA-256 íntegra (chainIntact=true), integridad ISO 25012 OK; tarjeta receptora vinculada y saldo actualizado de 1000 a 3500.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "RF-10-CP02",
                "Negativo / Permisos (Bloqueo RBAC y validación de tarjeta receptora)",
                "Sesiones cliente y vendedor activas.",
                "1. Cliente solicita GET /api/reports/summary, /api/quality/data-audit y /api/seller/dashboard.\n2. Vendedor intenta POST /api/seller/receiving-card con cardId=999999.",
                "HTTP 403 Forbidden en los 3 endpoints para rol cliente; HTTP 404 cuando el ID de tarjeta no existe o no pertenece al vendedor.",
                "PASÓ (tests/rf-casos-prueba.test.js)"
            ),
            (
                "CP-RF-10 / SEG-15 / #6, #18",
                "Cobertura Complementaria E2E, Seguridad y Unitaria",
                "Suites integration, security, unit y panel admin Python.",
                "Exportación de reporte TXT/CSV con firma SHA-256 desde scripts/admin_modules/common.py y validación /api/quality/database-policy.",
                "Reportes financieros web, API y escritorio consistentes.",
                "PASÓ (integration / security / unit)"
            ),
        ],
    },
]

RNF_REPORTS_AUDIT = [
    (
        "RNF-01",
        "Disponibilidad (>= 99.9% mensual)",
        "Reporte mensual de disponibilidad generado por monitoreo (Apartado 35)",
        "PARCIAL / SOLO EN VIVO",
        "GET /api/metrics y GET /api/health en src/routes/adminRoutes.js (reporta 99.98% y telemetría en RAM).",
        "No existe script ni archivo de reporte mensual guardado en data/ ni en reportes/."
    ),
    (
        "RNF-02",
        "Rendimiento de checkout (>= 100 concurrentes < 2s)",
        "Informe de pruebas de carga (Apartado 24)",
        "IMPLEMENTADO CON HALLAZGO",
        "scripts/performance-test.js genera data/EV-24_Informe_Pruebas_Rendimiento.json (latencia promedio 278.04 ms, P95 292 ms).",
        "HALLAZGO en corrida del 11/11/2026: transaccionesExitosas=0 y cumpleSinSobreventa=false porque el script hace login sin NODE_ENV=test tras activarse 2FA."
    ),
    (
        "RNF-03",
        "Seguridad de los datos (TLS/HSTS, AES-256-GCM, PCI)",
        "Pruebas de seguridad (Apartado 25) e inspección de cifrado en tránsito y reposo",
        "PARCIAL / DISPERSO",
        "scripts/verify-auth-sessions.js (EV-18) y scripts/static-analysis.js (SAST 0 hallazgos en consola) + tests/security.test.js.",
        "EV-18 solo existe en ../documentos_respaldo/docs/evidencias/, NO está generado en pauditoria/data/; lint solo imprime en consola sin guardar archivo."
    ),
    (
        "RNF-04",
        "Cobertura de pruebas (>= 80% automatizada)",
        "Reporte de cobertura generado por CI / Jest (Apartados 21.2 y 31)",
        "IMPLEMENTADO",
        "coverage/lcov-report/index.html, coverage/clover.xml, coverage/coverage-final.json y coverage/lcov.info (90.35% Stmts / 91.41% Lines).",
        "Cumple al 100%; se regenera automáticamente en cada ejecución de npm test."
    ),
    (
        "RNF-05",
        "Fiabilidad (Degradación controlada ante caída de recomendaciones)",
        "Pruebas de tolerancia a fallos (Apartado 23) y simulacro de continuidad (Apartado 34)",
        "IMPLEMENTADO (EV-34 + TEST)",
        "scripts/backup-restore.js genera data/EV-34_Acta_Simulacro_Recuperacion_ISO22301.json; prueba CP-RNF-05 en tests/integration.test.js.",
        "Existe acta de continuidad ISO 22301 (EV-34), aunque no se exporta un JSON separado exclusivo del Circuit Breaker."
    ),
    (
        "RNF-06",
        "Compatibilidad (Navegadores y móviles)",
        "Matriz de compatibilidad por navegador y dispositivo (Apartado 27)",
        "NO IMPLEMENTADO EN REPO ACTIVO",
        "Matriz redactada en ../documentos_respaldo/docs/04_Plan_y_Actas_de_Pruebas_Integrales.md (fuera de pauditoria/).",
        "No existe script de pruebas cross-browser ni archivo de reporte en pauditoria/docs/, data/ o reportes/."
    ),
    (
        "RNF-07",
        "Accesibilidad (WCAG 2.2 AA)",
        "Reporte de evaluación de accesibilidad WCAG (Apartado 28)",
        "NO IMPLEMENTADO EN REPO ACTIVO",
        "Controles CSS/HTML en public/index.html y public/styles.css (.skip-link, :user-invalid, aria-live); matriz estática solo en respaldo external.",
        "No hay auditoría automatizada (axe/Lighthouse) ni archivo de reporte WCAG dentro de pauditoria/."
    ),
    (
        "RNF-08",
        "Escalabilidad (Contenedores y autoescalado)",
        "Prueba de autoescalado bajo carga (Apartado 24) y configuración infraestructura",
        "PARCIAL / INCOMPLETO",
        "EV-24 menciona RNF-08 en su encabezado; Dockerfile y docker-compose.yml están en ../documentos_respaldo/.",
        "Faltan Dockerfile/docker-compose.yml en raíz pauditoria/ y no existe reporte ni prueba real de autoescalado multi-réplica."
    ),
    (
        "RNF-09",
        "Integridad de los datos (ISO/IEC 25012, 0 alteraciones)",
        "Métricas de integridad (Apartado 19) y verificación carrito-pagos",
        "IMPLEMENTADO",
        "GET /api/quality/data-audit, GET /api/audit-logs, data/EV-05_Verificacion_Base_Datos_Funcional.json y reportes/*.txt con firma SHA-256.",
        "Implementado end-to-end tanto en API, verificador BD (EV-05) como en reportes TXT de administración."
    ),
    (
        "RNF-10",
        "Despliegue continuo (Git y CI/CD)",
        "Bitácora del pipeline CI/CD (Apartado 31) e historial de versiones (Apartado 32)",
        "PARCIAL / SIN BITÁCORA EXPORTADA",
        ".github/workflows/ci-cd.yml, tags Git (v0.1.0, v0.5.0, v1.0.0) y data/EV-39_Informe_Resultado_Auditoria_ECTA01.json (audit-verifier.js).",
        "No se exporta reporte/bitácora de corridas CI/CD en data/ o reportes/; audit-verifier.js tiene fechaExecution estática ('2026-10-21')."
    ),
    (
        "RNF-11",
        "Usabilidad (Checkout máximo en 3 pasos)",
        "Evaluación de usabilidad (Apartado 26)",
        "NO IMPLEMENTADO COMO REPORTE",
        "Validación técnica pasosCheckout <= 3 en src/routes/checkoutRoutes.js probada en tests/rf-casos-prueba.test.js y integration.test.js.",
        "No hay script ni archivo de reporte de evaluación heurística en pauditoria/ (calificación 4.8/5.0 solo existe en documento estático del respaldo)."
    ),
]

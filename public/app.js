/**
 * ============================================================================
 * Cliente Web ExpressMart México - Orquestador Principal (SGC MC-001 v1.0)
 * Sistema de Diseño Stitch "Aura Commerce" en Pesos Mexicanos ($ MXN).
 * ============================================================================
 * Arquitectura modular desacoplada en public/js/:
 *   - state-utils.js: Estado reactivo, cálculo de totales, alertas, toasts y hojas de otoño.
 *   - info-pages.js: Catálogo legal, términos, privacidad, garantía y vendedor.
 *   - favorites.js: Gestión de lista de deseos y sincronización por usuario.
 *   - catalog.js: Cuadrícula bento, buscador con sugerencias y ficha de producto con zoom lens.
 *   - cart-checkout.js: Cesta flotante y asistente de pago en 3 pasos (PayPal y tarjetas).
 *   - auth.js: Gestión de sesión, modal de login/registro, roles y verificación 2FA.
 *   - profile.js: Mi Cuenta, avatar personalizado, membresía ExpressPrime y derechos ARCO.
 *   - orders-logistics.js: Historial de compras y rastreo en vivo OpenStreetMap.
 *   - admin-audit.js: Reportes comerciales, control de contingencias y centro de auditoría D8.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicialización de listeners de eventos en submódulos
  if (typeof initStateUtilsEvents === 'function') initStateUtilsEvents();
  if (typeof initFavoritesEvents === 'function') initFavoritesEvents();
  if (typeof initCatalogEvents === 'function') initCatalogEvents();
  if (typeof initCartCheckoutEvents === 'function') initCartCheckoutEvents();
  if (typeof initAuthEvents === 'function') initAuthEvents();
  if (typeof initProfileEvents === 'function') initProfileEvents();
  if (typeof initWalletCardsEvents === 'function') initWalletCardsEvents();
  if (typeof initOrdersLogisticsEvents === 'function') initOrdersLogisticsEvents();
  if (typeof initAdminAuditEvents === 'function') initAdminAuditEvents();

  // 2. Navegación por pestañas y accesos directos del Header Stitch
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll('.btn-nav-home').forEach((btn) => {
    btn.addEventListener('click', () => switchTab('view-home'));
  });

  document.querySelectorAll('.btn-nav-catalog').forEach((btn) => {
    btn.addEventListener('click', () => switchTab('view-catalog'));
  });

  const btnBackCatalog = document.getElementById('btn-back-to-catalog');
  if (btnBackCatalog) {
    btnBackCatalog.addEventListener('click', () => switchTab('view-catalog'));
  }

  const btnHeaderOrders = document.getElementById('btn-header-orders');
  if (btnHeaderOrders) {
    btnHeaderOrders.addEventListener('click', () => switchTab('view-orders'));
  }

  const brandHome = document.getElementById('brand-home-link');
  if (brandHome) {
    brandHome.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('view-home');
    });
  }

  // 3. Sistema de páginas informativas y modal legal / corporativo
  const infoModal = document.getElementById('info-modal');
  const btnCloseInfoModal = document.getElementById('btn-close-info-modal');
  const btnAcceptInfoModal = document.getElementById('btn-accept-info-modal');

  if (btnCloseInfoModal && infoModal) {
    btnCloseInfoModal.addEventListener('click', () => infoModal.close());
  }
  if (btnAcceptInfoModal && infoModal) {
    btnAcceptInfoModal.addEventListener('click', () => infoModal.close());
  }

  document.querySelectorAll('.footer-info-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.info;
      if (key && typeof openInfoModal === 'function') {
        openInfoModal(key);
      }
    });
  });

  // 4. Verificación y sincronización de sesión con el backend
  if (state.token) {
    apiFetch('/api/auth/profile')
      .then((data) => {
        if (data && data.user) {
          state.user = data.user;
          state.notifications = data.notifications || [];
          localStorage.setItem('em_user', JSON.stringify(data.user));
          updateSessionUI();
          updateHeaderNotifications();
          updateFavoritesBadge();
          startInactivityMonitor();
        }
      })
      .catch((_) => {
        if (state.token) {
          clearSessionState('Tu sesión previa ha expirado o no es válida. Se ha cerrado la cuenta por seguridad.', true);
        }
      });
  } else {
    updateSessionUI();
  }

  // 5. Carga inicial de datos y efectos visuales de interfaz
  updateFavoritesBadge();
  updateHeaderNotifications();
  if (typeof loadCatalog === 'function') loadCatalog();
  if (typeof setupSearchSuggestions === 'function') setupSearchSuggestions();
  if (typeof initFallingLeaves === 'function') initFallingLeaves();
  if (typeof initCustomerTrackingModal === 'function') initCustomerTrackingModal();
});

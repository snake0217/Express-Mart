/**
 * Cliente Web Interactivo ExpressMart - Sistema de Diseño Stitch "Aura Commerce" (Precios en MXN)
 * Conecta los flujos de Catálogo, Ficha de Producto con Zoom Interactivo y Reseñas Verificadas,
 * Cesta con Miniaturas y Checkout en 3 pasos, Perfil con Foto Personalizada,
 * Pedidos y Devoluciones, Notificaciones, Reportes y Centro de Auditoría.
 */

function getInitialCart() {
  const token = localStorage.getItem('em_token');
  const userRaw = localStorage.getItem('em_user');
  if (!token || !userRaw) {
    return [];
  }
  try {
    const user = JSON.parse(userRaw);
    if (user && user.id) {
      const userCart = localStorage.getItem(`em_cart_${user.id}`);
      if (userCart) return JSON.parse(userCart);
    }
  } catch (_) {}
  return [];
}


const state = {
  token: localStorage.getItem('em_token') || '',
  user: JSON.parse(localStorage.getItem('em_user') || 'null'),
  cart: getInitialCart(),
  notifications: [],
  coupon: '',
  calculatedTotals: null,
  recommendationsHealthy: true,
  currentProduct: null
};

function formatMxn(amount) {
  return `$${Number(amount || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} MXN`;
}

function showAlert(msg, isError = false) {
  const el = document.getElementById('global-alert');
  if (!el) return;
  el.textContent = msg;
  el.className = `alert ${isError ? 'alert-error' : 'alert-info'}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 6000);
}

function showToast({ title, message, imageUrl, price }) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className =
    'pointer-events-auto flex items-center gap-3 p-3.5 bg-surface-container-lowest text-on-surface rounded-xl shadow-[0_12px_36px_rgba(11,28,48,0.18)] border border-surface-container-highest/80 transform translate-y-3 opacity-0 transition-all duration-300 max-w-sm';

  toast.innerHTML = `
    <img
      src="${imageUrl || '/assets/logo.png'}"
      alt="${title}"
      class="w-12 h-12 rounded-lg object-contain bg-white p-1 border border-surface-dim shrink-0"
      onerror="this.src='/assets/logo.png'"
    />
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-1 text-tertiary font-bold text-xs">
        <span class="material-symbols-outlined text-[15px]">check_circle</span>
        <span>${message || '¡Agregado a la cesta!'}</span>
      </div>
      <p class="font-bold text-xs truncate text-on-surface">${title}</p>
      ${price ? `<p class="text-xs text-primary font-semibold">${formatMxn(price)}</p>` : ''}
    </div>
    <button type="button" class="btn-toast-view px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-bold shrink-0 transition-colors">
      Ver Cesta
    </button>
  `;

  container.appendChild(toast);

  toast.querySelector('.btn-toast-view').addEventListener('click', () => {
    const cartDialog = document.getElementById('cart-dialog');
    setCheckoutStep(1);
    refreshCartModal();
    cartDialog.showModal();
    toast.remove();
  });

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-3', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-3', 'opacity-0');
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

// ============================================================================
// GESTIÓN CENTRALIZADA DE SESIÓN Y CIERRE AUTOMÁTICO
// ============================================================================

function clearSessionState(reason = '', isError = true) {
  stopInactivityMonitor();

  state.token = '';
  state.user = null;
  state.cart = [];
  state.notifications = [];
  state.coupon = '';
  state.calculatedTotals = null;
  localStorage.removeItem('em_token');
  localStorage.removeItem('em_user');
  localStorage.removeItem('em_cart');

  const ordersBox = document.getElementById('orders-list');
  if (ordersBox) {
    ordersBox.innerHTML =
      '<p class="muted p-4 rounded-xl bg-surface-container-low text-center">Inicie sesión para consultar sus pedidos en MXN, guías DHL/FedEx y gestionar devoluciones.</p>';
  }
  const addrInput = document.getElementById('checkout-address');
  if (addrInput) addrInput.value = '';
  const cardHolderInput = document.getElementById('card-holder');
  if (cardHolderInput) cardHolderInput.value = '';
  const checkoutSummary = document.getElementById('checkout-final-summary');
  if (checkoutSummary) checkoutSummary.innerHTML = '';
  const checkoutResult = document.getElementById('checkout-result-box');
  if (checkoutResult) checkoutResult.innerHTML = '';
  const couponInput = document.getElementById('cart-coupon');
  if (couponInput) couponInput.value = '';

  const cartDialog = document.getElementById('cart-dialog');
  if (cartDialog && cartDialog.open) cartDialog.close();

  const subDialog = document.getElementById('subscription-dialog');
  if (subDialog && subDialog.open) subDialog.close();

  const logoutConfirmDialog = document.getElementById('logout-confirm-dialog');
  if (logoutConfirmDialog && logoutConfirmDialog.open) logoutConfirmDialog.close();

  const inactivityDialog = document.getElementById('inactivity-dialog');
  if (inactivityDialog && inactivityDialog.open) inactivityDialog.close();

  const notifDialog = document.getElementById('notifications-dialog');
  if (notifDialog && notifDialog.open) notifDialog.close();

  updateSessionUI();
  refreshCartModal();
  updateHeaderNotifications();
  updateFavoritesBadge();
  const favsView = document.getElementById('view-favorites');
  if (favsView && !favsView.classList.contains('hidden')) {
    renderFavoritesView();
  }

  // Si el usuario estaba en una pestaña protegida, volver a Inicio
  const profileView = document.getElementById('view-profile');
  const auditView = document.getElementById('view-audit');
  const adminView = document.getElementById('view-admin');
  if ((profileView && !profileView.classList.contains('hidden')) ||
      (auditView && !auditView.classList.contains('hidden')) ||
      (adminView && !adminView.classList.contains('hidden'))) {
    switchTab('view-home');
  }

  if (reason) {
    showAlert(reason, isError);
  }
}

async function executeLogout(notify = true, reason = 'Sesión cerrada de forma segura.') {
  const tokenToRevoke = state.token;
  try {
    if (tokenToRevoke) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenToRevoke}`
        }
      });
    }
  } catch (_) {
    // Continuar limpieza local de sesión
  }
  clearSessionState(notify ? reason : '', false);
}

// ============================================================================
// MONITOR DE INACTIVIDAD (5 MIN INACTIVO -> "¿SIGUES AHÍ?" -> 2 MIN -> LOGOUT)
// ============================================================================
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos de inactividad
const WARNING_COUNTDOWN_SEC = 2 * 60;        // 2 minutos de tolerancia (120 segundos)

let inactivityTimer = null;
let countdownInterval = null;
let secondsRemaining = WARNING_COUNTDOWN_SEC;
let isWarningOpen = false;
let inactivityListenersBound = false;

function onUserActivity() {
  if (isWarningOpen) return; // Si la advertencia ya está visible, no cerrarla por movimiento accidental
  resetInactivityTimer();
}

function resetInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  if (!state.token || !state.user) {
    return;
  }
  inactivityTimer = setTimeout(triggerInactivityPrompt, INACTIVITY_TIMEOUT_MS);
}

function triggerInactivityPrompt() {
  if (!state.token || !state.user) return;

  const dialog = document.getElementById('inactivity-dialog');
  if (!dialog) return;

  isWarningOpen = true;
  secondsRemaining = WARNING_COUNTDOWN_SEC;

  const countdownEl = document.getElementById('inactivity-countdown');
  if (countdownEl) countdownEl.textContent = '02:00';

  if (!dialog.open) {
    dialog.showModal();
  }

  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    secondsRemaining--;
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (countdownEl) countdownEl.textContent = formatted;

    if (secondsRemaining <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      if (dialog && dialog.open) {
        dialog.close();
      }
      isWarningOpen = false;
      // Cerrar sesión automáticamente tras 2 minutos sin presionar el botón de confirmación
      executeLogout(true, 'Tu sesión se ha cerrado por inactividad (5 minutos sin actividad + 2 minutos sin confirmación).');
    }
  }, 1000);
}

function confirmStayLoggedIn() {
  const dialog = document.getElementById('inactivity-dialog');
  if (dialog && dialog.open) dialog.close();
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  isWarningOpen = false;

  // Notificar al backend para renovar el vencimiento en base de datos (Sliding session)
  if (state.token) {
    fetch('/api/auth/keep-alive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      }
    }).catch(() => {});
  }

  resetInactivityTimer();
  showAlert('Sesión confirmada. ¡Continúas activo en ExpressMart!');
}

function startInactivityMonitor() {
  if (!state.token || !state.user) return;

  if (!inactivityListenersBound) {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((evt) => {
      window.addEventListener(evt, onUserActivity, { passive: true });
    });
    inactivityListenersBound = true;
  }

  resetInactivityTimer();
}

function stopInactivityMonitor() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  isWarningOpen = false;
  const dialog = document.getElementById('inactivity-dialog');
  if (dialog && dialog.open) dialog.close();
}

async function apiFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      const isAuthEndpoint = url.includes('/api/auth/login') || url.includes('/api/auth/register') || url.includes('/api/auth/verify-mfa');
      if (!isAuthEndpoint && state.token) {
        // La sesión ha expirado o no es válida: cerrar automáticamente la cuenta
        clearSessionState('Tu sesión ha expirado o no es válida. La cuenta se ha cerrado por seguridad.', true);
      }
    }
    throw new Error(data.error || `Error HTTP ${res.status}`);
  }
  return data;
}

function switchTab(tabId) {
  // Verificación de privilegios para Panel de Auditoría
  if (tabId === 'view-audit') {
    const isAuditorOrAdmin = state.user && state.token && ['auditor', 'administrador'].includes(state.user.rol);
    if (!isAuditorOrAdmin) {
      showAlert('Acceso denegado: El panel de auditoría requiere credenciales de Auditor o Administrador.', true);
      switchTab('view-home');
      return;
    }
  }

  // Verificación de privilegios para Panel de Administrador / Vendedor
  if (tabId === 'view-admin') {
    const isAdminOrSeller = state.user && state.token && ['administrador', 'vendedor'].includes(state.user.rol);
    if (!isAdminOrSeller) {
      showAlert('Acceso denegado: El panel de productos requiere credenciales de Administrador o Vendedor.', true);
      switchTab('view-home');
      return;
    }
  }

  // Verificación de autenticación para Mi Cuenta y Privacidad
  if (tabId === 'view-profile') {
    if (!state.user || !state.token) {
      showAlert('Debes iniciar sesión para acceder a tu cuenta y privacidad.', true);
      const authDialog = document.getElementById('auth-dialog');
      if (authDialog) authDialog.showModal();
      switchTab('view-home');
      return;
    }
  }

  document.querySelectorAll('.tab-btn').forEach((b) => {
    const isTarget = b.dataset.tab === tabId;
    b.classList.toggle('active', isTarget);
    b.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  document.querySelectorAll('.tab-view').forEach((v) => {
    v.classList.toggle('hidden', v.id !== tabId);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (tabId === 'view-catalog') loadCatalog();
  if (tabId === 'view-favorites') renderFavoritesView();
  if (tabId === 'view-orders') loadOrders();
  if (tabId === 'view-profile') loadProfile();
  if (tabId === 'view-admin') loadAdminReports();
  if (tabId === 'view-audit') loadAuditCenter();
}

function renderProfileWishlists(user) {
  const container = document.getElementById('profile-wishlists-container');
  const badge = document.getElementById('profile-wishlist-badge');
  if (!container) return;

  if (!user || !user.id) {
    container.innerHTML = `
      <div class="p-6 rounded-xl bg-surface-container-low text-center border border-dashed border-surface-dim">
        <span class="material-symbols-outlined text-[36px] text-secondary mb-2 block">favorite_border</span>
        <p class="font-bold text-sm text-on-surface">Inicia sesión para ver tus artículos favoritos</p>
      </div>
    `;
    if (badge) {
      badge.textContent = '0 artículos';
      badge.className = 'px-2 py-0.5 rounded-full bg-surface-container-high text-secondary font-label-xs text-label-xs font-semibold';
    }
    return;
  }

  const favs = getFavorites();

  if (!favs || favs.length === 0) {
    container.innerHTML = `
      <div class="p-6 rounded-xl bg-surface-container-low text-center border border-dashed border-surface-dim">
        <span class="material-symbols-outlined text-[36px] text-secondary mb-2 block">favorite_border</span>
        <p class="font-bold text-sm text-on-surface">Aún no tienes artículos en favoritos</p>
        <p class="text-xs text-secondary mt-1">Explora el catálogo y pulsa el corazón en cualquier producto para guardarlo aquí y en la pestaña de Favoritos.</p>
        <button type="button" class="btn-profile-fav-to-catalog mt-3 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs transition-colors inline-flex items-center gap-1 cursor-pointer">
          <span class="material-symbols-outlined text-[14px]">grid_view</span>
          <span>Explorar Catálogo</span>
        </button>
      </div>
    `;
    const btnToCat = container.querySelector('.btn-profile-fav-to-catalog');
    if (btnToCat) {
      btnToCat.onclick = () => {
        const tabCat = document.getElementById('tab-catalog');
        if (tabCat) tabCat.click();
      };
    }
    if (badge) {
      badge.textContent = '0 artículos';
      badge.className = 'px-2 py-0.5 rounded-full bg-surface-container-high text-secondary font-label-xs text-label-xs font-semibold';
    }
  } else {
    container.innerHTML = `
      <div class="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
        ${favs.map((item) => `
          <div class="p-2.5 rounded-xl bg-surface-container-low border border-surface-container hover:border-primary/40 transition-all flex items-center justify-between gap-3 group">
            <div class="flex items-center gap-2.5 min-w-0">
              <img
                src="${item.imagen_url || '/assets/logo.png'}"
                alt="${escapeHtml(item.nombre || 'Producto')}"
                class="w-12 h-12 object-contain bg-white rounded-lg p-1 border border-surface-container flex-shrink-0"
                onerror="this.src='/assets/logo.png'"
              />
              <div class="min-w-0">
                <p class="font-bold text-xs text-on-surface truncate group-hover:text-primary transition-colors cursor-pointer btn-profile-fav-view" data-id="${item.id}" title="${escapeHtml(item.nombre || '')}">
                  ${escapeHtml(item.nombre || '')}
                </p>
                <div class="flex items-center gap-2 text-[11px] text-secondary mt-0.5">
                  <span>${escapeHtml(item.categoria || 'Catálogo')}</span>
                  <span>·</span>
                  <span class="font-bold text-primary">${formatMxn(item.precio || 0)}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                class="btn-profile-fav-addcart p-1.5 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-white transition-colors cursor-pointer"
                data-id="${item.id}"
                title="Agregar a la cesta"
              >
                <span class="material-symbols-outlined text-[18px]">shopping_cart</span>
              </button>
              <button
                type="button"
                class="btn-profile-fav-remove p-1.5 rounded-lg hover:bg-rose-50 text-secondary hover:text-rose-600 transition-colors cursor-pointer"
                data-id="${item.id}"
                title="Quitar de favoritos"
              >
                <span class="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="pt-2.5 border-t border-surface-container mt-2 flex items-center justify-between">
        <span class="text-xs text-secondary font-medium">${favs.length} artículo${favs.length === 1 ? '' : 's'} guardado${favs.length === 1 ? '' : 's'}</span>
        <button type="button" id="btn-profile-view-all-favs" class="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer">
          <span>Ver pestaña de Favoritos</span>
          <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>
      </div>
    `;

    if (badge) {
      badge.textContent = `${favs.length} ${favs.length === 1 ? 'artículo' : 'artículos'}`;
      badge.className = 'px-2 py-0.5 rounded-full bg-primary/15 text-primary font-label-xs text-label-xs font-bold';
    }

    container.querySelectorAll('.btn-profile-fav-view').forEach((btn) => {
      btn.onclick = () => {
        const pId = Number(btn.getAttribute('data-id'));
        const product = (state.products || []).find((p) => Number(p.id) === pId) || favs.find((f) => Number(f.id) === pId);
        if (product) openProductDetail(product);
      };
    });

    container.querySelectorAll('.btn-profile-fav-addcart').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const pId = Number(btn.getAttribute('data-id'));
        const product = (state.products || []).find((p) => Number(p.id) === pId) || favs.find((f) => Number(f.id) === pId);
        if (product) addToCart(product, 1);
      };
    });

    container.querySelectorAll('.btn-profile-fav-remove').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const pId = Number(btn.getAttribute('data-id'));
        const product = favs.find((f) => Number(f.id) === pId);
        if (product) {
          toggleFavorite(product);
          renderProfileWishlists(user);
        }
      };
    });

    const btnAllFavs = container.querySelector('#btn-profile-view-all-favs');
    if (btnAllFavs) {
      btnAllFavs.onclick = () => {
        const tabFavs = document.getElementById('tab-favorites');
        if (tabFavs) tabFavs.click();
      };
    }
  }
}

function updateProfilePhotoUI(fotoUrl) {
  const avatarImg = document.getElementById('profile-avatar-img');
  const avatarInitials = document.getElementById('profile-avatar-initials');
  const btnRemove = document.getElementById('btn-remove-photo');
  if (!avatarImg || !avatarInitials) return;

  if (fotoUrl && String(fotoUrl).trim()) {
    avatarImg.onerror = () => {
      avatarImg.classList.add('hidden');
      avatarInitials.classList.remove('hidden');
    };
    avatarImg.src = fotoUrl;
    avatarImg.classList.remove('hidden');
    avatarInitials.classList.add('hidden');
    if (btnRemove) btnRemove.classList.remove('hidden');
  } else {
    avatarImg.onerror = null;
    avatarImg.removeAttribute('src');
    avatarImg.classList.add('hidden');
    avatarInitials.classList.remove('hidden');
    const name = state.user?.nombre || 'EM';
    const initials = name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    avatarInitials.textContent = initials || 'EM';
    if (btnRemove) btnRemove.classList.add('hidden');
  }
}

function updateSessionUI() {
  const statusEl = document.getElementById('user-status');
  const btnLogout = document.getElementById('btn-logout');
  const headerAvatarImg = document.getElementById('header-avatar-img');
  const headerAvatarIcon = document.getElementById('header-avatar-icon');
  const auditTabBtn = document.querySelector('.tab-btn[data-tab="view-audit"]');
  const adminTabBtn = document.querySelector('.tab-btn[data-tab="view-admin"]');
  const profileTabBtn = document.querySelector('.tab-btn[data-tab="view-profile"]');

  if (state.user && state.token) {
    const firstName = state.user.nombre.split(' ')[0];
    statusEl.textContent = `Hola, ${firstName}`;
    btnLogout.classList.remove('hidden');
    if (profileTabBtn) profileTabBtn.classList.remove('hidden');

    if (state.user.fotoPerfil && headerAvatarImg) {
      headerAvatarImg.onerror = () => {
        headerAvatarImg.classList.add('hidden');
        if (headerAvatarIcon) headerAvatarIcon.classList.remove('hidden');
      };
      headerAvatarImg.src = state.user.fotoPerfil;
      headerAvatarImg.classList.remove('hidden');
      if (headerAvatarIcon) headerAvatarIcon.classList.add('hidden');
    } else if (headerAvatarImg) {
      headerAvatarImg.onerror = null;
      headerAvatarImg.removeAttribute('src');
      headerAvatarImg.classList.add('hidden');
      if (headerAvatarIcon) headerAvatarIcon.classList.remove('hidden');
    }

    const addrInput = document.getElementById('checkout-address');
    if (addrInput) {
      addrInput.value = state.user.direccion || '';
    }
    const cardHolderInput = document.getElementById('card-holder');
    if (cardHolderInput) {
      cardHolderInput.value = state.user.nombre ? state.user.nombre.toUpperCase() : '';
    }

    // Panel de Auditoría solo visible para usuarios con rol auditor o administrador
    const isAuditorOrAdmin = ['auditor', 'administrador'].includes(state.user.rol);
    if (auditTabBtn) {
      auditTabBtn.classList.toggle('hidden', !isAuditorOrAdmin);
    }

    // Panel de Productos visible para administrador y vendedor
    const isAdminOrSeller = ['administrador', 'vendedor'].includes(state.user.rol);
    const adminTabText = document.getElementById('admin-tab-text');
    if (adminTabBtn) {
      adminTabBtn.classList.toggle('hidden', !isAdminOrSeller);
      if (adminTabText) {
        adminTabText.textContent = state.user.rol === 'vendedor' ? 'Panel de Vendedor' : 'Panel de Administrador';
      }
    }
  } else {
    statusEl.textContent = 'Hola, Identifícate';
    btnLogout.classList.add('hidden');
    if (profileTabBtn) profileTabBtn.classList.add('hidden');
    if (headerAvatarImg) {
      headerAvatarImg.onerror = null;
      headerAvatarImg.removeAttribute('src');
      headerAvatarImg.classList.add('hidden');
    }
    if (headerAvatarIcon) headerAvatarIcon.classList.remove('hidden');
    if (auditTabBtn) auditTabBtn.classList.add('hidden');
    if (adminTabBtn) adminTabBtn.classList.add('hidden');

    const addrInput = document.getElementById('checkout-address');
    if (addrInput) addrInput.value = '';
    const cardHolderInput = document.getElementById('card-holder');
    if (cardHolderInput) cardHolderInput.value = '';
  }

  const totalItems = state.cart.reduce((acc, i) => acc + i.cantidad, 0);
  const countEl = document.getElementById('cart-count');
  if (countEl) countEl.textContent = String(totalItems);

  updateProfilePhotoUI(state.user?.fotoPerfil || '');
  renderProfileWishlists(state.user);
  renderMembershipProfile();
}

function saveCart() {
  if (state.user && state.user.id) {
    localStorage.setItem(`em_cart_${state.user.id}`, JSON.stringify(state.cart));
  }
  if (state.user && state.token) {
    localStorage.setItem('em_cart', JSON.stringify(state.cart));
  } else {
    localStorage.removeItem('em_cart');
  }
  updateSessionUI();
}

// ============================================================================
// GESTIÓN DE FAVORITOS (LISTA DE DESEOS Y PRODUCTOS GUARDADOS)
// ============================================================================
function getFavoritesKey() {
  if (state.user && state.user.id) {
    return `em_favorites_user_${state.user.id}`;
  }
  return 'em_favorites_guest';
}

function getFavorites() {
  try {
    const key = getFavoritesKey();
    const raw = localStorage.getItem(key);
    let favs = raw ? JSON.parse(raw) : [];

    // Migración inteligente si el usuario recién inició sesión y tenía favoritos guardados como invitado
    if (state.user && state.user.id && (!Array.isArray(favs) || favs.length === 0)) {
      const guestRaw = localStorage.getItem('em_favorites_guest');
      if (guestRaw) {
        try {
          const guestFavs = JSON.parse(guestRaw);
          if (Array.isArray(guestFavs) && guestFavs.length > 0) {
            favs = guestFavs;
            localStorage.setItem(key, JSON.stringify(favs));
          }
        } catch (_) {}
      }
    }
    return Array.isArray(favs) ? favs : [];
  } catch (_) {
    return [];
  }
}

function saveFavorites(favs) {
  try {
    localStorage.setItem(getFavoritesKey(), JSON.stringify(favs));
  } catch (_) {}
  updateFavoritesBadge();
  if (state.user) {
    renderProfileWishlists(state.user);
  }
}

function isProductFavorite(productId) {
  const favs = getFavorites();
  return favs.some((item) => Number(item.id) === Number(productId));
}

function toggleFavorite(product) {
  const favs = getFavorites();
  const idx = favs.findIndex((item) => Number(item.id) === Number(product.id));
  let isFav = false;
  const precioNum = Number(product.precio || 0);

  if (idx >= 0) {
    favs.splice(idx, 1);
    isFav = false;
    showToast({
      title: product.nombre,
      message: 'Eliminado de tus favoritos',
      imageUrl: product.imagen_url || '/assets/logo.png',
      price: precioNum
    });
  } else {
    favs.push({
      id: product.id,
      nombre: product.nombre,
      precio: precioNum,
      imagen_url: product.imagen_url || '/assets/logo.png',
      categoria: product.categoria || '',
      marca: product.marca || '',
      sku: product.sku || '',
      descripcion: product.descripcion || '',
      calificacion_promedio: product.calificacion_promedio || 5.0,
      stock_disponible: product.stock_disponible ?? 10
    });
    isFav = true;
    showToast({
      title: product.nombre,
      message: '¡Guardado en tus favoritos!',
      imageUrl: product.imagen_url || '/assets/logo.png',
      price: precioNum
    });
  }

  saveFavorites(favs);
  updateFavoritesBadge();

  // Actualizar Buy Box si este producto está visible en la vista de detalle
  const buyboxFavIcon = document.getElementById('buybox-fav-icon');
  const buyboxFavText = document.getElementById('buybox-fav-text');
  if (buyboxFavIcon && buyboxFavText && state.currentProduct && Number(state.currentProduct.id) === Number(product.id)) {
    buyboxFavIcon.textContent = isFav ? 'favorite' : 'favorite_border';
    buyboxFavText.textContent = isFav ? 'Quitar de Favoritos' : 'Guardar en Favoritos';
  }

  // Refrescar vista de favoritos si está abierta
  const favsView = document.getElementById('view-favorites');
  if (favsView && !favsView.classList.contains('hidden')) {
    renderFavoritesView();
  }

  return isFav;
}

function updateFavoritesBadge() {
  const favs = getFavorites();
  const count = favs.length;
  const navBadge = document.getElementById('nav-favorites-count');
  if (navBadge) {
    navBadge.textContent = String(count);
    navBadge.classList.toggle('hidden', count === 0);
  }
  const viewBadge = document.getElementById('favorites-badge-count');
  if (viewBadge) {
    viewBadge.textContent = `${count} ${count === 1 ? 'artículo' : 'artículos'}`;
  }
}

function renderFavoritesView() {
  const container = document.getElementById('favorites-container');
  const badgeCount = document.getElementById('favorites-badge-count');
  const btnClearAll = document.getElementById('btn-fav-clear-all');
  if (!container) return;

  const favs = getFavorites();
  const count = favs.length;

  if (badgeCount) {
    badgeCount.textContent = `${count} ${count === 1 ? 'artículo' : 'artículos'}`;
  }

  if (btnClearAll) {
    btnClearAll.classList.toggle('hidden', count === 0);
  }

  if (count === 0) {
    container.innerHTML = `
      <div class="py-16 text-center max-w-md mx-auto">
        <div class="w-16 h-16 rounded-full bg-surface-container-high text-secondary mx-auto flex items-center justify-center mb-4">
          <span class="material-symbols-outlined text-[32px] text-secondary">favorite_border</span>
        </div>
        <h3 class="font-bold text-lg text-on-surface mb-1">Aún no tienes artículos en tus favoritos</h3>
        <p class="text-xs text-secondary mb-6">
          Guarda tus productos preferidos haciendo clic en el corazón de cualquier artículo del catálogo para tenerlos a la mano y comprarlos cuando gustes.
        </p>
        <button type="button" class="btn-fav-to-catalog px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[16px]">grid_view</span>
          <span>Explorar Catálogo</span>
        </button>
      </div>
    `;
    const btnToCat = container.querySelector('.btn-fav-to-catalog');
    if (btnToCat) {
      btnToCat.addEventListener('click', () => switchTab('view-catalog'));
    }
    return;
  }

  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
      ${favs
        .map((p) => {
          const precioNum = Number(p.precio || 0);
          const precioAnterior = Math.round(precioNum * 1.18);
          const imgUrl = p.imagen_url || '/assets/logo.png';
          return `
          <article class="bg-surface-container-lowest rounded-xl p-space-md shadow-[0_8px_24px_rgba(11,28,48,0.06)] hover:shadow-[0_14px_32px_rgba(11,28,48,0.12)] transition-all flex flex-col justify-between border border-surface-container relative group">
            <button
              type="button"
              class="btn-fav-remove-single absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-white/90 shadow hover:bg-rose-50 text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
              data-id="${p.id}"
              title="Quitar de favoritos"
            >
              <span class="material-symbols-outlined text-[18px]">favorite</span>
            </button>

            <div>
              <div class="relative w-full aspect-[4/3] rounded-xl bg-surface-container-low mb-space-sm overflow-hidden cursor-pointer open-fav-detail" data-id="${p.id}">
                ${
                  p.categoria
                    ? `<span class="absolute top-2.5 left-2.5 z-10 bg-primary text-on-primary font-label-xs text-label-xs px-2.5 py-0.5 rounded-full font-bold uppercase shadow-sm">${p.categoria}</span>`
                    : ''
                }
                <img
                  src="${imgUrl}"
                  alt="${p.nombre}"
                  class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                  onerror="this.src='/assets/logo.png'"
                />
              </div>

              <h3 class="font-headline-sm text-[16px] leading-snug text-on-surface font-bold line-clamp-2 mb-1 cursor-pointer hover:text-primary open-fav-detail" data-id="${p.id}">
                ${p.nombre}
              </h3>
              <p class="font-body-sm text-body-sm text-secondary line-clamp-2 mb-space-sm">
                ${p.descripcion || ''}
              </p>
            </div>

            <div class="pt-space-xs border-t border-surface-container">
              <div class="flex items-baseline gap-2 mb-2">
                <span class="font-price-card text-price-card text-on-surface font-extrabold">${formatMxn(precioNum)}</span>
                <span class="font-body-sm text-xs text-secondary line-through">${formatMxn(precioAnterior)}</span>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  class="py-2 px-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-bold transition-colors open-fav-detail cursor-pointer text-center"
                  data-id="${p.id}"
                >
                  Ver Ficha
                </button>
                <button
                  type="button"
                  class="py-2 px-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-bold transition-colors flex items-center justify-center gap-1 fav-add-cart cursor-pointer"
                  data-id="${p.id}"
                  data-nombre="${p.nombre}"
                  data-precio="${p.precio}"
                  data-imagen="${imgUrl}"
                >
                  <span class="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                  Agregar
                </button>
              </div>
            </div>
          </article>
        `;
        })
        .join('')}
    </div>
  `;

  container.querySelectorAll('.open-fav-detail').forEach((el) => {
    el.addEventListener('click', () => {
      const pid = Number(el.dataset.id);
      if (pid) openProductDetailPage(pid);
    });
  });

  container.querySelectorAll('.btn-fav-remove-single').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = Number(btn.dataset.id);
      const product = favs.find((item) => Number(item.id) === pid);
      if (product) {
        toggleFavorite(product);
      }
    });
  });

  container.querySelectorAll('.fav-add-cart').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state.token || !state.user) {
        document.getElementById('auth-dialog').showModal();
        showAlert('Inicia sesión o regístrate para agregar productos a tu carrito de compra.', true);
        return;
      }
      const pid = Number(btn.dataset.id);
      const precio = Number(btn.dataset.precio);
      const nombre = btn.dataset.nombre;
      const imagen = btn.dataset.imagen;

      const existing = state.cart.find((i) => i.productoId === pid);
      if (existing) {
        existing.cantidad += 1;
        if (!existing.imagen_url) existing.imagen_url = imagen;
      } else {
        state.cart.push({ productoId: pid, nombre, precio, imagen_url: imagen, cantidad: 1 });
      }
      saveCart();
      showToast({
        title: nombre,
        message: '¡Agregado a la cesta!',
        imageUrl: imagen,
        price: precio
      });
    });
  });
}

// ============================================================================
// NOTIFICACIONES RÁPIDAS DEL HEADER
// ============================================================================
function updateHeaderNotifications() {
  const notifCountBadge = document.getElementById('header-notif-count');
  const count = state.user && state.notifications ? state.notifications.length : 0;
  if (notifCountBadge) {
    notifCountBadge.textContent = String(count);
    notifCountBadge.classList.toggle('hidden', count === 0);
  }
}

function renderHeaderNotifications() {
  const listEl = document.getElementById('header-notifications-list');
  if (!listEl) return;

  if (!state.user || !state.token) {
    listEl.innerHTML = `
      <div class="py-8 text-center text-secondary">
        <span class="material-symbols-outlined text-[36px] text-secondary mb-2 block">notifications_off</span>
        <p class="font-bold text-sm text-on-surface">Inicia sesión para ver tus notificaciones</p>
        <p class="text-xs text-secondary mt-1">Recibirás avisos de confirmación de pedidos, envíos y alertas de tu cuenta.</p>
      </div>
    `;
    return;
  }

  const notifs = state.notifications || [];
  if (notifs.length === 0) {
    listEl.innerHTML = `
      <div class="py-8 text-center text-secondary">
        <span class="material-symbols-outlined text-[36px] text-secondary mb-2 block">notifications_none</span>
        <p class="font-bold text-sm text-on-surface">No tienes notificaciones pendientes</p>
        <p class="text-xs text-secondary mt-1">Aquí verás confirmaciones de compras, actualizaciones de entrega y promociones.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = notifs
    .map(
      (n) => `
      <div class="p-3 rounded-xl bg-surface-container-low border border-surface-container flex items-start gap-3">
        <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
          <span class="material-symbols-outlined text-[18px]">notifications</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2 mb-1">
            <strong class="text-xs font-bold text-on-surface truncate">${n.asunto || 'Aviso ExpressMart'}</strong>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">${n.acuse_recibo || 'Recibido'}</span>
          </div>
          <p class="text-xs text-secondary leading-relaxed">${n.mensaje || ''}</p>
        </div>
      </div>
    `
    )
    .join('');
}

// ============================================================================
// CATÁLOGO Y BÚSQUEDA CON TARJETAS STITCH "AURA COMMERCE" EN MXN
// ============================================================================
function createProductCard(p) {
  const precioNum = Number(p.precio);
  const precioAnterior = Math.round(precioNum * 1.18);
  const mensualidadMsi = (precioNum / 12).toFixed(2);
  const imgUrl = p.imagen_url || '/assets/logo.png';
  const isFav = isProductFavorite(p.id);

  const card = document.createElement('article');
  card.className =
    'bg-surface-container-lowest rounded-xl p-space-md shadow-[0_8px_24px_rgba(11,28,48,0.06)] hover:shadow-[0_14px_32px_rgba(11,28,48,0.12)] transition-all flex flex-col justify-between border border-surface-container relative group';

  card.innerHTML = `
    <div>
      <div class="relative w-full aspect-[4/3] rounded-xl bg-surface-container-low mb-space-sm overflow-hidden cursor-pointer open-detail-trigger" data-id="${p.id}">
        <span class="absolute top-2.5 left-2.5 z-10 bg-primary text-on-primary font-label-xs text-label-xs px-2.5 py-0.5 rounded-full font-bold uppercase shadow-sm">
          ${p.categoria} · ${p.marca}
        </span>
        <button
          type="button"
          class="btn-card-fav absolute top-2.5 right-2.5 z-20 w-8 h-8 rounded-full bg-white/90 shadow hover:bg-white text-rose-500 flex items-center justify-center transition-transform hover:scale-110 cursor-pointer"
          data-id="${p.id}"
          title="Guardar en favoritos"
        >
          <span class="material-symbols-outlined text-[18px] pointer-events-none">${isFav ? 'favorite' : 'favorite_border'}</span>
        </button>
        <span class="absolute bottom-2.5 left-2.5 z-10 bg-surface-container-highest/95 backdrop-blur-sm text-on-surface font-label-xs text-label-xs px-2 py-0.5 rounded-full font-bold shadow-sm">
          ${p.sku}
        </span>
        <img
          src="${imgUrl}"
          alt="Imagen del producto ${p.nombre}"
          class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
          onerror="this.src='/assets/logo.png'"
        />
      </div>

      <div class="flex items-center gap-1.5 text-amber-600 text-xs font-bold mb-1">
        <span class="material-symbols-outlined text-[15px] text-amber-500">star</span>
        <span>${Number(p.calificacion_promedio || 5.0).toFixed(1)} / 5.0</span>
        <span class="text-secondary font-normal">(${p.total_resenas || 0} reseñas verificadas)</span>
      </div>

      <h3 class="font-headline-sm text-[16px] leading-snug text-on-surface font-bold line-clamp-2 mb-1 cursor-pointer hover:text-primary open-detail-trigger" data-id="${p.id}">
        ${p.nombre}
      </h3>
      <p class="font-body-sm text-body-sm text-secondary line-clamp-2 mb-space-sm">
        ${p.descripcion}
      </p>
    </div>

    <div class="pt-space-xs border-t border-surface-container">
      <div class="flex items-baseline gap-2">
        <span class="font-price-card text-price-card text-on-surface font-extrabold">${formatMxn(precioNum)}</span>
        <span class="font-body-sm text-xs text-secondary line-through">${formatMxn(precioAnterior)}</span>
      </div>
      <div class="text-xs text-secondary mb-1">
        Hasta <strong>12 MSI de $${mensualidadMsi} MXN</strong> · IVA 16% incl.
      </div>
      <div class="flex items-center gap-1 text-tertiary font-label-xs text-label-xs font-bold mb-space-sm">
        <span class="material-symbols-outlined text-[15px]">verified</span>
        <span>ExpressPrime GRATIS · Stock: ${p.stock_disponible} uds.</span>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="py-2 px-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-bold transition-colors open-detail-trigger cursor-pointer text-center"
          data-id="${p.id}"
        >
          Ver Ficha
        </button>
        <button
          type="button"
          class="py-2 px-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-bold transition-colors flex items-center justify-center gap-1 add-to-cart-btn cursor-pointer"
          data-id="${p.id}"
          data-nombre="${p.nombre}"
          data-precio="${p.precio}"
          data-imagen="${imgUrl}"
        >
          <span class="material-symbols-outlined text-[16px]">add_shopping_cart</span>
          Agregar
        </button>
      </div>
    </div>
  `;

  card.querySelectorAll('.open-detail-trigger').forEach((el) => {
    el.addEventListener('click', () => openProductDetailPage(p.id));
  });

  const favBtn = card.querySelector('.btn-card-fav');
  if (favBtn) {
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isNowFav = toggleFavorite(p);
      const icon = favBtn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = isNowFav ? 'favorite' : 'favorite_border';
    });
  }

  card.querySelectorAll('.add-to-cart-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state.token || !state.user) {
        document.getElementById('auth-dialog').showModal();
        showAlert('Inicia sesión o regístrate para agregar productos a tu carrito de compra.', true);
        return;
      }
      const existing = state.cart.find((i) => i.productoId === p.id);
      if (existing) {
        existing.cantidad += 1;
        if (!existing.imagen_url) existing.imagen_url = imgUrl;
      } else {
        state.cart.push({ productoId: p.id, nombre: p.nombre, precio: precioNum, imagen_url: imgUrl, cantidad: 1 });
      }
      saveCart();
      showToast({
        title: p.nombre,
        message: '¡Agregado a la cesta!',
        imageUrl: imgUrl,
        price: precioNum
      });
    });
  });

  return card;
}

async function loadCatalog() {
  const categoria = document.getElementById('filter-category').value;
  const marca = document.getElementById('filter-brand').value;
  const maxPrecio = document.getElementById('filter-max-price').value;
  const orden = document.getElementById('filter-sort').value;

  const params = new URLSearchParams();
  if (categoria) params.set('categoria', categoria);
  if (marca) params.set('marca', marca);
  if (maxPrecio) params.set('maxPrecio', maxPrecio);
  if (orden) params.set('orden', orden);

  const data = await apiFetch(`/api/products?${params.toString()}`);
  const latencyPill = document.getElementById('search-latency-pill');
  if (latencyPill) {
    latencyPill.textContent = `Tiempo de respuesta: ${data.responseTimeMs} ms (${data.total} productos en MXN)`;
  }

  const recBanner = document.getElementById('recommendations-banner');
  if (recBanner) {
    if (data.recommendations && data.recommendations.degradedMode) {
      recBanner.textContent = `Aviso: ${data.recommendations.message}`;
      recBanner.classList.remove('hidden');
    } else {
      recBanner.classList.add('hidden');
    }
  }

  const grid = document.getElementById('products-grid');
  if (grid) {
    grid.innerHTML = '';
    for (const p of data.products) {
      grid.appendChild(createProductCard(p));
    }
  }
}

async function openSearchResultsPage(query, dept = '') {
  const queryDisplay = document.getElementById('search-query-display');
  const countPill = document.getElementById('search-results-count-pill');
  const latencyPill = document.getElementById('search-results-latency-pill');
  const grid = document.getElementById('search-results-grid');
  const emptyBox = document.getElementById('search-results-empty');

  if (queryDisplay) queryDisplay.textContent = `"${query || 'Todos los departamentos'}"`;

  switchTab('view-search-results');
  if (grid) grid.innerHTML = '<div class="col-span-full py-12 text-center text-secondary">Buscando productos en ExpressMart...</div>';
  if (emptyBox) emptyBox.classList.add('hidden');

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (dept) params.set('categoria', dept);

  try {
    const data = await apiFetch(`/api/products?${params.toString()}`);
    if (latencyPill) latencyPill.textContent = `Tiempo de respuesta: ${data.responseTimeMs} ms`;
    if (countPill) countPill.textContent = `${data.total} productos encontrados en MXN`;

    if (!data.products || data.products.length === 0) {
      if (grid) grid.innerHTML = '';
      if (emptyBox) emptyBox.classList.remove('hidden');
    } else {
      if (emptyBox) emptyBox.classList.add('hidden');
      if (grid) {
        grid.innerHTML = '';
        data.products.forEach((p) => {
          grid.appendChild(createProductCard(p));
        });
      }
    }
  } catch (err) {
    if (grid) grid.innerHTML = `<div class="col-span-full alert alert-error">${err.message}</div>`;
  }

}


// ============================================================================
// PÁGINA COMPLETA DE DETALLE DE PRODUCTO ESTILO MERCADO LIBRE / AMAZON
// CON ZOOM LENS INTERACTIVO AL PASAR EL RATÓN Y BUY BOX DEDICADO
// ============================================================================
async function openProductDetailPage(productId) {
  try {
    const p = await apiFetch(`/api/products/${productId}`);
    state.currentProduct = p;

    // Actualizar migas de pan
    document.getElementById('detail-breadcrumb-cat').textContent = p.categoria;
    document.getElementById('detail-breadcrumb-brand').textContent = p.marca;
    document.getElementById('detail-breadcrumb-name').textContent = p.nombre;

    // Configurar imagen principal y zoom
    const zoomBox = document.getElementById('product-zoom-box');
    const zoomImg = document.getElementById('product-zoom-image');
    const zoomHint = document.getElementById('zoom-badge-hint');
    const mainImgUrl = p.imagen_url || '/assets/logo.png';

    zoomImg.src = mainImgUrl;
    zoomImg.alt = p.nombre;
    zoomImg.style.transform = 'scale(1)';
    zoomImg.style.transformOrigin = 'center center';
    if (zoomHint) zoomHint.classList.remove('opacity-0');

    // Zoom interactivo al pasar el ratón (Magnificación 2.3x fluida con mouse tracking)
    zoomBox.onmousemove = (e) => {
      const rect = zoomBox.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      zoomImg.style.transformOrigin = `${x}% ${y}%`;
      zoomImg.style.transform = 'scale(2.3)';
      if (zoomHint) zoomHint.classList.add('opacity-0');
    };

    zoomBox.onmouseleave = () => {
      zoomImg.style.transformOrigin = 'center center';
      zoomImg.style.transform = 'scale(1)';
      if (zoomHint) zoomHint.classList.remove('opacity-0');
    };

    // Tira de miniaturas interactivas (vistas alternativas)
    const thumbsRow = document.getElementById('product-thumbnails-row');
    const thumbImages = [
      { label: 'Principal', url: mainImgUrl },
      { label: 'Detalle', url: mainImgUrl },
      { label: 'Empaque', url: mainImgUrl }
    ];

    thumbsRow.innerHTML = thumbImages
      .map(
        (t, idx) => `
        <button
          type="button"
          class="product-thumb-item flex-shrink-0 w-16 h-16 rounded-lg bg-surface-container-low border-2 ${
            idx === 0 ? 'border-primary ring-2 ring-primary/20' : 'border-surface-container opacity-70 hover:opacity-100'
          } p-1 overflow-hidden transition-all"
          data-url="${t.url}"
          title="Vista ${t.label}"
        >
          <img src="${t.url}" alt="${p.nombre} - ${t.label}" class="w-full h-full object-contain pointer-events-none" onerror="this.src='/assets/logo.png'" />
        </button>
      `
      )
      .join('');

    thumbsRow.querySelectorAll('.product-thumb-item').forEach((thumbBtn) => {
      thumbBtn.addEventListener('click', () => {
        thumbsRow.querySelectorAll('.product-thumb-item').forEach((b) => {
          b.classList.remove('border-primary', 'ring-2', 'ring-primary/20');
          b.classList.add('border-surface-container', 'opacity-70');
        });
        thumbBtn.classList.add('border-primary', 'ring-2', 'ring-primary/20');
        thumbBtn.classList.remove('border-surface-container', 'opacity-70');

        zoomImg.src = thumbBtn.dataset.url;
        zoomImg.style.transform = 'scale(1)';
      });
    });

    // Información del producto
    document.getElementById('detail-brand-badge').textContent = `${p.marca} · ${p.categoria}`;
    document.getElementById('detail-sku-badge').textContent = `SKU: ${p.sku}`;
    document.getElementById('detail-title').textContent = p.nombre;

    const ratingNum = Number(p.calificacion_promedio || 5.0).toFixed(1);
    const reviewsCount = (p.reviews || []).length;
    document.getElementById('detail-rating-num').textContent = ratingNum;
    document.getElementById('detail-rating-count').textContent = `${reviewsCount} opiniones verificadas`;

    // Precios y MSI
    const precio = Number(p.precio);
    const precioOrig = Math.round(precio * 1.18);
    const msiVal = (precio / 12).toFixed(2);
    document.getElementById('detail-price-main').textContent = formatMxn(precio);
    document.getElementById('detail-price-original').textContent = formatMxn(precioOrig);
    document.getElementById('detail-msi-val').textContent = `$${msiVal}`;

    // Descripción
    document.getElementById('detail-desc').textContent = p.descripcion;

    // Tabla de Especificaciones Técnicas
    const specsTable = document.getElementById('detail-specs-table');
    const specsEntries = Object.entries(p.especificaciones || {});
    if (specsEntries.length > 0) {
      specsTable.innerHTML = specsEntries
        .map(
          ([k, v], idx) => `
          <div class="grid grid-cols-3 p-2.5 ${idx % 2 === 0 ? 'bg-surface-container-low' : 'bg-surface-container-lowest'} border-b border-surface-container last:border-b-0">
            <span class="text-secondary font-medium capitalize">${k.replace(/_/g, ' ')}:</span>
            <span class="col-span-2 font-bold text-on-surface">${v}</span>
          </div>
        `
        )
        .join('');
    } else {
      specsTable.innerHTML = `<div class="p-3 text-secondary">Especificaciones verificadas por el fabricante oficial.</div>`;
    }

    // Reseñas verificadas
    document.getElementById('detail-reviews-total').textContent = String(reviewsCount);
    const reviewsList = document.getElementById('detail-reviews-list');
    if (reviewsCount > 0) {
      reviewsList.innerHTML = p.reviews
        .map(
          (r) => `
          <div class="p-3 rounded-xl bg-surface-container-low border border-surface-container">
            <div class="flex items-center justify-between text-xs mb-1.5">
              <div class="flex items-center gap-2">
                <span class="font-bold text-on-surface">${r.autor}</span>
                <span class="px-1.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-label-xs text-[10px] font-bold">
                  Compra Verificada
                </span>
              </div>
              <div class="flex items-center text-amber-500 font-bold text-xs">
                ${'★'.repeat(r.calificacion)}${'☆'.repeat(5 - r.calificacion)}
                <span class="text-secondary ml-1">${r.fecha ? r.fecha.split('T')[0] : 'Reciente'}</span>
              </div>
            </div>
            <p class="text-xs text-on-surface leading-relaxed">${r.comentario}</p>
          </div>
        `
        )
        .join('');
    } else {
      reviewsList.innerHTML = '<p class="text-xs text-secondary italic">Aún no hay opiniones registradas para este producto. ¡Sé el primero en calificarlo!</p>';
    }

    // Buy Box Dedicado
    document.getElementById('buybox-price').textContent = formatMxn(precio);
    document.getElementById('buybox-stock-label').textContent = `${p.stock_disponible} unidades disponibles para envío inmediato`;
    document.getElementById('buybox-quantity').value = '1';

    // Botón Agregar a la Cesta (Buy Box)
    const btnBuyboxAdd = document.getElementById('btn-buybox-add-cart');
    btnBuyboxAdd.onclick = () => {
      if (!state.token || !state.user) {
        document.getElementById('auth-dialog').showModal();
        showAlert('Inicia sesión o regístrate para agregar productos a tu carrito de compra.', true);
        return;
      }
      const qty = Number(document.getElementById('buybox-quantity').value || 1);
      const existing = state.cart.find((i) => i.productoId === p.id);
      if (existing) {
        existing.cantidad += qty;
        if (!existing.imagen_url) existing.imagen_url = mainImgUrl;
      } else {
        state.cart.push({
          productoId: p.id,
          nombre: p.nombre,
          precio: Number(p.precio),
          imagen_url: mainImgUrl,
          cantidad: qty
        });
      }
      saveCart();

      showToast({
        title: `${qty}x ${p.nombre}`,
        message: '¡Agregado a la cesta!',
        imageUrl: mainImgUrl,
        price: precio * qty
      });
    };

    // Botón Comprar Ahora (Buy Box)
    const btnBuyboxBuyNow = document.getElementById('btn-buybox-buy-now');
    btnBuyboxBuyNow.onclick = () => {
      if (!state.token || !state.user) {
        document.getElementById('auth-dialog').showModal();
        showAlert('Inicia sesión o regístrate para comprar productos en ExpressMart.', true);
        return;
      }
      const qty = Number(document.getElementById('buybox-quantity').value || 1);
      const existing = state.cart.find((i) => i.productoId === p.id);
      if (existing) {
        existing.cantidad += qty;
        if (!existing.imagen_url) existing.imagen_url = mainImgUrl;
      } else {
        state.cart.push({
          productoId: p.id,
          nombre: p.nombre,
          precio: Number(p.precio),
          imagen_url: mainImgUrl,
          cantidad: qty
        });
      }
      saveCart();

      const cartDialog = document.getElementById('cart-dialog');
      setCheckoutStep(1);
      refreshCartModal();
      cartDialog.showModal();
    };

    // Botón Guardar en Favoritos (Buy Box)
    const btnBuyboxFav = document.getElementById('btn-buybox-fav');
    const buyboxFavIcon = document.getElementById('buybox-fav-icon');
    const buyboxFavText = document.getElementById('buybox-fav-text');
    const isFavNow = isProductFavorite(p.id);
    if (buyboxFavIcon) buyboxFavIcon.textContent = isFavNow ? 'favorite' : 'favorite_border';
    if (buyboxFavText) buyboxFavText.textContent = isFavNow ? 'Quitar de Favoritos' : 'Guardar en Favoritos';

    if (btnBuyboxFav) {
      btnBuyboxFav.onclick = () => {
        const toggled = toggleFavorite(p);
        if (buyboxFavIcon) buyboxFavIcon.textContent = toggled ? 'favorite' : 'favorite_border';
        if (buyboxFavText) buyboxFavText.textContent = toggled ? 'Quitar de Favoritos' : 'Guardar en Favoritos';
      };
    }

    // Formulario de Reseña en la página
    const pageReviewForm = document.getElementById('page-review-form');
    pageReviewForm.onsubmit = async (e) => {
      e.preventDefault();
      if (!state.token) {
        document.getElementById('auth-dialog').showModal();
        showAlert('Inicie sesión para registrar una opinión verificada.', true);
        return;
      }
      try {
        await apiFetch(`/api/products/${p.id}/reviews`, {
          method: 'POST',
          body: JSON.stringify({
            calificacion: Number(document.getElementById('page-rev-rating').value),
            comentario: document.getElementById('page-rev-comment').value
          })
        });
        showAlert('Opinión verificada publicada exitosamente.');
        document.getElementById('page-rev-comment').value = '';
        openProductDetailPage(p.id);
        loadCatalog();
      } catch (err) {
        showAlert(err.message, true);
      }
    };

    // Cambiar a la vista de detalle de producto
    switchTab('view-product-detail');
  } catch (err) {
    showAlert(err.message, true);
  }
}

// Fallback para compatibilidad
function openProductDetailModal(productId) {
  openProductDetailPage(productId);
}

// ============================================================================
// CARRITO Y CHECKOUT EN 3 PASOS EN MXN CON MINIATURAS
// ============================================================================
function setCheckoutStep(stepNum) {
  [1, 2, 3].forEach((n) => {
    document.getElementById(`checkout-step-${n}`).classList.toggle('hidden', n !== stepNum);
    document.getElementById(`step-ind-${n}`).classList.toggle('active', n === stepNum);
  });

  // Restablecer botón de checkout al estado normal si volvemos a pasos anteriores
  const btnConfirm = document.getElementById('btn-confirm-order');
  const btnBackStep2 = document.getElementById('btn-back-step-2');
  if (btnConfirm && stepNum < 3) {
    btnConfirm.dataset.action = '';
    btnConfirm.textContent = 'Confirmar y Pagar en MXN';
    btnConfirm.className = 'btn btn-accent';
    if (btnBackStep2) btnBackStep2.classList.remove('hidden');
  }
}

async function refreshCartModal() {
  const container = document.getElementById('cart-items-container');
  const totalsBox = document.getElementById('cart-totals-box');
  const shipMsg = document.getElementById('free-shipping-msg');

  if (state.cart.length === 0) {
    container.innerHTML =
      '<p class="muted p-4 bg-surface-container-low rounded-xl text-center">Tu cesta está vacía. Explora el catálogo para agregar productos.</p>';
    totalsBox.innerHTML = '';
    state.calculatedTotals = null;
    return;
  }

  container.innerHTML = state.cart
    .map(
      (item, idx) => `
      <div class="flex items-center gap-3 py-3 px-3 mb-2 rounded-xl bg-surface-container-low border border-surface-container">
        <img
          src="${item.imagen_url || '/assets/logo.png'}"
          alt="${item.nombre}"
          class="w-16 h-16 rounded-lg object-contain bg-white p-1 border border-surface-dim shrink-0"
          onerror="this.src='/assets/logo.png'"
        />
        <div class="flex-1 min-w-0">
          <strong class="text-on-surface text-sm line-clamp-1">${item.nombre}</strong>
          <div class="text-xs text-secondary mt-0.5">Precio unitario: ${formatMxn(item.precio)}</div>
          <div class="flex items-center gap-2 mt-1.5">
            <div class="flex items-center border border-surface-dim rounded-lg overflow-hidden bg-white">
              <button type="button" class="cart-qty-btn cart-qty-minus px-2 py-0.5 text-xs hover:bg-slate-100 font-bold" data-idx="${idx}">-</button>
              <span class="px-2.5 py-0.5 text-xs font-bold text-on-surface">${item.cantidad}</span>
              <button type="button" class="cart-qty-btn cart-qty-plus px-2 py-0.5 text-xs hover:bg-slate-100 font-bold" data-idx="${idx}">+</button>
            </div>
            <button type="button" class="text-xs text-error hover:underline cart-remove-btn" data-idx="${idx}">Quitar</button>
          </div>
        </div>
        <div class="text-right shrink-0">
          <span class="font-bold text-primary text-sm">${formatMxn(item.precio * item.cantidad)}</span>
        </div>
      </div>
    `
    )
    .join('');

  // Controles de cantidad (+) y (-)
  container.querySelectorAll('.cart-qty-plus').forEach((b) => {
    b.addEventListener('click', () => {
      const idx = Number(b.dataset.idx);
      state.cart[idx].cantidad += 1;
      saveCart();
      refreshCartModal();
    });
  });

  container.querySelectorAll('.cart-qty-minus').forEach((b) => {
    b.addEventListener('click', () => {
      const idx = Number(b.dataset.idx);
      if (state.cart[idx].cantidad > 1) {
        state.cart[idx].cantidad -= 1;
      } else {
        state.cart.splice(idx, 1);
      }
      saveCart();
      refreshCartModal();
    });
  });

  container.querySelectorAll('.cart-remove-btn').forEach((b) => {
    b.addEventListener('click', () => {
      state.cart.splice(Number(b.dataset.idx), 1);
      saveCart();
      refreshCartModal();
    });
  });

  try {
    const calc = await apiFetch('/api/cart/calculate', {
      method: 'POST',
      body: JSON.stringify({ items: state.cart, cuponCodigo: state.coupon })
    });
    state.calculatedTotals = calc;

    // Sincronizar imágenes devueltas si el item no la tenía
    if (calc.items && Array.isArray(calc.items)) {
      calc.items.forEach((ci) => {
        const localItem = state.cart.find((i) => i.productoId === ci.productoId);
        if (localItem && ci.imagen_url && !localItem.imagen_url) {
          localItem.imagen_url = ci.imagen_url;
        }
      });
    }

    if (shipMsg) {
      if (calc.isPremium) {
        shipMsg.innerHTML = '<span class="text-emerald-700 font-bold flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">verified</span> Tienes Envíos ExpressPrime GRATIS en todos tus pedidos por ser Miembro Premium</span>';
      } else {
        shipMsg.textContent =
          calc.costoEnvio === 0
            ? 'Tu pedido incluye Envío ExpressPrime GRATIS en México ($0.00 MXN)'
            : `Agrega ${formatMxn(Math.max(0, 999 - calc.subtotal))} más para obtener Envío ExpressPrime GRATIS`;
      }
    }

    totalsBox.innerHTML = `
      <div class="space-y-1 text-sm">
        <div class="flex justify-between"><span>Subtotal productos:</span> <strong>${formatMxn(calc.subtotal)}</strong></div>
        ${calc.descuento > 0 ? `<div class="flex justify-between text-tertiary"><span>Descuento (${calc.cuponAplicado || 'Cupón'}):</span> <strong>-${formatMxn(calc.descuento)}</strong></div>` : ''}
        ${calc.cashback > 0 ? `<div class="flex justify-between text-emerald-600 font-semibold"><span>Cashback ExpressPrime (5%):</span> <strong>-${formatMxn(calc.cashback)}</strong></div>` : ''}
        <div class="flex justify-between"><span>IVA trasladado (16% México):</span> <strong>${formatMxn(calc.impuestos)}</strong></div>
        <div class="flex justify-between"><span>Envío ExpressPrime DHL/FedEx:</span> <strong>${calc.costoEnvio === 0 ? (calc.isPremium ? 'GRATIS (Beneficio Miembro Prime $0.00 MXN)' : 'GRATIS ($0.00 MXN)') : formatMxn(calc.costoEnvio)}</strong></div>
        <div class="flex justify-between text-lg pt-2 border-t border-surface-dim text-primary">
          <strong>Total a Pagar (MXN):</strong> <strong>${formatMxn(calc.total)}</strong>
        </div>
      </div>
    `;
  } catch (err) {
    totalsBox.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

// ============================================================================
// PEDIDOS, PERFIL, ADMIN Y AUDITORÍA EN MXN
// ============================================================================
async function loadOrders() {
  const box = document.getElementById('orders-list');
  if (!state.token) {
    box.innerHTML =
      '<p class="muted p-4 rounded-xl bg-surface-container-low">Inicie sesión para consultar sus pedidos en MXN, guías DHL/FedEx y gestionar devoluciones.</p>';
    return;
  }
  try {
    const data = await apiFetch('/api/orders');
    if (!data.orders || !data.orders.length) {
      box.innerHTML = `
        <div class="p-8 rounded-2xl bg-surface-container-low text-center border border-dashed border-surface-container">
          <span class="material-symbols-outlined text-[48px] text-secondary mb-2 block">receipt_long</span>
          <p class="font-bold text-on-surface text-base">Aún no tienes pedidos registrados</p>
          <p class="text-xs text-secondary mt-1 mb-4">Explora nuestro catálogo de productos en MXN y realiza tu primera compra con envío ExpressPrime gratis.</p>
          <button type="button" class="btn-nav-catalog px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-bold text-xs transition-colors cursor-pointer">
            Ir al Catálogo de Productos
          </button>
        </div>
      `;
      box.querySelector('.btn-nav-catalog')?.addEventListener('click', () => switchTab('view-catalog'));
      return;
    }

    box.innerHTML = data.orders
      .map((o) => {
        const itemsHtml = (o.items || [])
          .map((item) => {
            const imgUrl = item.imagen_url || '/assets/logo.png';
            const unitPrice = Number(item.precio_unitario || item.precio || 0);
            const subtotal = Number(item.subtotal || unitPrice * item.cantidad);
            return `
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-container-lowest border border-surface-container hover:border-primary/40 transition-all">
              <div class="relative w-16 h-16 rounded-lg bg-white p-1 border border-surface-dim shrink-0 overflow-hidden cursor-pointer order-item-view-trigger" data-prod-id="${item.producto_id}" title="Ver ficha técnica">
                <img
                  src="${imgUrl}"
                  alt="${item.nombre_producto}"
                  class="w-full h-full object-contain hover:scale-105 transition-transform"
                  onerror="this.src='/assets/logo.png'"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                  ${item.categoria ? `<span class="px-2 py-0.2 rounded bg-surface-container-high text-on-surface font-label-xs text-[10px] font-bold uppercase">${item.categoria}</span>` : ''}
                  ${item.marca ? `<span class="text-secondary text-xs">${item.marca}</span>` : ''}
                  ${item.sku ? `<span class="text-secondary text-[11px] font-mono">(${item.sku})</span>` : ''}
                </div>
                <h4
                  class="font-headline-sm text-sm text-on-surface font-bold truncate cursor-pointer hover:text-primary transition-colors order-item-view-trigger"
                  data-prod-id="${item.producto_id}"
                  title="Ver ficha técnica"
                >
                  ${item.nombre_producto}
                </h4>
                <div class="flex items-center gap-2 text-xs text-secondary mt-1">
                  <span>Cantidad: <strong class="text-on-surface">${item.cantidad} ${item.cantidad === 1 ? 'unidad' : 'unidades'}</strong></span>
                  <span>·</span>
                  <span>Precio unitario: <strong class="text-on-surface">${formatMxn(unitPrice)}</strong></span>
                </div>
              </div>
              <div class="text-right shrink-0">
                <span class="font-label-xs text-secondary text-[11px] block">Subtotal</span>
                <span class="font-bold text-on-surface text-sm">${formatMxn(subtotal)}</span>
                <button
                  type="button"
                  class="mt-1 px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[11px] font-bold flex items-center gap-1 transition-colors order-item-view-trigger cursor-pointer ml-auto"
                  data-prod-id="${item.producto_id}"
                >
                  <span class="material-symbols-outlined text-[14px]">visibility</span>
                  Ver Producto
                </button>
              </div>
            </div>
          `;
          })
          .join('');

        const estadoColor =
          o.estado === 'entregado'
            ? 'bg-tertiary-fixed text-on-tertiary-fixed font-bold'
            : o.estado === 'devuelto' || o.estado === 'cancelado'
            ? 'bg-error-container text-on-error-container font-bold'
            : 'bg-primary-fixed text-on-primary-fixed font-bold';

        return `
        <div class="p-space-lg rounded-2xl bg-surface-container-low border border-surface-container flex flex-col gap-3 shadow-sm">
          <!-- Encabezado del Pedido -->
          <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-container">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-label-xs text-label-xs uppercase text-secondary font-bold">Folio:</span>
                <strong class="font-headline-sm text-headline-sm text-on-surface">${o.folio}</strong>
                <span class="px-2.5 py-0.5 rounded-full text-xs uppercase ${estadoColor}">
                  ${o.estado.toUpperCase()}
                </span>
              </div>
              <div class="text-xs text-secondary mt-0.5">
                Fecha: ${o.created_at ? o.created_at.split('T')[0] : 'Reciente'} · Compra protegida por garantía oficial ExpressMart
              </div>
            </div>
            <div class="text-right">
              <span class="font-label-xs text-secondary text-xs block">Total Pagado en MXN</span>
              <span class="font-headline-sm text-lg text-primary font-extrabold">${formatMxn(o.total)}</span>
            </div>
          </div>

          <!-- Detalles de los Productos Comprados -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="font-label-sm text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px] text-primary">inventory_2</span>
                Detalles del Producto (${o.items ? o.items.length : 0} ${o.items && o.items.length === 1 ? 'artículo' : 'artículos'}):
              </span>
              <span class="text-xs text-tertiary font-bold flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">verified</span>
                Envío ExpressPrime
              </span>
            </div>
            <div class="space-y-2">
              ${itemsHtml || '<p class="text-xs text-secondary italic">No se encontraron artículos registrados para este pedido.</p>'}
            </div>
          </div>

          <!-- Datos de Envío y Pago -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-surface-container text-xs text-on-surface">
            <div class="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container space-y-1">
              <div class="text-secondary font-bold uppercase text-[10px] flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px] text-primary">local_shipping</span>
                Información de Logística y Envío:
              </div>
              <div><strong>Guía ExpressPrime:</strong> ${o.envio ? `${o.envio.numero_guia} (${o.envio.proveedor_paqueteria} · ${o.envio.estado_envio})` : 'Asignando guía en CEDIS'}</div>
              <div class="text-secondary truncate"><strong>Dirección:</strong> ${o.direccion_envio}</div>
            </div>
            <div class="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container space-y-1">
              <div class="text-secondary font-bold uppercase text-[10px] flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px] text-primary">credit_card</span>
                Método de Pago Seguro:
              </div>
              <div><strong>Transacción:</strong> ${o.pago ? `${o.pago.tarjeta_enmascarada} (${o.pago.referencia_pasarela})` : o.metodo_pago}</div>
              <div class="text-secondary"><strong>IVA Trasladado:</strong> 16% incluido en el total pagado</div>
            </div>
          </div>

          <!-- Botón de Devolución -->
          <div class="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-surface-container">
            <span class="text-xs text-secondary">
              Garantía de satisfacción de 30 días para devoluciones sin costo.
            </span>
            <div>
              ${
                o.estado !== 'devuelto' && o.estado !== 'cancelado'
                  ? `<button type="button" class="btn btn-sm btn-outline return-order-btn cursor-pointer" data-id="${o.id}">Solicitar Devolución y Reembolso en MXN</button>`
                  : '<span class="badge badge-ok">Reembolsado en MXN / Devolución completada</span>'
              }
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    box.querySelectorAll('.order-item-view-trigger').forEach((el) => {
      el.addEventListener('click', () => {
        const prodId = Number(el.dataset.prodId);
        if (prodId) {
          openProductDetailPage(prodId);
        }
      });
    });

    box.querySelectorAll('.return-order-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await apiFetch(`/api/orders/${btn.dataset.id}/return`, {
            method: 'POST',
            body: JSON.stringify({ motivo: 'Devolución en línea sin costo dentro del plazo de garantía' })
          });
          showAlert('Devolución autorizada y reembolso en MXN procesado.');
          loadOrders();
        } catch (err) {
          showAlert(err.message, true);
        }
      });
    });
  } catch (err) {
    box.innerHTML = `<p class="alert alert-error">${err.message}</p>`;
  }
}

async function loadProfile() {
  if (!state.token) return;
  try {
    const data = await apiFetch('/api/auth/profile');
    document.getElementById('prof-nombre').value = data.user.nombre || '';
    document.getElementById('prof-direccion').value = data.user.direccion || '';
    document.getElementById('prof-telefono').value = data.user.telefono || '';
    document.getElementById('prof-mfa').checked = Boolean(data.user.mfaEnabled);

    // Actualizar datos de usuario y membresía en estado local
    if (data.user) {
      if (data.user.fotoPerfil) {
        state.user.fotoPerfil = data.user.fotoPerfil;
      }
      state.user.membresiaPremium = Boolean(data.user.membresiaPremium);
      state.user.membresiaPlan = data.user.membresiaPlan || '';
      state.user.membresiaExpira = data.user.membresiaExpira || '';
      localStorage.setItem('em_user', JSON.stringify(state.user));
    }
    updateProfilePhotoUI(data.user?.fotoPerfil || '');
    updateSessionUI();
    state.notifications = data.notifications || [];
    updateHeaderNotifications();

    const notifList = document.getElementById('notifications-list');
    notifList.innerHTML = (data.notifications || [])
      .map(
        (n) => `
        <div class="p-3 rounded-lg bg-surface-container-low border border-surface-container">
          <div class="flex items-center justify-between gap-2 mb-1">
            <strong class="text-xs text-on-surface">${n.asunto}</strong>
            <span class="badge badge-ok">${n.acuse_recibo}</span>
          </div>
          <div class="text-xs text-secondary">${n.mensaje}</div>
        </div>
      `
      )
      .join('');
  } catch (err) {
    showAlert(err.message, true);
  }
}

function renderMembershipProfile() {
  const badgeEl = document.getElementById('profile-membership-badge');
  const sectionEl = document.getElementById('profile-membership-section');
  if (!sectionEl) return;

  const isPremium = Boolean(state.user && state.user.membresiaPremium);
  const plan = state.user?.membresiaPlan || '';
  const expira = state.user?.membresiaExpira ? new Date(state.user.membresiaExpira).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  const planNombres = {
    '1_mes': 'ExpressPrime 1 Mes',
    '3_meses': 'ExpressPrime 3 Meses',
    '1_ano': 'ExpressPrime 1 Año'
  };

  if (badgeEl) {
    if (isPremium) {
      badgeEl.className = 'px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-label-xs text-label-xs font-bold flex items-center gap-1 shadow-sm';
      badgeEl.innerHTML = '<span class="material-symbols-outlined text-[14px]">workspace_premium</span> Miembro ExpressPrime Activo';
    } else {
      badgeEl.className = 'px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-label-xs text-label-xs font-bold flex items-center gap-1';
      badgeEl.innerHTML = '<span class="material-symbols-outlined text-[14px]">person</span> Cuenta Estándar (Sin Membresía)';
    }
  }

  if (isPremium) {
    sectionEl.innerHTML = `
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-500/30">
        <div class="flex items-start gap-3">
          <div class="w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
            <span class="material-symbols-outlined text-[28px]">workspace_premium</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-headline-sm text-headline-sm font-bold text-on-surface">Membresía ExpressPrime Activa</h3>
              <span class="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-bold uppercase">${planNombres[plan] || 'ExpressPrime'}</span>
            </div>
            <p class="text-xs text-secondary mt-0.5">
              ${expira ? `Vigente hasta el <strong>${expira}</strong>.` : 'Membresía activa por tiempo determinado.'} Disfrutas de todos los beneficios preferenciales en MXN.
            </p>
            <div class="flex flex-wrap items-center gap-4 mt-2 text-xs font-semibold text-on-surface">
              <span class="flex items-center gap-1 text-emerald-700">
                <span class="material-symbols-outlined text-[16px]">check_circle</span>
                Envíos ExpressPrime GRATIS sin mínimo
              </span>
              <span class="flex items-center gap-1 text-emerald-700">
                <span class="material-symbols-outlined text-[16px]">check_circle</span>
                5% de Cashback en todas tus compras
              </span>
              <span class="flex items-center gap-1 text-emerald-700">
                <span class="material-symbols-outlined text-[16px]">check_circle</span>
                Devoluciones prioritarias sin costo
              </span>
            </div>
          </div>
        </div>
        <div class="shrink-0 flex items-center gap-2">
          <button type="button" id="btn-cancel-membership" class="px-3.5 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-error font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer">
            <span class="material-symbols-outlined text-[16px]">cancel</span>
            Cancelar Suscripción
          </button>
        </div>
      </div>
    `;

    const btnCancel = document.getElementById('btn-cancel-membership');
    if (btnCancel) {
      btnCancel.addEventListener('click', async () => {
        if (!confirm('¿Estás seguro de que deseas cancelar tu suscripción a ExpressPrime? Perderás tus envíos gratis y el 5% de cashback en futuras compras.')) {
          return;
        }
        try {
          btnCancel.disabled = true;
          btnCancel.textContent = 'Cancelando...';
          const res = await apiFetch('/api/membership/cancel', { method: 'POST' });
          showAlert(res.message || 'Membresía cancelada correctamente.');
          if (state.user) {
            state.user.membresiaPremium = false;
            state.user.membresiaPlan = '';
            state.user.membresiaExpira = '';
            localStorage.setItem('em_user', JSON.stringify(state.user));
          }
          updateSessionUI();
          renderMembershipProfile();
          refreshCartModal();
        } catch (err) {
          showAlert(err.message, true);
          btnCancel.disabled = false;
          btnCancel.textContent = 'Cancelar Suscripción';
        }
      });
    }
  } else {
    sectionEl.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-amber-500 text-[24px]">workspace_premium</span>
              <h3 class="font-headline-sm text-headline-sm font-bold text-on-surface">Suscríbete a ExpressPrime México</h3>
            </div>
            <p class="text-xs text-secondary mt-0.5">
              Obtén <strong>Envíos Gratis ilimitados</strong> en todos tus pedidos sin compra mínima y <strong>5% de Cashback</strong> en cada compra en MXN.
            </p>
          </div>
          <button type="button" class="btn-trigger-subscribe px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer shrink-0" data-plan="1_mes">
            <span class="material-symbols-outlined text-[16px]">lock_open</span>
            Suscribirme Ahora
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <!-- Tarjeta 1 Mes -->
          <div class="p-3.5 rounded-xl border border-surface-container bg-surface-container-low hover:border-primary transition-all flex flex-col justify-between">
            <div>
              <span class="text-[11px] font-bold text-secondary uppercase">Plan 1 Mes</span>
              <div class="font-headline-sm text-headline-sm font-extrabold text-primary mt-1">$99.00 <span class="text-xs font-normal text-secondary">MXN / mes</span></div>
              <ul class="text-xs text-secondary mt-2 space-y-1">
                <li class="flex items-center gap-1">✓ Envíos gratis sin mínimo</li>
                <li class="flex items-center gap-1">✓ 5% de Cashback en cada compra</li>
              </ul>
            </div>
            <button type="button" class="btn-trigger-subscribe mt-3 w-full py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold transition-colors cursor-pointer" data-plan="1_mes">
              Elegir 1 Mes ($99)
            </button>
          </div>

          <!-- Tarjeta 3 Meses -->
          <div class="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/5 hover:border-amber-500 transition-all flex flex-col justify-between relative">
            <span class="absolute -top-2 right-3 px-2 py-0.2 rounded-full bg-amber-500 text-white text-[9px] font-bold uppercase">Ahorro 16%</span>
            <div>
              <span class="text-[11px] font-bold text-secondary uppercase">Plan 3 Meses</span>
              <div class="font-headline-sm text-headline-sm font-extrabold text-primary mt-1">$249.00 <span class="text-xs font-normal text-secondary">MXN ($83/mes)</span></div>
              <ul class="text-xs text-secondary mt-2 space-y-1">
                <li class="flex items-center gap-1">✓ Envíos gratis garantizados</li>
                <li class="flex items-center gap-1">✓ 5% de Cashback en cada compra</li>
                <li class="flex items-center gap-1 text-amber-700 font-semibold">✓ Ahorro del 16%</li>
              </ul>
            </div>
            <button type="button" class="btn-trigger-subscribe mt-3 w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm" data-plan="3_meses">
              Elegir 3 Meses ($249)
            </button>
          </div>

          <!-- Tarjeta 1 Año -->
          <div class="p-3.5 rounded-xl border border-primary/40 bg-primary/5 hover:border-primary transition-all flex flex-col justify-between relative">
            <span class="absolute -top-2 right-3 px-2 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-bold uppercase">25% Ahorro</span>
            <div>
              <span class="text-[11px] font-bold text-secondary uppercase">Plan 1 Año</span>
              <div class="font-headline-sm text-headline-sm font-extrabold text-primary mt-1">$899.00 <span class="text-xs font-normal text-secondary">MXN ($74.91/mes)</span></div>
              <ul class="text-xs text-secondary mt-2 space-y-1">
                <li class="flex items-center gap-1">✓ Envíos gratis todo el año</li>
                <li class="flex items-center gap-1">✓ 5% de Cashback en todas tus compras</li>
                <li class="flex items-center gap-1 text-emerald-700 font-semibold">✓ Mejor valor · Ahorro 25%</li>
              </ul>
            </div>
            <button type="button" class="btn-trigger-subscribe mt-3 w-full py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-bold transition-colors cursor-pointer shadow-sm" data-plan="1_ano">
              Elegir 1 Año ($899)
            </button>
          </div>
        </div>
      </div>
    `;

    sectionEl.querySelectorAll('.btn-trigger-subscribe').forEach((btn) => {
      btn.addEventListener('click', () => {
        const plan = btn.dataset.plan || '1_mes';
        openSubscriptionDialog(plan);
      });
    });
  }
}

function openSubscriptionDialog(defaultPlan = '1_mes') {
  const dialog = document.getElementById('subscription-dialog');
  if (!dialog) return;

  if (!state.user || !state.token) {
    showAlert('Debes iniciar sesión para suscribirte a ExpressPrime.', true);
    openAuthModal('login');
    return;
  }

  // Preseleccionar el plan indicado
  const radio = dialog.querySelector(`input[name="sub_plan"][value="${defaultPlan}"]`);
  if (radio) {
    radio.checked = true;
  }
  updateSubPlanSelection();

  // Resetear resultado y habilitar botón
  const resBox = document.getElementById('sub-result-box');
  if (resBox) resBox.innerHTML = '';
  const btnConfirm = document.getElementById('btn-confirm-subscription');
  if (btnConfirm) {
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = '<span class="material-symbols-outlined text-[18px]">lock</span><span>Confirmar y Simular Pago</span>';
  }

  // Actualizar nombre de tarjeta por defecto con el nombre del usuario
  const cardNameInput = document.getElementById('sub-card-name');
  if (cardNameInput && state.user && state.user.nombre) {
    cardNameInput.value = state.user.nombre.toUpperCase();
  }

  dialog.showModal();
}

function updateSubPlanSelection() {
  const dialog = document.getElementById('subscription-dialog');
  if (!dialog) return;

  const selectedPlanRadio = dialog.querySelector('input[name="sub_plan"]:checked');
  const planVal = selectedPlanRadio ? selectedPlanRadio.value : '1_mes';

  const planPrices = {
    '1_mes': '$99.00 MXN',
    '3_meses': '$249.00 MXN',
    '1_ano': '$899.00 MXN'
  };

  const totalEl = document.getElementById('sub-summary-total');
  if (totalEl) {
    totalEl.textContent = planPrices[planVal] || '$99.00 MXN';
  }

  // Actualizar estilos de las tarjetas de plan
  dialog.querySelectorAll('.sub-plan-card').forEach((card) => {
    const radio = card.querySelector('input[name="sub_plan"]');
    const isChecked = radio && radio.checked;
    const dot = card.querySelector('.sub-plan-dot');
    const indicator = card.querySelector('.sub-plan-indicator');

    if (isChecked) {
      card.classList.add('border-primary', 'bg-primary/5', 'shadow-sm');
      card.classList.remove('border-surface-container', 'bg-surface-container-lowest');
      if (indicator) {
        indicator.classList.add('border-primary');
        indicator.classList.remove('border-surface-container');
      }
      if (dot) dot.classList.remove('hidden');
    } else {
      card.classList.remove('border-primary', 'bg-primary/5', 'shadow-sm');
      card.classList.add('border-surface-container', 'bg-surface-container-lowest');
      if (indicator) {
        indicator.classList.remove('border-primary');
        indicator.classList.add('border-surface-container');
      }
      if (dot) dot.classList.add('hidden');
    }
  });
}

async function handleSubscriptionSubmit() {
  const dialog = document.getElementById('subscription-dialog');
  const btnConfirm = document.getElementById('btn-confirm-subscription');
  const resultBox = document.getElementById('sub-result-box');
  if (!dialog || !btnConfirm) return;

  const selectedPlanRadio = dialog.querySelector('input[name="sub_plan"]:checked');
  const plan = selectedPlanRadio ? selectedPlanRadio.value : '1_mes';

  const selectedMethodRadio = dialog.querySelector('input[name="sub_payment_method"]:checked');
  const metodoPago = selectedMethodRadio ? selectedMethodRadio.value : 'tarjeta';

  if (metodoPago === 'paypal') {
    const subEmail = document.getElementById('sub-paypal-email')?.value.trim() || '';
    const subPwd = document.getElementById('sub-paypal-password')?.value.trim() || '';
    if (!subEmail || !subPwd) {
      showAlert('Debe ingresar el correo y la contraseña de PayPal Sandbox antes de simular la membresía.', true);
      return;
    }
    if (subEmail.toLowerCase() !== 'bancochido@banco.com' || subPwd !== 'nBBi"*d6') {
      showAlert('Credenciales de PayPal Sandbox no válidas. Use correo: bancochido@banco.com y contraseña: nBBi"*d6', true);
      return;
    }
  }

  const cardNumber = (document.getElementById('sub-card-number')?.value || '4111111111114242').replace(/\s+/g, '');
  const cardHolder = document.getElementById('sub-card-name')?.value || state.user?.nombre || 'CLIENTE';
  const expiry = document.getElementById('sub-card-exp')?.value || '12/29';

  try {
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span><span>Procesando pago simulado...</span>';
    if (resultBox) resultBox.innerHTML = '';

    const res = await apiFetch('/api/membership/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        plan,
        metodoPago,
        cardNumber,
        cardHolder,
        expiry
      })
    });

    if (res.success) {
      // Actualizar estado del usuario en local
      if (state.user) {
        state.user.membresiaPremium = true;
        state.user.membresiaPlan = res.user?.membresiaPlan || plan;
        state.user.membresiaExpira = res.user?.membresiaExpira || res.expiraEn;
        localStorage.setItem('em_user', JSON.stringify(state.user));
      }

      updateSessionUI();
      renderMembershipProfile();
      refreshCartModal();

      if (resultBox) {
        resultBox.innerHTML = `
          <div class="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 space-y-1 text-xs">
            <div class="flex items-center gap-1.5 font-bold text-sm text-emerald-800">
              <span class="material-symbols-outlined text-[18px]">verified</span>
              <span>${res.message}</span>
            </div>
            <div>Plan: <strong>${res.plan?.nombre}</strong> | Total Cobrado: <strong>$${res.plan?.precio?.toFixed(2)} MXN</strong></div>
            <div>Referencia de Pago: <strong>${res.pago?.referenciaPasarela || 'CAPTURED'}</strong> (${metodoPago.toUpperCase()})</div>
          </div>
        `;
      }

      showToast({
        title: '¡Membresía ExpressPrime Activada!',
        message: `Plan: ${res.plan?.nombre} · Envíos gratis y 5% de cashback activados`,
        imageUrl: '/assets/logo.png',
        price: res.plan?.precio
      });

      setTimeout(() => {
        dialog.close();
      }, 1500);
    }
  } catch (err) {
    if (resultBox) {
      resultBox.innerHTML = `<div class="alert alert-error text-xs">${err.message}</div>`;
    }
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = '<span class="material-symbols-outlined text-[18px]">lock</span><span>Confirmar y Simular Pago</span>';
  }
}

async function loadAdminReports() {
  const box = document.getElementById('admin-reports-box');
  try {
    const rep = await apiFetch('/api/reports/summary');
    box.innerHTML = `
      <div class="kpis-grid mb-3">
        <div class="kpi-card"><div>Pedidos Activos</div><div class="kpi-val">${rep.ventas.totalPedidos}</div></div>
        <div class="kpi-card"><div>Ingresos (MXN)</div><div class="kpi-val">${formatMxn(rep.ventas.ingresosTotalesMxn)}</div></div>
        <div class="kpi-card"><div>Ticket Promedio</div><div class="kpi-val">${formatMxn(rep.ventas.ticketPromedioMxn)}</div></div>
        <div class="kpi-card"><div>SKUs en Catálogo</div><div class="kpi-val">${rep.inventario.totalProductosActivos}</div></div>
      </div>
      <h4 class="font-label-lg text-label-lg font-bold mb-1">Conciliación de Inventario en Almacén (CEDIS CDMX Norte)</h4>
      <pre class="code-box">${JSON.stringify(rep.inventario.detalleInventario, null, 2)}</pre>
    `;
  } catch (err) {
    box.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

async function loadAuditCenter() {
  const kpiGrid = document.getElementById('audit-kpis-grid');
  try {
    const metrics = await apiFetch('/api/metrics');
    const k = metrics.kpisApartado7;
    kpiGrid.innerHTML = `
      <div class="kpi-card"><div>Disponibilidad (Meta ≥99.9%)</div><div class="kpi-val">${k.disponibilidadServicioPorcentaje}%</div></div>
      <div class="kpi-card"><div>Latencia Checkout (Meta ≤2000ms)</div><div class="kpi-val">${k.rendimientoCheckoutPromedioMs} ms</div></div>
      <div class="kpi-card"><div>Cobertura Pruebas (Meta ≥80%)</div><div class="kpi-val">${k.coberturaPruebasAutomatizadasPorcentaje}%</div></div>
      <div class="kpi-card"><div>Vulnerabilidades Críticas (Meta 0)</div><div class="kpi-val">${k.vulnerabilidadesCriticasAbiertas}</div></div>
      <div class="kpi-card"><div>Satisfacción Cliente (Meta ≥4.5)</div><div class="kpi-val">${k.satisfaccionClientePromedio} / 5</div></div>
    `;

    const dbPolicy = await apiFetch('/api/quality/database-policy');
    const policyEl = document.getElementById('db-policy-box');
    if (policyEl) {
      policyEl.textContent = JSON.stringify(dbPolicy, null, 2);
    }

    if (state.token && state.user && ['administrador', 'auditor'].includes(state.user.rol)) {
      const dq = await apiFetch('/api/quality/data-audit');
      document.getElementById('data-quality-box').textContent = JSON.stringify(dq, null, 2);

      const logs = await apiFetch('/api/audit-logs');
      document.getElementById('audit-logs-box').textContent = JSON.stringify(
        { cadenaIntegraSHA256: logs.chainIntact, totalRegistros: logs.totalEntries, ultimosEventos: logs.logs.slice(0, 8) },
        null,
        2
      );
    }
  } catch (err) {
    showAlert(err.message, true);
  }
}

// ============================================================================
// BUSCADOR EN VIVO CON SUGERENCIAS INTERACTIVAS E IMÁGENES
// ============================================================================
function setupSearchSuggestions() {
  const searchInput = document.getElementById('search-input');
  const searchForm = document.getElementById('search-form');
  const dropdown = document.getElementById('search-suggestions-dropdown');
  const deptSelect = document.getElementById('header-dept-select');
  if (!searchInput || !dropdown || !searchForm) return;

  let debounceTimer = null;

  const closeSuggestions = () => {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
  };

  const renderSuggestions = (products, query) => {
    if (!products || products.length === 0) {
      dropdown.innerHTML = `
        <div class="p-4 text-center text-xs text-secondary">
          No se encontraron coincidencias para <strong class="text-on-surface">"${query}"</strong>
        </div>
      `;
      dropdown.classList.remove('hidden');
      return;
    }

    const itemsHtml = products
      .slice(0, 6)
      .map((p) => {
        const imgUrl = p.imagen_url || '/assets/logo.png';
        const precioNum = Number(p.precio);
        return `
        <div
          class="search-suggestion-item flex items-center gap-3 p-3 hover:bg-surface-container transition-colors cursor-pointer border-b border-surface-container last:border-b-0"
          data-id="${p.id}"
          role="option"
        >
          <img
            src="${imgUrl}"
            alt="${p.nombre}"
            class="w-12 h-12 rounded-lg object-contain bg-white p-1 border border-surface-container shrink-0"
            onerror="this.src='/assets/logo.png'"
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 mb-0.5">
              <span class="px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface font-label-xs text-[10px] font-bold uppercase">${p.categoria}</span>
              <span class="text-secondary text-[11px] truncate">${p.marca}</span>
            </div>
            <p class="font-bold text-xs text-on-surface truncate">${p.nombre}</p>
            <p class="text-xs text-primary font-bold">${formatMxn(precioNum)}</p>
          </div>
          <span class="material-symbols-outlined text-[18px] text-secondary shrink-0">chevron_right</span>
        </div>
      `;
      })
      .join('');

    dropdown.innerHTML = `
      <div class="divide-y divide-surface-container">
        <div class="px-3 py-1.5 bg-surface-container-low text-[11px] font-bold text-secondary uppercase tracking-wider flex items-center justify-between">
          <span>Sugerencias en ExpressMart</span>
          <span class="text-[10px] text-primary font-semibold">${products.length} encontrados</span>
        </div>
        ${itemsHtml}
        <button
          type="button"
          class="btn-view-all-results w-full p-2.5 text-center text-xs font-bold text-primary hover:bg-surface-container-low transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span class="material-symbols-outlined text-[16px]">search</span>
          Ver todos los resultados para "${query}"
        </button>
      </div>
    `;

    dropdown.querySelectorAll('.search-suggestion-item').forEach((item) => {
      item.addEventListener('click', () => {
        const prodId = Number(item.dataset.id);
        closeSuggestions();
        openProductDetailPage(prodId);
      });
    });

    const btnViewAll = dropdown.querySelector('.btn-view-all-results');
    if (btnViewAll) {
      btnViewAll.addEventListener('click', () => {
        closeSuggestions();
        openSearchResultsPage(query, deptSelect ? deptSelect.value : '');
      });
    }

    dropdown.classList.remove('hidden');
  };

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    clearTimeout(debounceTimer);
    if (!val || val.length < 2) {
      closeSuggestions();
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        const dept = deptSelect ? deptSelect.value : '';
        const params = new URLSearchParams({ q: val });
        if (dept) params.set('categoria', dept);
        const res = await apiFetch(`/api/products?${params.toString()}`);
        renderSuggestions(res.products || [], val);
      } catch (_) {
        closeSuggestions();
      }
    }, 200);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSuggestions();
    }
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    closeSuggestions();
    const query = searchInput.value.trim();
    const dept = deptSelect ? deptSelect.value : '';
    openSearchResultsPage(query, dept);
  });

  document.addEventListener('click', (e) => {
    if (!searchForm.contains(e.target) && !dropdown.contains(e.target)) {
      closeSuggestions();
    }
  });
}

// ============================================================================
// EFECTO HOJAS DE OTOÑO CAYENDO (FALLING LEAVES) CON CANVAS Y SWITCH
// ============================================================================
function initFallingLeaves() {
  const canvas = document.getElementById('falling-leaves-canvas');
  const toggle = document.getElementById('toggle-falling-leaves');
  if (!canvas || !toggle) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let animationFrameId = null;
  let isRunning = false;
  let leaves = [];
  const leafCount = 32;

  // Paleta de tonos otoñales naturales (arce, roble, dorado, bronce)
  const colors = [
    { fill: '#c0392b', stroke: '#962d22' }, // Maple Rojo intenso
    { fill: '#d35400', stroke: '#a04000' }, // Naranja otoñal calabaza
    { fill: '#e67e22', stroke: '#ba641b' }, // Ámbar dorado
    { fill: '#f39c12', stroke: '#c67d0a' }, // Amarillo mostaza
    { fill: '#b9770e', stroke: '#87560a' }, // Bronce otoñal
    { fill: '#a04000', stroke: '#6e2b00' }  // Castaño cobrizo
  ];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });

  class Leaf {
    constructor(initial = false) {
      this.reset(initial);
    }

    reset(initial = false) {
      this.x = Math.random() * (canvas.width || window.innerWidth);
      this.y = initial ? Math.random() * (canvas.height || window.innerHeight) : -30 - Math.random() * 50;
      this.size = 12 + Math.random() * 16;
      this.speedY = 0.8 + Math.random() * 1.5;
      this.speedX = -0.4 + Math.random() * 0.8;
      this.swingSpeed = 0.015 + Math.random() * 0.025;
      this.swingPhase = Math.random() * Math.PI * 2;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.03;
      this.flip = Math.random() * Math.PI;
      this.flipSpeed = 0.02 + Math.random() * 0.03;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.opacity = 0.7 + Math.random() * 0.3;
      this.shapeType = Math.floor(Math.random() * 2); // 0: Arce (Maple), 1: Roble/Ovalada
    }

    update() {
      this.y += this.speedY;
      this.swingPhase += this.swingSpeed;
      this.x += Math.sin(this.swingPhase) * 0.8 + this.speedX;
      this.rotation += this.rotationSpeed;
      this.flip += this.flipSpeed;

      // Reiniciar arriba si sale de los límites de la pantalla
      if (this.y > canvas.height + 40 || this.x < -60 || this.x > canvas.width + 60) {
        this.reset(false);
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      const scaleX = Math.cos(this.flip);
      ctx.scale(scaleX, 1);
      ctx.globalAlpha = this.opacity;

      ctx.fillStyle = this.color.fill;
      ctx.strokeStyle = this.color.stroke;
      ctx.lineWidth = 1;

      ctx.beginPath();
      if (this.shapeType === 0) {
        // Silueta hoja de arce / otoñal estilizada
        const s = this.size;
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(s * 0.5, -s * 0.6, s * 0.7, -s * 0.2);
        ctx.quadraticCurveTo(s * 0.3, 0, s * 0.8, s * 0.5);
        ctx.quadraticCurveTo(s * 0.3, s * 0.4, 0, s);
        ctx.quadraticCurveTo(-s * 0.3, s * 0.4, -s * 0.8, s * 0.5);
        ctx.quadraticCurveTo(-s * 0.3, 0, -s * 0.7, -s * 0.2);
        ctx.quadraticCurveTo(-s * 0.5, -s * 0.6, 0, -s);
      } else {
        // Hoja lanceolada clásica de otoño con nervadura
        const s = this.size;
        ctx.moveTo(0, -s);
        ctx.bezierCurveTo(s * 0.8, -s * 0.4, s * 0.8, s * 0.4, 0, s);
        ctx.bezierCurveTo(-s * 0.8, s * 0.4, -s * 0.8, -s * 0.4, 0, -s);
      }
      ctx.fill();
      ctx.stroke();

      // Nervadura central sutil
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.moveTo(0, -this.size * 0.8);
      ctx.lineTo(0, this.size * 0.8);
      ctx.stroke();

      ctx.restore();
    }
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    canvas.classList.remove('hidden-leaves');
    if (leaves.length === 0) {
      for (let i = 0; i < leafCount; i++) {
        leaves.push(new Leaf(true));
      }
    }
    loop();
  }

  function stop() {
    isRunning = false;
    canvas.classList.add('hidden-leaves');
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function loop() {
    if (!isRunning) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < leaves.length; i++) {
      leaves[i].update();
      leaves[i].draw(ctx);
    }
    animationFrameId = requestAnimationFrame(loop);
  }

  // Comprobar preferencia guardada en localStorage o reduced motion
  const savedState = localStorage.getItem('em_falling_leaves');
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const initialActive = savedState !== null ? savedState === 'true' : !prefersReduced;

  toggle.checked = initialActive;
  if (initialActive) {
    start();
  } else {
    stop();
  }

  toggle.addEventListener('change', (e) => {
    const active = e.target.checked;
    localStorage.setItem('em_falling_leaves', String(active));
    if (active) {
      start();
      showAlert('🍂 Efecto de hojas de otoño activado.');
    } else {
      stop();
      showAlert('🍂 Efecto de hojas de otoño desactivado.');
    }
  });

  // Pausar si la pestaña pasa a segundo plano para optimizar rendimiento de batería
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (isRunning && animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    } else if (toggle.checked && isRunning && !animationFrameId) {
      loop();
    }
  });
}

// ============================================================================
// INICIALIZACIÓN DE EVENTOS DOM
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  updateSessionUI();
  updateFavoritesBadge();
  updateHeaderNotifications();
  loadCatalog();
  setupSearchSuggestions();
  initFallingLeaves();

  // Gestión de eventos para el modal de inactividad ("¿Sigues ahí?")
  const btnInactivityKeep = document.getElementById('btn-inactivity-keep');
  if (btnInactivityKeep) {
    btnInactivityKeep.addEventListener('click', confirmStayLoggedIn);
  }

  const btnInactivityLogout = document.getElementById('btn-inactivity-logout');
  if (btnInactivityLogout) {
    btnInactivityLogout.addEventListener('click', () => {
      const dialog = document.getElementById('inactivity-dialog');
      if (dialog && dialog.open) dialog.close();
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      isWarningOpen = false;
      executeLogout(true, 'Has cerrado tu sesión voluntariamente.');
    });
  }

  const inactivityDialog = document.getElementById('inactivity-dialog');
  if (inactivityDialog) {
    inactivityDialog.addEventListener('cancel', (e) => {
      e.preventDefault(); // Impedir que ESC cierre la advertencia sin pulsar el botón
    });
  }

  // Notificaciones y avisos rápidos desde el Header
  const btnHeaderNotifs = document.getElementById('btn-header-notifications');
  const notifDialog = document.getElementById('notifications-dialog');
  if (btnHeaderNotifs && notifDialog) {
    btnHeaderNotifs.addEventListener('click', () => {
      renderHeaderNotifications();
      notifDialog.showModal();
    });
  }

  const btnCloseNotif = document.getElementById('btn-close-notif-dialog');
  const btnCloseNotifFooter = document.getElementById('btn-close-notif-dialog-footer');
  if (btnCloseNotif && notifDialog) {
    btnCloseNotif.addEventListener('click', () => notifDialog.close());
  }
  if (btnCloseNotifFooter && notifDialog) {
    btnCloseNotifFooter.addEventListener('click', () => notifDialog.close());
  }

  const btnGoToProfileNotifs = document.getElementById('btn-go-to-profile-notifs');
  if (btnGoToProfileNotifs && notifDialog) {
    btnGoToProfileNotifs.addEventListener('click', () => {
      notifDialog.close();
      if (!state.user || !state.token) {
        showAlert('Inicia sesión para consultar todas tus notificaciones.', true);
        const authDialog = document.getElementById('auth-dialog');
        if (authDialog) authDialog.showModal();
        return;
      }
      switchTab('view-profile');
      const target = document.getElementById('notifications-list');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Botón para vaciar favoritos
  const btnFavClearAll = document.getElementById('btn-fav-clear-all');
  if (btnFavClearAll) {
    btnFavClearAll.addEventListener('click', () => {
      if (confirm('¿Deseas vaciar tu lista de favoritos?')) {
        saveFavorites([]);
        renderFavoritesView();
        showAlert('Se han vaciado tus favoritos.');
      }
    });
  }

  // Si existe token almacenado, validar vigencia de la sesión con el backend
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
      .catch((err) => {
        // Si la sesión fue revocada, expiró por TTL o se reinició el servidor, limpiar sesión
        if (state.token) {
          clearSessionState('Tu sesión previa ha expirado o no es válida. Se ha cerrado la cuenta por seguridad.', true);
        }
      });
  }

  // Navegación por pestañas
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Botones de navegación directa a Inicio y Catálogo
  document.querySelectorAll('.btn-nav-home').forEach((btn) => {
    btn.addEventListener('click', () => switchTab('view-home'));
  });

  document.querySelectorAll('.btn-nav-catalog').forEach((btn) => {
    btn.addEventListener('click', () => switchTab('view-catalog'));
  });

  // Botón volver al catálogo desde la página de detalle
  const btnBackCatalog = document.getElementById('btn-back-to-catalog');
  if (btnBackCatalog) {
    btnBackCatalog.addEventListener('click', () => switchTab('view-catalog'));
  }

  // Accesos rápidos del header Stitch
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

  // Selector de departamento en el buscador compuesto
  const deptSelect = document.getElementById('header-dept-select');
  if (deptSelect) {
    deptSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      const label = e.target.options[e.target.selectedIndex].text;
      document.getElementById('header-dept-label').textContent = label;
      document.getElementById('filter-category').value = val;
      switchTab('view-catalog');
      loadCatalog();
    });
  }

  // Botones de tarjetas promocionales Stitch y Fila Bento del Dashboard
  document.querySelectorAll('.promo-filter-trigger').forEach((el) => {
    el.addEventListener('click', () => {
      const sku = el.dataset.sku;
      if (sku) {
        openProductDetailPage(sku);
        return;
      }
      document.getElementById('filter-category').value = el.dataset.cat || '';
      switchTab('view-catalog');
      loadCatalog();
      document.getElementById('products-grid').scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Botones de cupones promocionales
  const heroCouponBtn = document.getElementById('btn-hero-coupon');
  if (heroCouponBtn) {
    heroCouponBtn.addEventListener('click', () => {
      state.coupon = 'BIENVENIDA10';
      const cInput = document.getElementById('cart-coupon');
      if (cInput) cInput.value = 'BIENVENIDA10';
      showAlert('Cupón BIENVENIDA10 (-10% en MXN) activado para tu compra.');
    });
  }

  const primeCouponBtn = document.getElementById('btn-prime-coupon');
  if (primeCouponBtn) {
    primeCouponBtn.addEventListener('click', () => {
      state.coupon = 'ENVIOGRATIS';
      const cInput = document.getElementById('cart-coupon');
      if (cInput) cInput.value = 'ENVIOGRATIS';
      showAlert('Cupón ENVIOGRATIS ExpressPrime activado en tu cesta.');
    });
  }

  // Filtros avanzados del catálogo

  ['filter-category', 'filter-brand', 'filter-max-price', 'filter-sort'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', loadCatalog);
  });

  // Modal Detalle de Producto legacy (cerrar)
  const detailDialog = document.getElementById('product-detail-dialog');
  const btnCloseDetail = document.getElementById('btn-close-detail');
  if (btnCloseDetail) btnCloseDetail.addEventListener('click', () => detailDialog.close());

  // Modal de Autenticación
  const authDialog = document.getElementById('auth-dialog');
  document.getElementById('btn-open-auth').addEventListener('click', () => {
    if (state.token && state.user) {
      switchTab('view-profile');
    } else {
      authDialog.showModal();
    }
  });
  document.getElementById('btn-close-auth').addEventListener('click', () => authDialog.close());

  // Función auxiliar para simular carga y mensajes centrados en Login y Registro
  async function simulateAuthLoading({ title, desc, successTitle, durationMs = 850 }) {
    const overlay = document.getElementById('auth-loading-overlay');
    const titleEl = document.getElementById('auth-loading-title');
    const descEl = document.getElementById('auth-loading-desc');
    const spinner = document.getElementById('auth-loading-spinner');
    const successIcon = document.getElementById('auth-loading-success-icon');

    if (!overlay) return;
    if (titleEl) titleEl.textContent = title || 'Iniciando sesión...';
    if (descEl) descEl.textContent = desc || 'Verificando credenciales de acceso seguro...';
    if (spinner) spinner.classList.remove('hidden');
    if (successIcon) successIcon.classList.add('hidden');
    overlay.classList.remove('hidden');

    await new Promise((resolve) => setTimeout(resolve, durationMs));

    if (successTitle) {
      if (titleEl) titleEl.textContent = successTitle;
      if (spinner) spinner.classList.add('hidden');
      if (successIcon) successIcon.classList.remove('hidden');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    overlay.classList.add('hidden');
  }

  // Alternador para ver u ocultar contraseña en campos de autenticación
  document.querySelectorAll('.btn-toggle-password').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.dataset.target;
      const input = targetId ? document.getElementById(targetId) : btn.parentElement.querySelector('input');
      const icon = btn.querySelector('.material-symbols-outlined');
      if (!input || !icon) return;

      if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
        btn.setAttribute('aria-label', 'Ocultar contraseña');
        btn.setAttribute('title', 'Ocultar contraseña');
      } else {
        input.type = 'password';
        icon.textContent = 'visibility';
        btn.setAttribute('aria-label', 'Mostrar contraseña');
        btn.setAttribute('title', 'Mostrar contraseña');
      }
    });
  });

  // Botones de acceso rápido para demostración de roles
  document.querySelectorAll('.demo-login-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      document.getElementById('login-email').value = btn.dataset.email;
      document.getElementById('login-password').value = btn.dataset.pass;
      document.getElementById('login-mfa').value = '';

      try {
        const loadingPromise = simulateAuthLoading({
          title: 'Iniciando sesión...',
          desc: `Accediendo con credenciales de ${btn.textContent.trim()}...`,
          successTitle: '¡Acceso Concedido!',
          durationMs: 700
        });

        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: btn.dataset.email, password: btn.dataset.pass })
        });

        if (res.mfaRequired) {
          const overlay = document.getElementById('auth-loading-overlay');
          if (overlay) overlay.classList.add('hidden');
          document.getElementById('mfa-field-group').classList.remove('hidden');
          document.getElementById('login-mfa').value = res.demoHintCode || '';
          const verified = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
              email: btn.dataset.email,
              password: btn.dataset.pass,
              mfaCode: res.demoHintCode
            })
          });
          state.token = verified.token;
          state.user = verified.user;
        } else {
          state.token = res.token;
          state.user = res.user;
        }

        await loadingPromise;

        localStorage.setItem('em_token', state.token);
        localStorage.setItem('em_user', JSON.stringify(state.user));
        state.cart = getInitialCart();
        saveCart();
        updateSessionUI();
        startInactivityMonitor();
        refreshCartModal();
        loadOrders();
        authDialog.close();
        showAlert(`Sesión iniciada como ${state.user.nombre} (${state.user.rol.toUpperCase()})`);
      } catch (err) {
        const overlay = document.getElementById('auth-loading-overlay');
        if (overlay) overlay.classList.add('hidden');
        showAlert(err.message, true);
      }
    });
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const mfaCode = document.getElementById('login-mfa').value.trim();

    try {
      const loadingPromise = simulateAuthLoading({
        title: 'Iniciando sesión...',
        desc: 'Verificando credenciales con cifrado seguro...',
        successTitle: '¡Bienvenido a ExpressMart!',
        durationMs: 850
      });

      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, mfaCode: mfaCode || undefined })
      });

      if (res.mfaRequired) {
        const overlay = document.getElementById('auth-loading-overlay');
        if (overlay) overlay.classList.add('hidden');
        openMfaModal({
          email,
          purpose: 'login',
          message: res.message
        });
        return;
      }

      await loadingPromise;

      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('em_token', state.token);
      localStorage.setItem('em_user', JSON.stringify(state.user));
      state.cart = getInitialCart();
      saveCart();
      updateSessionUI();
      startInactivityMonitor();
      refreshCartModal();
      loadOrders();
      authDialog.close();
      showAlert(`Bienvenido a ExpressMart México, ${state.user.nombre}`);
      showToast({
        title: `¡Hola, ${state.user.nombre.split(' ')[0]}!`,
        message: 'Sesión iniciada correctamente',
        imageUrl: state.user.fotoPerfil || '/assets/logo.png'
      });
    } catch (err) {
      const overlay = document.getElementById('auth-loading-overlay');
      if (overlay) overlay.classList.add('hidden');
      showAlert(err.message, true);
    }
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const loadingPromise = simulateAuthLoading({
        title: 'Verificando datos...',
        desc: 'Generando código de seguridad y cifrado para tu cuenta...',
        successTitle: '¡Código de verificación enviado!',
        durationMs: 750
      });

      const regEmail = document.getElementById('reg-email').value.trim();
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          nombre: document.getElementById('reg-nombre').value,
          email: regEmail,
          password: document.getElementById('reg-password').value,
          direccion: document.getElementById('reg-direccion').value,
          consentimientoPrivacidad: document.getElementById('reg-privacy').checked
        })
      });

      if (res.mfaRequired) {
        const overlay = document.getElementById('auth-loading-overlay');
        if (overlay) overlay.classList.add('hidden');
        openMfaModal({
          email: regEmail,
          purpose: 'registro',
          message: res.message
        });
        return;
      }

      await loadingPromise;

      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('em_token', state.token);
      localStorage.setItem('em_user', JSON.stringify(state.user));

      // Garantizar que la cesta y lista de deseos de una cuenta nueva comiencen 100% vacías
      state.cart = [];
      localStorage.setItem(`em_cart_${res.user.id}`, JSON.stringify([]));
      saveCart();
      localStorage.setItem(`em_wishlists_${res.user.id}`, JSON.stringify([]));

      updateSessionUI();
      startInactivityMonitor();
      refreshCartModal();
      loadOrders();
      authDialog.close();
      showAlert('Cuenta creada y sesión iniciada correctamente.');
      showToast({
        title: `¡Bienvenido(a), ${state.user.nombre.split(' ')[0]}!`,
        message: 'Creación de cuenta exitosa',
        imageUrl: '/assets/logo.png'
      });
    } catch (err) {
      const overlay = document.getElementById('auth-loading-overlay');
      if (overlay) overlay.classList.add('hidden');
      showAlert(err.message, true);
    }
  });

  // ===============================================================
  // GESTIÓN DEL MODAL DE VERIFICACIÓN DE DOS PASOS (2FA)
  // ===============================================================
  const mfaModal = document.getElementById('mfa-modal');
  const mfaEmailDisplay = document.getElementById('mfa-email-display');
  const mfaCodeInput = document.getElementById('mfa-code-input');
  const mfaResultBox = document.getElementById('mfa-result-box');
  const btnCloseMfa = document.getElementById('btn-close-mfa');
  const btnCancelMfa = document.getElementById('btn-cancel-mfa');
  const btnResendMfa = document.getElementById('btn-resend-mfa');
  const mfaForm = document.getElementById('mfa-form');

  function openMfaModal({ email, purpose = 'login', message }) {
    state.pendingMfa = { email, purpose };
    if (authDialog) authDialog.close();
    if (mfaEmailDisplay) mfaEmailDisplay.textContent = email;
    if (mfaResultBox) mfaResultBox.innerHTML = '';
    if (mfaCodeInput) {
      mfaCodeInput.value = '';
      setTimeout(() => mfaCodeInput.focus(), 150);
    }
    const dialogTitle = document.getElementById('mfa-dialog-title');
    if (dialogTitle) {
      dialogTitle.textContent = purpose === 'registro' ? 'Verifica tu Correo (2FA)' : 'Verificación en Dos Pasos (2FA)';
    }
    if (mfaModal) mfaModal.showModal();
    showAlert(message || `Código de seguridad enviado a tu correo ${email}`);
  }

  if (mfaForm) {
    mfaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = mfaCodeInput ? mfaCodeInput.value.trim() : '';
      if (!code || code.length !== 6) {
        if (mfaResultBox) {
          mfaResultBox.innerHTML = '<div class="p-2.5 rounded-lg bg-red-100 text-red-900 text-xs font-semibold">Por favor ingresa el código completo de 6 dígitos.</div>';
        }
        return;
      }

      try {
        const pending = state.pendingMfa || { email: '', purpose: 'login' };
        const res = await apiFetch('/api/auth/verify-mfa', {
          method: 'POST',
          body: JSON.stringify({
            email: pending.email,
            code,
            purpose: pending.purpose
          })
        });

        state.token = res.token;
        state.user = res.user;
        localStorage.setItem('em_token', state.token);
        localStorage.setItem('em_user', JSON.stringify(state.user));

        if (pending.purpose === 'registro') {
          state.cart = [];
          localStorage.setItem(`em_cart_${res.user.id}`, JSON.stringify([]));
          saveCart();
          localStorage.setItem(`em_wishlists_${res.user.id}`, JSON.stringify([]));
        } else {
          state.cart = getInitialCart();
          saveCart();
        }

        updateSessionUI();
        startInactivityMonitor();
        refreshCartModal();
        loadOrders();
        if (mfaModal) mfaModal.close();

        showAlert(res.message || 'Verificación 2FA completada exitosamente.');
        showToast({
          title: `¡Bienvenido(a), ${state.user.nombre.split(' ')[0]}!`,
          message: 'Autenticación 2FA verificada',
          imageUrl: state.user.fotoPerfil || '/assets/logo.png'
        });
      } catch (err) {
        if (mfaResultBox) {
          mfaResultBox.innerHTML = `<div class="p-2.5 rounded-lg bg-red-100 text-red-900 text-xs font-semibold">${err.message}</div>`;
        }
        showAlert(err.message, true);
      }
    });
  }

  if (btnResendMfa) {
    btnResendMfa.addEventListener('click', async () => {
      try {
        const pending = state.pendingMfa || { email: '', purpose: 'login' };
        btnResendMfa.disabled = true;
        btnResendMfa.textContent = 'Enviando correo...';
        const res = await apiFetch('/api/auth/resend-code', {
          method: 'POST',
          body: JSON.stringify({ email: pending.email, purpose: pending.purpose })
        });
        showAlert(res.message);
        if (mfaResultBox) {
          mfaResultBox.innerHTML = `<div class="p-2.5 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-semibold">¡Nuevo código enviado a ${pending.email}!</div>`;
        }
        let countdown = 30;
        const interval = setInterval(() => {
          countdown -= 1;
          if (countdown > 0) {
            btnResendMfa.textContent = `Reenviar en ${countdown}s`;
          } else {
            clearInterval(interval);
            btnResendMfa.disabled = false;
            btnResendMfa.innerHTML = '<span class="material-symbols-outlined text-[16px]">refresh</span> <span>Reenviar código</span>';
          }
        }, 1000);
      } catch (err) {
        btnResendMfa.disabled = false;
        btnResendMfa.innerHTML = '<span class="material-symbols-outlined text-[16px]">refresh</span> <span>Reenviar código</span>';
        showAlert(err.message, true);
      }
    });
  }

  if (btnCloseMfa && mfaModal) {
    btnCloseMfa.addEventListener('click', () => mfaModal.close());
  }

  if (btnCancelMfa && mfaModal) {
    btnCancelMfa.addEventListener('click', () => {
      mfaModal.close();
      if (authDialog) authDialog.showModal();
    });
  }

  // Modal de Confirmación para Salir / Cerrar Sesión
  const logoutConfirmDialog = document.getElementById('logout-confirm-dialog');
  const btnCancelLogout = document.getElementById('btn-cancel-logout');
  const btnCloseLogoutDialog = document.getElementById('btn-close-logout-dialog');
  const btnConfirmLogout = document.getElementById('btn-confirm-logout');

  document.getElementById('btn-logout').addEventListener('click', () => {
    if (logoutConfirmDialog) {
      logoutConfirmDialog.showModal();
    } else {
      executeLogout();
    }
  });

  if (btnCancelLogout) {
    btnCancelLogout.addEventListener('click', () => logoutConfirmDialog.close());
  }
  if (btnCloseLogoutDialog) {
    btnCloseLogoutDialog.addEventListener('click', () => logoutConfirmDialog.close());
  }

  if (btnConfirmLogout) {
    btnConfirmLogout.addEventListener('click', async () => {
      logoutConfirmDialog.close();
      await executeLogout();
    });
  }

  // Modal de Carrito y Checkout en 3 pasos
  const cartDialog = document.getElementById('cart-dialog');
  document.getElementById('btn-open-cart').addEventListener('click', () => {
    setCheckoutStep(1);
    refreshCartModal();
    cartDialog.showModal();
  });
  document.getElementById('btn-close-cart').addEventListener('click', () => cartDialog.close());

  document.getElementById('btn-apply-coupon').addEventListener('click', () => {
    state.coupon = document.getElementById('cart-coupon').value.trim();
    refreshCartModal();
  });

  const updatePaymentMethodUI = (method) => {
    const isMsi = method === 'msi';
    const isPaypal = method === 'paypal';
    const msiGroup = document.getElementById('msi-group');
    const paypalBox = document.getElementById('paypal-sandbox-box');
    const cardGroup = document.getElementById('credit-card-fields-group');
    const cardHolderInput = document.getElementById('card-holder');
    const cardNumberInput = document.getElementById('card-number');
    const cardExpiryInput = document.getElementById('card-expiry');

    if (msiGroup) msiGroup.classList.toggle('hidden', !isMsi);
    if (paypalBox) paypalBox.classList.toggle('hidden', !isPaypal);
    if (cardGroup) cardGroup.classList.toggle('hidden', isPaypal);

    if (cardHolderInput) cardHolderInput.required = !isPaypal;
    if (cardNumberInput) cardNumberInput.required = !isPaypal;
    if (cardExpiryInput) cardExpiryInput.required = !isPaypal;
  };

  document.getElementById('payment-method').addEventListener('change', (e) => {
    updatePaymentMethodUI(e.target.value);
  });

  // Toggle visibilidad de contraseña PayPal Sandbox
  const btnTogglePaypalPwd = document.getElementById('btn-toggle-paypal-pwd');
  const inputPaypalPwd = document.getElementById('paypal-sandbox-password');
  if (btnTogglePaypalPwd && inputPaypalPwd) {
    btnTogglePaypalPwd.addEventListener('click', () => {
      const isPwd = inputPaypalPwd.type === 'password';
      inputPaypalPwd.type = isPwd ? 'text' : 'password';
      const icon = btnTogglePaypalPwd.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = isPwd ? 'visibility_off' : 'visibility';
    });
  }

  const btnPaypalSimulate = document.getElementById('btn-paypal-sandbox-simulate');
  if (btnPaypalSimulate) {
    btnPaypalSimulate.addEventListener('click', () => {
      const emailInput = document.getElementById('paypal-sandbox-email');
      const pwdInput = document.getElementById('paypal-sandbox-password');
      const feedback = document.getElementById('paypal-status-feedback');
      const btnText = document.getElementById('btn-paypal-simulate-text');

      const emailVal = emailInput ? emailInput.value.trim() : '';
      const pwdVal = pwdInput ? pwdInput.value.trim() : '';

      if (!emailVal || !pwdVal) {
        if (feedback) {
          feedback.innerHTML = `
            <span class="material-symbols-outlined text-[14px] text-red-600">error</span>
            <span class="text-red-600 font-bold">Por favor ingresa tanto el correo como la contraseña de PayPal Sandbox.</span>
          `;
        }
        showAlert('Debes ingresar tu correo y contraseña antes de autorizar el pago con PayPal.', true);
        state.paypalAuthorized = false;
        return;
      }

      // Validar credenciales de la cuenta bancochido@banco.com
      if (emailVal.toLowerCase() === 'bancochido@banco.com' && pwdVal === 'nBBi"*d6') {
        state.paypalAuthorized = true;
        state.paypalEmail = emailVal;
        if (feedback) {
          feedback.innerHTML = `
            <span class="material-symbols-outlined text-[14px] text-emerald-600">check_circle</span>
            <span class="text-emerald-700 font-bold">¡Cuenta PayPal Sandbox autorizada con éxito! (${emailVal})</span>
          `;
        }
        if (btnText) {
          btnText.textContent = `✓ Autorizado con PayPal Sandbox (${emailVal})`;
        }
        showAlert('¡Cuenta PayPal Sandbox autorizada con éxito! Pulsa en "Revisar Resumen Final" para confirmar el pedido.');
      } else {
        state.paypalAuthorized = false;
        if (feedback) {
          feedback.innerHTML = `
            <span class="material-symbols-outlined text-[14px] text-red-600">cancel</span>
            <span class="text-red-600 font-bold">Credenciales incorrectas. Cuenta sandbox: bancochido@banco.com</span>
          `;
        }
        showAlert('Credenciales de PayPal Sandbox incorrectas. Use el correo bancochido@banco.com y contraseña nBBi"*d6', true);
      }
    });
  }

  // Carga y sincronización de tarjetas simuladas con saldo para compras
  let loadedSimulatedCards = [];
  async function loadSimulatedCardsForCheckout() {
    const selector = document.getElementById('simulated-card-selector');
    if (!selector) return;
    try {
      const cards = await apiFetch('/api/payments/simulated-cards');
      if (Array.isArray(cards)) {
        loadedSimulatedCards = cards;
        selector.innerHTML = '<option value="">-- Seleccionar tarjeta con saldo para simular compra --</option>' +
          cards.map(c => `
            <option value="${c.id}">
              ${c.marca} · terminación ${c.numero_tarjeta.replace(/[\s-]/g, '').slice(-4)} · Saldo: $${Number(c.saldo).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN (${c.titular})
            </option>
          `).join('');
      }
    } catch (_) {}
  }

  const simCardSelector = document.getElementById('simulated-card-selector');
  if (simCardSelector) {
    simCardSelector.addEventListener('change', (e) => {
      const cardId = Number(e.target.value);
      const card = loadedSimulatedCards.find(c => c.id === cardId);
      const infoBox = document.getElementById('simulated-card-balance-info');
      const holderText = document.getElementById('simulated-card-holder-text');
      const amountText = document.getElementById('simulated-card-amount-text');

      if (card) {
        document.getElementById('card-holder').value = card.titular;
        document.getElementById('card-number').value = card.numero_tarjeta;
        document.getElementById('card-expiry').value = card.expiracion;
        if (infoBox && holderText && amountText) {
          holderText.textContent = `Titular: ${card.titular} (${card.tipo.toUpperCase()})`;
          amountText.textContent = `Saldo Disponible: $${Number(card.saldo).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
          infoBox.classList.remove('hidden');
        }
      } else {
        if (infoBox) infoBox.classList.add('hidden');
      }
    });
  }

  document.getElementById('btn-to-step-2').addEventListener('click', () => {
    if (!state.cart.length) {
      showAlert('Agregue al menos un artículo a la cesta.', true);
      return;
    }
    if (!state.token) {
      cartDialog.close();
      authDialog.showModal();
      showAlert('Inicie sesión antes de continuar al pago seguro.', true);
      return;
    }
    updatePaymentMethodUI(document.getElementById('payment-method').value);
    loadSimulatedCardsForCheckout();
    setCheckoutStep(2);
  });

  document.getElementById('btn-back-step-1').addEventListener('click', () => setCheckoutStep(1));
  document.getElementById('btn-back-step-2').addEventListener('click', () => {
    loadSimulatedCardsForCheckout();
    setCheckoutStep(2);
  });

  // Paso 3: Resumen final con miniaturas de productos
  document.getElementById('btn-to-step-3').addEventListener('click', () => {
    if (!state.calculatedTotals) return;
    const method = document.getElementById('payment-method').value;

    // Validación obligatoria de PayPal: correo y contraseña ingresados y autorizados
    if (method === 'paypal' && !state.paypalAuthorized) {
      showAlert('Debes integrar el correo y la contraseña de PayPal Sandbox y pulsar en "Iniciar Sesión y Autorizar con PayPal" antes de continuar.', true);
      return;
    }

    const summaryEl = document.getElementById('checkout-final-summary');
    const addr = document.getElementById('checkout-address').value.trim();

    let methodDisplay = 'Tarjeta de Crédito / Débito';
    if (method === 'paypal') {
      methodDisplay = `PayPal Sandbox Oficial MX (${state.paypalEmail || 'bancochido@banco.com'})`;
    } else if (method === 'wallet') {
      methodDisplay = 'Billetera Digital (ExpressPay / SPEI)';
    } else if (method === 'msi') {
      methodDisplay = `Meses Sin Intereses (${document.getElementById('payment-msi').value} MSI)`;
    }

    const itemsSummaryHtml = state.cart
      .map(
        (item) => `
        <div class="flex items-center gap-2.5 py-1.5 border-b border-surface-container">
          <img
            src="${item.imagen_url || '/assets/logo.png'}"
            alt="${item.nombre}"
            class="w-10 h-10 rounded object-contain bg-white p-0.5 border border-surface-dim shrink-0"
            onerror="this.src='/assets/logo.png'"
          />
          <div class="flex-1 min-w-0">
            <div class="font-bold text-xs text-on-surface truncate">${item.nombre}</div>
            <div class="text-[11px] text-secondary">${item.cantidad} × ${formatMxn(item.precio)}</div>
          </div>
          <span class="font-bold text-xs text-on-surface">${formatMxn(item.precio * item.cantidad)}</span>
        </div>
      `
      )
      .join('');

    summaryEl.innerHTML = `
      <div class="space-y-2 text-sm">
        <div class="mb-2">
          <div class="text-xs font-bold text-secondary uppercase mb-1">Artículos a Enviar:</div>
          <div class="max-h-40 overflow-y-auto space-y-1 bg-surface-container-low p-2 rounded-lg">
            ${itemsSummaryHtml}
          </div>
        </div>
        <div class="space-y-1 text-xs">
          <div><strong>Dirección de Entrega:</strong> ${addr}</div>
          <div><strong>Método de Pago:</strong> ${methodDisplay}</div>
          <div class="flex justify-between pt-1"><span>Subtotal:</span> <strong>${formatMxn(state.calculatedTotals.subtotal)}</strong></div>
          ${state.calculatedTotals.descuento > 0 ? `<div class="flex justify-between text-tertiary"><span>Descuento (${state.calculatedTotals.cuponAplicado || 'Cupón'}):</span> <strong>-${formatMxn(state.calculatedTotals.descuento)}</strong></div>` : ''}
          ${state.calculatedTotals.cashback > 0 ? `<div class="flex justify-between text-emerald-600 font-semibold"><span>Cashback ExpressPrime (5%):</span> <strong>-${formatMxn(state.calculatedTotals.cashback)}</strong></div>` : ''}
          <div class="flex justify-between"><span>IVA (16%):</span> <strong>${formatMxn(state.calculatedTotals.impuestos)}</strong></div>
          <div class="flex justify-between"><span>Envío ExpressPrime DHL/FedEx:</span> <strong>${state.calculatedTotals.costoEnvio === 0 ? (state.calculatedTotals.isPremium ? 'GRATIS (Beneficio Miembro Prime $0.00 MXN)' : 'GRATIS ($0.00 MXN)') : formatMxn(state.calculatedTotals.costoEnvio)}</strong></div>
          <div class="text-base pt-2 border-t border-surface-dim text-primary flex justify-between">
            <strong>Total Confirmado a Pagar:</strong> <strong>${formatMxn(state.calculatedTotals.total)}</strong>
          </div>
        </div>
      </div>
    `;

    document.getElementById('checkout-result-box').innerHTML = '';
    const btnConfirm = document.getElementById('btn-confirm-order');
    btnConfirm.dataset.action = '';
    btnConfirm.textContent = 'Confirmar y Pagar en MXN';
    btnConfirm.className = 'btn btn-accent';
    document.getElementById('btn-back-step-2').classList.remove('hidden');

    setCheckoutStep(3);
  });

  // Botón Confirmar y Pagar: cambia a "Salir" cuando la compra se concreta
  document.getElementById('btn-confirm-order').addEventListener('click', async () => {
    const btnConfirm = document.getElementById('btn-confirm-order');
    const resultBox = document.getElementById('checkout-result-box');

    // Si ya se concretó la compra y el botón dice "Salir"
    if (btnConfirm.dataset.action === 'exit') {
      btnConfirm.dataset.action = '';
      btnConfirm.textContent = 'Confirmar y Pagar en MXN';
      btnConfirm.className = 'btn btn-accent';
      document.getElementById('btn-back-step-2').classList.remove('hidden');
      cartDialog.close();
      switchTab('view-orders');
      return;
    }

    try {
      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Procesando pago seguro...';

      const isPaypal = document.getElementById('payment-method').value === 'paypal';
      const res = await apiFetch('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: state.cart,
          cuponCodigo: state.coupon,
          direccionEnvio: document.getElementById('checkout-address').value.trim(),
          metodoPago: document.getElementById('payment-method').value,
          mesesSinIntereses: Number(document.getElementById('payment-msi').value || 1),
          cardHolder: isPaypal ? 'CLIENTE PAYPAL SANDBOX' : document.getElementById('card-holder').value,
          cardNumber: isPaypal ? '4111111111114242' : document.getElementById('card-number').value,
          expiry: isPaypal ? '12/29' : document.getElementById('card-expiry').value,
          pasosCheckout: 3
        })
      });

      state.cart = [];
      state.coupon = '';
      saveCart();
      loadCatalog();

      const pagoDesc = res.order?.pago?.metodoPago === 'paypal'
        ? `PayPal Sandbox (${res.order.pago?.tarjetaEnmascarada || 'bancochido@banco.com'})`
        : (res.order?.pago?.tarjetaEnmascarada || 'Pago Seguro');

      const cardSimDeductedInfo = res.order?.pago?.tarjetaSimulada
        ? `<div class="p-2 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs mt-1 space-y-0.5">
             <div class="font-bold flex items-center gap-1"><span class="material-symbols-outlined text-[15px]">credit_card</span><span>Tarjeta Simulada ${res.order.pago.tarjetaSimulada.marca} (•••• ${res.order.pago.tarjetaSimulada.terminacion})</span></div>
             <div>Titular: <strong>${res.order.pago.tarjetaSimulada.titular}</strong></div>
             <div>Saldo Anterior: <strong>${formatMxn(res.order.pago.tarjetaSimulada.saldoAnterior)}</strong> → Saldo Descontado: <strong>-${formatMxn(res.order.total)}</strong></div>
             <div class="text-emerald-800 font-extrabold">Nuevo Saldo Disponible: ${formatMxn(res.order.pago.tarjetaSimulada.saldoNuevo)}</div>
           </div>`
        : '';

      resultBox.innerHTML = `
        <div class="p-3.5 rounded-xl bg-tertiary-fixed/30 border border-tertiary/20 text-on-surface space-y-1">
          <div class="flex items-center gap-1.5 text-tertiary font-bold text-sm">
            <span class="material-symbols-outlined text-[18px]">verified</span>
            <span>${res.message || '¡Pago procesado con éxito!'}</span>
          </div>
          <div class="text-xs">Folio de Pedido: <strong>${res.order.folio}</strong> | Total: <strong>${formatMxn(res.order.total)}</strong></div>
          <div class="text-xs">Método: <strong>${pagoDesc}</strong> · Pasarela: <strong>${res.order?.pago?.referenciaPasarela || 'CAPTURED'}</strong></div>
          ${cardSimDeductedInfo}
          <div class="text-xs">Guía ExpressPrime: <strong>${res.order.envio.numeroGuia}</strong> (${res.order.envio.proveedorPaqueteria})</div>
          <div class="text-xs text-secondary">Recibirás la confirmación de tu pedido por correo electrónico.</div>
        </div>
      `;

      // Ocultar botón "Volver al Pago" y cambiar botón de confirmar a "Salir"
      document.getElementById('btn-back-step-2').classList.add('hidden');
      btnConfirm.disabled = false;
      btnConfirm.dataset.action = 'exit';
      btnConfirm.textContent = 'Salir';
      btnConfirm.className = 'btn btn-primary';

      showToast({
        title: '¡Compra confirmada con éxito!',
        message: `Folio: ${res.order.folio}`,
        imageUrl: '/assets/logo.png',
        price: res.order.total
      });
    } catch (err) {
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'Confirmar y Pagar en MXN';
      if (err.message && (err.message.includes('expirad') || err.message.includes('inválid') || err.message.includes('Autenticación requerida') || err.message.includes('401'))) {
        clearSessionState('Tu sesión ha expirado por seguridad. La cuenta ha sido cerrada. Inicia sesión nuevamente para completar tu compra.', true);
        const authDialog = document.getElementById('auth-dialog');
        if (authDialog && !authDialog.open) {
          authDialog.showModal();
        }
        return;
      }
      resultBox.innerHTML = `<div class="alert alert-error">Error en la transacción: ${err.message}</div>`;
    }
  });

  // Carga y modificación de Foto de Perfil en "Mi Cuenta"
  const fileInputPhoto = document.getElementById('input-profile-photo');
  const btnTriggerPhoto = document.getElementById('btn-trigger-photo');
  const btnUploadDirect = document.getElementById('btn-upload-photo-direct');
  const profileAvatarBox = document.getElementById('profile-avatar-box');
  const btnRemovePhoto = document.getElementById('btn-remove-photo');

  const triggerFileSelect = () => {
    if (!state.token) {
      document.getElementById('auth-dialog').showModal();
      showAlert('Inicie sesión para personalizar su foto de perfil.', true);
      return;
    }
    fileInputPhoto.click();
  };

  if (btnTriggerPhoto) btnTriggerPhoto.addEventListener('click', triggerFileSelect);
  if (btnUploadDirect) btnUploadDirect.addEventListener('click', triggerFileSelect);
  if (profileAvatarBox) profileAvatarBox.addEventListener('click', triggerFileSelect);

  if (fileInputPhoto) {
    fileInputPhoto.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showAlert('Seleccione un archivo de imagen válido (PNG, JPG, WEBP).', true);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showAlert('La imagen no debe superar los 5MB.', true);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target.result;
        try {
          const res = await apiFetch('/api/auth/profile', {
            method: 'PUT',
            body: JSON.stringify({ fotoPerfil: dataUrl })
          });
          state.user = res.user;
          state.user.fotoPerfil = dataUrl;
          localStorage.setItem('em_user', JSON.stringify(state.user));
          updateSessionUI();
          updateProfilePhotoUI(dataUrl);
          showAlert('Foto de perfil actualizada correctamente.');
        } catch (err) {
          showAlert(err.message, true);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnRemovePhoto) {
    btnRemovePhoto.addEventListener('click', async () => {
      try {
        const res = await apiFetch('/api/auth/profile', {
          method: 'PUT',
          body: JSON.stringify({ fotoPerfil: '' })
        });
        state.user = res.user;
        state.user.fotoPerfil = '';
        localStorage.setItem('em_user', JSON.stringify(state.user));
        updateSessionUI();
        updateProfilePhotoUI('');
        showAlert('Foto de perfil eliminada.');
      } catch (err) {
        showAlert(err.message, true);
      }
    });
  }

  // Guardar Cambios en Formulario de Perfil
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          nombre: document.getElementById('prof-nombre').value,
          direccion: document.getElementById('prof-direccion').value,
          telefono: document.getElementById('prof-telefono').value,
          enableMfa: document.getElementById('prof-mfa').checked,
          fotoPerfil: state.user?.fotoPerfil || ''
        })
      });
      state.user = res.user;
      localStorage.setItem('em_user', JSON.stringify(state.user));
      updateSessionUI();
      showAlert('¡Tus cambios se guardaron correctamente!');
      showToast({
        title: 'Perfil actualizado',
        message: '¡Cambios guardados correctamente!',
        imageUrl: state.user?.fotoPerfil || '/assets/logo.png'
      });
    } catch (err) {
      showAlert(err.message, true);
    }
  });

  // Formulario de Privacidad (si está presente)
  const arcoForm = document.getElementById('arco-form');
  if (arcoForm) {
    arcoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await apiFetch('/api/privacy/arco', {
          method: 'POST',
          body: JSON.stringify({
            tipo: document.getElementById('arco-tipo')?.value || '',
            descripcion: document.getElementById('arco-desc')?.value || ''
          })
        });
        const resultEl = document.getElementById('arco-result');
        if (resultEl) {
          resultEl.innerHTML =
            `<div class="alert alert-info">Folio: <strong>${res.folio}</strong> — ${res.respuesta}</div>`;
        }
      } catch (err) {
        showAlert(err.message, true);
      }
    });
  }

  // Alta de Producto en Panel Administrativo
  document.getElementById('admin-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const imgVal = document.getElementById('prod-imagen')?.value?.trim();
      const res = await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          sku: document.getElementById('prod-sku').value,
          nombre: document.getElementById('prod-nombre').value,
          categoria: document.getElementById('prod-cat').value,
          marca: document.getElementById('prod-marca').value,
          precio: Number(document.getElementById('prod-precio').value),
          stock: Number(document.getElementById('prod-stock').value),
          imagen_url: imgVal || '/assets/logo.png',
          descripcion: document.getElementById('prod-desc').value,
          condiciones_envio: document.getElementById('prod-envio').value,
          especificaciones: { origen: 'Panel Oficial ExpressMart México' }
        })
      });
      showAlert(res.message);
      document.getElementById('admin-product-form').reset();
      loadCatalog();
      loadAdminReports();
    } catch (err) {
      showAlert(err.message, true);
    }
  });

  document.getElementById('btn-refresh-orders').addEventListener('click', loadOrders);
  document.getElementById('btn-load-reports').addEventListener('click', loadAdminReports);
  document.getElementById('btn-refresh-audit').addEventListener('click', loadAuditCenter);

  document.getElementById('btn-toggle-contingency').addEventListener('click', async () => {
    try {
      state.recommendationsHealthy = !state.recommendationsHealthy;
      const res = await apiFetch('/api/admin/contingency/recommendations', {
        method: 'POST',
        body: JSON.stringify({ healthy: state.recommendationsHealthy })
      });
      showAlert(res.message);
      loadCatalog();
    } catch (err) {
      showAlert(err.message, true);
    }
  });

  // Eventos de Membresía ExpressPrime
  const subDialog = document.getElementById('subscription-dialog');
  const btnCloseSub = document.getElementById('btn-close-sub');
  const btnCancelSub = document.getElementById('btn-cancel-sub-dialog');
  const btnOpenMembership = document.getElementById('btn-open-membership');
  const btnConfirmSub = document.getElementById('btn-confirm-subscription');

  if (btnOpenMembership) {
    btnOpenMembership.addEventListener('click', () => openSubscriptionDialog('1_mes'));
  }
  if (btnCloseSub && subDialog) {
    btnCloseSub.addEventListener('click', () => subDialog.close());
  }
  if (btnCancelSub && subDialog) {
    btnCancelSub.addEventListener('click', () => subDialog.close());
  }

  // Cambio de selección de plan en modal de suscripción
  if (subDialog) {
    subDialog.querySelectorAll('input[name="sub_plan"]').forEach((radio) => {
      radio.addEventListener('change', updateSubPlanSelection);
    });

    subDialog.querySelectorAll('input[name="sub_payment_method"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const isPaypal = e.target.value === 'paypal';
        const cardFields = document.getElementById('sub-card-fields');
        const paypalFields = document.getElementById('sub-paypal-fields');
        if (cardFields) cardFields.classList.toggle('hidden', isPaypal);
        if (paypalFields) paypalFields.classList.toggle('hidden', !isPaypal);
      });
    });
  }

  if (btnConfirmSub) {
    btnConfirmSub.addEventListener('click', handleSubscriptionSubmit);
  }

  // ===============================================================
  // SISTEMA DE PÁGINAS INFORMATIVAS Y MODAL LEGAL / CORPORATIVO
  // ===============================================================
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
      if (key) {
        openInfoModal(key);
      }
    });
  });
});

// ============================================================================
// CATÁLOGO DE CONTENIDOS INFORMATIVOS Y LEGALES (INFO_PAGES)
// ============================================================================
const INFO_PAGES = {
  vender: {
    icon: 'storefront',
    title: '¿Quieres vender con nosotros en ExpressMart?',
    subtitle: 'Marketplace Oficial para Sellers y Marcas en México',
    renderHtml: () => `
      <div class="space-y-4">
        <div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <span class="material-symbols-outlined text-amber-600 text-[28px] shrink-0">workspace_premium</span>
          <div>
            <h4 class="font-bold text-on-surface text-sm">¡Comisión 0% durante tus primeros 90 días de ventas!</h4>
            <p class="text-xs text-secondary mt-0.5">
              Únete a la red de más de 1,200 comercios y fabricantes mexicanos que distribuyen sus productos a través de nuestra infraestructura logística.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="p-3.5 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-1">
            <div class="flex items-center gap-2 font-bold text-sm text-primary">
              <span class="material-symbols-outlined text-[20px]">payments</span>
              <span>Dispersión Semanal Vía SPEI</span>
            </div>
            <p class="text-xs text-secondary leading-relaxed">
              Recibe tus liquidaciones directamente en tu cuenta CLABE cada viernes sin cobro de comisiones interbancarias ni montos mínimos de retiro.
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-1">
            <div class="flex items-center gap-2 font-bold text-sm text-primary">
              <span class="material-symbols-outlined text-[20px]">local_shipping</span>
              <span>Logística ExpressPrime CEDIS</span>
            </div>
            <p class="text-xs text-secondary leading-relaxed">
              Almacena tu inventario en nuestro CEDIS CDMX Norte y nos encargamos de empaque, recolección y entrega con garantía en 24 a 48 horas.
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-1">
            <div class="flex items-center gap-2 font-bold text-sm text-primary">
              <span class="material-symbols-outlined text-[20px]">receipt_long</span>
              <span>Facturación CFDI 4.0 SAT</span>
            </div>
            <p class="text-xs text-secondary leading-relaxed">
              Cumplimiento automático de retenciones de ISR e IVA ante el SAT y emisión automatizada de comprobantes fiscales a compradores.
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-1">
            <div class="flex items-center gap-2 font-bold text-sm text-primary">
              <span class="material-symbols-outlined text-[20px]">security</span>
              <span>Protección Antifraude PCI DSS</span>
            </div>
            <p class="text-xs text-secondary leading-relaxed">
              Cero riesgo de contracargos con validación 3D Secure 2.0 y tokenización bancaria respaldada por ExpressMart.
            </p>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-surface border border-surface-container space-y-2">
          <h4 class="font-bold text-sm text-on-surface flex items-center gap-1.5">
            <span class="material-symbols-outlined text-primary text-[18px]">checklist</span>
            Requisitos indispensables para darte de alta
          </h4>
          <ul class="text-xs text-secondary space-y-1 list-disc list-inside">
            <li>RFC con Constancia de Situación Fiscal vigente (&lt; 3 meses) de Persona Física con Actividad Empresarial o Persona Moral.</li>
            <li>Cuenta bancaria CLABE mexicana a nombre del titular o razón social registrada.</li>
            <li>Identificación oficial vigente del representante legal (INE o Pasaporte).</li>
            <li>Garantía de satisfacción de 30 días naturales en todos los productos.</li>
          </ul>
        </div>

        <!-- Formulario o acción de alta -->
        <div class="p-4 rounded-xl bg-surface-container-low border border-surface-dim space-y-3">
          <h4 class="font-bold text-sm text-on-surface">Registro Rápido de Solicitud de Vendedor</h4>
          <form id="form-vender-express" class="space-y-2.5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="text" id="vend-nombre" placeholder="Nombre Comercial o Empresa" required class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
              <input type="text" id="vend-rfc" placeholder="RFC (12 o 13 caracteres)" required maxlength="13" class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="email" id="vend-email" placeholder="Correo electrónico de contacto" required class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
              <input type="tel" id="vend-tel" placeholder="Teléfono de contacto (10 dígitos)" required maxlength="10" class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
            </div>
            <select id="vend-cat" class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full">
              <option value="Electronica">Electrónica, Laptops y Telefonía</option>
              <option value="Videojuegos">Videojuegos, Consolas y Accesorios</option>
              <option value="Hogar">Hogar, Cocina y Oficina</option>
              <option value="Deportes">Deportes, Suplementos y Fitness</option>
              <option value="Automotriz">Automotriz y Maquinaria</option>
              <option value="Otros">Otras Categorías</option>
            </select>
            <div id="vender-result-box"></div>
            <button type="submit" class="w-full py-2.5 rounded-lg bg-primary text-on-primary font-bold text-xs hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5 shadow-sm cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">send</span>
              <span>Enviar Solicitud de Vendedor ExpressMart</span>
            </button>
          </form>
        </div>
      </div>
    `,
    initListeners: () => {
      const form = document.getElementById('form-vender-express');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const folio = 'SELL-' + Math.floor(100000 + Math.random() * 900000);
          const resBox = document.getElementById('vender-result-box');
          if (resBox) {
            resBox.innerHTML = `
              <div class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs space-y-1">
                <div class="flex items-center gap-1.5 font-bold">
                  <span class="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>¡Solicitud de Vendedor Recibida con Éxito!</span>
                </div>
                <p>Folio Oficial: <strong class="font-mono text-emerald-900">${folio}</strong>. Nuestro equipo de Onboarding de Sellers validará tu información en menos de 24 horas.</p>
              </div>
            `;
          }
          form.reset();
        });
      }
    }
  },

  trabajar: {
    icon: 'work',
    title: 'Trabajar en ExpressMart México',
    subtitle: 'Forma parte del equipo que revoluciona el e-commerce y la tecnología en México',
    renderHtml: () => `
      <div class="space-y-4">
        <div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
          <span class="material-symbols-outlined text-emerald-600 text-[28px] shrink-0">groups</span>
          <div>
            <h4 class="font-bold text-on-surface text-sm">Cultura de Innovación, Seguridad y Bienestar</h4>
            <p class="text-xs text-secondary mt-0.5">
              En ExpressMart creemos en el talento mexicano. Ofrecemos prestaciones superiores a la ley, esquema híbrido o 100% remoto, y crecimiento continuo.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3 rounded-xl bg-surface-container-low border border-surface-container text-center">
            <span class="material-symbols-outlined text-primary text-[24px]">favorite</span>
            <h5 class="font-bold text-xs text-on-surface mt-1">Salud Integral</h5>
            <p class="text-[11px] text-secondary">SGMM familiar, seguro de vida, dental y visual desde el día 1.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface-container-low border border-surface-container text-center">
            <span class="material-symbols-outlined text-primary text-[24px]">savings</span>
            <h5 class="font-bold text-xs text-on-surface mt-1">Ahorro y Bonos</h5>
            <p class="text-[11px] text-secondary">Fondo de ahorro 13%, vales de despensa y 30 días de aguinaldo.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface-container-low border border-surface-container text-center">
            <span class="material-symbols-outlined text-primary text-[24px]">laptop_chromebook</span>
            <h5 class="font-bold text-xs text-on-surface mt-1">Flexibilidad</h5>
            <p class="text-[11px] text-secondary">Home office flexible, presupuesto para setup y cursos pagados.</p>
          </div>
        </div>

        <!-- Vacantes activas -->
        <div class="space-y-2">
          <h4 class="font-bold text-sm text-on-surface flex items-center gap-1.5">
            <span class="material-symbols-outlined text-primary text-[18px]">work_outline</span>
            Vacantes Abiertas Actualmente en México
          </h4>
          <div class="space-y-2">
            <div class="p-3 rounded-xl bg-surface border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span class="text-xs font-bold text-on-surface block">Ingeniero/a de Software Full Stack (Node.js &amp; SQLite)</span>
                <span class="text-[11px] text-secondary">Ingeniería &amp; Plataforma · Remoto México · Tiempo Completo</span>
              </div>
              <span class="px-2 py-1 rounded bg-blue-100 text-blue-900 text-[10px] font-bold w-fit">Contratación Inmediata</span>
            </div>

            <div class="p-3 rounded-xl bg-surface border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span class="text-xs font-bold text-on-surface block">Auditor/a de Ciberseguridad &amp; Cumplimiento</span>
                <span class="text-[11px] text-secondary">Seguridad de la Información · Paseo de la Reforma, CDMX (Híbrido)</span>
              </div>
              <span class="px-2 py-1 rounded bg-emerald-100 text-emerald-900 text-[10px] font-bold w-fit">Vacante Abierta</span>
            </div>

            <div class="p-3 rounded-xl bg-surface border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span class="text-xs font-bold text-on-surface block">Coordinador/a de Operaciones Logísticas CEDIS Full</span>
                <span class="text-[11px] text-secondary">Cadena de Suministro · CEDIS CDMX Norte · Tiempo Completo</span>
              </div>
              <span class="px-2 py-1 rounded bg-amber-100 text-amber-900 text-[10px] font-bold w-fit">Vacante Abierta</span>
            </div>

            <div class="p-3 rounded-xl bg-surface border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span class="text-xs font-bold text-on-surface block">Especialista en Atención al Cliente &amp; Conciliaciones</span>
                <span class="text-[11px] text-secondary">Experiencia del Cliente · Remoto / Turno Mixto · Tiempo Completo</span>
              </div>
              <span class="px-2 py-1 rounded bg-purple-100 text-purple-900 text-[10px] font-bold w-fit">Vacante Abierta</span>
            </div>
          </div>
        </div>

        <!-- Formulario de Postulación -->
        <div class="p-4 rounded-xl bg-surface-container-low border border-surface-dim space-y-3">
          <h4 class="font-bold text-sm text-on-surface">Postulación Rápida de Candidatura</h4>
          <form id="form-trabajar-express" class="space-y-2.5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="text" id="cand-nombre" placeholder="Tu nombre completo" required class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
              <input type="email" id="cand-email" placeholder="Correo electrónico" required class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="tel" id="cand-tel" placeholder="Teléfono (10 dígitos)" required maxlength="10" class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
              <select id="cand-vacante" class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full">
                <option value="dev">Ingeniero/a de Software Full Stack</option>
                <option value="security">Auditor/a de Ciberseguridad y Cumplimiento</option>
                <option value="logistica">Coordinador/a Logística CEDIS</option>
                <option value="cx">Especialista en Atención y Soluciones</option>
                <option value="general">Bolsa General / Otras Áreas</option>
              </select>
            </div>
            <input type="url" id="cand-link" placeholder="Enlace a tu perfil de LinkedIn o portafolio / CV en PDF (opcional)" class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
            <div id="trabajar-result-box"></div>
            <button type="submit" class="w-full py-2.5 rounded-lg bg-primary text-on-primary font-bold text-xs hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5 shadow-sm cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">send</span>
              <span>Enviar Mi Postulación a Recursos Humanos</span>
            </button>
          </form>
        </div>
      </div>
    `,
    initListeners: () => {
      const form = document.getElementById('form-trabajar-express');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const folio = 'TALENT-' + Math.floor(100000 + Math.random() * 900000);
          const resBox = document.getElementById('trabajar-result-box');
          if (resBox) {
            resBox.innerHTML = `
              <div class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs space-y-1">
                <div class="flex items-center gap-1.5 font-bold">
                  <span class="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>¡Postulación Recibida Exitosamente!</span>
                </div>
                <p>Folio de Seguimiento: <strong class="font-mono text-emerald-900">${folio}</strong>. El equipo de Talento ExpressMart revisará tu perfil y te contactará en un plazo máximo de 48 horas hábiles.</p>
              </div>
            `;
          }
          form.reset();
        });
      }
    }
  },

  'aviso-privacidad': {
    icon: 'shield',
    title: 'Aviso de Privacidad Integral',
    subtitle: 'Compromiso de Privacidad y Protección de Datos Personales',
    renderHtml: () => `
      <div class="space-y-4 text-xs leading-relaxed text-secondary">
        <div class="p-3 rounded-xl bg-surface border border-surface-container text-on-surface">
          <p class="font-semibold">
            TiendaExpress Online, S.A. de C.V. (en lo sucesivo "ExpressMart México"), con domicilio legal en Av. Paseo de la Reforma 450, Piso 18, Col. Juárez, Alcaldía Cuauhtémoc, C.P. 06600, Ciudad de México, es el responsable del tratamiento y resguardo de sus datos personales.
          </p>
        </div>

        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1 flex items-center gap-1">
            <span class="material-symbols-outlined text-primary text-[16px]">badge</span>
            1. Datos Personales Recabados
          </h4>
          <p>
            Recabamos datos de identificación y contacto (nombre completo, correo electrónico, teléfono, dirección física de entrega), datos fiscales para facturación (RFC, razón social, código postal, régimen fiscal) y huellas digitales de pago tokenizadas.
          </p>
          <div class="mt-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-950 font-medium">
            🔒 <strong>Política de Seguridad Financiera:</strong> ExpressMart México <u>nunca almacena números completos de tarjetas de crédito o débito ni códigos de seguridad CVV/CVC</u>. Todos los cobros se realizan bajo estándares internacionales de máxima seguridad bancaria mediante tokenización cifrada.
          </div>
        </div>

        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1 flex items-center gap-1">
            <span class="material-symbols-outlined text-primary text-[16px]">task_alt</span>
            2. Finalidades Primarias (Necesarias para el Servicio)
          </h4>
          <ul class="list-disc list-inside space-y-1">
            <li>Gestión, procesamiento y confirmación de pedidos y transacciones en el marketplace.</li>
            <li>Emisión de facturas electrónicas con desglose del 16% de IVA conforme a disposiciones fiscales.</li>
            <li>Logística de empaque, recolección y entrega a domicilio a través de la red CEDIS.</li>
            <li>Atención de garantías de 30 días, devoluciones y resolución ágil de aclaraciones con respaldo al consumidor.</li>
            <li>Prevención de fraudes, verificación de identidad y mitigación de transacciones sospechosas.</li>
          </ul>
        </div>

        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1 flex items-center gap-1">
            <span class="material-symbols-outlined text-primary text-[16px]">campaign</span>
            3. Finalidades Secundarias
          </h4>
          <p>
            Envío de ofertas comerciales, promociones exclusivas del programa ExpressPrime y encuestas de calidad de servicio. Puede rechazar el uso para estas finalidades en cualquier momento en el apartado "Cuenta y Privacidad" de su perfil.
          </p>
        </div>

        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1 flex items-center gap-1">
            <span class="material-symbols-outlined text-primary text-[16px]">lock_reset</span>
            4. Medidas de Seguridad de la Información
          </h4>
          <p>
            Implementamos rigurosos controles de seguridad de la información: cifrado de datos en reposo y en tránsito (TLS 1.3, AES-256), hashing robusto con sales criptográficas y políticas de control de accesos basados en roles.
          </p>
        </div>

        <div class="pt-2 border-t border-surface-container flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Contacto de la Unidad de Privacidad: <strong>privacidad@expressmart.mx</strong></span>
          <span class="text-xs text-secondary">Atención de Lunes a Viernes de 9:00 a 18:00 hrs.</span>
        </div>
      </div>
    `
  },

  'derechos-arco': {
    icon: 'contact_page',
    title: 'Procedimiento de Ejercicio de Derechos de Privacidad',
    subtitle: 'Acceso, Rectificación, Cancelación y Oposición de Datos Personales',
    renderHtml: () => `
      <div class="space-y-4 text-xs leading-relaxed text-secondary">
        <p>
          Usted o su representante legal debidamente acreditado tienen derecho a ejercer sus derechos de privacidad en todo momento respecto a sus datos personales resguardados por ExpressMart México:
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-on-surface">
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="font-bold text-primary block mb-1">A — Acceso</span>
            <p class="text-secondary text-[11px]">Conocer qué datos personales suyos poseemos, su origen y las condiciones de su tratamiento.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="font-bold text-primary block mb-1">R — Rectificación</span>
            <p class="text-secondary text-[11px]">Solicitar la corrección de datos personales que sean inexactos, desactualizados o incompletos.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="font-bold text-primary block mb-1">C — Cancelación</span>
            <p class="text-secondary text-[11px]">Solicitar la eliminación de sus datos de nuestros registros cuando no se requieran legalmente.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="font-bold text-primary block mb-1">O — Oposición</span>
            <p class="text-secondary text-[11px]">Oponerse al tratamiento de sus datos para finalidades secundarias (mercadotecnia y perfiles).</p>
          </div>
        </div>

        <div class="p-3 rounded-xl bg-surface-container-low border border-surface-container">
          <h5 class="font-bold text-sm text-on-surface mb-1">Tiempos de Respuesta</h5>
          <p>
            Conforme a nuestras políticas de protección de datos, ExpressMart dará respuesta formal a su solicitud en un plazo máximo de <strong>20 días hábiles</strong>. De resultar procedente, se ejecutará dentro de los <strong>15 días hábiles</strong> siguientes.
          </p>
        </div>

        <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-950 flex items-center justify-between gap-3">
          <div>
            <span class="font-bold text-xs block">¿Deseas enviar una solicitud de privacidad?</span>
            <span class="text-[11px]">Comunícate directamente a nuestra unidad especializada en privacidad.</span>
          </div>
          <a href="mailto:privacidad@expressmart.mx" class="px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-xs shrink-0 cursor-pointer hover:bg-emerald-800">
            Contactar por Correo
          </a>
        </div>
      </div>
    `
  },

  'terminos-condiciones': {
    icon: 'gavel',
    title: 'Términos y Condiciones Generales de Compraventa',
    subtitle: 'Términos de Servicio y Protección al Comprador',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1">1. Precios y Divisa Oficial</h4>
          <p>
            Todos los precios publicados en ExpressMart están expresados en <strong>Pesos Mexicanos ($ MXN)</strong> e incluyen puntualmente el 16% del Impuesto al Valor Agregado (IVA). No existen cargos ocultos ni comisiones imprevistas al momento de pagar.
          </p>
        </div>
        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1">2. Inventario y Despacho</h4>
          <p>
            El stock mostrado en la plataforma se actualiza en tiempo real contra los registros de nuestro CEDIS CDMX Norte. En caso fortuito de discrepancia de stock, el cliente tiene derecho a la sustitución inmediata o reembolso total al 100%.
          </p>
        </div>
        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1">3. Cancelación Sin Penalización</h4>
          <p>
            El usuario podrá cancelar cualquier orden de compra antes de que el pedido sea recolectado por la paquetería sin costo ni penalización alguna, reintegrándose los fondos inmediatamente.
          </p>
        </div>
        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1">4. Jurisdicción y Competencia</h4>
          <p>
            Para la interpretación de estos términos, las partes se someten a la competencia administrativa de la Procuraduría Federal del Consumidor (PROFECO) y a las leyes federales de los Estados Unidos Mexicanos.
          </p>
        </div>
      </div>
    `
  },

  'garantias-devoluciones': {
    icon: 'assignment_return',
    title: 'Garantía Oficial de 30 Días y Devoluciones',
    subtitle: 'Garantía de Satisfacción Total ExpressMart',
    renderHtml: () => `
      <div class="space-y-4 text-xs leading-relaxed text-secondary">
        <div class="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-on-surface">
          <h4 class="font-bold text-sm text-primary mb-1">¡Cero Complicaciones en Devoluciones!</h4>
          <p>
            Todos los artículos comprados en ExpressMart México cuentan con <strong>30 días naturales de garantía directa</strong> a partir de la fecha de entrega física.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-on-surface">
          <div class="p-2.5 rounded-lg bg-surface border border-surface-container">
            <span class="material-symbols-outlined text-primary text-[22px]">history</span>
            <span class="font-bold text-xs block mt-1">1. Solicita</span>
            <span class="text-[11px] text-secondary">Desde "Mis Pedidos" con un solo clic.</span>
          </div>
          <div class="p-2.5 rounded-lg bg-surface border border-surface-container">
            <span class="material-symbols-outlined text-primary text-[22px]">local_shipping</span>
            <span class="font-bold text-xs block mt-1">2. Envía Gratis</span>
            <span class="text-[11px] text-secondary">Guía prepagada sin costo alguno.</span>
          </div>
          <div class="p-2.5 rounded-lg bg-surface border border-surface-container">
            <span class="material-symbols-outlined text-primary text-[22px]">credit_card</span>
            <span class="font-bold text-xs block mt-1">3. Reembolso</span>
            <span class="text-[11px] text-secondary">Acreditación en 24 a 48 horas hábiles.</span>
          </div>
        </div>

        <div class="space-y-1">
          <h5 class="font-bold text-xs text-on-surface">Condiciones para devolución:</h5>
          <ul class="list-disc list-inside space-y-0.5 text-secondary">
            <li>El producto debe incluir sus empaques originales, manuales y accesorios completos.</li>
            <li>En electrónicos y consolas, no debe presentar manipulación física ni software alterado.</li>
          </ul>
        </div>
      </div>
    `
  },

  'seguridad-iso': {
    icon: 'verified',
    title: 'Estándares de Calidad y Ciberseguridad',
    subtitle: 'Calidad del Software, Integridad de Datos y Seguridad Global',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          ExpressMart implementa las mejores prácticas mundiales de ingeniería de software y seguridad de la información:
        </p>
        <div class="space-y-2">
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <h5 class="font-bold text-xs text-primary">Adecuación Funcional y Fiabilidad de Software</h5>
            <p class="text-[11px] mt-0.5">Control de cobertura de pruebas riguroso, arquitectura tolerante a fallos y verificación de integridad transaccional.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <h5 class="font-bold text-xs text-primary">Calidad e Integridad de los Datos</h5>
            <p class="text-[11px] mt-0.5">Completitud, consistencia, exactitud y credibilidad de los registros de catálogo, stock e histórico de transacciones.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <h5 class="font-bold text-xs text-primary">Sistema Integral de Gestión de Seguridad</h5>
            <p class="text-[11px] mt-0.5">Controles de cifrado, gestión de vulnerabilidades, planes de contingencia operativa y trazabilidad inmutable de accesos.</p>
          </div>
        </div>
      </div>
    `
  },

  'seguridad-owasp': {
    icon: 'security',
    title: 'Protección contra Vulnerabilidades y Amenazas Web',
    subtitle: 'Arquitectura Segura y Mitigación Integral de Riesgos',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          Nuestra plataforma cuenta con barreras activas de mitigación contra las principales amenazas web:
        </p>
        <ul class="list-disc list-inside space-y-1">
          <li><strong>Inyección SQL:</strong> Consultas 100% parametrizadas (Prepared Statements) sin interpolación directa de cadenas.</li>
          <li><strong>Cross-Site Scripting (XSS):</strong> Sanitización estricta de entradas y cabeceras de Content Security Policy (CSP).</li>
          <li><strong>Control de Acceso Robusto:</strong> Verificación de roles en cada endpoint (Cliente, Vendedor, Auditor, Admin).</li>
          <li><strong>Rate Limiting &amp; Anti-Brute Force:</strong> Protección contra ataques distribuidos de denegación de servicio y fuerza bruta.</li>
        </ul>
      </div>
    `
  },

  'seguridad-pci': {
    icon: 'lock',
    title: 'Protección Financiera y Tokenización de Pagos',
    subtitle: 'Transacciones Cifradas y Pasarelas de Pago Seguras',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          La seguridad de tus tarjetas y fondos es nuestra máxima prioridad:
        </p>
        <div class="p-3 rounded-xl bg-surface border border-surface-container space-y-2 text-on-surface">
          <div class="flex items-center gap-2 font-bold text-xs text-emerald-700">
            <span class="material-symbols-outlined text-[18px]">verified_user</span>
            <span>Entorno Seguro y Cifrado para Procesamiento de Tarjetas</span>
          </div>
          <p class="text-xs text-secondary leading-relaxed">
            ExpressMart no almacena números de tarjeta (PAN), fechas completas ni códigos CVV en su base de datos. Los datos sensibles se intercambian directamente mediante tokens criptográficos efímeros con los procesadores bancarios autorizados.
          </p>
        </div>
      </div>
    `
  },

  profeco: {
    icon: 'verified',
    title: 'Protección y Respaldo al Consumidor en México',
    subtitle: 'Lineamientos y Código de Ética en Comercio Electrónico',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          ExpressMart México opera bajo los lineamientos y principios del Código de Ética en Comercio Electrónico de la Procuraduría Federal del Consumidor:
        </p>
        <ul class="list-disc list-inside space-y-1">
          <li>Precios claros, finales y con IVA incluido en Moneda Nacional ($ MXN).</li>
          <li>Información completa sobre especificaciones, modelo, marca y origen de los productos.</li>
          <li>Procedimiento accesible de conciliación y atención inmediata a quejas de clientes.</li>
        </ul>
      </div>
    `
  },

  'pagos-tarjetas': {
    icon: 'credit_card',
    title: 'Tarjetas Bancarias y Meses Sin Intereses (MSI)',
    subtitle: 'Visa, Mastercard, American Express y Tarjetas de Débito Mexicanas',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          Aceptamos todas las tarjetas de crédito y débito emitidas en México por bancos participantes (BBVA, Banorte, Santander, Citibanamex, HSBC, Scotiabank, Nu, Hey Banco):
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-on-surface">
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="font-bold text-xs text-primary block mb-1">Meses Sin Intereses (MSI)</span>
            <p class="text-[11px] text-secondary">Hasta 12 Meses Sin Intereses en compras seleccionadas de Electrónica, Consolas y Cómputo participantes.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="font-bold text-xs text-primary block mb-1">Cifrado de Extremo a Extremo</span>
            <p class="text-[11px] text-secondary">Transacciones aseguradas con protocolo TLS 1.3 y autenticación reforzada 3D Secure 2.0.</p>
          </div>
        </div>
      </div>
    `
  },

  'pagos-paypal': {
    icon: 'account_balance_wallet',
    title: 'Integración Oficial con PayPal México Sandbox',
    subtitle: 'Pagos rápidos y seguros sin compartir tus datos bancarios',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <div class="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-on-surface">
          <h4 class="font-bold text-sm text-blue-900 mb-1 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            PayPal Sandbox Oficial Integrado
          </h4>
          <p class="text-xs text-secondary leading-relaxed">
            Puedes simular y procesar pagos directos tanto en compras del catálogo como en la suscripción a ExpressPrime ingresando las credenciales de la cuenta sandbox oficial de PayPal México:
            <div class="mt-2 space-y-1 bg-white p-2.5 rounded border border-blue-200 text-blue-950 font-mono text-[11px]">
              <div><strong>Correo:</strong> bancochido@banco.com</div>
              <div><strong>Contraseña:</strong> nBBi"*d6</div>
              <div><strong>URL Sandbox:</strong> https://sandbox.paypal.com</div>
            </div>
          </p>
        </div>
        <p>
          Disfruta de la Protección al Comprador de PayPal con reembolsos automáticos en caso de incidentes de entrega.
        </p>
      </div>
    `
  },

  facturacion: {
    icon: 'receipt_long',
    title: 'Facturación Electrónica Fiscal CFDI 4.0',
    subtitle: 'Comprobantes Fiscales Digitales por Internet conformes con el SAT',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          ExpressMart México emite comprobantes fiscales digitales versión 4.0 por todas las compras realizadas:
        </p>
        <ul class="list-disc list-inside space-y-1">
          <li>Desglose exacto del 16% de IVA conforme al Código Fiscal de la Federación.</li>
          <li>Puedes registrar tu RFC, Régimen Fiscal y Uso de CFDI directamente en tu perfil antes o después de tu compra.</li>
          <li>Descarga de archivos XML y PDF timbrados ante el SAT en cualquier momento desde "Mis Pedidos".</li>
        </ul>
      </div>
    `
  },

  ayuda: {
    icon: 'support_agent',
    title: 'Centro de Ayuda al Cliente 24/7',
    subtitle: 'Soporte, Aclaraciones y Seguimiento de Envíos ExpressMart',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          Estamos disponibles para ayudarte en cualquier momento a través de nuestros canales oficiales:
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-on-surface">
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="material-symbols-outlined text-primary text-[20px]">call</span>
            <span class="font-bold text-xs block mt-1">Línea Telefónica Gratuita</span>
            <span class="text-[11px] text-secondary">800-EXPRESS (800-397-7377) · Lunes a Domingo 24h</span>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="material-symbols-outlined text-primary text-[20px]">mail</span>
            <span class="font-bold text-xs block mt-1">Atención por Correo</span>
            <span class="text-[11px] text-secondary">soporte@expressmart.mx · Respuesta en &lt; 2 horas</span>
          </div>
        </div>
      </div>
    `
  },

  afiliados: {
    icon: 'handshake',
    title: 'Programa de Afiliados y Creadores ExpressMart',
    subtitle: 'Monetiza tu contenido recomendando los mejores productos de México',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          Gana hasta un <strong>8% de comisión</strong> por cada compra referida a través de tus enlaces personalizados en redes sociales, blogs o canales de streaming.
        </p>
        <ul class="list-disc list-inside space-y-1">
          <li>Panel de analítica de clics y conversiones en tiempo real.</li>
          <li>Depósitos mensuales directos vía SPEI a tu cuenta bancaria.</li>
          <li>Herramientas para generación rápida de banners y enlaces de producto.</li>
        </ul>
      </div>
    `
  },

  cedis: {
    icon: 'warehouse',
    title: 'Red Logística y Centro de Distribución CEDIS CDMX',
    subtitle: 'Infraestructura de Última Milla ExpressPrime México',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          Contamos con un Centro de Distribución principal ubicado estratégicamente en CDMX Norte con más de 15,000 m² de capacidad y certificación de seguridad en cadena de suministro:
        </p>
        <ul class="list-disc list-inside space-y-1">
          <li>Entregas garantizadas el mismo día (Same-Day Delivery) en Área Metropolitana de CDMX.</li>
          <li>Cobertura nacional en 24 a 48 horas mediante convenios directos con paqueterías líderes.</li>
          <li>Trazabilidad por código de barras y monitoreo GPS de unidades en ruta.</li>
        </ul>
      </div>
    `
  }
};

function openInfoModal(key) {
  const page = INFO_PAGES[key];
  const dialog = document.getElementById('info-modal');
  if (!dialog || !page) return;

  const iconEl = document.getElementById('info-modal-icon');
  const titleEl = document.getElementById('info-modal-title');
  const subtitleEl = document.getElementById('info-modal-subtitle');
  const bodyEl = document.getElementById('info-modal-body');

  if (iconEl) iconEl.textContent = page.icon || 'info';
  if (titleEl) titleEl.textContent = page.title;
  if (subtitleEl) subtitleEl.textContent = page.subtitle || 'ExpressMart Marketplace México';
  if (bodyEl) {
    bodyEl.innerHTML = typeof page.renderHtml === 'function' ? page.renderHtml() : '<p>Información no disponible.</p>';
  }

  if (typeof page.initListeners === 'function') {
    page.initListeners();
  }

  dialog.showModal();
}


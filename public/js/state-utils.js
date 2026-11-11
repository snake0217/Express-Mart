/**
 * Módulo de Estado Global, Utilidades y Notificaciones para ExpressMart México.
 * Conforme a ISO/IEC 25010 y SGC MC-001.
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
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
  const walletView = document.getElementById('view-wallet');
  const auditView = document.getElementById('view-audit');
  const adminView = document.getElementById('view-admin');
  if ((profileView && !profileView.classList.contains('hidden')) ||
      (walletView && !walletView.classList.contains('hidden')) ||
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

function switchTab(tabId, bypassPanelAuth = false) {
  // Verificación de privilegios y autenticación cada que se abre el Panel de Auditoría
  if (tabId === 'view-audit') {
    if (!bypassPanelAuth && typeof requireWebPanelAuth === 'function') {
      requireWebPanelAuth('Centro de Auditoría SGC D8', ['auditor', 'administrador'], () => {
        switchTab('view-audit', true);
      });
      return;
    }
    const isAuditorOrAdmin = state.user && state.token && ['auditor', 'administrador'].includes(state.user.rol);
    if (!isAuditorOrAdmin) {
      showAlert('Acceso denegado: El panel de auditoría requiere credenciales de Auditor o Administrador.', true);
      switchTab('view-home');
      return;
    }
  }

  // Verificación de privilegios y autenticación cada que se abre el Panel de Administrador / Vendedor
  if (tabId === 'view-admin') {
    if (!bypassPanelAuth && typeof requireWebPanelAuth === 'function') {
      requireWebPanelAuth('Panel Administrativo y de Vendedor', ['administrador', 'vendedor'], () => {
        switchTab('view-admin', true);
      });
      return;
    }
    const isAdminOrSeller = state.user && state.token && ['administrador', 'vendedor'].includes(state.user.rol);
    if (!isAdminOrSeller) {
      showAlert('Acceso denegado: El panel de productos requiere credenciales de Administrador o Vendedor.', true);
      switchTab('view-home');
      return;
    }
  }

  // Verificación de autenticación para Mi Cuenta y Privacidad y Mi Cartera y PayPal
  if (tabId === 'view-profile' || tabId === 'view-wallet') {
    if (!state.user || !state.token) {
      showAlert('Debes iniciar sesión para acceder a tu cuenta y métodos de pago.', true);
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
  if (tabId === 'view-wallet' && typeof loadUserWalletCards === 'function') loadUserWalletCards();
  if (tabId === 'view-admin') loadAdminReports();
  if (tabId === 'view-audit') loadAuditCenter();
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


function initStateUtilsEvents() {
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

}

// Asignaciones globales a window para interoperabilidad total entre scripts
window.state = state;
window.formatMxn = formatMxn;
window.escapeHtml = escapeHtml;
window.showAlert = showAlert;
window.showToast = showToast;
window.clearSessionState = clearSessionState;
window.executeLogout = executeLogout;
window.startInactivityMonitor = startInactivityMonitor;
window.stopInactivityMonitor = stopInactivityMonitor;
window.confirmStayLoggedIn = confirmStayLoggedIn;
window.apiFetch = apiFetch;
window.switchTab = switchTab;
window.saveCart = saveCart;
window.updateHeaderNotifications = updateHeaderNotifications;
window.renderHeaderNotifications = renderHeaderNotifications;
window.initFallingLeaves = initFallingLeaves;
window.initStateUtilsEvents = initStateUtilsEvents;

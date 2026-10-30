/**
 * Cliente Web Interactivo ExpressMart - Sistema de Diseño Stitch "Aura Commerce" (Precios en MXN)
 * Conecta los flujos de Catálogo, Ficha de Producto con Zoom Interactivo y Reseñas Verificadas,
 * Cesta con Miniaturas y Checkout en 3 pasos, Perfil con Foto Personalizada,
 * Pedidos y Devoluciones LFPC, Notificaciones, Reportes y Centro de Auditoría RBAC.
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

async function apiFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
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

  // Verificación de privilegios para Panel de Administrador
  if (tabId === 'view-admin') {
    const isAdmin = state.user && state.token && state.user.rol === 'administrador';
    if (!isAdmin) {
      showAlert('Acceso denegado: El panel administrativo requiere credenciales de Administrador.', true);
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
        <p class="font-bold text-sm text-on-surface">Inicia sesión para ver tu lista de deseos</p>
      </div>
    `;
    if (badge) badge.textContent = '0 listas';
    return;
  }

  const storageKey = `em_wishlists_${user.id}`;
  let wishlists = null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== null) {
      wishlists = JSON.parse(raw);
    }
  } catch (_) {
    wishlists = null;
  }

  // Cuentas de demostración iniciales mantienen listas de ejemplo
  // Cualquier usuario nuevo registrado comienza con lista completamente vacía
  if (wishlists === null) {
    if (user.email === 'cliente@expressmart.mx') {
      wishlists = [
        {
          titulo: 'Setup Oficina & Desarrollo CDMX',
          detalle: '3 artículos · Monitoreo de precios en MXN',
          precio: 26739
        },
        {
          titulo: 'Hogar Inteligente & Café',
          detalle: '2 artículos · Envío ExpressPrime Gratis',
          precio: 10089
        }
      ];
      localStorage.setItem(storageKey, JSON.stringify(wishlists));
    } else {
      wishlists = [];
      localStorage.setItem(storageKey, JSON.stringify([]));
    }
  }

  if (!wishlists || wishlists.length === 0) {
    container.innerHTML = `
      <div class="p-6 rounded-xl bg-surface-container-low text-center border border-dashed border-surface-dim">
        <span class="material-symbols-outlined text-[36px] text-secondary mb-2 block">favorite_border</span>
        <p class="font-bold text-sm text-on-surface">Tu lista de deseos está vacía</p>
        <p class="text-xs text-secondary mt-1">Explora el catálogo y guarda tus artículos favoritos para recibir alertas de precio y ofertas.</p>
      </div>
    `;
    if (badge) {
      badge.textContent = '0 listas';
      badge.className = 'px-2 py-0.5 rounded-full bg-surface-container-high text-secondary font-label-xs text-label-xs font-semibold';
    }
  } else {
    container.innerHTML = wishlists
      .map(
        (w) => `
        <div class="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
          <div>
            <p class="font-bold text-on-surface">${w.titulo}</p>
            <p class="text-secondary text-xs">${w.detalle}</p>
          </div>
          <span class="font-bold text-primary">${formatMxn(w.precio)}</span>
        </div>
      `
      )
      .join('');
    if (badge) {
      badge.textContent = `${wishlists.length} ${wishlists.length === 1 ? 'lista' : 'listas'}`;
      badge.className = 'px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-xs text-label-xs font-bold';
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

  if (state.user && state.token) {
    const firstName = state.user.nombre.split(' ')[0];
    statusEl.textContent = `Hola, ${firstName}`;
    btnLogout.classList.remove('hidden');

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
    if (addrInput && state.user.direccion && !addrInput.value) {
      addrInput.value = state.user.direccion;
    }

    // Panel de Auditoría solo visible para usuarios con rol auditor o administrador
    const isAuditorOrAdmin = ['auditor', 'administrador'].includes(state.user.rol);
    if (auditTabBtn) {
      auditTabBtn.classList.toggle('hidden', !isAuditorOrAdmin);
    }

    // Panel de Administrador solo visible para usuarios con rol administrador
    const isAdmin = state.user.rol === 'administrador';
    if (adminTabBtn) {
      adminTabBtn.classList.toggle('hidden', !isAdmin);
    }
  } else {
    statusEl.textContent = 'Hola, Identifícate';
    btnLogout.classList.add('hidden');
    if (headerAvatarImg) {
      headerAvatarImg.onerror = null;
      headerAvatarImg.removeAttribute('src');
      headerAvatarImg.classList.add('hidden');
    }
    if (headerAvatarIcon) headerAvatarIcon.classList.remove('hidden');
    if (auditTabBtn) auditTabBtn.classList.add('hidden');
    if (adminTabBtn) adminTabBtn.classList.add('hidden');
  }

  const totalItems = state.cart.reduce((acc, i) => acc + i.cantidad, 0);
  const countEl = document.getElementById('cart-count');
  if (countEl) countEl.textContent = String(totalItems);

  updateProfilePhotoUI(state.user?.fotoPerfil || '');
  renderProfileWishlists(state.user);
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
// CATÁLOGO Y BÚSQUEDA CON TARJETAS STITCH "AURA COMMERCE" EN MXN
// ============================================================================
function createProductCard(p) {
  const precioNum = Number(p.precio);
  const precioAnterior = Math.round(precioNum * 1.18);
  const mensualidadMsi = (precioNum / 12).toFixed(2);
  const imgUrl = p.imagen_url || '/assets/logo.png';

  const card = document.createElement('article');
  card.className =
    'bg-surface-container-lowest rounded-xl p-space-md shadow-[0_8px_24px_rgba(11,28,48,0.06)] hover:shadow-[0_14px_32px_rgba(11,28,48,0.12)] transition-all flex flex-col justify-between border border-surface-container';

  card.innerHTML = `
    <div>
      <div class="relative w-full aspect-[4/3] rounded-xl bg-surface-container-low mb-space-sm overflow-hidden group cursor-pointer open-detail-trigger" data-id="${p.id}">
        <span class="absolute top-2.5 left-2.5 z-10 bg-primary text-on-primary font-label-xs text-label-xs px-2.5 py-0.5 rounded-full font-bold uppercase shadow-sm">
          ${p.categoria} · ${p.marca}
        </span>
        <span class="absolute top-2.5 right-2.5 z-10 bg-surface-container-highest/95 backdrop-blur-sm text-on-surface font-label-xs text-label-xs px-2 py-0.5 rounded-full font-bold shadow-sm">
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
      shipMsg.textContent =
        calc.costoEnvio === 0
          ? 'Tu pedido incluye Envío ExpressPrime GRATIS en México ($0.00 MXN)'
          : `Agrega ${formatMxn(Math.max(0, 999 - calc.subtotal))} más para obtener Envío ExpressPrime GRATIS`;
    }

    totalsBox.innerHTML = `
      <div class="space-y-1 text-sm">
        <div class="flex justify-between"><span>Subtotal productos:</span> <strong>${formatMxn(calc.subtotal)}</strong></div>
        <div class="flex justify-between text-tertiary"><span>Descuento (${calc.cuponAplicado || 'Sin cupón'}):</span> <strong>-${formatMxn(calc.descuento)}</strong></div>
        <div class="flex justify-between"><span>IVA trasladado (16% México):</span> <strong>${formatMxn(calc.impuestos)}</strong></div>
        <div class="flex justify-between"><span>Envío ExpressPrime DHL/FedEx:</span> <strong>${calc.costoEnvio === 0 ? 'GRATIS ($0.00 MXN)' : formatMxn(calc.costoEnvio)}</strong></div>
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
                Fecha: ${o.created_at ? o.created_at.split('T')[0] : 'Reciente'} · Compra protegida por garantía oficial ExpressMart LFPC
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
                Método de Pago Seguro (PCI DSS):
              </div>
              <div><strong>Transacción:</strong> ${o.pago ? `${o.pago.tarjeta_enmascarada} (${o.pago.referencia_pasarela})` : o.metodo_pago}</div>
              <div class="text-secondary"><strong>IVA Trasladado:</strong> 16% incluido en el total pagado</div>
            </div>
          </div>

          <!-- Botón de Devolución -->
          <div class="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-surface-container">
            <span class="text-xs text-secondary">
              Garantía legal de 30 días para devoluciones sin costo conforme a la LFPC.
            </span>
            <div>
              ${
                o.estado !== 'devuelto' && o.estado !== 'cancelado'
                  ? `<button type="button" class="btn btn-sm btn-outline return-order-btn cursor-pointer" data-id="${o.id}">Solicitar Devolución y Reembolso en MXN</button>`
                  : '<span class="badge badge-ok">Reembolsado en MXN / Devuelto conforme a LFPC</span>'
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
            body: JSON.stringify({ motivo: 'Devolución en línea sin costo conforme a LFPC México' })
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

    // Actualizar foto en la UI de perfil
    if (data.user.fotoPerfil) {
      state.user.fotoPerfil = data.user.fotoPerfil;
      localStorage.setItem('em_user', JSON.stringify(state.user));
    }
    updateProfilePhotoUI(data.user.fotoPerfil || '');
    updateSessionUI();

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
// INICIALIZACIÓN DE EVENTOS DOM
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  updateSessionUI();
  loadCatalog();
  setupSearchSuggestions();

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

  // Botones de tarjetas promocionales Stitch
  document.querySelectorAll('.promo-filter-trigger').forEach((el) => {
    el.addEventListener('click', () => {
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
        refreshCartModal();
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
        document.getElementById('mfa-field-group').classList.remove('hidden');
        document.getElementById('login-mfa').value = res.demoHintCode || '';
        showAlert(`Ingrese el código de verificación de 6 dígitos (Código TOTP de prueba: ${res.demoHintCode})`);
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
      refreshCartModal();
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
        title: 'Creación de cuenta exitosa',
        desc: 'Configurando tu perfil y cifrado de datos en ExpressMart...',
        successTitle: '¡Cuenta creada con éxito!',
        durationMs: 950
      });

      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          nombre: document.getElementById('reg-nombre').value,
          email: document.getElementById('reg-email').value,
          password: document.getElementById('reg-password').value,
          direccion: document.getElementById('reg-direccion').value,
          consentimientoPrivacidad: document.getElementById('reg-privacy').checked
        })
      });

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
      refreshCartModal();
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

  async function executeLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {
      // Continuar limpieza local de sesión
    }
    state.token = '';
    state.user = null;
    state.cart = [];
    state.coupon = '';
    state.calculatedTotals = null;
    localStorage.removeItem('em_token');
    localStorage.removeItem('em_user');
    localStorage.removeItem('em_cart');
    updateSessionUI();
    refreshCartModal();
    switchTab('view-home');
    showAlert('Sesión cerrada de forma segura.');
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

  document.getElementById('payment-method').addEventListener('change', (e) => {
    document.getElementById('msi-group').classList.toggle('hidden', e.target.value !== 'msi');
  });

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
    setCheckoutStep(2);
  });

  document.getElementById('btn-back-step-1').addEventListener('click', () => setCheckoutStep(1));
  document.getElementById('btn-back-step-2').addEventListener('click', () => setCheckoutStep(2));

  // Paso 3: Resumen final con miniaturas de productos
  document.getElementById('btn-to-step-3').addEventListener('click', () => {
    if (!state.calculatedTotals) return;
    const summaryEl = document.getElementById('checkout-final-summary');
    const addr = document.getElementById('checkout-address').value.trim();
    const method = document.getElementById('payment-method').value;

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
          <div><strong>Método de Pago:</strong> ${method.toUpperCase()}</div>
          <div class="flex justify-between pt-1"><span>Subtotal:</span> <strong>${formatMxn(state.calculatedTotals.subtotal)}</strong></div>
          <div class="flex justify-between text-tertiary"><span>Descuento:</span> <strong>-${formatMxn(state.calculatedTotals.descuento)}</strong></div>
          <div class="flex justify-between"><span>IVA (16%):</span> <strong>${formatMxn(state.calculatedTotals.impuestos)}</strong></div>
          <div class="flex justify-between"><span>Envío ExpressPrime:</span> <strong>${formatMxn(state.calculatedTotals.costoEnvio)}</strong></div>
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

      const res = await apiFetch('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: state.cart,
          cuponCodigo: state.coupon,
          direccionEnvio: document.getElementById('checkout-address').value.trim(),
          metodoPago: document.getElementById('payment-method').value,
          mesesSinIntereses: Number(document.getElementById('payment-msi').value || 1),
          cardHolder: document.getElementById('card-holder').value,
          cardNumber: document.getElementById('card-number').value,
          expiry: document.getElementById('card-expiry').value,
          pasosCheckout: 3
        })
      });

      state.cart = [];
      state.coupon = '';
      saveCart();
      loadCatalog();

      resultBox.innerHTML = `
        <div class="p-3.5 rounded-xl bg-tertiary-fixed/30 border border-tertiary/20 text-on-surface space-y-1">
          <div class="flex items-center gap-1.5 text-tertiary font-bold text-sm">
            <span class="material-symbols-outlined text-[18px]">verified</span>
            <span>${res.message || '¡Pago procesado con éxito!'}</span>
          </div>
          <div class="text-xs">Folio de Pedido: <strong>${res.order.folio}</strong> | Total: <strong>${formatMxn(res.order.total)}</strong></div>
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

  // Formulario de Derechos ARCO
  document.getElementById('arco-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/privacy/arco', {
        method: 'POST',
        body: JSON.stringify({
          tipo: document.getElementById('arco-tipo').value,
          descripcion: document.getElementById('arco-desc').value
        })
      });
      document.getElementById('arco-result').innerHTML =
        `<div class="alert alert-info">Folio ARCO: <strong>${res.folio}</strong> — ${res.respuesta}</div>`;
    } catch (err) {
      showAlert(err.message, true);
    }
  });

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
});

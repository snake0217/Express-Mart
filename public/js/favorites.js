/**
 * Módulo de Favoritos y Lista de Deseos de ExpressMart México.
 * Almacenamiento aislado por usuario y sincronización con UI en tiempo real.
 */
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


function initFavoritesEvents() {
  // Botón para vaciar favoritos
  const btnFavClearAll = document.getElementById('btn-fav-clear-all');
  if (btnFavClearAll) {
    btnFavClearAll.addEventListener('click', async () => {
      const confirmClear = await window.showAppConfirm({
        title: 'Vaciar Lista de Favoritos',
        subtitle: '¿Deseas vaciar tu lista de productos guardados?',
        message: 'Se eliminarán todos los artículos guardados en tus favoritos.',
        confirmText: 'Sí, Vaciar Lista',
        cancelText: 'Cancelar',
        isDanger: true,
        icon: 'delete_sweep'
      });
      if (confirmClear) {
        saveFavorites([]);
        renderFavoritesView();
        showAlert('Se han vaciado tus favoritos.');
      }
    });
  }


}

window.getFavoritesKey = getFavoritesKey;
window.getFavorites = getFavorites;
window.saveFavorites = saveFavorites;
window.isProductFavorite = isProductFavorite;
window.toggleFavorite = toggleFavorite;
window.updateFavoritesBadge = updateFavoritesBadge;
window.renderFavoritesView = renderFavoritesView;
window.initFavoritesEvents = initFavoritesEvents;

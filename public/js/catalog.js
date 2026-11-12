/**
 * Módulo de Catálogo, Búsqueda con Sugerencias y Ficha de Producto con Zoom Lens.
 * Sistema de Diseño Stitch "Aura Commerce" en MXN.
 */
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
      const maxStock = Number(p.stock_disponible || 0);
      if (maxStock <= 0) {
        showAlert('Este producto no cuenta con stock disponible por el momento.', true);
        return;
      }
      const rawQty = Number(document.getElementById('buybox-quantity').value || 1);
      const qty = Math.max(1, Math.min(rawQty, maxStock));
      const existing = state.cart.find((i) => i.productoId === p.id);
      if (existing) {
        // Comprar Ahora fija exactamente la cantidad elegida sin acumular intentos cerrados previos
        existing.cantidad = qty;
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


function initCatalogEvents() {
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


}

window.createProductCard = createProductCard;
window.loadCatalog = loadCatalog;
window.openSearchResultsPage = openSearchResultsPage;
window.openProductDetailPage = openProductDetailPage;
window.openProductDetailModal = openProductDetailModal;
window.setupSearchSuggestions = setupSearchSuggestions;
window.initCatalogEvents = initCatalogEvents;

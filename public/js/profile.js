/**
 * Módulo de Perfil de Usuario, Membresía ExpressPrime y Derechos ARCO.
 * Permite actualización de datos, avatar personalizado y autoeliminación de cuenta.
 */
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


let profilePickerMap = null;
let profileDestMarker = null;
let profilePreviewLine = null;

function setProfileMapCoordinates(lat, lng, customAddressText) {
  const cleanLat = Number(Number(lat).toFixed(5));
  const cleanLng = Number(Number(lng).toFixed(5));
  state.profileCoords = { lat: cleanLat, lng: cleanLng };

  const latInput = document.getElementById('prof-latitud');
  const lngInput = document.getElementById('prof-longitud');
  const coordsText = document.getElementById('prof-coords-text');
  const whPreview = document.getElementById('prof-warehouse-preview');
  const addrInput = document.getElementById('prof-direccion');

  if (latInput) latInput.value = String(cleanLat);
  if (lngInput) lngInput.value = String(cleanLng);
  if (coordsText) coordsText.textContent = `${cleanLat}, ${cleanLng}`;

  const nearestWh = typeof findNearestCedisWarehouse === 'function'
    ? findNearestCedisWarehouse(cleanLat, cleanLng)
    : { nombre: 'CEDIS CDMX Norte (Vallejo)', direccion: 'Av. Ceylán 450, Bodega Logística 4-B, Col. Industrial Vallejo, CDMX', lat: 19.4895, lng: -99.1645 };

  if (whPreview) {
    whPreview.innerHTML = `🏢 Almacén asignado más cercano: <strong class="text-on-surface">${escapeHtml(nearestWh.nombre)} — ${escapeHtml(nearestWh.direccion)}</strong>`;
  }

  if (addrInput && customAddressText !== false) {
    const baseAddr = customAddressText
      ? customAddressText
      : (addrInput.value.replace(/\s*\[Lat:.*?\]/g, '').trim() || 'Av. Insurgentes Sur 1602, Col. Crédito Constructor, CDMX');
    addrInput.value = `${baseAddr} [Lat: ${cleanLat}, Lng: ${cleanLng}]`;
  }

  if (profilePickerMap && typeof L !== 'undefined') {
    if (profileDestMarker) {
      profileDestMarker.setLatLng([cleanLat, cleanLng]);
    } else {
      const destIcon = L.divIcon({
        className: 'prof-dest-pin',
        html: `<div style="background:#059669; color:#fff; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; font-size:15px; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.35);">📍</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      profileDestMarker = L.marker([cleanLat, cleanLng], { icon: destIcon })
        .bindPopup(`<strong>📍 Domicilio de Entrega</strong><br>Coordenadas: ${cleanLat}, ${cleanLng}`)
        .addTo(profilePickerMap);
    }

    if (profilePreviewLine) {
      profilePickerMap.removeLayer(profilePreviewLine);
    }
    profilePreviewLine = L.polyline([[nearestWh.lat, nearestWh.lng], [cleanLat, cleanLng]], {
      color: '#0284c7',
      weight: 4,
      dashArray: '8, 6',
      opacity: 0.85
    }).addTo(profilePickerMap);
  }

  if (customAddressText === undefined && typeof resolveStreetNameFromMapClick === 'function') {
    resolveStreetNameFromMapClick(cleanLat, cleanLng).then((geo) => {
      if (geo && geo.direccionCompleta) {
        if (addrInput) {
          addrInput.value = `${geo.direccionCompleta} [Lat: ${cleanLat}, Lng: ${cleanLng}]`;
        }
        if (coordsText) {
          coordsText.textContent = `${cleanLat}, ${cleanLng} · 🛣️ ${geo.calle || ''}`;
        }
        if (profileDestMarker) {
          profileDestMarker.setPopupContent(
            `<strong>📍 ${escapeHtml(geo.calle || 'Domicilio de Entrega')}</strong><br><span style="font-size:11px;">${escapeHtml(geo.direccionCompleta)}</span><br><code>${cleanLat}, ${cleanLng}</code>`
          ).openPopup();
        }
      }
    });
  }
}

function initProfileOsmPicker() {
  const mapEl = document.getElementById('prof-osm-picker-map');
  if (!mapEl || typeof L === 'undefined') return;

  const initLat = Number(state.profileCoords?.lat) || Number(state.user?.latitud) || 19.3907;
  const initLng = Number(state.profileCoords?.lng) || Number(state.user?.longitud) || -99.1636;

  if (!profilePickerMap) {
    profilePickerMap = L.map('prof-osm-picker-map', {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([initLat, initLng], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(profilePickerMap);

    const whList = window.EXPRESSMART_WAREHOUSES || [];
    whList.forEach((wh) => {
      const whIcon = L.divIcon({
        className: 'prof-wh-pin',
        html: `<div style="background:#1d4e9a; color:#fff; border-radius:50%; width:26px; height:26px; display:flex; align-items:center; justify-content:center; font-size:13px; border:2px solid #fff; box-shadow:0 2px 5px rgba(0,0,0,0.3);">🏢</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      L.marker([wh.lat, wh.lng], { icon: whIcon })
        .bindPopup(`<strong>🏢 ${escapeHtml(wh.nombre)}</strong><br><span style="font-size:11px;">${escapeHtml(wh.direccion)}</span>`)
        .addTo(profilePickerMap);
    });

    profilePickerMap.on('click', (ev) => {
      setProfileMapCoordinates(ev.latlng.lat, ev.latlng.lng);
    });
  }

  setProfileMapCoordinates(initLat, initLng, false);
  setTimeout(() => {
    if (profilePickerMap) {
      profilePickerMap.invalidateSize();
      profilePickerMap.setView([initLat, initLng], 11);
    }
  }, 220);
}

async function loadProfile() {
  if (!state.token) return;
  try {
    const data = await apiFetch('/api/auth/profile');
    document.getElementById('prof-nombre').value = data.user.nombre || '';
    document.getElementById('prof-direccion').value = data.user.direccion || '';
    document.getElementById('prof-telefono').value = data.user.telefono || '';
    document.getElementById('prof-mfa').checked = Boolean(data.user.mfaEnabled);

    const savedLat = Number(data.user.latitud) || 19.3907;
    const savedLng = Number(data.user.longitud) || -99.1636;
    setProfileMapCoordinates(savedLat, savedLng, false);

    // Actualizar datos de usuario y membresía en estado local
    if (data.user) {
      if (data.user.fotoPerfil) {
        state.user.fotoPerfil = data.user.fotoPerfil;
      }
      state.user.latitud = savedLat;
      state.user.longitud = savedLng;
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


function initProfileEvents() {
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
    if (fileInputPhoto) fileInputPhoto.click();
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

  const btnToggleProfMap = document.getElementById('btn-toggle-prof-map');
  if (btnToggleProfMap) {
    btnToggleProfMap.addEventListener('click', () => {
      const wrap = document.getElementById('prof-osm-picker-wrapper');
      if (wrap) {
        wrap.classList.toggle('hidden');
        if (!wrap.classList.contains('hidden')) {
          initProfileOsmPicker();
        }
      }
    });
  }

  document.querySelectorAll('.prof-preset-zone').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lat = Number(btn.dataset.lat);
      const lng = Number(btn.dataset.lng);
      const addr = btn.dataset.addr || '';
      setProfileMapCoordinates(lat, lng, addr);
      if (profilePickerMap) {
        profilePickerMap.setView([lat, lng], 12);
      }
    });
  });

  // Guardar Cambios en Formulario de Perfil
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nombre: document.getElementById('prof-nombre').value,
        direccion: document.getElementById('prof-direccion').value,
        telefono: document.getElementById('prof-telefono').value,
        enableMfa: document.getElementById('prof-mfa').checked,
        fotoPerfil: state.user?.fotoPerfil || ''
      };
      if (state.profileCoords && state.profileCoords.lat && state.profileCoords.lng) {
        payload.latitud = state.profileCoords.lat;
        payload.longitud = state.profileCoords.lng;
      }
      const res = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(payload)
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

  // Eliminación de Cuenta Propia (Zona de Peligro)
  const btnDeleteOwn = document.getElementById('btn-delete-own-account');
  if (btnDeleteOwn) {
    btnDeleteOwn.addEventListener('click', async () => {
      const confirmDelete = window.confirm(
        'ADVERTENCIA: ¿Estás seguro de que deseas eliminar permanentemente tu cuenta de ExpressMart?\n\n' +
        'Esta acción cerrará tu sesión, cancelará beneficios activos y borrará tus datos personales de manera irreversible.'
      );
      if (!confirmDelete) return;

      try {
        const res = await apiFetch('/api/users/me', {
          method: 'DELETE'
        });
        showAlert(res.message || 'Tu cuenta ha sido eliminada permanentemente.');
        showToast({
          title: 'Cuenta eliminada',
          message: 'Tu cuenta ha sido eliminada del sistema.',
          imageUrl: '/assets/logo.png'
        });
        executeLogout();
        switchTab('view-catalog');
      } catch (err) {
        showAlert(err.message, true);
      }
    });
  }

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


}

window.renderProfileWishlists = renderProfileWishlists;
window.updateProfilePhotoUI = updateProfilePhotoUI;
window.loadProfile = loadProfile;
window.renderMembershipProfile = renderMembershipProfile;
window.openSubscriptionDialog = openSubscriptionDialog;
window.updateSubPlanSelection = updateSubPlanSelection;
window.handleSubscriptionSubmit = handleSubscriptionSubmit;
window.initProfileEvents = initProfileEvents;

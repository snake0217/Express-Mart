/**
 * ============================================================================
 * Módulo de Cartera Interactiva (Stitched Wallet) y Tarjetas PayPal por Usuario
 * ============================================================================
 * - Carga exclusivamente las tarjetas simuladas asignadas al usuario activo (?mine=1).
 * - Permite máximo 3 tarjetas por usuario.
 * - Incluye animación interactiva donde la tarjeta emerge fuera de la cartera
 *   al pulsar "+ Add Card", permitiendo cambiar el color del plástico en vivo.
 * - Renderiza el panel estilo PayPal Sandbox "Manage credit cards" (Type, Card Number,
 *   Expiry, CVC Code con botones de copiado rápido y eliminación).
 * - Incluye sección de administración para que el Administrador pueda asignar
 *   tarjetas a cualquier usuario registrado.
 */

const WALLET_PLASTIC_COLORS = [
  { id: '#1d4ed8', name: 'Azul Rey PayPal', bg: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)', text: '#ffffff', badge: '#93c5fd' },
  { id: '#22c55e', name: 'Verde Esmeralda', bg: 'linear-gradient(135deg, #14532d 0%, #16a34a 60%, #4ade80 100%)', text: '#ffffff', badge: '#bbf7d0' },
  { id: '#f8fafc', name: 'Blanco Platino', bg: 'linear-gradient(135deg, #e2e8f0 0%, #f8fafc 60%, #ffffff 100%)', text: '#0f172a', badge: '#334155' },
  { id: '#0f172a', name: 'Negro Obsidiana', bg: 'linear-gradient(135deg, #020617 0%, #1e293b 60%, #334155 100%)', text: '#ffffff', badge: '#cbd5e1' },
  { id: '#d97706', name: 'Dorado VIP', bg: 'linear-gradient(135deg, #78350f 0%, #d97706 60%, #fbbf24 100%)', text: '#ffffff', badge: '#fef08a' },
  { id: '#7c3aed', name: 'Morado Neón', bg: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 60%, #a855f7 100%)', text: '#ffffff', badge: '#ddd6fe' },
  { id: '#e11d48', name: 'Rojo Carmesí', bg: 'linear-gradient(135deg, #881337 0%, #e11d48 60%, #fb7185 100%)', text: '#ffffff', badge: '#fecdd3' }
];

let userWalletCards = [];
let selectedWalletCardId = null;
let isCardEmergingOpen = false;
let currentEmergingColor = '#1d4ed8';

function getPlasticStyle(hexColor) {
  const normalized = (hexColor || '#1d4ed8').toLowerCase();
  return WALLET_PLASTIC_COLORS.find((c) => c.id.toLowerCase() === normalized) || WALLET_PLASTIC_COLORS[0];
}

function generateLuhnSandboxCard(brand = 'Visa') {
  let prefix = '403203';
  if (brand === 'Mastercard') prefix = '542523';
  if (brand === 'American Express') prefix = '378282';

  let digits = prefix.split('').map(Number);
  while (digits.length < 15) {
    digits.push(Math.floor(Math.random() * 10));
  }
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = digits[14 - i];
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  digits.push(checkDigit);
  return digits.join('');
}

function formatCardNumberBlocks(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

async function copyTextToClipboard(text, label = 'Dato') {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const temp = document.createElement('textarea');
      temp.value = text;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      temp.remove();
    }
    showAlert(`📋 ${label} copiado al portapapeles: ${text}`);
  } catch (_) {
    showAlert(`Copiado: ${text}`);
  }
}

async function loadUserWalletCards() {
  if (!state.token || !state.user) return [];
  try {
    const cards = await apiFetch('/api/payments/simulated-cards?mine=1');
    userWalletCards = Array.isArray(cards) ? cards : [];
    const navBadge = document.getElementById('nav-wallet-cards-count');
    if (navBadge) {
      navBadge.textContent = `${userWalletCards.length}/3`;
      navBadge.classList.remove('hidden');
    }
    renderStitchedWalletStack();
    renderPaypalManageCardsList();
    if (typeof loadAdminAllSimulatedCards === 'function' && state.user.rol === 'administrador') {
      loadAdminAllSimulatedCards();
    }
    return userWalletCards;
  } catch (err) {
    console.warn('Error cargando tarjetas del usuario:', err.message);
    return [];
  }
}

function renderStitchedWalletStack() {
  const stackContainer = document.getElementById('wallet-cards-stack-slot');
  const countBadge = document.getElementById('wallet-counter-badge');
  const limitWarning = document.getElementById('wallet-limit-warning');
  const btnAddWallet = document.getElementById('btn-wallet-add-card');

  if (countBadge) {
    countBadge.textContent = `${userWalletCards.length} / 3 Tarjetas`;
    countBadge.className = userWalletCards.length >= 3
      ? 'px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500 text-slate-950 shadow-xs'
      : 'px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30';
  }

  if (limitWarning) {
    limitWarning.classList.toggle('hidden', userWalletCards.length < 3);
  }

  if (btnAddWallet) {
    if (userWalletCards.length >= 3) {
      btnAddWallet.classList.add('opacity-60');
      btnAddWallet.innerHTML = `<span class="material-symbols-outlined text-[20px]">block</span><span>Límite Alcanzado (3/3 Tarjetas)</span>`;
    } else {
      btnAddWallet.classList.remove('opacity-60');
      btnAddWallet.innerHTML = `<span class="text-xl leading-none font-black">+</span><span>Add Card (${userWalletCards.length}/3)</span>`;
    }
  }

  if (!stackContainer) return;

  if (userWalletCards.length === 0) {
    stackContainer.innerHTML = `
      <div class="wallet-empty-slot text-center py-6 text-slate-400 text-xs font-medium">
        Tu cartera está vacía (0/3). Pulsa <strong>"+ Add Card"</strong> abajo para que salga una nueva tarjeta.
      </div>
    `;
    return;
  }

  // Renderizar hasta 3 tarjetas apiladas asomándose por la ranura superior de la cartera
  stackContainer.innerHTML = userWalletCards.slice(0, 3).map((card, idx) => {
    const style = getPlasticStyle(card.color_plastico);
    const isSelected = Number(selectedWalletCardId) === Number(card.id);
    const cleanNum = String(card.numero_tarjeta || '').replace(/\D/g, '');
    const last4 = cleanNum.slice(-4) || '0000';
    const formattedNum = formatCardNumberBlocks(cleanNum);
    const offsetTop = idx * 38;
    const scale = 1 - ((userWalletCards.length - 1 - idx) * 0.035);
    const zIndex = 10 + idx + (isSelected ? 20 : 0);

    return `
      <div
        class="wallet-stacked-card ${isSelected ? 'is-peeking-up' : ''}"
        data-card-id="${card.id}"
        style="
          background: ${style.bg};
          color: ${style.text};
          top: ${offsetTop}px;
          transform: translateX(-50%) scale(${ isSelected ? 1.02 : scale }) translateY(${isSelected ? '-52px' : '0px'});
          z-index: ${zIndex};
        "
        title="Haz clic para sacar / inspeccionar esta tarjeta"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="wallet-card-chip"></span>
            <span class="text-[11px] font-bold tracking-wider uppercase opacity-90">${escapeHtml(card.titular || state.user?.nombre || 'TITULAR')}</span>
          </div>
          <span class="font-headline-sm text-sm font-black tracking-wider uppercase italic">${escapeHtml((card.marca || 'VISA').toUpperCase())}</span>
        </div>
        <div class="mt-3 font-mono text-sm sm:text-base font-extrabold tracking-[2.5px] drop-shadow-xs">
          ${escapeHtml(formattedNum)}
        </div>
        <div class="mt-2 flex items-center justify-between text-[11px] opacity-90">
          <span>EXP: <strong>${escapeHtml(card.expiracion || '10/2028')}</strong> · CVC: <strong>${escapeHtml(card.cvv || 'Any 3 digits')}</strong></span>
          <span class="font-extrabold px-2 py-0.5 rounded bg-black/25 text-white">${formatMxn(card.saldo || 0)}</span>
        </div>
        <div class="mt-1 text-[10px] opacity-75 flex items-center justify-between">
          <span>•••• ${last4} (${escapeHtml((card.tipo || 'credito').toUpperCase())})</span>
          <span>${isSelected ? '▲ Tarjeta seleccionada (clic para guardar)' : '👆 Clic para deslizar fuera'}</span>
        </div>
      </div>
    `;
  }).join('');

  stackContainer.querySelectorAll('.wallet-stacked-card').forEach((el) => {
    el.addEventListener('click', () => {
      const id = Number(el.dataset.cardId);
      selectedWalletCardId = selectedWalletCardId === id ? null : id;
      renderStitchedWalletStack();
    });
  });
}

function renderPaypalManageCardsList() {
  const listEl = document.getElementById('paypal-manage-cards-list');
  if (!listEl) return;

  if (userWalletCards.length === 0) {
    listEl.innerHTML = `
      <div class="p-6 rounded-2xl bg-surface-container-low border border-dashed border-surface-dim text-center space-y-2">
        <span class="material-symbols-outlined text-[36px] text-[#0070ba]">credit_card_off</span>
        <p class="font-bold text-sm text-on-surface">No tienes tarjetas simuladas registradas en tu cuenta PayPal</p>
        <p class="text-xs text-secondary">Haz clic en <strong>"+ Add Card"</strong> en la cartera o en <strong>"Generate New Card"</strong> abajo para crear tu primera tarjeta (máx. 3).</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = userWalletCards.map((card) => {
    const cleanNum = String(card.numero_tarjeta || '').replace(/\s+/g, '');
    const style = getPlasticStyle(card.color_plastico);
    const expDisplay = card.expiracion && card.expiracion.length === 5
      ? `${card.expiracion.slice(0, 2)}/20${card.expiracion.slice(3, 5)}`
      : (card.expiracion || '10/2028');

    return `
      <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5 transition-all hover:border-[#0070ba]/50">
        <!-- Fila Type + Botón Eliminar (Papelera como en la imagen de PayPal) -->
        <div class="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div class="grid grid-cols-[120px_1fr] items-center gap-2 flex-1">
            <span class="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">Type</span>
            <div class="flex items-center gap-2">
              <span class="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block shrink-0" style="background:${style.id};" title="Color del plástico: ${style.name}"></span>
              <span class="text-xs sm:text-sm font-extrabold tracking-wide text-slate-800 dark:text-slate-200 uppercase">${escapeHtml(card.marca || 'VISA')}</span>
              <span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">${formatMxn(card.saldo || 0)}</span>
            </div>
          </div>
          <button
            type="button"
            class="btn-delete-wallet-card p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            data-id="${card.id}"
            title="Eliminar esta tarjeta de tu cartera"
            aria-label="Eliminar tarjeta"
          >
            <span class="material-symbols-outlined text-[20px]">delete</span>
          </button>
        </div>

        <!-- Fila Card Number + Copy -->
        <div class="flex items-center justify-between">
          <div class="grid grid-cols-[120px_1fr] items-center gap-2 flex-1 min-w-0">
            <span class="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">Card Number</span>
            <span class="font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300 truncate">${escapeHtml(cleanNum)}</span>
          </div>
          <button
            type="button"
            class="btn-copy-card-field p-1.5 rounded-lg text-slate-500 hover:text-[#0070ba] hover:bg-blue-50 transition-colors cursor-pointer"
            data-copy="${escapeHtml(cleanNum)}"
            data-label="Card Number"
            title="Copiar número de tarjeta"
          >
            <span class="material-symbols-outlined text-[19px]">content_copy</span>
          </button>
        </div>

        <!-- Fila Expiry + Copy -->
        <div class="flex items-center justify-between">
          <div class="grid grid-cols-[120px_1fr] items-center gap-2 flex-1">
            <span class="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">Expiry</span>
            <span class="font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300">${escapeHtml(expDisplay)}</span>
          </div>
          <button
            type="button"
            class="btn-copy-card-field p-1.5 rounded-lg text-slate-500 hover:text-[#0070ba] hover:bg-blue-50 transition-colors cursor-pointer"
            data-copy="${escapeHtml(card.expiracion || expDisplay)}"
            data-label="Expiry"
            title="Copiar fecha de expiración"
          >
            <span class="material-symbols-outlined text-[19px]">content_copy</span>
          </button>
        </div>

        <!-- Fila CVC Code + Copy -->
        <div class="flex items-center justify-between">
          <div class="grid grid-cols-[120px_1fr] items-center gap-2 flex-1">
            <span class="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">CVC Code</span>
            <span class="text-xs sm:text-sm text-slate-700 dark:text-slate-300">Any 3 digits <span class="font-mono text-xs text-slate-500">(${escapeHtml(card.cvv || '123')})</span></span>
          </div>
          <button
            type="button"
            class="btn-copy-card-field p-1.5 rounded-lg text-slate-500 hover:text-[#0070ba] hover:bg-blue-50 transition-colors cursor-pointer"
            data-copy="${escapeHtml(card.cvv || '123')}"
            data-label="CVC Code"
            title="Copiar CVC"
          >
            <span class="material-symbols-outlined text-[19px]">content_copy</span>
          </button>
        </div>

        <!-- Pie de tarjeta con titular y acción rápida para usar en Checkout PayPal -->
        <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span class="text-slate-500">Titular: <strong class="text-slate-800 dark:text-slate-200">${escapeHtml(card.titular)}</strong></span>
          <button
            type="button"
            class="btn-use-card-in-paypal px-3 py-1 rounded-full bg-[#0070ba]/10 hover:bg-[#0070ba] text-[#0070ba] hover:text-white font-bold transition-colors cursor-pointer flex items-center gap-1"
            data-id="${card.id}"
          >
            <span class="material-symbols-outlined text-[15px]">shopping_cart_checkout</span>
            <span>Usar en Pago PayPal</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.btn-copy-card-field').forEach((btn) => {
    btn.addEventListener('click', () => {
      copyTextToClipboard(btn.dataset.copy, btn.dataset.label);
    });
  });

  listEl.querySelectorAll('.btn-delete-wallet-card').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const cardId = Number(btn.dataset.id);
      if (!cardId) return;
      try {
        await apiFetch(`/api/payments/simulated-cards/${cardId}`, { method: 'DELETE' });
        showAlert('🗑️ Tarjeta eliminada de tu cartera y de PayPal Sandbox.');
        await loadUserWalletCards();
        if (typeof loadSimulatedCardsForCheckout === 'function') {
          loadSimulatedCardsForCheckout();
        }
      } catch (err) {
        showAlert(err.message, true);
      }
    });
  });

  listEl.querySelectorAll('.btn-use-card-in-paypal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cardId = Number(btn.dataset.id);
      state.preferredPaypalCardId = cardId;
      showAlert('✓ Tarjeta seleccionada para tu próximo pago con PayPal Sandbox en la Cesta.');
      const btnOpenCart = document.getElementById('btn-open-cart');
      if (btnOpenCart && state.cart && state.cart.length > 0) {
        btnOpenCart.click();
      }
    });
  });
}

function updateEmergingCardLivePreview() {
  const cardEl = document.getElementById('wallet-emerging-plastic-card');
  if (!cardEl) return;

  const style = getPlasticStyle(currentEmergingColor);
  cardEl.style.background = style.bg;
  cardEl.style.color = style.text;

  const holder = document.getElementById('wallet-new-holder')?.value.trim() || state.user?.nombre?.toUpperCase() || 'TITULAR EXPRESSMART';
  const rawNum = document.getElementById('wallet-new-number')?.value || '4032037799230187';
  const exp = document.getElementById('wallet-new-expiry')?.value.trim() || '10/28';
  const cvv = document.getElementById('wallet-new-cvv')?.value.trim() || '734';
  const brand = document.getElementById('wallet-new-brand')?.value || 'Visa';
  const saldo = Number(document.getElementById('wallet-new-balance')?.value || 15000);

  const prevHolder = document.getElementById('emerging-preview-holder');
  const prevNum = document.getElementById('emerging-preview-number');
  const prevExp = document.getElementById('emerging-preview-exp');
  const prevCvv = document.getElementById('emerging-preview-cvv');
  const prevBrand = document.getElementById('emerging-preview-brand');
  const prevBalance = document.getElementById('emerging-preview-balance');
  const colorLabel = document.getElementById('wallet-selected-color-name');

  if (prevHolder) prevHolder.textContent = holder.toUpperCase();
  if (prevNum) prevNum.textContent = formatCardNumberBlocks(rawNum) || '4032 0377 9923 0187';
  if (prevExp) prevExp.textContent = exp;
  if (prevCvv) prevCvv.textContent = cvv;
  if (prevBrand) prevBrand.textContent = brand.toUpperCase();
  if (prevBalance) prevBalance.textContent = formatMxn(saldo);
  if (colorLabel) colorLabel.textContent = style.name;

  document.querySelectorAll('.wallet-color-swatch').forEach((sw) => {
    const active = sw.dataset.color.toLowerCase() === currentEmergingColor.toLowerCase();
    sw.classList.toggle('ring-4', active);
    sw.classList.toggle('ring-white', active);
    sw.classList.toggle('scale-110', active);
  });
}

function openEmergingCardCreator(autoGenerateRandom = true) {
  if (!state.token || !state.user) {
    showAlert('Inicia sesión para agregar tarjetas a tu cartera.', true);
    return;
  }
  if (userWalletCards.length >= 3) {
    showAlert('Has alcanzado el límite máximo de 3 tarjetas en tu cartera. Elimina una tarjeta si deseas crear otra.', true);
    return;
  }

  const stage = document.getElementById('wallet-emerging-stage');
  const cardEl = document.getElementById('wallet-emerging-plastic-card');
  if (!stage || !cardEl) return;

  // Escoger un color de plástico distinto a los que ya tiene el usuario
  const usedColors = new Set(userWalletCards.map((c) => (c.color_plastico || '').toLowerCase()));
  const nextColorObj = WALLET_PLASTIC_COLORS.find((c) => !usedColors.has(c.id.toLowerCase())) || WALLET_PLASTIC_COLORS[0];
  currentEmergingColor = nextColorObj.id;

  const holderInput = document.getElementById('wallet-new-holder');
  const numInput = document.getElementById('wallet-new-number');
  const expInput = document.getElementById('wallet-new-expiry');
  const cvvInput = document.getElementById('wallet-new-cvv');
  const brandSelect = document.getElementById('wallet-new-brand');
  const balanceInput = document.getElementById('wallet-new-balance');

  if (holderInput) holderInput.value = (state.user.nombre || 'CLIENTE EXPRESSMART').toUpperCase();
  if (autoGenerateRandom) {
    const brands = ['Visa', 'Mastercard'];
    const pickedBrand = brands[userWalletCards.length % brands.length];
    if (brandSelect) brandSelect.value = pickedBrand;
    if (numInput) numInput.value = formatCardNumberBlocks(generateLuhnSandboxCard(pickedBrand));
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const year = String(28 + (userWalletCards.length % 3));
    if (expInput) expInput.value = `${month}/${year}`;
    if (cvvInput) cvvInput.value = String(Math.floor(100 + Math.random() * 899));
    if (balanceInput && !balanceInput.value) balanceInput.value = '15000';
  }

  isCardEmergingOpen = true;
  stage.classList.remove('hidden');
  cardEl.classList.remove('is-sliding-in');
  // Reiniciar animación de salida desde la cartera
  cardEl.classList.remove('is-emerging');
  void cardEl.offsetWidth;
  cardEl.classList.add('is-emerging');

  updateEmergingCardLivePreview();
  stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function closeEmergingCardCreator() {
  const stage = document.getElementById('wallet-emerging-stage');
  const cardEl = document.getElementById('wallet-emerging-plastic-card');
  if (cardEl) {
    cardEl.classList.remove('is-emerging');
    cardEl.classList.add('is-sliding-in');
  }
  setTimeout(() => {
    if (stage) stage.classList.add('hidden');
    isCardEmergingOpen = false;
  }, 280);
}

async function loadAdminAllSimulatedCards() {
  const adminSection = document.getElementById('wallet-admin-assign-section');
  if (!adminSection) return;

  if (!state.user || state.user.rol !== 'administrador') {
    adminSection.classList.add('hidden');
    return;
  }
  adminSection.classList.remove('hidden');

  try {
    const [allCards, allUsers] = await Promise.all([
      apiFetch('/api/payments/simulated-cards'),
      apiFetch('/api/admin/users').catch(() => [])
    ]);

    const userSelect = document.getElementById('admin-card-assign-user');
    if (userSelect && Array.isArray(allUsers) && allUsers.length > 0) {
      userSelect.innerHTML = allUsers.map((u) => `
        <option value="${u.id}">#${u.id} · ${escapeHtml(u.nombre)} (${escapeHtml(u.email)}) [${u.rol}]</option>
      `).join('');
    }

    const tbody = document.getElementById('admin-simulated-cards-tbody');
    if (tbody && Array.isArray(allCards)) {
      tbody.innerHTML = allCards.map((c) => {
        const clean = String(c.numero_tarjeta || '').replace(/\s+/g, '');
        const style = getPlasticStyle(c.color_plastico);
        return `
          <tr class="border-b border-surface-container hover:bg-surface-container-low text-xs">
            <td class="py-2 px-2 font-mono font-bold">#${c.id}</td>
            <td class="py-2 px-2">
              <div class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-full inline-block shrink-0" style="background:${style.id};"></span>
                <span class="font-mono font-bold">${escapeHtml(clean)}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high font-bold">${escapeHtml(c.marca)}</span>
              </div>
            </td>
            <td class="py-2 px-2 font-semibold">${escapeHtml(c.titular)}</td>
            <td class="py-2 px-2 font-bold text-emerald-700">${formatMxn(c.saldo || 0)}</td>
            <td class="py-2 px-2">
              <span class="px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 font-semibold text-[11px]">
                👤 #${c.usuario_id || '?'} · ${escapeHtml(c.usuario_email || c.usuario_nombre || 'Sin asignar')}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (_) {}
}

function initWalletCardsEvents() {
  // Swatches de colores del plástico
  const swatchContainer = document.getElementById('wallet-color-swatches');
  if (swatchContainer) {
    swatchContainer.innerHTML = WALLET_PLASTIC_COLORS.map((c) => `
      <button
        type="button"
        class="wallet-color-swatch w-8 h-8 rounded-full border-2 border-slate-300 dark:border-slate-600 transition-all cursor-pointer shadow-sm"
        style="background: ${c.bg};"
        data-color="${c.id}"
        title="${c.name}"
        aria-label="Cambiar color de plástico a ${c.name}"
      ></button>
    `).join('');

    swatchContainer.querySelectorAll('.wallet-color-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentEmergingColor = btn.dataset.color;
        updateEmergingCardLivePreview();
      });
    });
  }

  // Botón "+ Add Card" en el frente de la cartera con costura
  const btnAddWallet = document.getElementById('btn-wallet-add-card');
  if (btnAddWallet) {
    btnAddWallet.addEventListener('click', () => {
      openEmergingCardCreator(true);
    });
  }

  // Botón "Generate New Card" estilo PayPal Sandbox
  const btnPaypalGenerate = document.getElementById('btn-paypal-generate-new-card');
  if (btnPaypalGenerate) {
    btnPaypalGenerate.addEventListener('click', () => {
      openEmergingCardCreator(true);
    });
  }

  // Botón "🎲 Auto-Generar Datos PayPal" dentro del creador
  const btnRandomize = document.getElementById('btn-wallet-randomize-card');
  if (btnRandomize) {
    btnRandomize.addEventListener('click', () => {
      const brand = document.getElementById('wallet-new-brand')?.value || 'Visa';
      const numInput = document.getElementById('wallet-new-number');
      const expInput = document.getElementById('wallet-new-expiry');
      const cvvInput = document.getElementById('wallet-new-cvv');
      if (numInput) numInput.value = formatCardNumberBlocks(generateLuhnSandboxCard(brand));
      if (expInput) expInput.value = `10/${27 + Math.floor(Math.random() * 4)}`;
      if (cvvInput) cvvInput.value = String(Math.floor(100 + Math.random() * 899));
      updateEmergingCardLivePreview();
    });
  }

  // Botón cancelar emergencia de tarjeta
  const btnCancelEmerging = document.getElementById('btn-wallet-cancel-emerging');
  if (btnCancelEmerging) {
    btnCancelEmerging.addEventListener('click', closeEmergingCardCreator);
  }

  // Inputs en tiempo real para actualizar el plástico
  ['wallet-new-holder', 'wallet-new-number', 'wallet-new-expiry', 'wallet-new-cvv', 'wallet-new-brand', 'wallet-new-balance'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        if (id === 'wallet-new-number') {
          el.value = formatCardNumberBlocks(el.value);
        }
        updateEmergingCardLivePreview();
      });
      el.addEventListener('change', updateEmergingCardLivePreview);
    }
  });

  // Guardar la tarjeta que salió de la cartera
  const formEmerging = document.getElementById('wallet-emerging-card-form');
  if (formEmerging) {
    formEmerging.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (userWalletCards.length >= 3) {
        showAlert('Solo puedes crear un máximo de 3 tarjetas por usuario.', true);
        return;
      }

      const titular = document.getElementById('wallet-new-holder')?.value.trim() || state.user?.nombre || 'CLIENTE';
      const numeroTarjeta = (document.getElementById('wallet-new-number')?.value || '').replace(/\s+/g, '');
      const expiracion = document.getElementById('wallet-new-expiry')?.value.trim() || '10/28';
      const cvv = document.getElementById('wallet-new-cvv')?.value.trim() || '123';
      const marca = document.getElementById('wallet-new-brand')?.value || 'Visa';
      const tipo = document.getElementById('wallet-new-type')?.value || 'credito';
      const saldo = Number(document.getElementById('wallet-new-balance')?.value || 15000);

      try {
        await apiFetch('/api/payments/simulated-cards', {
          method: 'POST',
          body: JSON.stringify({
            usuarioId: state.user.id,
            numeroTarjeta,
            titular,
            expiracion,
            cvv,
            tipo,
            marca,
            saldo,
            colorPlastico: currentEmergingColor,
            vinculadaPaypal: true
          })
        });

        closeEmergingCardCreator();
        await loadUserWalletCards();
        if (typeof loadSimulatedCardsForCheckout === 'function') {
          loadSimulatedCardsForCheckout();
        }
        showAlert('💳 ¡Nueva tarjeta guardada en tu cartera y vinculada a tu cuenta PayPal!');
      } catch (err) {
        showAlert(err.message, true);
      }
    });
  }

  // Formulario de administrador para crear/asignar tarjeta a un usuario específico
  const adminAssignForm = document.getElementById('admin-assign-card-form');
  if (adminAssignForm) {
    adminAssignForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const targetUserId = Number(document.getElementById('admin-card-assign-user')?.value || state.user?.id);
      const titular = document.getElementById('admin-card-holder')?.value.trim() || 'USUARIO EXPRESSMART';
      const numeroTarjeta = (document.getElementById('admin-card-number')?.value || generateLuhnSandboxCard('Visa')).replace(/\s+/g, '');
      const saldo = Number(document.getElementById('admin-card-balance')?.value || 20000);
      const colorPlastico = document.getElementById('admin-card-color')?.value || '#1d4ed8';

      try {
        await apiFetch('/api/payments/simulated-cards', {
          method: 'POST',
          body: JSON.stringify({
            usuarioId: targetUserId,
            numeroTarjeta,
            titular,
            expiracion: '10/28',
            cvv: String(Math.floor(100 + Math.random() * 899)),
            tipo: 'credito',
            marca: numeroTarjeta.startsWith('5') ? 'Mastercard' : 'Visa',
            saldo,
            colorPlastico,
            vinculadaPaypal: true
          })
        });
        showAlert(`✓ Tarjeta creada y asignada exclusivamente al usuario #${targetUserId}.`);
        await loadUserWalletCards();
      } catch (err) {
        showAlert(err.message, true);
      }
    });
  }
}

window.WALLET_PLASTIC_COLORS = WALLET_PLASTIC_COLORS;
window.loadUserWalletCards = loadUserWalletCards;
window.openEmergingCardCreator = openEmergingCardCreator;
window.initWalletCardsEvents = initWalletCardsEvents;

/**
 * Módulo de Cesta de Compras y Checkout Seguro en 3 Pasos.
 * Soporta Tarjetas Simuladas, PayPal Sandbox, Cupones y Cashback ExpressPrime en MXN.
 */
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

function initCartCheckoutEvents() {
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

}

window.setCheckoutStep = setCheckoutStep;
window.refreshCartModal = refreshCartModal;
window.initCartCheckoutEvents = initCartCheckoutEvents;

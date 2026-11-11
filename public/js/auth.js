/**
 * Módulo de Autenticación, Sesión, Roles y Verificación de Dos Pasos (2FA).
 * Conforme a OWASP ASVS y LFPDPPP / LFPC.
 */
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

    // Panel de Envíos y Logística OpenStreetMap visible para roles con permisos
    const navBtnEnvios = document.getElementById('nav-btn-envios');
    if (navBtnEnvios) {
      const canAccessLogistics = ['administrador', 'vendedor', 'soporte', 'auditor'].includes(state.user.rol);
      navBtnEnvios.classList.toggle('hidden', !canAccessLogistics);
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
    const navBtnEnvios = document.getElementById('nav-btn-envios');
    if (navBtnEnvios) navBtnEnvios.classList.add('hidden');

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


function initAuthEvents() {
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


}

window.updateSessionUI = updateSessionUI;
window.initAuthEvents = initAuthEvents;

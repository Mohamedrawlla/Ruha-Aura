(() => {
  'use strict';

  const CATALOG_CACHE_VERSION = 'v3.1_2026';
  try {
    if (localStorage.getItem('ruha_catalog_version') !== CATALOG_CACHE_VERSION) {
      localStorage.removeItem('ruha-aura-custom-catalog');
      localStorage.setItem('ruha_catalog_version', CATALOG_CACHE_VERSION);
    }
  } catch {}

  const ensureFullCatalog = (currentList) => {
    const defaultCatalog = window.RUHA_CATALOG || [];
    if (!Array.isArray(currentList) || currentList.length === 0) {
      return [...defaultCatalog];
    }
    const map = new Map();
    // 1. Seed with full default catalog (219 products)
    defaultCatalog.forEach(p => map.set(p.id, { ...p }));
    // 2. Overlay any modifications from current list
    currentList.forEach(p => {
      if (p && p.id) {
        const existing = map.get(p.id);
        map.set(p.id, existing ? { ...existing, ...p } : p);
      }
    });
    return Array.from(map.values());
  };

  const getCatalogData = () => {
    try {
      const stored = localStorage.getItem('ruha-aura-custom-catalog');
      const defaultCatalog = window.RUHA_CATALOG || [];
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length >= defaultCatalog.length) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse custom catalog from localStorage', e);
    }
    return ensureFullCatalog([]);
  };

  let data = ensureFullCatalog(getCatalogData());

  // Live Cloud Database Sync for Storefront
  const syncWithRemoteDatabase = () => {
    if (typeof window !== 'undefined' && window.RuhaDB && window.RuhaDB.isConfigured()) {
      window.RuhaDB.getProducts().then(remoteProducts => {
        if (Array.isArray(remoteProducts) && remoteProducts.length > 0) {
          // Merge remote products with full local catalog so we never truncate to only DB items
          data = ensureFullCatalog(remoteProducts);

          try {
            localStorage.setItem('ruha-aura-custom-catalog', JSON.stringify(data));
          } catch (storageErr) {
            console.warn('[RuhaShop] Local storage note:', storageErr);
          }
          window.dispatchEvent(new CustomEvent('ruha:catalog-updated', { detail: { catalog: data } }));
        }
      }).catch(err => {
        console.warn('[RuhaShop] Remote catalogue sync note:', err);
      });
    }
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', syncWithRemoteDatabase);
    } else {
      syncWithRemoteDatabase();
    }
  }

  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

  const icon = name => {
    if (name === 'bag') {
      return `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;
    }
    return `<svg aria-hidden="true"><use href="#${name}"/></svg>`;
  };

  const formatPrice = p => {
    const val = typeof p === 'object' && p !== null ? p.price : p;
    const curr = typeof p === 'object' && p !== null ? (p.currency || 'INR') : 'INR';
    if (typeof val === 'number' && Number.isFinite(val)) {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: curr,
        maximumFractionDigits: 0
      }).format(val);
    }
    return 'Price on request';
  };

  // --- FAVOURITES STATE ---
  let favourites = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem('ruha-aura-favourites') || '[]');
    if (Array.isArray(saved)) favourites = new Set(saved.filter(id => data.some(p => p.id === id)));
  } catch {}

  function updateSavedCount() {
    document.querySelectorAll('[data-saved-count]').forEach(el => el.textContent = favourites.size);
  }

  function toggleFavourite(id) {
    if (!data.some(p => p.id === id)) return;
    const had = favourites.has(id);
    if (had) favourites.delete(id);
    else favourites.add(id);
    try {
      localStorage.setItem('ruha-aura-favourites', JSON.stringify([...favourites]));
    } catch {}
    updateSavedCount();
    window.dispatchEvent(new CustomEvent('ruha:favourites'));
    notify(had ? 'Removed from your favourites.' : 'Saved to your favourites.');
  }

  // --- CART STATE ---
  let cart = [];
  try {
    const savedCart = JSON.parse(localStorage.getItem('ruha-aura-cart') || '[]');
    if (Array.isArray(savedCart)) {
      cart = savedCart.filter(item => data.some(p => p.id === item.id));
    }
  } catch {}

  function saveCart() {
    try {
      localStorage.setItem('ruha-aura-cart', JSON.stringify(cart));
    } catch {}
    updateCartCount();
    renderCartDrawer();
    window.dispatchEvent(new CustomEvent('ruha:cart'));
  }

  function getCart() {
    return cart.map(item => {
      const product = data.find(p => p.id === item.id) || { name: 'Item', price: 0, src: '' };
      const unitPrice = typeof product.price === 'number' ? product.price : 0;
      return {
        id: item.id,
        product,
        quantity: item.quantity,
        option: item.option || (product.options?.[0] || ''),
        lineTotal: unitPrice * item.quantity
      };
    });
  }

  function getCartCount() {
    return cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }

  function getCartSubtotal() {
    return getCart().reduce((sum, item) => sum + item.lineTotal, 0);
  }

  function addToCart(id, quantity = 1, option = null) {
    const product = data.find(p => p.id === id);
    if (!product) return;

    const opt = option || (product.options && product.options.length ? product.options[0] : null);
    const existing = cart.find(item => item.id === id && item.option === opt);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({ id, quantity, option: opt });
    }
    saveCart();
    notify(`Added ${product.name} to your bag.`);
    openCart();
  }

  function updateCartQuantity(id, quantity) {
    const index = cart.findIndex(item => item.id === id);
    if (index === -1) return;
    if (quantity <= 0) {
      cart.splice(index, 1);
    } else {
      cart[index].quantity = quantity;
    }
    saveCart();
  }

  function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    saveCart();
    notify('Item removed from your bag.');
  }

  function clearCart() {
    cart = [];
    saveCart();
  }

  function updateCartCount() {
    const count = getCartCount();
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      el.textContent = count;
      el.classList.toggle('has-items', count > 0);
      el.classList.remove('cart-bump');
      void el.offsetWidth;
      el.classList.add('cart-bump');
    });
  }

  // Sticky frosted header on scroll
  function handleHeaderScroll() {
    const header = document.querySelector('.header');
    if (!header) return;
    if (window.scrollY > 25) {
      header.classList.add('header-scrolled');
    } else {
      header.classList.remove('header-scrolled');
    }
  }
  window.addEventListener('scroll', handleHeaderScroll, { passive: true });

  // --- NOTIFICATION TOAST ---
  let toastTimer;
  function notify(text) {
    let toast = document.getElementById('shop-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'shop-toast';
      toast.className = 'shop-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
  }

  // --- CART DRAWER UI ---
  function ensureCartDrawer() {
    let drawer = document.getElementById('cart-drawer');
    if (drawer) return drawer;

    drawer = document.createElement('aside');
    drawer.id = 'cart-drawer';
    drawer.className = 'cart-drawer';
    drawer.setAttribute('aria-label', 'Shopping Bag');
    drawer.setAttribute('aria-hidden', 'true');

    drawer.innerHTML = `
      <div class="cart-backdrop" data-close-cart></div>
      <div class="cart-panel">
        <header class="cart-header">
          <div>
            <span class="eyebrow">YOUR SELECTION</span>
            <h2>Shopping Bag (<span data-cart-count>0</span>)</h2>
          </div>
          <button type="button" class="cart-close" data-close-cart aria-label="Close shopping bag">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
          </button>
        </header>

        <div class="cart-shipping-bar" id="cart-shipping-bar"></div>

        <div class="cart-items" id="cart-items-container"></div>

        <footer class="cart-footer" id="cart-footer">
          <div class="cart-subtotal-row">
            <span>Subtotal</span>
            <span id="cart-subtotal-val">₹0</span>
          </div>
          <p class="cart-taxes-note">Standard delivery & taxes calculated at checkout.</p>
          <button type="button" class="button button-plum cart-checkout-btn" data-checkout-start>
            <span>Proceed to Checkout</span>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
          </button>
          <button type="button" class="underlined cart-continue-btn" data-close-cart>
            Continue exploring
          </button>
        </footer>
      </div>
    `;

    document.body.appendChild(drawer);
    return drawer;
  }

  function renderCartDrawer() {
    const container = document.getElementById('cart-items-container');
    const footer = document.getElementById('cart-footer');
    const shippingBar = document.getElementById('cart-shipping-bar');
    if (!container || !footer) return;

    const items = getCart();
    const subtotal = getCartSubtotal();
    const freeShippingThreshold = 999;

    // Shipping progress
    if (shippingBar) {
      if (subtotal === 0) {
        shippingBar.innerHTML = `<span class="shipping-msg">Free delivery on orders over ₹999</span>`;
      } else if (subtotal >= freeShippingThreshold) {
        shippingBar.innerHTML = `<span class="shipping-msg shipping-free-unlocked">✨ You've unlocked <strong>FREE Delivery!</strong></span>`;
      } else {
        const remaining = freeShippingThreshold - subtotal;
        const pct = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));
        shippingBar.innerHTML = `
          <div class="shipping-msg">Add <strong>${formatPrice(remaining)}</strong> more for <strong>FREE Delivery</strong></div>
          <div class="shipping-progress-track"><div class="shipping-progress-fill" style="width: ${pct}%"></div></div>
        `;
      }
    }

    if (!items.length) {
      container.innerHTML = `
        <div class="cart-empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <h3>Your bag is empty</h3>
          <p>Discover our everyday edit of hair accessories and handcrafted toys.</p>
          <a href="catalogue.html" class="button button-plum" data-close-cart>Explore the collection</a>
        </div>
      `;
      footer.style.display = 'none';
      return;
    }

    footer.style.display = 'block';
    document.getElementById('cart-subtotal-val').textContent = formatPrice(subtotal);

    container.innerHTML = items.map(item => `
      <article class="cart-item">
        <a href="product.html?id=${encodeURIComponent(item.product.id)}" class="cart-item-image">
          <img src="${escape(item.product.src)}" alt="${escape(item.product.name)}" width="80" height="85" loading="lazy">
        </a>
        <div class="cart-item-details">
          <div class="cart-item-top">
            <h4><a href="product.html?id=${encodeURIComponent(item.product.id)}">${escape(item.product.name)}</a></h4>
            <button type="button" class="cart-remove-btn" data-cart-remove="${escape(item.id)}" aria-label="Remove ${escape(item.product.name)}">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>
            </button>
          </div>
          ${item.option ? `<span class="cart-item-option">${escape(item.option)}</span>` : ''}
          <div class="cart-item-bottom">
            <div class="cart-qty-control" role="group" aria-label="Quantity for ${escape(item.product.name)}">
              <button type="button" data-cart-qty="${escape(item.id)}" data-delta="-1" aria-label="Decrease quantity">−</button>
              <span>${item.quantity}</span>
              <button type="button" data-cart-qty="${escape(item.id)}" data-delta="1" aria-label="Increase quantity">+</button>
            </div>
            <span class="cart-item-price">${formatPrice(item.lineTotal)}</span>
          </div>
        </div>
      </article>
    `).join('');
  }

  function openCart() {
    ensureCartDrawer();
    renderCartDrawer();
    const drawer = document.getElementById('cart-drawer');
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cart-open-scroll-lock');
  }

  function closeCart() {
    const drawer = document.getElementById('cart-drawer');
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cart-open-scroll-lock');
  }

  function saveCustomCatalog(newCatalog) {
    if (!Array.isArray(newCatalog)) return false;
    try {
      localStorage.setItem('ruha-aura-custom-catalog', JSON.stringify(newCatalog));
      data = newCatalog;
      if (typeof window !== 'undefined' && window.RuhaDB && window.RuhaDB.isConfigured()) {
        window.RuhaDB.saveProductsBatch(newCatalog).catch(() => {});
      }
      window.dispatchEvent(new CustomEvent('ruha:catalog-updated', { detail: data }));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  function resetCustomCatalog() {
    try {
      localStorage.removeItem('ruha-aura-custom-catalog');
      data = window.RUHA_CATALOG || [];
      window.dispatchEvent(new CustomEvent('ruha:catalog-updated', { detail: data }));
      return true;
    } catch (e) {
      return false;
    }
  }

  // --- PRODUCT CARD RENDERER ---
  function card(p) {
    const saved = favourites.has(p.id);
    const badgeHTML = p.badge ? `<span class="card-badge">${escape(p.badge)}</span>` : '';
    const swatchesHTML = Array.isArray(p.swatches) && p.swatches.length
      ? `<div class="card-swatches" aria-label="Available colors">${p.swatches.map(hex => `<span class="swatch-dot" style="background-color: ${escape(hex)}" title="${escape(hex)}"></span>`).join('')}</div>`
      : '';
    return `
      <article class="catalogue-card" data-category="${escape(p.category || p.collection)}">
        <div class="catalogue-card-photo">
          ${badgeHTML}
          <a href="product.html?id=${encodeURIComponent(p.id)}" aria-label="View ${escape(p.name)}">
            <img class="card-primary-img" src="${escape(p.src)}" alt="${escape(p.name)}" width="600" height="650" loading="lazy">
            ${Array.isArray(p.images) && p.images.length > 1 && p.images[1] ? `<img class="card-hover-img" src="${escape(p.images[1].src)}" alt="${escape(p.images[1].alt || p.name)}" width="600" height="650" loading="lazy">` : ''}
          </a>
          ${Array.isArray(p.images) && p.images.length > 1 ? `<span class="card-photo-count" title="${p.images.length} photos available">📷 ${p.images.length}</span>` : ''}
          <button class="save-product ${saved ? 'is-saved' : ''}" data-save="${escape(p.id)}" aria-label="${saved ? 'Unsave' : 'Save'} ${escape(p.name)}" aria-pressed="${saved}">
            ${icon('heart')}
          </button>
          <button class="quick-add-bag" data-quick-add="${escape(p.id)}" aria-label="Add ${escape(p.name)} to bag">
            Add to bag +
          </button>
          <a class="view-detail" href="product.html?id=${encodeURIComponent(p.id)}">
            View details ${icon('arrow')}
          </a>
        </div>
        <div class="catalogue-card-copy">
          <div class="catalogue-card-meta">
            <span>${escape(p.collection)} / ${escape(p.type)}</span>
            ${swatchesHTML}
          </div>
          <a href="product.html?id=${encodeURIComponent(p.id)}">${escape(p.name)} ${icon('arrow')}</a>
          <div class="catalogue-card-price-row">
            <p class="catalogue-price">${formatPrice(p)}</p>
          </div>
        </div>
      </article>
    `;
  }

  // --- GLOBAL EVENT DELEGATION ---
  document.addEventListener('click', e => {
    // Save to favourites
    const saveBtn = e.target.closest('[data-save]');
    if (saveBtn) {
      e.preventDefault();
      toggleFavourite(saveBtn.dataset.save);
      return;
    }

    // Quick add to cart
    const quickAddBtn = e.target.closest('[data-quick-add]');
    if (quickAddBtn) {
      e.preventDefault();
      addToCart(quickAddBtn.dataset.quickAdd, 1);
      return;
    }

    // Open cart
    const openCartBtn = e.target.closest('[data-open-cart]');
    if (openCartBtn) {
      e.preventDefault();
      openCart();
      return;
    }

    // Close cart
    const closeCartBtn = e.target.closest('[data-close-cart]');
    if (closeCartBtn) {
      e.preventDefault();
      closeCart();
      return;
    }

    // Cart quantity delta
    const qtyBtn = e.target.closest('[data-cart-qty]');
    if (qtyBtn) {
      const id = qtyBtn.dataset.cartQty;
      const delta = parseInt(qtyBtn.dataset.delta, 10);
      const item = cart.find(i => i.id === id);
      if (item) {
        updateCartQuantity(id, item.quantity + delta);
      }
      return;
    }

    // Remove from cart
    const removeBtn = e.target.closest('[data-cart-remove]');
    if (removeBtn) {
      removeFromCart(removeBtn.dataset.cartRemove);
      return;
    }

    // Start checkout from drawer
    const checkoutBtn = e.target.closest('[data-checkout-start]');
    if (checkoutBtn) {
      e.preventDefault();
      closeCart();
      if (window.RuhaCheckout) {
        window.RuhaCheckout.start();
      }
      return;
    }

    // Login button handler
    const loginBtn = e.target.closest('#header-login-btn, .header-login-btn');
    if (loginBtn) {
      e.preventDefault();
      if (authUser && authUser.role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        openAuthModal();
      }
      return;
    }
  });

  // --- AUTH STATE & MODAL ---
  let authUser = null;
  try {
    const saved = localStorage.getItem('ruha-aura-auth');
    if (saved) authUser = JSON.parse(saved);
  } catch {}

  function getAuthUser() {
    return authUser;
  }

  function setAuthUser(user) {
    authUser = user;
    try {
      if (user) {
        localStorage.setItem('ruha-aura-auth', JSON.stringify(user));
      } else {
        localStorage.removeItem('ruha-aura-auth');
      }
    } catch {}
    updateAuthUI();
    window.dispatchEvent(new CustomEvent('ruha:auth', { detail: user }));
  }

  function updateAuthUI() {
    const btnTexts = document.querySelectorAll('#login-btn-text, .login-btn-text');
    const loginBtns = document.querySelectorAll('#header-login-btn, .header-login-btn');
    if (authUser) {
      btnTexts.forEach(el => el.textContent = authUser.role === 'admin' ? 'Admin' : (authUser.name || 'Account'));
      loginBtns.forEach(el => {
        el.classList.add('is-authenticated');
        if (authUser.role === 'admin') el.classList.add('is-admin');
      });
    } else {
      btnTexts.forEach(el => el.textContent = 'Log in');
      loginBtns.forEach(el => {
        el.classList.remove('is-authenticated', 'is-admin');
      });
    }
  }

  function ensureAuthModal() {
    if (document.getElementById('auth-modal-dialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'auth-modal-dialog';
    dialog.className = 'auth-modal-dialog';
    dialog.innerHTML = `
      <div class="auth-modal-card">
        <button type="button" class="auth-modal-close" aria-label="Close dialog">&times;</button>
        <div class="auth-modal-head">
          <img src="assets/brand-logo.jpeg" alt="Ruha Aura" class="auth-modal-logo">
          <h3>Welcome to Ruha Aura</h3>
          <p id="auth-modal-sub">Sign in to access your bag, orders, and saved favourites.</p>
        </div>
        <form id="auth-modal-form">
          <div class="auth-input-group">
            <label for="auth-email">Email or Username</label>
            <input type="text" id="auth-email" required placeholder="you@example.com" autocomplete="username">
          </div>
          <div class="auth-input-group">
            <label for="auth-password">Password</label>
            <input type="password" id="auth-password" required placeholder="••••••••" autocomplete="current-password">
          </div>
          <button type="submit" class="auth-submit-btn">Sign in</button>
        </form>
        <div class="auth-footer-status" id="auth-logged-in-view" style="display:none;">
          <p style="font-size: 14px; margin-bottom: 14px;">Signed in as <strong id="auth-current-username">Member</strong></p>
          <div class="auth-action-buttons">
            <a href="admin.html" class="button button-plum" id="auth-go-admin-btn" style="display:none;">Admin Dashboard &rarr;</a>
            <button type="button" class="button button-outline" id="auth-signout-btn">Sign out</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    // Close handlers
    dialog.querySelector('.auth-modal-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => {
      if (e.target === dialog) dialog.close();
    });

    // Sign out button
    dialog.querySelector('#auth-signout-btn').addEventListener('click', () => {
      setAuthUser(null);
      notify('Signed out successfully.');
      dialog.close();
      if (window.location.pathname.includes('admin.html')) {
        window.location.href = 'index.html';
      }
    });

    // Form submission
    const form = dialog.querySelector('#auth-modal-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const userVal = dialog.querySelector('#auth-email').value.trim().toLowerCase();
      const passVal = dialog.querySelector('#auth-password').value.trim();

      const isAdmin = (userVal === 'admin' || userVal === 'admin@ruhaaura.com') && passVal === 'admin123';

      if (isAdmin) {
        setAuthUser({ name: 'Admin', role: 'admin', email: 'admin@ruhaaura.com' });
        notify('Welcome back, Admin! Redirecting to Dashboard...');
        dialog.close();
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 300);
        return;
      }

      // Customer login
      const displayName = userVal.split('@')[0] || 'Member';
      setAuthUser({ name: displayName, role: 'customer', email: userVal });
      notify(`Welcome back, ${displayName}!`);
      dialog.close();
    });
  }

  function openAuthModal() {
    ensureAuthModal();
    const dialog = document.getElementById('auth-modal-dialog');
    const form = dialog.querySelector('#auth-modal-form');
    const loggedInView = dialog.querySelector('#auth-logged-in-view');
    const usernameEl = dialog.querySelector('#auth-current-username');
    const goAdminBtn = dialog.querySelector('#auth-go-admin-btn');

    if (authUser) {
      form.style.display = 'none';
      loggedInView.style.display = 'block';
      usernameEl.textContent = authUser.name;
      if (goAdminBtn) {
        goAdminBtn.style.display = authUser.role === 'admin' ? 'inline-flex' : 'none';
      }
    } else {
      form.style.display = 'block';
      loggedInView.style.display = 'none';
      form.reset();
    }

    dialog.showModal();
  }

  // Mobile menu handling
  const menu = document.getElementById('mobile-menu');
  const menuBtn = document.querySelector('.menu-button');
  function closeMenu() {
    if (menu) menu.hidden = true;
    menuBtn?.setAttribute('aria-expanded', 'false');
  }
  menuBtn?.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  menu?.addEventListener('click', e => {
    if (e.target.closest('a')) closeMenu();
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (document.getElementById('cart-drawer')?.classList.contains('is-open')) {
        closeCart();
      } else if (menu && !menu.hidden) {
        closeMenu();
        menuBtn?.focus();
      }
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 800) closeMenu();
  });

  document.addEventListener('DOMContentLoaded', () => {
    const yr = document.getElementById('year');
    if (yr) yr.textContent = new Date().getFullYear();
    updateSavedCount();
    updateCartCount();
    ensureCartDrawer();
    updateAuthUI();
  });

  // Exports
  window.RuhaShop = {
    get data() { return data; },
    escape,
    icon,
    price: formatPrice,
    card,
    hasSaved: id => favourites.has(id),
    toggleFavourite,
    notify,
    updateCount: updateSavedCount,
    // Auth API
    getAuthUser,
    setAuthUser,
    openAuthModal,
    updateAuthUI,
    // Catalog Customization API
    saveCatalog: saveCustomCatalog,
    resetCatalog: resetCustomCatalog,
    getCatalog: () => data,
    // Cart API
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    getCart,
    getCartCount,
    getCartSubtotal,
    openCart,
    closeCart,
    renderCartDrawer
  };
})();

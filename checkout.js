/* Ruha Aura Checkout Module — Handles order form, delivery details, and WhatsApp / UPI order dispatch. */
(() => {
  'use strict';

  // Set your store's WhatsApp number here (include country code without + or spaces).
  const STORE_WHATSAPP_NUMBER = '918220431210'; 
  const FREE_SHIPPING_THRESHOLD = 999;
  const STANDARD_SHIPPING_FEE = 60;

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  }

  function ensureCheckoutModal() {
    let modal = document.getElementById('checkout-modal');
    if (modal) return modal;

    modal = document.createElement('dialog');
    modal.id = 'checkout-modal';
    modal.className = 'checkout-modal';
    modal.setAttribute('aria-labelledby', 'checkout-title');

    modal.innerHTML = `
      <div class="checkout-modal-inner">
        <header class="checkout-header">
          <div>
            <span class="eyebrow">ORDER DETAILS</span>
            <h2 id="checkout-title">Complete your <em>order.</em></h2>
          </div>
          <button type="button" class="dialog-close" id="checkout-close" aria-label="Close checkout">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
          </button>
        </header>

        <div id="checkout-view-form">
          <div class="checkout-grid">
            <form id="checkout-form" class="checkout-form" novalidate>
              <fieldset class="checkout-fieldset">
                <legend>1. Contact Information</legend>
                <div class="form-row">
                  <div class="form-group">
                    <label for="cust-name">Full Name <span class="req">*</span></label>
                    <input type="text" id="cust-name" required placeholder="e.g. Ananya Sharma">
                  </div>
                  <div class="form-group">
                    <label for="cust-phone">WhatsApp / Phone Number <span class="req">*</span></label>
                    <input type="tel" id="cust-phone" required placeholder="10-digit mobile number">
                  </div>
                </div>
                <div class="form-group">
                  <label for="cust-email">Email Address <span class="opt">(for order updates)</span></label>
                  <input type="email" id="cust-email" placeholder="ananya@example.com">
                </div>
              </fieldset>

              <fieldset class="checkout-fieldset">
                <legend>2. Shipping Address</legend>
                <div class="form-group">
                  <label for="cust-address">Street Address, Flat / House No. <span class="req">*</span></label>
                  <input type="text" id="cust-address" required placeholder="Flat 4B, Emerald Heights, MG Road">
                </div>
                <div class="form-row form-row-three">
                  <div class="form-group">
                    <label for="cust-city">City <span class="req">*</span></label>
                    <input type="text" id="cust-city" required placeholder="Bengaluru">
                  </div>
                  <div class="form-group">
                    <label for="cust-state">State <span class="req">*</span></label>
                    <input type="text" id="cust-state" required placeholder="Karnataka">
                  </div>
                  <div class="form-group">
                    <label for="cust-pincode">Pincode <span class="req">*</span></label>
                    <input type="text" id="cust-pincode" required maxlength="6" placeholder="560001">
                  </div>
                </div>
                <div class="form-group">
                  <label for="cust-notes">Delivery Notes or Gift Message <span class="opt">(optional)</span></label>
                  <textarea id="cust-notes" rows="2" placeholder="Leave at door / Gift wrap requested"></textarea>
                </div>
              </fieldset>

              <fieldset class="checkout-fieldset">
                <legend>3. Payment & Confirmation Method</legend>
                <div class="payment-options">
                  <label class="payment-radio">
                    <input type="radio" name="payment-method" value="whatsapp" checked>
                    <div class="payment-radio-body">
                      <strong>Order via WhatsApp (Recommended)</strong>
                      <span>Dispatches your order directly to our store desk. Pay securely via UPI link or QR on chat.</span>
                    </div>
                  </label>
                  <label class="payment-radio">
                    <input type="radio" name="payment-method" value="upi">
                    <div class="payment-radio-body">
                      <strong>Direct UPI Payment</strong>
                      <span>Pay directly to our official UPI ID (ruha.aura@upi) with instant order reservation.</span>
                    </div>
                  </label>
                  <label class="payment-radio">
                    <input type="radio" name="payment-method" value="cod">
                    <div class="payment-radio-body">
                      <strong>Cash on Delivery (COD)</strong>
                      <span>Pay in cash or UPI when your package arrives at your doorstep.</span>
                    </div>
                  </label>
                </div>
              </fieldset>

              <div class="checkout-actions">
                <button type="submit" class="button button-plum checkout-submit">
                  <span>Place Order</span>
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
                </button>
              </div>
            </form>

            <aside class="checkout-summary-pane">
              <h3>Order Summary</h3>
              <div id="checkout-items-list" class="checkout-items-list"></div>
              <div class="checkout-totals">
                <div class="totals-line">
                  <span>Subtotal</span>
                  <span id="checkout-subtotal">₹0</span>
                </div>
                <div class="totals-line">
                  <span>Standard Shipping</span>
                  <span id="checkout-shipping">Calculated</span>
                </div>
                <div class="totals-line total-grand">
                  <strong>Total Amount</strong>
                  <strong id="checkout-total">₹0</strong>
                </div>
              </div>
              <div class="checkout-security-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span>Direct boutique fulfillment. Safe & authentic handcrafted pieces.</span>
              </div>
            </aside>
          </div>
        </div>

        <div id="checkout-view-success" class="checkout-view-success" hidden>
          <div class="success-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#460329" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <span class="eyebrow">ORDER CONFIRMATION</span>
          <h2>Thank you for your order!</h2>
          <p id="success-order-id" class="order-id-badge"></p>
          <div id="success-message-text" class="success-details-card"></div>
          <div class="success-actions">
            <a id="success-whatsapp-btn" class="button button-plum" target="_blank" rel="noopener">Open in WhatsApp</a>
            <button type="button" class="button button-outline" id="success-continue-btn">Continue Exploring</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#checkout-close').addEventListener('click', () => modal.close());
    modal.querySelector('#success-continue-btn').addEventListener('click', () => modal.close());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        const rect = modal.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
          modal.close();
        }
      }
    });

    const form = modal.querySelector('#checkout-form');
    form.addEventListener('submit', handleFormSubmit);

    return modal;
  }

  function renderSummary() {
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;

    const items = window.RuhaShop.getCart();
    const subtotal = window.RuhaShop.getCartSubtotal();
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : STANDARD_SHIPPING_FEE;
    const total = subtotal + shipping;

    const listEl = modal.querySelector('#checkout-items-list');
    listEl.innerHTML = items.map(item => `
      <div class="checkout-item-row">
        <img src="${item.product.src}" alt="${item.product.name}" width="50" height="50">
        <div class="checkout-item-info">
          <strong>${item.product.name}</strong>
          <span>Qty: ${item.quantity}${item.option ? ' · ' + item.option : ''}</span>
        </div>
        <span class="checkout-item-price">${formatCurrency(item.lineTotal)}</span>
      </div>
    `).join('');

    modal.querySelector('#checkout-subtotal').textContent = formatCurrency(subtotal);
    modal.querySelector('#checkout-shipping').innerHTML = shipping === 0 
      ? '<span class="free-ship-tag">FREE</span>' 
      : formatCurrency(shipping);
    modal.querySelector('#checkout-total').textContent = formatCurrency(total);
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const modal = document.getElementById('checkout-modal');
    const items = window.RuhaShop.getCart();

    if (!items.length) {
      window.RuhaShop.notify('Your bag is empty.');
      modal.close();
      return;
    }

    const name = modal.querySelector('#cust-name').value.trim();
    const phone = modal.querySelector('#cust-phone').value.trim();
    const email = modal.querySelector('#cust-email').value.trim();
    const address = modal.querySelector('#cust-address').value.trim();
    const city = modal.querySelector('#cust-city').value.trim();
    const state = modal.querySelector('#cust-state').value.trim();
    const pincode = modal.querySelector('#cust-pincode').value.trim();
    const notes = modal.querySelector('#cust-notes').value.trim();
    const paymentMethod = modal.querySelector('input[name="payment-method"]:checked')?.value || 'whatsapp';

    if (!name || !phone || !address || !city || !state || !pincode) {
      window.RuhaShop.notify('Please fill in all required shipping fields.');
      return;
    }

    const subtotal = window.RuhaShop.getCartSubtotal();
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
    const total = subtotal + shipping;
    const orderId = 'RA-' + Math.floor(100000 + Math.random() * 900000);

    // Format WhatsApp message
    let lines = [
      `*NEW ORDER — RUHA AURA* 🛍️`,
      `*Order ID:* ${orderId}`,
      `---------------------------------`,
      `*Customer Information:*`,
      `• Name: ${name}`,
      `• Phone: ${phone}`,
      email ? `• Email: ${email}` : '',
      `• Address: ${address}`,
      `• City, State: ${city}, ${state}`,
      `• Pincode: ${pincode}`,
      notes ? `• Notes: ${notes}` : '',
      `---------------------------------`,
      `*Items in Order:*`
    ].filter(Boolean);

    items.forEach(it => {
      lines.push(`• ${it.quantity}x ${it.product.name} (${it.product.sku}) - ${formatCurrency(it.lineTotal)}`);
      if (it.option) lines.push(`  Variant: ${it.option}`);
    });

    lines.push(`---------------------------------`);
    lines.push(`*Subtotal:* ${formatCurrency(subtotal)}`);
    lines.push(`*Delivery:* ${shipping === 0 ? 'FREE' : formatCurrency(shipping)}`);
    lines.push(`*Total Amount Payable:* ${formatCurrency(total)}`);
    lines.push(`*Payment Mode:* ${
      paymentMethod === 'whatsapp' ? 'WhatsApp Confirmation / UPI' : 
      paymentMethod === 'upi' ? 'Direct UPI' : 'Cash on Delivery (COD)'
    }`);
    lines.push(`---------------------------------`);
    lines.push(`_Thank you for choosing Ruha Aura!_ ✨`);

    const waText = encodeURIComponent(lines.join('\n'));
    const waUrl = `https://wa.me/${STORE_WHATSAPP_NUMBER}?text=${waText}`;

    // Switch views in modal
    modal.querySelector('#checkout-view-form').hidden = true;
    const successView = modal.querySelector('#checkout-view-success');
    successView.hidden = false;

    modal.querySelector('#success-order-id').textContent = `Order Reference: ${orderId}`;
    
    let instructions = '';
    if (paymentMethod === 'whatsapp') {
      instructions = `
        <p>Your order is ready to dispatch! Tap below to send your order details directly to our WhatsApp support desk to confirm and receive tracking.</p>
      `;
      modal.querySelector('#success-whatsapp-btn').href = waUrl;
      modal.querySelector('#success-whatsapp-btn').style.display = 'inline-flex';
      // Automatically attempt opening WhatsApp in a new tab
      window.open(waUrl, '_blank');
    } else if (paymentMethod === 'upi') {
      instructions = `
        <p>Please complete your payment of <strong>${formatCurrency(total)}</strong> to our official UPI ID:</p>
        <div class="upi-box"><strong>ruha.aura@upi</strong></div>
        <p>Send a screenshot of the payment with your Order ID <strong>${orderId}</strong> via WhatsApp to confirm.</p>
      `;
      modal.querySelector('#success-whatsapp-btn').href = waUrl;
      modal.querySelector('#success-whatsapp-btn').textContent = 'Confirm via WhatsApp';
      modal.querySelector('#success-whatsapp-btn').style.display = 'inline-flex';
    } else {
      instructions = `
        <p>Your Cash on Delivery order has been registered! Total payable upon delivery: <strong>${formatCurrency(total)}</strong>.</p>
        <p>Our team will contact you on <strong>${phone}</strong> before dispatching your package.</p>
      `;
      modal.querySelector('#success-whatsapp-btn').style.display = 'none';
    }

    modal.querySelector('#success-message-text').innerHTML = instructions;

    // Clear cart after successful placement
    window.RuhaShop.clearCart();
  }

  function startCheckout() {
    const items = window.RuhaShop.getCart();
    if (!items.length) {
      window.RuhaShop.notify('Please add items to your bag before checking out.');
      return;
    }
    const modal = ensureCheckoutModal();
    modal.querySelector('#checkout-view-form').hidden = false;
    modal.querySelector('#checkout-view-success').hidden = true;
    renderSummary();
    modal.showModal();
  }

  window.RuhaCheckout = {
    start: startCheckout,
    renderSummary
  };

  document.addEventListener('DOMContentLoaded', () => {
    ensureCheckoutModal();
  });
})();

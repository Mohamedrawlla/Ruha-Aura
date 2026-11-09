(() => {
  'use strict';
  const S = window.RuhaShop, $ = s => document.querySelector(s), root = $('#product-root');
  const id = new URLSearchParams(location.search).get('id'), p = S.data.find(p => p.id === id);

  if (!p) {
    const handleUpdate = () => {
      const refreshed = S.data.find(x => x.id === id);
      if (refreshed) {
        window.removeEventListener('ruha:catalog-updated', handleUpdate);
        location.reload();
      }
    };
    window.addEventListener('ruha:catalog-updated', handleUpdate);

    document.title = 'Product not found | Ruha Aura';
    root.innerHTML = `
      <section class="product-not-found">
        <span class="eyebrow">A LITTLE DETOUR</span>
        <h1>This piece isn’t here.</h1>
        <p>Explore the collection to find something lovely.</p>
        <a href="catalogue.html" class="button button-plum">Back to catalogue ${S.icon('arrow')}</a>
      </section>
    `;
    return;
  }

  document.title = p.name + ' | Ruha Aura';
  document.querySelector('meta[name=description]').content = p.description;

  const collection = p.collection === 'Kids’ toys' ? 'toys' : 'accessories';
  const images = p.images?.length ? p.images : [{ src: p.src, alt: p.name }];
  let current = 0;
  let selectedOption = p.options?.[0] || '';
  let quantity = 1;

  const value = v => S.escape(v || 'Standard specifications');
  const related = S.data.filter(x => x.collection === p.collection && x.id !== p.id).slice(0, 4);

  const optionsHTML = p.options && p.options.length > 1 ? `
    <div class="product-option-group">
      <label class="option-label">Option / Style:</label>
      <div class="option-pills" role="radiogroup">
        ${p.options.map((opt, i) => `
          <button type="button" class="option-pill ${i === 0 ? 'is-selected' : ''}" data-option="${S.escape(opt)}">
            ${S.escape(opt)}
          </button>
        `).join('')}
      </div>
    </div>
  ` : '';

  root.innerHTML = `
    <div class="product-wrap">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="index.html">Home</a>
        <span>/</span>
        <a href="catalogue.html?collection=${collection}">${S.escape(p.collection)}</a>
        <span>/</span>
        <span aria-current="page">${S.escape(p.name)}</span>
      </nav>

      <section class="product-detail">
        <div class="product-gallery">
          <button class="main-product-photo" id="main-product-photo" aria-label="Enlarge ${S.escape(p.name)}">
            <img id="main-product-image" src="${S.escape(images[0].src)}" alt="${S.escape(images[0].alt)}" width="800" height="850" fetchpriority="high">
            <span class="zoom-hint">View full photo ${S.icon('plus')}</span>
          </button>
          <div class="photo-switcher" ${images.length < 2 ? 'hidden' : ''}>
            <button id="photo-prev" aria-label="Previous product photograph">${S.icon('left')}</button>
            <div class="photo-thumbnails" role="group" aria-label="Product photographs">
              ${images.map((im, i) => `
                <button data-photo="${i}" aria-label="View photograph ${i + 1}" aria-pressed="${i === 0}">
                  <img src="${S.escape(im.src)}" alt="" width="70" height="70" loading="lazy">
                </button>
              `).join('')}
            </div>
            <button id="photo-next" aria-label="Next product photograph">${S.icon('chevron')}</button>
          </div>
          <p class="image-note">Original product photograph${images.length > 1 ? 's' : ''} · Colours may vary slightly by screen.</p>
        </div>

        <div class="product-information">
          <div class="product-category">${S.escape(p.collection)} <span> / </span> ${S.escape(p.type)}</div>
          <h1>${S.escape(p.name)}</h1>
          <p class="detail-price">${S.price(p)}</p>
          <p class="product-description">${S.escape(p.description)}</p>

          <div class="product-status">
            <span class="status-dot in-stock"></span>
            ${p.stock > 0 ? `In stock (${p.stock} available)` : 'Made to order'}
          </div>

          ${optionsHTML}

          <div class="purchase-controls">
            <div class="quantity-picker" aria-label="Select quantity">
              <button type="button" id="qty-minus" aria-label="Decrease quantity">−</button>
              <span id="qty-val">1</span>
              <button type="button" id="qty-plus" aria-label="Increase quantity">+</button>
            </div>

            <button type="button" class="button button-plum btn-add-bag" id="btn-add-to-bag">
              <span>Add to Bag</span>
              ${S.icon('bag')}
            </button>

            <button type="button" class="button button-cream btn-buy-now" id="btn-buy-now">
              <span>Buy Now</span>
              ${S.icon('arrow')}
            </button>
          </div>

          <div class="secondary-actions">
            <button class="button button-outline detail-save" data-save="${S.escape(p.id)}" aria-pressed="${S.hasSaved(p.id)}"></button>
            <button class="share-product" id="share-product">Copy link ${S.icon('arrow')}</button>
          </div>

          <div class="share-fallback" id="share-fallback" hidden>
            <label for="product-link">Copy this product link</label>
            <input readonly id="product-link" type="text">
          </div>

          <div class="delivery-perks">
            <div class="perk-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              <span>Free standard delivery on all orders over ₹999 across India.</span>
            </div>
            <div class="perk-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Handcrafted inspection with safe, tamper-evident packaging.</span>
            </div>
          </div>

          <div class="detail-accordions">
            <details open>
              <summary>Product details ${S.icon('plus')}</summary>
              <dl>
                <div><dt>Product code</dt><dd>${S.escape(p.sku)}</dd></div>
                <div><dt>Collection</dt><dd>${S.escape(p.collection)}</dd></div>
                <div><dt>Style / type</dt><dd>${S.escape(p.type)}</dd></div>
                <div><dt>Materials</dt><dd>${value(p.material)}</dd></div>
                <div><dt>Dimensions</dt><dd>${value(p.dimensions)}</dd></div>
                ${collection === 'toys' ? `<div><dt>Age guidance</dt><dd>${value(p.ageGuidance)}</dd></div>` : ''}
                <div><dt>Options</dt><dd>${p.options?.length ? S.escape(p.options.join(', ')) : 'Standard Edition'}</dd></div>
              </dl>
            </details>
            <details>
              <summary>Delivery & returns ${S.icon('plus')}</summary>
              <p>Dispatched within 24–48 hours from Bengaluru. Standard delivery arrives in 3–5 business days. 7-day return or exchange supported on any undamaged, unused piece.</p>
            </details>
          </div>

          <a href="catalogue.html?collection=${collection}" class="underlined back-collection">
            Explore ${collection === 'toys' ? 'more toys' : 'more accessories'} ${S.icon('right')}
          </a>
        </div>
      </section>

      <section class="related-products">
        <div class="section-top">
          <div>
            <span class="eyebrow">A FEW MORE LITTLE FINDS</span>
            <h2>You might also <em>love.</em></h2>
          </div>
          <a href="catalogue.html?collection=${collection}" class="underlined">View the collection ${S.icon('arrow')}</a>
        </div>
        <div class="catalogue-grid">${related.map(S.card).join('')}</div>
      </section>
    </div>
  `;

  // Quantity controls
  $('#qty-minus')?.addEventListener('click', () => {
    if (quantity > 1) {
      quantity--;
      $('#qty-val').textContent = quantity;
    }
  });

  $('#qty-plus')?.addEventListener('click', () => {
    quantity++;
    $('#qty-val').textContent = quantity;
  });

  // Option / variant pill selection
  document.querySelectorAll('.option-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.option-pill').forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      selectedOption = btn.dataset.option;
    });
  });

  // Add to Bag
  $('#btn-add-to-bag')?.addEventListener('click', () => {
    S.addToCart(p.id, quantity, selectedOption);
  });

  // Buy Now
  $('#btn-buy-now')?.addEventListener('click', () => {
    S.addToCart(p.id, quantity, selectedOption);
    if (window.RuhaCheckout) {
      window.RuhaCheckout.start();
    }
  });

  function syncSaved() {
    const b = $('.detail-save');
    if (!b) return;
    const saved = S.hasSaved(p.id);
    b.innerHTML = S.icon('heart') + (saved ? 'Saved to favourites' : 'Save to favourites');
    b.setAttribute('aria-pressed', String(saved));
    b.classList.toggle('is-saved', saved);

    document.querySelectorAll('.related-products [data-save]').forEach(b => {
      const active = S.hasSaved(b.dataset.save);
      b.classList.toggle('is-saved', active);
      b.setAttribute('aria-pressed', String(active));
      const item = S.data.find(x => x.id === b.dataset.save);
      if (item) {
        b.setAttribute('aria-label', (active ? 'Unsave ' : 'Save ') + item.name);
      }
    });
  }

  function showPhoto(n) {
    current = (n + images.length) % images.length;
    $('#main-product-image').src = images[current].src;
    $('#main-product-image').alt = images[current].alt;
    document.querySelectorAll('[data-photo]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.photo) === current)));
    if ($('#product-zoom').open) zoomImage();
  }

  document.querySelectorAll('[data-photo]').forEach(b => {
    b.addEventListener('click', () => showPhoto(Number(b.dataset.photo)));
    b.addEventListener('mouseenter', () => showPhoto(Number(b.dataset.photo)));
  });
  $('#photo-prev')?.addEventListener('click', () => showPhoto(current - 1));
  $('#photo-next')?.addEventListener('click', () => showPhoto(current + 1));

  const zoom = $('#product-zoom');
  let priorOverflow = '';
  function zoomImage() {
    $('#zoom-image').src = images[current].src;
    $('#zoom-image').alt = images[current].alt;
    $('#zoom-count').textContent = (current + 1) + ' / ' + images.length;
    $('#zoom-prev').hidden = $('#zoom-next').hidden = images.length < 2;
  }

  $('#main-product-photo').addEventListener('click', () => {
    zoomImage();
    priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    zoom.showModal();
  });

  $('#zoom-close').addEventListener('click', () => zoom.close());
  zoom.addEventListener('close', () => {
    document.body.style.overflow = priorOverflow;
    $('#main-product-photo').focus();
  });

  $('#zoom-prev').addEventListener('click', () => showPhoto(current - 1));
  $('#zoom-next').addEventListener('click', () => showPhoto(current + 1));
  zoom.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); showPhoto(current + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); showPhoto(current - 1); }
  });

  zoom.addEventListener('click', e => {
    if (e.target === zoom) {
      const b = zoom.getBoundingClientRect();
      if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) zoom.close();
    }
  });

  $('#share-product').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw Error();
      await navigator.clipboard.writeText(location.href);
      S.notify('Product link copied.');
    } catch {
      $('#share-fallback').hidden = false;
      $('#product-link').value = location.href;
      $('#product-link').focus();
      $('#product-link').select();
    }
  });

  window.addEventListener('ruha:favourites', syncSaved);
  syncSaved();
})();

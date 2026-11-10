/* Ruha Aura landing page — connects with unified catalogue, live interactive showcase, and shopping bag. */
(() => {
  'use strict';

  function getCatalog() {
    const full = window.RUHA_CATALOG || [];
    const fromShop = window.RuhaShop?.data;
    if (Array.isArray(fromShop) && fromShop.length >= full.length) {
      return fromShop;
    }
    if (Array.isArray(fromShop) && fromShop.length > 0) {
      const map = new Map();
      full.forEach(p => map.set(p.id, { ...p }));
      fromShop.forEach(p => {
        if (p && p.id) {
          const existing = map.get(p.id);
          map.set(p.id, existing ? { ...existing, ...p } : p);
        }
      });
      return Array.from(map.values());
    }
    return full;
  }

  function getProducts() {
    return getCatalog().filter(p => p.collection === 'Hair accessories' || p.category !== "Kids' toys");
  }

  function getToys() {
    return getCatalog().filter(p => p.collection === 'Kids’ toys' || p.collection === "Kids' toys" || p.category === "Kids' toys");
  }

  const $ = selector => document.querySelector(selector);
  const arrow = '<svg aria-hidden="true" width="16" height="16"><use href="#arrow"/></svg>';
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Intersection Observer for scroll animations
  let observer;
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.08 });
  }

  function reveals() {
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
      if (observer) {
        el.classList.add('will-reveal');
        observer.observe(el);
      } else {
        el.classList.add('visible');
      }
    });
  }

  // --- FEATURED FAVOURITES (Tabs & Dynamic Grid) ---
  let activeFavTab = 'all';

  function getFilteredFavourites() {
    const catalog = getCatalog();
    const fallback = window.RUHA_CATALOG || [];

    if (activeFavTab === 'jewellery') {
      let items = catalog.filter(p => p.collection === 'Jewellery' || p.category === 'Jewellery' || (p.id && p.id.startsWith('RA-JW')));
      if (items.length < 4) {
        items = fallback.filter(p => p.collection === 'Jewellery' || p.category === 'Jewellery' || (p.id && p.id.startsWith('RA-JW')));
      }
      // Prioritize stud and earring sets that are distinctly jewellery
      const preferred = items.filter(p => p.type === 'Stud Earrings Set' || (p.name && p.name.toLowerCase().includes('earring')));
      return (preferred.length >= 4 ? preferred : items).slice(0, 4);
    }

    if (activeFavTab === 'accessories') {
      let items = catalog.filter(p => p.collection === 'Hair accessories' || p.category === 'Hair accessories' || (p.id && p.id.startsWith('RA-HC')));
      if (items.length < 4) {
        items = fallback.filter(p => p.collection === 'Hair accessories' || p.category === 'Hair accessories' || (p.id && p.id.startsWith('RA-HC')));
      }
      return items.slice(0, 4);
    }

    if (activeFavTab === 'toys') {
      let items = catalog.filter(p => p.collection === 'Kids’ toys' || p.collection === "Kids' toys" || p.category === "Kids' toys" || (p.id && p.id.startsWith('RA-TY')));
      if (items.length < 4) {
        items = fallback.filter(p => p.collection === 'Kids’ toys' || p.collection === "Kids' toys" || p.category === "Kids' toys" || (p.id && p.id.startsWith('RA-TY')));
      }
      return items.slice(0, 4);
    }

    if (activeFavTab === 'sets') {
      let sets = catalog.filter(p => 
        (p.type && p.type.toLowerCase().includes('set')) || 
        (p.name && p.name.toLowerCase().includes('set'))
      );
      if (sets.length < 4) {
        sets = fallback.filter(p => 
          (p.type && p.type.toLowerCase().includes('set')) || 
          (p.name && p.name.toLowerCase().includes('set'))
        );
      }
      return sets.slice(0, 4);
    }

    // 'all' curated selection: 1 Hair Clip Set, 1 Jewellery Stud Set, 1 Scrunchie, 1 Toy
    const hair = catalog.find(p => p.id === 'RA-CL-01') || fallback.find(p => p.id === 'RA-CL-01');
    const jewel = catalog.find(p => p.id === 'RA-ER-01') || fallback.find(p => p.id === 'RA-ER-01');
    const clawOrScrunch = catalog.find(p => p.id === 'RA-SC-01') || fallback.find(p => p.id === 'RA-SC-01');
    const toy = catalog.find(p => p.id === 'RA-TY-01') || fallback.find(p => p.id === 'RA-TY-01');
    const mixed = [hair, jewel, clawOrScrunch, toy].filter(Boolean);
    if (mixed.length === 4) return mixed;
    return fallback.slice(0, 4);
  }

  function renderFavourites() {
    const grid = $('#featured-grid');
    if (!grid) return;
    const items = getFilteredFavourites();
    if (window.RuhaShop?.card) {
      grid.innerHTML = items.map(window.RuhaShop.card).join('');
    }
    reveals();
  }

  // Tab switching
  document.querySelectorAll('[data-fav-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFavTab = btn.dataset.favTab;
      document.querySelectorAll('[data-fav-tab]').forEach(b => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', String(active));
      });
      renderFavourites();
    });
  });


  // Newsletter submission
  $('#newsletter-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const emailInput = $('#newsletter-email');
    const val = emailInput?.value.trim();
    if (!val) return;
    if (window.RuhaShop?.notify) {
      window.RuhaShop.notify('A little lovely is on its way to your inbox! Thank you for subscribing.');
    } else {
      alert('Thank you for subscribing to Ruha Aura!');
    }
    emailInput.value = '';
  });

  // Lightbox
  const dialog = $('#lightbox');
  let lightboxList = [], index = 0, previousFocus = null, previousOverflow = '';

  function renderLightbox() {
    if (!dialog) return;
    const p = lightboxList[index];
    if (!p) return;
    $('#lightbox-image').src = p.src;
    $('#lightbox-image').alt = p.name;
    $('#lightbox-title').textContent = p.name;
    $('#lightbox-count').textContent = lightboxList.length > 1 ? `${String(index + 1).padStart(2, '0')} / ${String(lightboxList.length).padStart(2, '0')}` : 'THE LITTLE WONDERS EDIT';
    $('.lightbox-prev').hidden = $('.lightbox-next').hidden = lightboxList.length < 2;
    dialog.classList.toggle('toys-lightbox', lightboxList.length === 1);
  }

  function openLightbox(list, start = 0) {
    if (!dialog) return;
    lightboxList = list;
    index = Math.max(0, start);
    renderLightbox();
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
  }

  function closeLightbox() {
    dialog?.close();
  }

  function nextLightbox(n) {
    if (!lightboxList.length) return;
    index = (index + n + lightboxList.length) % lightboxList.length;
    renderLightbox();
  }

  $('.dialog-close')?.addEventListener('click', closeLightbox);
  $('.lightbox-done')?.addEventListener('click', closeLightbox);
  $('.lightbox-prev')?.addEventListener('click', () => nextLightbox(-1));
  $('.lightbox-next')?.addEventListener('click', () => nextLightbox(1));

  dialog?.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    previousFocus?.focus();
  });

  dialog?.addEventListener('click', e => {
    if (e.target === dialog) {
      const b = dialog.getBoundingClientRect();
      if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) closeLightbox();
    }
  });

  dialog?.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); nextLightbox(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); nextLightbox(-1); }
  });

  // Hero slideshow & dots
  const slides = Array.from(document.querySelectorAll('.hero-slide'));
  const dots = Array.from(document.querySelectorAll('.hero-dot'));
  let heroIndex = 0, paused = false, hovering = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function showHero(n) {
    if (!slides.length) return;
    heroIndex = (n + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const isActive = i === heroIndex;
      slide.classList.toggle('active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === heroIndex);
      dot.setAttribute('aria-selected', String(i === heroIndex));
    });

    const nameEl = $('#hero-name');
    if (nameEl) nameEl.textContent = slides[heroIndex].dataset.name;
    const counterEl = $('#hero-counter');
    if (counterEl) counterEl.textContent = `${String(heroIndex + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
  }

  $('#hero-prev')?.addEventListener('click', () => showHero(heroIndex - 1));
  $('#hero-next')?.addEventListener('click', () => showHero(heroIndex + 1));

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const slideNum = parseInt(dot.dataset.slide, 10);
      showHero(slideNum);
    });
  });

  function updatePause() {
    const pauseBtn = $('#hero-pause');
    if (!pauseBtn) return;
    const stopped = paused || reducedMotion.matches;
    pauseBtn.setAttribute('aria-pressed', String(stopped));
    pauseBtn.setAttribute('aria-label', stopped ? 'Play photo slideshow' : 'Pause photo slideshow');
    pauseBtn.textContent = stopped ? '▶' : 'Ⅱ';
  }

  $('#hero-pause')?.addEventListener('click', () => {
    paused = !paused;
    updatePause();
  });

  reducedMotion.addEventListener('change', updatePause);
  $('.hero-visual')?.addEventListener('pointerenter', () => { hovering = true; });
  $('.hero-visual')?.addEventListener('pointerleave', () => { hovering = false; });

  setInterval(() => {
    if (!paused && !hovering && !document.hidden && !dialog?.open && !reducedMotion.matches && !$('.hero-visual')?.contains(document.activeElement)) {
      showHero(heroIndex + 1);
    }
  }, 5500);

  $('.hero-enlarge')?.addEventListener('click', () => {
    const prods = getProducts();
    const p = prods.find(p => p.src === slides[heroIndex]?.getAttribute('src'));
    if (p) openLightbox(prods, prods.indexOf(p));
  });

  // --- INTERACTIVE LIVE TOY SHOWCASE ---
  let activeToyId = 'hammer';
  function updateToyShowcase(toyId) {
    const toys = getToys();
    const toy = toys.find(t => t.id === toyId);
    if (!toy) return;
    activeToyId = toyId;

    const mainImg = $('#toy-main-img');
    if (mainImg) {
      mainImg.style.opacity = '0';
      mainImg.style.transform = 'scale(0.96)';
      setTimeout(() => {
        mainImg.src = toy.src;
        mainImg.alt = toy.name;
        mainImg.style.opacity = '1';
        mainImg.style.transform = 'scale(1)';
      }, 150);
    }

    const titleEl = $('#toy-featured-title');
    if (titleEl) {
      titleEl.innerHTML = `${esc(toy.name)}.<br/><em>${toy.category || 'Wonder & Play'}.</em>`;
    }

    const descEl = $('#toy-featured-desc');
    if (descEl) {
      descEl.textContent = toy.description;
    }

    const captionEl = $('#toy-photo-caption');
    if (captionEl) {
      captionEl.textContent = `${toy.name.toUpperCase()} · ₹${toy.price || ''}`;
    }

    const quickAddBtn = $('#toy-quick-add-btn');
    if (quickAddBtn) {
      quickAddBtn.dataset.toyAdd = toy.id;
    }

    const detailsBtn = $('#toy-details-btn');
    if (detailsBtn) {
      detailsBtn.href = `product.html?id=${encodeURIComponent(toy.id)}`;
    }

    document.querySelectorAll('.toy-mini').forEach(btn => {
      const isSelected = btn.dataset.toy === toyId;
      btn.classList.toggle('is-active', isSelected);
      btn.setAttribute('aria-pressed', String(isSelected));
    });
  }

  document.querySelectorAll('[data-toy]').forEach(button => {
    button.addEventListener('click', () => {
      updateToyShowcase(button.dataset.toy);
    });
  });

  $('#toy-quick-add-btn')?.addEventListener('click', () => {
    if (window.RuhaShop && activeToyId) {
      window.RuhaShop.addToCart(activeToyId, 1);
    }
  });

  $('#toy-photo')?.addEventListener('click', () => {
    const toys = getToys();
    const idx = toys.findIndex(t => t.id === activeToyId);
    openLightbox(toys, Math.max(0, idx));
  });

  // Re-render when catalogue changes
  window.addEventListener('ruha:catalog-updated', () => {
    renderFavourites();
  });

  const yr = $('#year');
  if (yr) yr.textContent = new Date().getFullYear();

  updatePause();
  renderFavourites();
  reveals();
})();

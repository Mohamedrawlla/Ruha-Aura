// Backwards compatibility layer: derives products and toys directly from window.RUHA_CATALOG.
(() => {
  'use strict';
  function init() {
    const catalog = window.RUHA_CATALOG || [];
    window.RUHA_PRODUCTS = catalog
      .filter(p => p.collection === 'Hair accessories')
      .map(p => ({
        id: p.id,
        name: p.name,
        category: p.type || p.category,
        src: p.src,
        price: p.price
      }));

    window.RUHA_TOYS = catalog
      .filter(p => p.collection === 'Kids’ toys')
      .map(p => ({
        id: p.id,
        name: p.name,
        src: p.src,
        price: p.price
      }));
  }

  if (window.RUHA_CATALOG) {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }
})();

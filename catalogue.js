(() => {
  'use strict';
  const S = window.RuhaShop, $ = s => document.querySelector(s), params = new URLSearchParams(location.search);
  let collection = ['accessories', 'jewellery', 'toys'].includes(params.get('collection')) ? params.get('collection') : 'all';
  let selectedTypes = new Set((params.get('types') || '').split(',').filter(Boolean));
  let query = params.get('q') || '';
  const validSorts = ['az', 'za', 'price-low', 'price-high'];
  let sort = validSorts.includes(params.get('sort')) ? params.get('sort') : 'featured';
  let saved = params.get('saved') === '1', limit = 12;

  const inCollection = p => {
    if (collection === 'all') return true;
    if (collection === 'toys') return p.collection === 'Kids’ toys' || p.category === "Kids' toys";
    if (collection === 'jewellery') return p.collection === 'Jewellery' || p.category === 'Jewellery' || p.collection === 'Jewellery accessories';
    if (collection === 'accessories') return p.collection === 'Hair accessories' || p.category === 'Hair accessories';
    return true;
  };
  const availableTypes = () => [...new Set(S.data.filter(inCollection).map(p => p.type).filter(Boolean))];
  selectedTypes = new Set([...selectedTypes].filter(t => availableTypes().includes(t)));

  window.addEventListener('ruha:catalog-updated', () => {
    typesUI();
    render();
  });

  function syncURL() {
    const p = new URLSearchParams();
    if (collection !== 'all') p.set('collection', collection);
    if (selectedTypes.size) p.set('types', [...selectedTypes].join(','));
    if (query.trim()) p.set('q', query.trim());
    if (sort !== 'featured') p.set('sort', sort);
    if (saved) p.set('saved', '1');
    const path = location.pathname + (p.size ? '?' + p : '');
    try { history.replaceState(null, '', path); } catch {}
  }

  function typesUI() {
    const types = availableTypes();
    const typeContainer = $('#type-filters');
    if (!typeContainer) return;
    typeContainer.innerHTML = types.map(type => `
      <label>
        <input type="checkbox" name="type" value="${S.escape(type)}" ${selectedTypes.has(type) ? 'checked' : ''}>
        ${S.escape(type)}
      </label>
    `).join('');
  }

  function render() {
    const savedFocus = document.activeElement?.dataset?.save;
    document.querySelectorAll('input[name=collection]').forEach(el => el.checked = el.value === collection);
    if ($('#saved-only')) $('#saved-only').checked = saved;
    if ($('#product-search')) $('#product-search').value = query;
    if ($('#product-sort')) $('#product-sort').value = sort;

    let filtered = S.data.filter(p => 
      inCollection(p) && 
      (!selectedTypes.size || selectedTypes.has(p.type)) && 
      (!saved || S.hasSaved(p.id)) && 
      [p.name, p.collection, p.type, p.description].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    );

    if (sort === 'az') filtered.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'za') filtered.sort((a, b) => b.name.localeCompare(a.name));
    else if (sort === 'price-low') filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
    else if (sort === 'price-high') filtered.sort((a, b) => (b.price || 0) - (a.price || 0));

    const grid = $('#catalogue-grid');
    if (grid) grid.innerHTML = filtered.slice(0, limit).map(S.card).join('');

    const countEl = $('#catalogue-count');
    if (countEl) countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'product' : 'products'}${saved ? ' saved' : ''}${query.trim() ? ' matching “' + query.trim() + '”' : ''}`;

    const emptyEl = $('#catalogue-empty');
    if (emptyEl) emptyEl.hidden = filtered.length > 0;

    const moreBtn = $('#catalogue-more');
    if (moreBtn) {
      moreBtn.hidden = filtered.length <= limit;
      moreBtn.innerHTML = `Show ${Math.min(12, Math.max(0, filtered.length - limit))} more products ${S.icon('plus')}`;
    }

    const collLabel = collection === 'toys' ? 'Kids’ toys' : (collection === 'jewellery' ? 'Jewellery' : (collection === 'accessories' ? 'Hair accessories' : 'All products'));
    const bcEl = $('#breadcrumb-current-collection');
    if (bcEl) bcEl.textContent = collLabel;

    const chips = [
      ...(collection !== 'all' ? [{ key: 'collection', label: collLabel }] : []),
      ...[...selectedTypes].map(t => ({ key: 'type:' + t, label: t })),
      ...(saved ? [{ key: 'saved', label: 'Saved favourites' }] : []),
      ...(query.trim() ? [{ key: 'query', label: query.trim() }] : [])
    ];

    const activeEl = $('#active-filters');
    if (activeEl) {
      activeEl.innerHTML = chips.map(c => `
        <button data-remove-filter="${S.escape(c.key)}" aria-label="Remove ${S.escape(c.label)} filter">
          ${S.escape(c.label)} ${S.icon('close')}
        </button>
      `).join('');
    }

    syncURL();

    if (savedFocus) {
      const b = [...document.querySelectorAll('[data-save]')].find(b => b.dataset.save === savedFocus);
      if (b) b.focus();
      else $('#saved-only')?.focus();
    }
  }

  $('#filter-form')?.addEventListener('change', e => {
    if (e.target.name === 'collection') {
      collection = e.target.value;
      selectedTypes.clear();
      typesUI();
    }
    if (e.target.name === 'type') {
      if (e.target.checked) selectedTypes.add(e.target.value);
      else selectedTypes.delete(e.target.value);
    }
    if (e.target.id === 'saved-only') saved = e.target.checked;
    limit = 12;
    render();
  });

  $('#product-search')?.addEventListener('input', e => {
    query = e.target.value;
    limit = 12;
    render();
  });

  $('#product-sort')?.addEventListener('change', e => {
    sort = e.target.value;
    render();
  });

  function reset() {
    collection = 'all';
    selectedTypes.clear();
    query = '';
    sort = 'featured';
    saved = false;
    limit = 12;
    typesUI();
    render();
  }

  $('#clear-filters')?.addEventListener('click', reset);
  $('#empty-reset')?.addEventListener('click', reset);

  $('#active-filters')?.addEventListener('click', e => {
    const b = e.target.closest('[data-remove-filter]');
    if (!b) return;
    const key = b.dataset.removeFilter;
    if (key === 'collection') {
      collection = 'all';
      selectedTypes.clear();
      typesUI();
    } else if (key === 'saved') {
      saved = false;
    } else if (key === 'query') {
      query = '';
    } else {
      selectedTypes.delete(key.slice(5));
      typesUI();
    }
    limit = 12;
    render();
  });

  $('#catalogue-more')?.addEventListener('click', () => {
    limit += 12;
    render();
  });

  window.addEventListener('ruha:favourites', render);

  $('#toggle-filters')?.addEventListener('click', () => {
    const panel = $('.catalogue-sidebar');
    const open = panel?.classList.toggle('filters-open');
    $('#toggle-filters')?.setAttribute('aria-expanded', String(open));
  });

  typesUI();
  render();
})();

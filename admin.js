(() => {
  'use strict';

  // State
  let catalog = [];
  let currentFilterCategory = 'all';
  let currentFilterBadge = 'all';
  let currentFilterStock = 'all';
  let searchQuery = '';

  // POS State
  let posCart = [];

  // Orders State
  let orders = [];

  // Customers & Registered Users State
  let customers = [];

  // ========================================================
  // 1. CODE-128 VECTOR BARCODE GENERATOR (LIGHTWEIGHT & PURE JS)
  // ========================================================
  const CODE128_PATTERNS = [
    "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
    "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
    "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
    "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
    "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
    "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
    "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
    "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
    "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
    "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
    "114131","311141","411131","211412","211214","211232","2331112"
  ];

  function generateCode128SVG(rawText, height = 65, barWidth = 2.2, showText = true) {
    const text = String(rawText || '').trim().toUpperCase();
    if (!text) return '';

    let checksum = 104; // Start Code B
    const indices = [104];
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i) - 32;
      if (code >= 0 && code <= 95) {
        indices.push(code);
        checksum += code * (i + 1);
      }
    }
    indices.push(checksum % 103);
    indices.push(106); // Stop code

    let patternStr = "";
    for (const idx of indices) {
      patternStr += (CODE128_PATTERNS[idx] || "212222");
    }

    const quietZone = 12;
    let x = quietZone;
    let isBar = true;
    let rects = "";
    for (let i = 0; i < patternStr.length; i++) {
      const w = parseInt(patternStr[i], 10) * barWidth;
      if (isBar) {
        rects += `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${height}" fill="#000000"/>`;
      }
      x += w;
      isBar = !isBar;
    }
    const totalWidth = (x + quietZone).toFixed(1);
    const totalHeight = showText ? height + 18 : height;
    const isMini = height <= 35;
    const svgHeight = isMini ? `${height}px` : '68px';
    const svgMaxWidth = isMini ? '105px' : '270px';
    const miniClass = isMini ? ' code128-barcode-mini' : '';

    return `<svg class="code128-barcode-svg${miniClass}" width="100%" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;width:100% !important;max-width:${svgMaxWidth} !important;height:${svgHeight} !important;min-height:${isMini ? '0' : '60px'} !important;overflow:visible;">
      ${rects}
      ${showText ? `<text x="${(totalWidth / 2).toFixed(1)}" y="${height + 14}" font-family="monospace, 'Courier New', Courier" font-size="13" font-weight="800" text-anchor="middle" fill="#000000" letter-spacing="3">${text}</text>` : ''}
    </svg>`;
  }

  // Scanner Audio Beep Generator (Web Audio API)
  function playScannerBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime); // Crisp scanner frequency
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }

  const formatPrice = n => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(n);

  function showToast(msg) {
    const toast = document.getElementById('admin-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function getCatalog() {
    let list = [];
    if (window.RuhaShop && window.RuhaShop.getCatalog) {
      list = window.RuhaShop.getCatalog();
    } else {
      try {
        const stored = localStorage.getItem('ruha-aura-custom-catalog');
        if (stored !== null) {
          list = JSON.parse(stored);
        } else {
          list = window.RUHA_CATALOG || [];
        }
      } catch {
        list = window.RUHA_CATALOG || [];
      }
    }

    // Auto-migrate if stored catalogue contains old legacy mock items or outdated SKUs
    const isOldData = p => 
      p.id === 'hibiscus' || 
      p.id === 'butterfly' || 
      p.id === 'floral-dotted' || 
      p.id === 'lily' ||
      p.id === 'golden' ||
      p.id === 'pearl' ||
      p.id === 'daisy' ||
      (p.sku && p.sku.startsWith('RA-HC-')) ||
      (p.sku && p.sku.startsWith('RA-JW-')) ||
      (p.sku && p.sku.startsWith('RA-0') && Number(p.sku.replace('RA-', '')) <= 17) ||
      (p.src && p.src.includes('yentto.com'));

    const defaultCat = window.RUHA_CATALOG || [];
    if (Array.isArray(list) && (list.some(isOldData) || list.length < defaultCat.length)) {
      list = [...defaultCat];
      try {
        localStorage.setItem('ruha-aura-custom-catalog', JSON.stringify(list));
      } catch {}
      if (window.RuhaShop && window.RuhaShop.saveCatalog) {
        window.RuhaShop.saveCatalog(list);
      }
    }

    if (window.RuhaDB && window.RuhaDB.isConfigured()) {
      window.RuhaDB.getProducts().then(remoteList => {
        if (Array.isArray(remoteList) && remoteList.length > 0) {
          const isDeprecated = p => {
            if (!p || !p.id) return true;
            const id = String(p.id);
            const sku = String(p.sku || '');
            return (
              id === 'hibiscus' || id === 'butterfly' || id === 'floral-dotted' ||
              id === 'lily' || id === 'golden' || id === 'pearl' || id === 'daisy' ||
              id.startsWith('RA-HC-') || id.startsWith('RA-JW-') ||
              sku.startsWith('RA-HC-') || sku.startsWith('RA-JW-') ||
              (sku.startsWith('RA-0') && Number(sku.replace('RA-', '')) <= 17)
            );
          };

          const cleanRemote = remoteList.filter(p => !isDeprecated(p));
          const defaultCat = window.RUHA_CATALOG || [];

          // Map clean remote over default catalog strictly matching valid IDs
          const map = new Map();
          defaultCat.forEach(p => map.set(p.id, { ...p }));
          cleanRemote.forEach(rem => {
            if (rem && rem.id && map.has(rem.id)) {
              map.set(rem.id, { ...map.get(rem.id), ...rem });
            }
          });

          catalog = Array.from(map.values());

          // If remote had deprecated items, purge them and sync clean 219 items to Supabase
          if (remoteList.some(isDeprecated) || cleanRemote.length < defaultCat.length) {
            window.RuhaDB.saveProductsBatch(catalog).catch(() => {});
          }

          try {
            localStorage.setItem('ruha-aura-custom-catalog', JSON.stringify(catalog));
          } catch {}

          renderKPIs();
          renderTable();
          populateQuickAddSelect();
          populateLabelSelect();
          populateCategoryFilter();
        }
      }).catch(() => {});
    }

    return list;
  }

  function saveCatalogAndSync(newCatalog, message = 'Catalogue updated.') {
    catalog = newCatalog;
    if (window.RuhaShop && window.RuhaShop.saveCatalog) {
      window.RuhaShop.saveCatalog(catalog);
    } else {
      try {
        localStorage.setItem('ruha-aura-custom-catalog', JSON.stringify(catalog));
      } catch (err) {
        console.warn('LocalStorage save note:', err);
      }
    }

    if (window.RuhaDB && window.RuhaDB.isConfigured()) {
      window.RuhaDB.saveProductsBatch(catalog).catch(err => {
        console.warn('[Admin] Cloud sync note:', err);
      });
    }

    renderKPIs();
    renderTable();
    populateQuickAddSelect();
    populateLabelSelect();
    populateCategoryFilter();
    if (message) showToast(message);
  }

  // ========================================================
  // 2. TAB SWITCHING
  // ========================================================
  const tabButtons = document.querySelectorAll('.admin-tab-btn[data-view]');
  const views = {
    analytics: document.getElementById('view-analytics'),
    catalog: document.getElementById('view-catalog'),
    pos: document.getElementById('view-pos'),
    barcodes: document.getElementById('view-barcodes'),
    multichannel: document.getElementById('view-multichannel'),
    customers: document.getElementById('view-customers')
  };

  const breadcrumbView = document.getElementById('admin-breadcrumb-view');
  const viewTitles = {
    analytics: 'Overview',
    catalog: 'Products',
    pos: 'Dispatch POS',
    barcodes: 'Barcode Labels',
    multichannel: 'Multi-Channel Sales',
    customers: 'Customers & Users'
  };

  function switchTab(viewName) {
    tabButtons.forEach(btn => {
      const isActive = btn.dataset.view === viewName;
      btn.classList.toggle('is-active', isActive);
    });

    Object.keys(views).forEach(k => {
      if (views[k]) {
        if (k === viewName) {
          views[k].removeAttribute('hidden');
          views[k].classList.add('is-active');
        } else {
          views[k].setAttribute('hidden', '');
          views[k].classList.remove('is-active');
        }
      }
    });

    if (breadcrumbView && viewTitles[viewName]) {
      breadcrumbView.textContent = viewTitles[viewName];
    }

    if (viewName === 'analytics') {
      renderAnalyticsDashboard();
    } else if (viewName === 'pos') {
      const scanInput = document.getElementById('pos-barcode-input');
      setTimeout(() => scanInput?.focus(), 100);
      renderPOSCart();
    } else if (viewName === 'barcodes') {
      renderBarcodeLabels();
    } else if (viewName === 'multichannel') {
      renderOrdersTable();
      renderOrdersKPIs();
    }
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.view));
  });

  // Quick navigation links inside analytics mockup
  document.getElementById('link-to-dispatch-pos')?.addEventListener('click', e => {
    e.preventDefault();
    switchTab('pos');
  });

  document.getElementById('link-manage-catalogue')?.addEventListener('click', () => {
    switchTab('catalog');
  });

  document.getElementById('link-print-barcodes')?.addEventListener('click', () => {
    switchTab('barcodes');
  });

  // ========================================================
  // 2B. SALES ANALYTICS & REVENUE DASHBOARD
  // ========================================================
  let currentAnalyticsRange = 'month';
  let currentAnalyticsChannel = 'all';

  function filterOrdersForAnalytics() {
    const now = Date.now();
    return (orders || []).filter(ord => {
      // Channel filter
      if (currentAnalyticsChannel !== 'all') {
        const ch = (ord.channel || '').toLowerCase();
        const target = currentAnalyticsChannel.toLowerCase();
        if (!ch.includes(target) && !target.includes(ch)) return false;
      }

      // Time range filter
      if (currentAnalyticsRange === 'all') return true;
      const ordTime = new Date(ord.date).getTime();
      const diffMs = now - ordTime;

      if (currentAnalyticsRange === 'today') {
        return diffMs <= 86400000; // last 24h
      } else if (currentAnalyticsRange === 'week') {
        return diffMs <= 86400000 * 7; // last 7 days
      } else if (currentAnalyticsRange === 'month') {
        return diffMs <= 86400000 * 30; // last 30 days
      }
      return true;
    });
  }

  function renderAnalyticsDashboard() {
    const filteredOrders = filterOrdersForAnalytics();

    // 1. Executive Metrics
    const totalGrossRevenue = filteredOrders.reduce((sum, ord) => sum + (Number(ord.total) || 0), 0);
    const totalOrdersCount = filteredOrders.length;
    const aov = totalOrdersCount > 0 ? Math.round(totalGrossRevenue / totalOrdersCount) : 0;

    let totalUnits = 0;
    filteredOrders.forEach(ord => {
      if (Array.isArray(ord.items)) {
        ord.items.forEach(it => totalUnits += (Number(it.quantity) || 1));
      }
    });

    // Channel revenue distribution
    const channelTotals = {};
    filteredOrders.forEach(ord => {
      const ch = ord.channel || 'Website';
      channelTotals[ch] = (channelTotals[ch] || 0) + (Number(ord.total) || 0);
    });

    let topChannel = 'Instagram DM';
    let maxChannelRev = 0;
    Object.keys(channelTotals).forEach(ch => {
      if (channelTotals[ch] > maxChannelRev) {
        maxChannelRev = channelTotals[ch];
        topChannel = ch;
      }
    });
    const topChannelPct = totalGrossRevenue > 0 ? Math.round((maxChannelRev / totalGrossRevenue) * 100) : 0;

    // Render KPI elements
    const elRev = document.getElementById('kpi-total-revenue');
    const elOrd = document.getElementById('kpi-total-orders');
    const elAov = document.getElementById('kpi-aov');
    const elUnits = document.getElementById('kpi-units-sold');
    const elTopBadge = document.getElementById('kpi-top-channel-badge');
    const elPeriodBadge = document.getElementById('overview-period-badge');
    const elOverviewAmt = document.getElementById('overview-total-amount');
    const elOverviewSub = document.getElementById('overview-period-total-sub');
    const elActiveChannels = document.getElementById('channels-active-count');
    const elDispatchNum = document.getElementById('dispatch-units-num');
    const elDispatchChannel = document.getElementById('dispatch-top-channel-name');

    if (elRev) elRev.textContent = formatPrice(totalGrossRevenue);
    if (elOrd) elOrd.textContent = totalOrdersCount;
    if (elAov) elAov.textContent = formatPrice(aov);
    if (elUnits) elUnits.textContent = totalUnits;
    if (elTopBadge) elTopBadge.textContent = totalOrdersCount > 0 ? `Top: ${topChannel}` : 'Top: —';
    if (elOverviewAmt) elOverviewAmt.textContent = formatPrice(totalGrossRevenue);

    const rangeLabels = { today: 'TODAY', week: '7 DAYS', month: '30 DAYS', all: 'ALL TIME' };
    const periodLabel = rangeLabels[currentAnalyticsRange] || '30 DAYS';
    if (elPeriodBadge) elPeriodBadge.textContent = periodLabel;
    if (elOverviewSub) elOverviewSub.textContent = `${periodLabel.toLowerCase()} total · ${formatPrice(totalGrossRevenue)}`;
    if (elActiveChannels) elActiveChannels.textContent = `${Object.keys(channelTotals).length} active`;

    if (elDispatchNum) elDispatchNum.textContent = totalUnits;
    if (elDispatchChannel) elDispatchChannel.textContent = totalOrdersCount > 0 ? topChannel : '—';

    // 2. Render Visual Channel List
    renderChannelBreakdown(filteredOrders, totalGrossRevenue);
    renderOverviewRecentOrders();
  }

  function renderChannelBreakdown(filteredOrders, totalRevenue) {
    const container = document.getElementById('channel-breakdown-list');
    if (!container) return;

    const channels = [
      { name: 'Instagram DM', tag: 'Social', icon: '📸' },
      { name: 'WhatsApp', tag: 'Direct', icon: '💬' },
      { name: 'Amazon', tag: 'India', icon: '🛒' },
      { name: 'Website', tag: 'Online', icon: '🌐' }
    ];

    container.innerHTML = channels.map(ch => {
      const matchOrders = filteredOrders.filter(o => (o.channel || '').toLowerCase().includes(ch.name.toLowerCase()));
      const rev = matchOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
      const valStr = rev > 0 ? formatPrice(rev) : '—';

      return `
        <div class="channel-list-item">
          <div class="channel-item-left">
            <div class="channel-icon-wrap">${ch.icon}</div>
            <span class="channel-name-clean">${ch.name}</span>
          </div>
          <div class="channel-item-right">
            <span class="channel-tag-clean">${ch.tag}</span>
            <span class="channel-dash" style="font-weight:700; color:#332826;">${valStr}</span>
          </div>
        </div>
      `;
    }).join('');
  }



  // Time Range Filters (Today, 7D, 30D, All)
  document.getElementById('analytics-time-range')?.addEventListener('click', e => {
    const btn = e.target.closest('.time-pill-btn');
    if (!btn) return;
    document.querySelectorAll('.time-pill-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    currentAnalyticsRange = btn.dataset.range || 'month';
    renderAnalyticsDashboard();
  });

  // Channel Filter Dropdown
  document.getElementById('analytics-channel-filter')?.addEventListener('change', e => {
    currentAnalyticsChannel = e.target.value;
    renderAnalyticsDashboard();
  });

  // Export Sales Ledger as CSV
  document.getElementById('analytics-export-csv-btn')?.addEventListener('click', () => {
    const filteredOrders = filterOrdersForAnalytics();
    if (!filteredOrders.length) {
      alert('No sales records to export for current filter.');
      return;
    }

    const headers = ['Order ID', 'Date', 'Sales Channel', 'Customer Name', 'Phone', 'Address', 'Items Sold', 'Subtotal (INR)', 'GST Tax (INR)', 'Shipping (INR)', 'Grand Total (INR)', 'Order Status'];
    const rows = filteredOrders.map(o => {
      const itemsStr = (o.items || []).map(i => `${i.product.name} (x${i.quantity})`).join('; ');
      return [
        o.id,
        new Date(o.date).toLocaleDateString('en-IN'),
        o.channel || 'Direct',
        `"${(o.customer?.name || '').replace(/"/g, '""')}"`,
        `"${(o.customer?.phone || '').replace(/"/g, '""')}"`,
        `"${(o.customer?.address || '').replace(/"/g, '""')}"`,
        `"${itemsStr.replace(/"/g, '""')}"`,
        o.subtotal || 0,
        o.tax || 0,
        o.shipping || 0,
        o.total || 0,
        o.status || 'Packed'
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ruha-Aura-Sales-Report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📊 Sales Report downloaded as CSV spreadsheet.');
  });

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.view));
  });

  // Shortcut buttons
  document.getElementById('print-all-barcodes-shortcut')?.addEventListener('click', () => {
    switchTab('barcodes');
  });

  document.getElementById('record-sale-shortcut')?.addEventListener('click', () => {
    switchTab('pos');
    const chan = document.getElementById('pos-channel');
    if (chan) chan.value = 'Instagram DM';
  });

  // ========================================================
  // 3. CATALOGUE & INVENTORY MANAGEMENT
  // ========================================================
  function renderKPIs() {
    const totalCount = catalog.length;
    const totalStock = catalog.reduce((s, p) => s + (Number(p.stock) || 0), 0);
    const totalValue = catalog.reduce((s, p) => s + ((Number(p.price) || 0) * (Number(p.stock) || 0)), 0);
    const lowStockCount = catalog.filter(p => (Number(p.stock) || 0) <= 5).length;

    const elTotalProds = document.getElementById('stat-total-products');
    const elTotalStock = document.getElementById('stat-total-stock');
    const elTotalVal = document.getElementById('stat-inventory-value');
    const elLowStock = document.getElementById('stat-low-stock');

    if (elTotalProds) elTotalProds.textContent = totalCount;
    if (elTotalStock) elTotalStock.textContent = totalStock.toLocaleString('en-IN');
    if (elTotalVal) elTotalVal.textContent = formatPrice(totalValue);
    if (elLowStock) elLowStock.textContent = lowStockCount;

    const elAlertStockSub = document.getElementById('alert-stock-sub');
    if (elAlertStockSub) {
      elAlertStockSub.textContent = `${lowStockCount} products are low or out of stock. The alert threshold is fewer than 5 units.`;
    }
  }

  function filterCatalog() {
    return catalog.filter(p => {
      if (currentFilterCategory !== 'all') {
        const cat = p.category || p.collection || '';
        if (cat.toLowerCase() !== currentFilterCategory.toLowerCase()) return false;
      }
      if (currentFilterBadge !== 'all') {
        if ((p.badge || '').toLowerCase() !== currentFilterBadge.toLowerCase()) return false;
      }
      const stock = Number(p.stock) || 0;
      if (currentFilterStock === 'in' && stock <= 5) return false;
      if (currentFilterStock === 'low' && (stock <= 0 || stock > 5)) return false;
      if (currentFilterStock === 'out' && stock > 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sku = (p.sku || p.id).toLowerCase();
        const text = `${p.id} ${sku} ${p.name} ${p.category} ${p.collection} ${p.type} ${p.badge || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }

  function renderTable() {
    const tbody = document.getElementById('admin-product-tbody');
    const filteredCount = document.getElementById('filtered-count');
    if (!tbody) return;

    const filtered = filterCatalog();
    if (filteredCount) {
      filteredCount.textContent = `${filtered.length} total`;
    }

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 40px 20px; color: #8c7e7b;">
            No products match your current search or filter.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const stock = Number(p.stock) || 0;
      let stockDotClass = 'stock-dot-green';
      let stockText = `${stock} In stock`;
      if (stock === 0) {
        stockDotClass = 'stock-dot-red';
        stockText = 'Out of stock';
      } else if (stock <= 5) {
        stockDotClass = 'stock-dot-orange';
        stockText = `${stock} Low stock`;
      }

      let badgeHtml = '<span style="color:#a89b97;font-size:0.75rem;">—</span>';
      if (p.badge) {
        const b = p.badge.toUpperCase();
        const isBest = b.includes('BEST');
        badgeHtml = `<span class="badge-pill-soft ${isBest ? 'badge-pill-bestseller' : ''}">${p.badge}</span>`;
      }

      const swatchesHTML = Array.isArray(p.swatches) && p.swatches.length
        ? `<div class="swatches-dots-row">${p.swatches.map(hex => `<span class="swatch-circle-dot" style="background:${hex};" title="${hex}"></span>`).join('')}</div>`
        : '<span style="color:#a89b97;font-size:0.75rem;">—</span>';

      const sku = (p.sku || p.id).toUpperCase();
      const barcodeSVG = generateCode128SVG(sku, 28, 1.1, false);

      return `
        <tr data-product-id="${p.id}">
          <td style="width: 36px;"><input type="checkbox" class="row-checkbox" data-id="${p.id}" aria-label="Select ${p.name}"></td>
          <td>
            <div class="table-prod-cell">
              <div class="table-prod-icon-box">
                <img src="${p.src}" alt="${p.name}" onerror="this.src='assets/brand-logo.jpeg'">
              </div>
              <div>
                <a href="product.html?id=${encodeURIComponent(p.id)}" target="_blank" class="table-prod-name">${p.name}</a>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:2px;">
                  <span class="table-prod-sku-tag">#${p.id}</span>
                  ${p.images && p.images.length > 1 ? `<span class="badge-photos-count" onclick="window.adminOpenEdit('${p.id}')" title="${p.images.length} photos in gallery (Amazon style)">📷 ${p.images.length} photos</span>` : ''}
                </div>
              </div>
            </div>
          </td>
          <td>
            <span style="font-weight:600;display:block;">${p.category || p.collection || ''}</span>
            <span style="font-size:0.75rem;color:#8c7e7b;">${p.type || ''}</span>
          </td>
          <td style="font-weight:700; color:#211918;">
            ${formatPrice(p.price || 0)}
          </td>
          <td>
            <span class="stock-pill-dot">
              <span class="${stockDotClass}"></span>
              ${stockText}
            </span>
          </td>
          <td>
            <div class="barcode-col-clean">
              <div class="barcode-mini-svg">${barcodeSVG}</div>
              <span class="barcode-sku-pill">${sku}</span>
            </div>
          </td>
          <td>${badgeHtml}</td>
          <td>${swatchesHTML}</td>
          <td>
            <div class="table-row-actions-clean">
              <button type="button" class="btn-row-action" data-action="label" data-id="${p.id}">Label</button>
              <button type="button" class="btn-row-action" data-action="edit" data-id="${p.id}">Edit</button>
              <button type="button" class="btn-row-action" data-action="duplicate" data-id="${p.id}">Copy</button>
              <button type="button" class="btn-row-action btn-row-action-delete" data-action="delete" data-id="${p.id}" title="Delete this product">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    updateBatchStrip();
  }

  // ========================================================
  // 4. PHOTO UPLOAD & PRODUCT MODAL
  // ========================================================
  const modalBackdrop = document.getElementById('product-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const productForm = document.getElementById('product-form');
  const modalTitle = document.getElementById('modal-title');

  const fileInput = document.getElementById('form-file-input');
  const dropZone = document.getElementById('photo-upload-dropzone');
  const previewThumb = document.getElementById('form-preview-thumb');
  const srcInput = document.getElementById('form-src');
  const addUrlInput = document.getElementById('form-add-photo-url');
  const addUrlBtn = document.getElementById('btn-add-photo-url');

  // Amazon-Style Multi-Photo Gallery State for Modal
  let currentModalImages = [];
  let activePreviewIndex = 0;

  function renderModalGallery() {
    const grid = document.getElementById('photo-thumbnails-grid');
    const countPill = document.getElementById('photo-count-pill');
    const mainImg = document.getElementById('form-preview-thumb');
    const mainTag = document.getElementById('photo-main-tag');

    if (!grid) return;

    if (countPill) {
      countPill.textContent = `${currentModalImages.length} photo${currentModalImages.length === 1 ? '' : 's'}`;
    }

    if (currentModalImages.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; font-size: 0.78rem; color: #888; padding: 12px; text-align: center; background: #fff; border-radius: 6px;">No photos uploaded yet. Drop photos above or paste a URL below.</div>`;
      if (mainImg) mainImg.src = 'assets/brand-logo.jpeg';
      if (mainTag) {
        mainTag.textContent = 'No Photos';
        mainTag.style.color = '#888';
      }
      if (srcInput) srcInput.value = '';
      return;
    }

    // Ensure active index is within bounds
    if (activePreviewIndex < 0 || activePreviewIndex >= currentModalImages.length) {
      activePreviewIndex = 0;
    }

    // Update main preview box (Amazon style high-res viewer)
    const activePhoto = currentModalImages[activePreviewIndex];
    if (mainImg && activePhoto) {
      mainImg.src = activePhoto.src;
      mainImg.alt = activePhoto.alt || 'Product preview';
    }
    if (mainTag) {
      if (activePreviewIndex === 0) {
        mainTag.textContent = '★ Main Cover Photo';
        mainTag.style.color = '#2e7d32';
      } else {
        mainTag.textContent = `Photo ${activePreviewIndex + 1} of ${currentModalImages.length}`;
        mainTag.style.color = 'var(--admin-plum)';
      }
    }

    // Keep primary (index 0) photo synced in srcInput
    if (srcInput && currentModalImages[0]) {
      srcInput.value = currentModalImages[0].src;
    }

    // Render Amazon-style thumbnail cards
    grid.innerHTML = currentModalImages.map((img, idx) => {
      const isMain = idx === 0;
      const isActive = idx === activePreviewIndex;
      return `
        <div class="photo-thumb-card ${isMain ? 'is-main' : ''} ${isActive ? 'is-active' : ''}" data-photo-idx="${idx}" title="${isMain ? 'Main Cover Photo' : `Angle Photo ${idx + 1}`} (Click to preview)">
          <img src="${img.src}" alt="${img.alt || `Angle ${idx + 1}`}">
          ${isMain ? `<span class="photo-thumb-badge">★ MAIN</span>` : ''}
          <button type="button" class="photo-thumb-del" data-del-photo="${idx}" title="Delete this photo">&times;</button>
          <div class="photo-thumb-actions">
            ${!isMain ? `<button type="button" class="photo-thumb-btn" data-make-main="${idx}">Set Main</button>` : `<span style="font-size:0.6rem; color:#fff; font-weight:700;">Cover</span>`}
          </div>
        </div>
      `;
    }).join('');

    // Attach click events on thumbnails
    grid.querySelectorAll('.photo-thumb-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('[data-del-photo]') || e.target.closest('[data-make-main]')) return;
        const idx = Number(card.dataset.photoIdx);
        activePreviewIndex = idx;
        renderModalGallery();
      });
    });

    // Delete photo button
    grid.querySelectorAll('[data-del-photo]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = Number(btn.dataset.delPhoto);
        currentModalImages.splice(idx, 1);
        if (activePreviewIndex >= currentModalImages.length) {
          activePreviewIndex = Math.max(0, currentModalImages.length - 1);
        }
        renderModalGallery();
        showToast('Photo removed from gallery.');
      });
    });

    // Set Main photo button
    grid.querySelectorAll('[data-make-main]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = Number(btn.dataset.makeMain);
        const [promoted] = currentModalImages.splice(idx, 1);
        currentModalImages.unshift(promoted);
        activePreviewIndex = 0;
        renderModalGallery();
        showToast('Set as main cover photograph (Amazon style)!');
      });
    });
  }

  // Client-Side Canvas Image Optimizer (converts multi-megabyte photos to crisp ~80KB web-optimized photos)
  function compressImageFile(file, maxWidth = 1000, maxHeight = 1000, quality = 0.82) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  // Handle Multiple Photo Files (Upload or Drag-and-drop)
  async function handlePhotoFiles(files) {
    if (!files || !files.length) return;
    const fileList = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!fileList.length) {
      alert('Please select valid image files (JPG, PNG, WEBP).');
      return;
    }

    showToast(`Optimizing & loading ${fileList.length} photo${fileList.length > 1 ? 's' : ''}...`);

    for (const file of fileList) {
      try {
        let finalUrl = '';
        if (window.RuhaDB && window.RuhaDB.isConfigured() && window.RuhaDB.uploadPhoto) {
          try {
            finalUrl = await window.RuhaDB.uploadPhoto(file);
          } catch (storageErr) {
            console.warn('[RuhaDB] Supabase storage upload note:', storageErr);
          }
        }
        if (!finalUrl) {
          finalUrl = await compressImageFile(file, 1000, 1000, 0.82);
        }
        if (finalUrl) {
          currentModalImages.push({
            src: finalUrl,
            alt: file.name.replace(/\.[^/.]+$/, "")
          });
        }
      } catch (err) {
        console.warn('Photo processing note:', err);
      }
    }

    activePreviewIndex = currentModalImages.length - 1; // preview newly uploaded
    renderModalGallery();
    showToast(`Added ${fileList.length} photo${fileList.length > 1 ? 's' : ''} to gallery!`);
  }

  fileInput?.addEventListener('change', e => {
    if (e.target.files && e.target.files.length) {
      handlePhotoFiles(e.target.files);
    }
  });

  dropZone?.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone?.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      handlePhotoFiles(e.dataTransfer.files);
    }
  });

  // Add Photo via URL or Path
  addUrlBtn?.addEventListener('click', () => {
    const url = addUrlInput?.value.trim();
    if (!url) {
      alert('Please enter an image path or URL.');
      return;
    }
    currentModalImages.push({
      src: url,
      alt: 'Product angle photo'
    });
    if (addUrlInput) addUrlInput.value = '';
    activePreviewIndex = currentModalImages.length - 1;
    renderModalGallery();
    showToast('Photo added to gallery.');
  });

  addUrlInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addUrlBtn?.click();
    }
  });

  // Category prefix mapping & sequential ID generator
  const CATEGORY_PREFIXES = {
    "kids' toys": "TY",
    "kids’ toys": "TY",
    "activity toys": "TY",
    "busy books": "TY",
    "puzzles": "TY",
    "wooden games": "TY",
    "toys": "TY",
    "hair clips": "CL",
    "clips": "CL",
    "floral": "CL",
    "claw clips": "CL",
    "hair claw clip": "CL",
    "scrunchies": "SC",
    "bow collection": "BW",
    "bows": "BW",
    "sets & combos": "ST",
    "sets": "ST",
    "combos": "ST",
    "earrings": "ER",
    "studs": "ER",
    "stud earrings": "ER",
    "drop earrings": "ER",
    "necklaces & pendants": "NK",
    "necklaces": "NK",
    "pendants": "NK",
    "chains": "NK",
    "bracelets & bangles": "BR",
    "bracelets": "BR",
    "bangles": "BR",
    "kadas": "BR",
    "kada": "BR",
    "rings": "RG",
    "ring": "RG",
    "jewellery": "JW"
  };

  const customCategoryPrefixes = {};

  function registerCategory(catName, customCode) {
    if (!catName) return 'TY';
    const norm = catName.trim().toLowerCase();
    const code = customCode ? customCode.trim().toUpperCase() : getCategoryPrefix(catName);
    CATEGORY_PREFIXES[norm] = code;
    customCategoryPrefixes[norm] = code;
    return code;
  }

  function populateCategoryFilter() {
    const filterSelect = document.getElementById('filter-category');
    if (!filterSelect) return;
    const currentVal = filterSelect.value;

    const baseCategories = [
      "Kids' toys",
      "Hair clips",
      "Scrunchies",
      "Bow collection",
      "Sets & Combos",
      "Earrings",
      "Necklaces & Pendants",
      "Bracelets & Bangles",
      "Rings"
    ];
    const catalogCategories = catalog.map(p => p.category || p.collection).filter(Boolean);
    const customCats = Object.keys(customCategoryPrefixes).map(c => c.charAt(0).toUpperCase() + c.slice(1));
    const allUnique = Array.from(new Set([...baseCategories, ...catalogCategories, ...customCats]));

    filterSelect.innerHTML = `<option value="all">All categories (${catalog.length})</option>` +
      allUnique.map(cat => {
        const count = catalog.filter(p => (p.category || p.collection || '').toLowerCase() === cat.toLowerCase()).length;
        return `<option value="${cat}">${cat} (${count})</option>`;
      }).join('');

    if (allUnique.includes(currentVal)) {
      filterSelect.value = currentVal;
    } else {
      filterSelect.value = 'all';
    }
  }

  function getCategoryPrefix(category) {
    if (!category) return 'TY';
    const norm = category.trim().toLowerCase();
    if (CATEGORY_PREFIXES[norm]) return CATEGORY_PREFIXES[norm];
    for (const key of Object.keys(CATEGORY_PREFIXES)) {
      if (norm.includes(key)) return CATEGORY_PREFIXES[key];
    }
    const letters = norm.replace(/[^a-z]/g, '');
    return (letters.slice(0, 2) || 'PR').toUpperCase();
  }

  function generateNextProductId(category) {
    const prefix = getCategoryPrefix(category);
    const targetPrefix = `RA-${prefix}-`;
    let highestNum = 0;

    catalog.forEach(p => {
      const sku = (p.sku || p.id || '').toUpperCase();
      if (sku.startsWith(targetPrefix)) {
        const numStr = sku.replace(targetPrefix, '').replace(/[^0-9]/g, '');
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > highestNum) {
          highestNum = num;
        }
      } else {
        const pCat = (p.category || p.collection || '').toLowerCase();
        if (getCategoryPrefix(pCat) === prefix) {
          const match = (p.id || '').match(/(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > highestNum) highestNum = num;
          }
        }
      }
    });

    const nextNum = highestNum + 1;
    const padded = String(nextNum).padStart(2, '0');
    return `RA-${prefix}-${padded}`;
  }

  function deleteProductById(id) {
    const prod = catalog.find(p => p.id === id);
    const name = prod ? prod.name : id;
    const updated = catalog.filter(p => p.id !== id);
    if (window.RuhaDB && window.RuhaDB.isConfigured()) {
      window.RuhaDB.deleteProduct(id);
    }
    saveCatalogAndSync(updated, `Deleted "${name}".`);
    updateBatchStrip();
  }

  function updateBatchStrip() {
    const selected = document.querySelectorAll('.row-checkbox:checked');
    const count = selected.length;
    const strip = document.getElementById('batch-actions-strip');
    const countEl = document.getElementById('batch-selected-count');
    const numEl = document.getElementById('batch-delete-num');
    const selectAll = document.getElementById('select-all-products');

    if (countEl) countEl.textContent = count;
    if (numEl) numEl.textContent = count;

    if (strip) {
      strip.style.display = count > 0 ? 'flex' : 'none';
    }

    const allCheckboxes = document.querySelectorAll('.row-checkbox');
    if (selectAll && allCheckboxes.length > 0) {
      selectAll.checked = count === allCheckboxes.length;
      selectAll.indeterminate = count > 0 && count < allCheckboxes.length;
    } else if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }
  }

  function openEditModal(productId) {
    const prod = catalog.find(p => p.id === productId);
    if (!prod) return;

    modalTitle.textContent = `Edit Product: ${prod.name}`;
    document.getElementById('form-mode').value = 'edit';
    document.getElementById('form-id').value = prod.id;
    document.getElementById('form-id').readOnly = true;
    document.getElementById('form-sku').value = prod.sku || prod.id.toUpperCase();
    document.getElementById('form-name').value = prod.name;
    document.getElementById('form-category').value = prod.category || prod.collection || "Kids' toys";
    document.getElementById('form-type').value = prod.type || '';
    document.getElementById('form-price').value = prod.price || '';
    document.getElementById('form-stock').value = prod.stock ?? 10;
    document.getElementById('form-badge').value = prod.badge || '';
    document.getElementById('form-swatches').value = Array.isArray(prod.swatches) ? prod.swatches.join(', ') : '';
    document.getElementById('form-options').value = Array.isArray(prod.options) ? prod.options.join(', ') : '';
    document.getElementById('form-description').value = prod.description || '';

    // Initialize Multi-Photo Gallery for this product
    if (Array.isArray(prod.images) && prod.images.length > 0) {
      currentModalImages = prod.images.map(img => 
        typeof img === 'string' ? { src: img, alt: prod.name } : { src: img.src || prod.src, alt: img.alt || prod.name }
      );
    } else if (prod.src) {
      currentModalImages = [{ src: prod.src, alt: prod.name }];
    } else {
      currentModalImages = [];
    }
    activePreviewIndex = 0;
    renderModalGallery();

    const delBtn = document.getElementById('modal-delete-btn');
    if (delBtn) delBtn.style.display = 'inline-flex';

    modalBackdrop.classList.add('is-open');
  }
  window.adminOpenEdit = openEditModal;

  function openAddModal() {
    modalTitle.textContent = 'Add New Product';
    productForm.reset();
    document.getElementById('form-mode').value = 'add';
    document.getElementById('form-id').readOnly = false;
    document.getElementById('form-stock').value = '10';
    document.getElementById('form-price').value = '499';
    document.getElementById('form-category').value = "Kids' toys";
    const nextId = generateNextProductId("Kids' toys");
    document.getElementById('form-id').value = nextId;
    document.getElementById('form-sku').value = nextId;
    document.getElementById('form-swatches').value = '#d97c65, #629b9f, #e5b85a';

    // Default multi-photo gallery for new product
    currentModalImages = [
      { src: 'assets/toys/hammer.png', alt: 'Main Photo' }
    ];
    activePreviewIndex = 0;
    renderModalGallery();

    const delBtn = document.getElementById('modal-delete-btn');
    if (delBtn) delBtn.style.display = 'none';

    modalBackdrop.classList.add('is-open');
  }

  function closeModal() {
    modalBackdrop.classList.remove('is-open');
  }

  modalCloseBtn?.addEventListener('click', closeModal);
  modalCancelBtn?.addEventListener('click', closeModal);
  modalBackdrop?.addEventListener('click', e => {
    if (e.target === modalBackdrop) closeModal();
  });

  document.getElementById('add-product-btn')?.addEventListener('click', openAddModal);

  // Form Submit (Save Product)
  productForm?.addEventListener('submit', e => {
    e.preventDefault();
    const mode = document.getElementById('form-mode').value;
    const id = document.getElementById('form-id').value.trim();
    const sku = (document.getElementById('form-sku').value.trim() || id).toUpperCase();
    const name = document.getElementById('form-name').value.trim();
    const category = document.getElementById('form-category').value;
    const type = document.getElementById('form-type').value.trim();
    const price = parseInt(document.getElementById('form-price').value, 10) || 0;
    const stock = parseInt(document.getElementById('form-stock').value, 10) || 0;
    const badge = document.getElementById('form-badge').value.trim();
    const src = srcInput.value.trim() || 'assets/brand-logo.jpeg';
    const swatchesRaw = document.getElementById('form-swatches').value;
    const optionsRaw = document.getElementById('form-options').value;
    const description = document.getElementById('form-description').value.trim();

    const swatches = swatchesRaw ? swatchesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const options = optionsRaw ? optionsRaw.split(',').map(s => s.trim()).filter(Boolean) : ['Standard'];

    // Amazon-Style Multi-Photo Gallery Processing
    const images = currentModalImages.length > 0 
      ? currentModalImages.map(img => ({ src: img.src, alt: img.alt || name }))
      : [{ src: src, alt: name }];
    const mainSrc = images[0].src;

    if (mode === 'add') {
      if (catalog.some(p => p.id === id)) {
        alert('A product with this Slug ID already exists. Please choose a unique ID.');
        return;
      }
      const newProd = {
        id,
        sku,
        name,
        collection: category,
        category,
        type: type || category,
        price,
        stock,
        badge,
        src: mainSrc,
        images,
        swatches,
        options,
        description: description || `${name} - Handcrafted collection piece by Ruha Aura.`,
        features: ['Handcrafted with attention to detail', 'Gentle grip for all day wear', 'Presented in signature packaging'],
        currency: 'INR'
      };
      const updated = [newProd, ...catalog];
      saveCatalogAndSync(updated, `Product "${name}" added with ${images.length} photos & barcode.`);
      if (window.RuhaDB && window.RuhaDB.isConfigured()) {
        window.RuhaDB.saveProduct(newProd).catch(e => console.warn('[RuhaDB] Auto cloud sync note:', e));
      }
    } else {
      let savedProd = null;
      const updated = catalog.map(p => {
        if (p.id !== id) return p;
        savedProd = {
          ...p,
          sku,
          name,
          collection: category,
          category,
          type: type || p.type,
          price,
          stock,
          badge,
          src: mainSrc,
          images,
          swatches,
          options: options.length ? options : p.options,
          description: description || p.description
        };
        return savedProd;
      });
      saveCatalogAndSync(updated, `Product "${name}" updated with ${images.length} photos.`);
      if (window.RuhaDB && window.RuhaDB.isConfigured() && savedProd) {
        window.RuhaDB.saveProduct(savedProd).catch(e => console.warn('[RuhaDB] Auto cloud sync note:', e));
      }
    }

    closeModal();
  });

  // Modal Category change & auto ID generation
  document.getElementById('form-category')?.addEventListener('change', e => {
    const val = e.target.value;
    const customBox = document.getElementById('custom-category-box');
    if (val === '__new__') {
      if (customBox) customBox.style.display = 'block';
      document.getElementById('custom-category-input')?.focus();
      return;
    } else {
      if (customBox) customBox.style.display = 'none';
    }
    if (document.getElementById('form-mode').value === 'add') {
      const nextId = generateNextProductId(val);
      document.getElementById('form-id').value = nextId;
      document.getElementById('form-sku').value = nextId;
    }
  });

  // Toggle custom category input box
  document.getElementById('btn-toggle-custom-category')?.addEventListener('click', () => {
    const customBox = document.getElementById('custom-category-box');
    if (customBox) {
      const isHidden = customBox.style.display === 'none';
      customBox.style.display = isHidden ? 'block' : 'none';
      if (isHidden) document.getElementById('custom-category-input')?.focus();
    }
  });

  // Add new custom category button click
  document.getElementById('btn-add-custom-category')?.addEventListener('click', () => {
    const inputEl = document.getElementById('custom-category-input');
    const codeEl = document.getElementById('custom-category-code');
    const catName = inputEl?.value.trim();
    if (!catName) {
      alert('Please enter a category name (e.g. Activity toys, Puzzles, Jewellery).');
      return;
    }

    const code = registerCategory(catName, codeEl?.value);
    const select = document.getElementById('form-category');
    if (select) {
      let opt = Array.from(select.options).find(o => o.value.toLowerCase() === catName.toLowerCase());
      if (!opt) {
        opt = document.createElement('option');
        opt.value = catName;
        opt.textContent = `${catName} (RA-${code})`;
        const newOpt = Array.from(select.options).find(o => o.value === '__new__');
        if (newOpt) select.insertBefore(opt, newOpt);
        else select.appendChild(opt);
      }
      select.value = catName;
    }

    const nextId = generateNextProductId(catName);
    document.getElementById('form-id').value = nextId;
    document.getElementById('form-sku').value = nextId;

    populateCategoryFilter();

    document.getElementById('custom-category-box').style.display = 'none';
    if (inputEl) inputEl.value = '';
    if (codeEl) codeEl.value = '';
    showToast(`New category "${catName}" added! Assigned prefix RA-${code}. Next ID: ${nextId}`);
  });

  document.getElementById('btn-regenerate-id')?.addEventListener('click', () => {
    const cat = document.getElementById('form-category').value;
    const nextId = generateNextProductId(cat);
    document.getElementById('form-id').value = nextId;
    document.getElementById('form-sku').value = nextId;
    showToast(`Generated ID: ${nextId}`);
  });

  // Delete button inside Edit Modal
  document.getElementById('modal-delete-btn')?.addEventListener('click', () => {
    const id = document.getElementById('form-id').value;
    const prod = catalog.find(p => p.id === id);
    if (!prod) return;
    if (confirm(`Are you sure you want to delete "${prod.name}" (${prod.id})?`)) {
      closeModal();
      deleteProductById(id);
    }
  });

  // Table row action delegation
  document.getElementById('admin-product-tbody')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const prod = catalog.find(p => p.id === id);
    if (!prod) return;

    if (action === 'edit') {
      openEditModal(id);
    } else if (action === 'label') {
      switchTab('barcodes');
      const select = document.getElementById('label-product-select');
      if (select) select.value = id;
      renderBarcodeLabels();
    } else if (action === 'delete') {
      if (confirm(`Are you sure you want to delete "${prod.name}" (${prod.id})?`)) {
        deleteProductById(id);
      }
    } else if (action === 'duplicate') {
      const copyId = generateNextProductId(prod.category || 'Kids\' toys');
      const duplicated = {
        ...prod,
        id: copyId,
        sku: copyId,
        name: `${prod.name} (Copy)`,
        badge: 'New Arrival'
      };
      const updated = [duplicated, ...catalog];
      saveCatalogAndSync(updated, `Duplicated "${prod.name}" as ${copyId}.`);
    }
  });

  // Batch Select & Batch Delete Handlers
  document.getElementById('select-all-products')?.addEventListener('change', e => {
    const isChecked = e.target.checked;
    document.querySelectorAll('.row-checkbox').forEach(cb => {
      cb.checked = isChecked;
    });
    updateBatchStrip();
  });

  document.getElementById('admin-product-tbody')?.addEventListener('change', e => {
    if (e.target.classList.contains('row-checkbox')) {
      updateBatchStrip();
    }
  });

  document.getElementById('batch-deselect-btn')?.addEventListener('click', () => {
    document.querySelectorAll('.row-checkbox').forEach(cb => {
      cb.checked = false;
    });
    const selectAll = document.getElementById('select-all-products');
    if (selectAll) selectAll.checked = false;
    updateBatchStrip();
  });

  document.getElementById('batch-delete-btn')?.addEventListener('click', () => {
    const selectedCheckboxes = Array.from(document.querySelectorAll('.row-checkbox:checked'));
    const idsToDelete = selectedCheckboxes.map(cb => cb.dataset.id).filter(Boolean);
    if (idsToDelete.length === 0) return;

    if (confirm(`Are you sure you want to permanently delete ${idsToDelete.length} selected product(s)?`)) {
      const updated = catalog.filter(p => !idsToDelete.includes(p.id));
      if (window.RuhaDB && window.RuhaDB.isConfigured()) {
        idsToDelete.forEach(id => window.RuhaDB.deleteProduct(id));
      }
      saveCatalogAndSync(updated, `Deleted ${idsToDelete.length} products.`);
      updateBatchStrip();
    }
  });

  // Filters
  document.getElementById('admin-search')?.addEventListener('input', e => {
    searchQuery = e.target.value;
    renderTable();
  });
  document.getElementById('filter-category')?.addEventListener('change', e => {
    currentFilterCategory = e.target.value;
    renderTable();
  });
  document.getElementById('filter-badge')?.addEventListener('change', e => {
    currentFilterBadge = e.target.value;
    renderTable();
  });
  document.getElementById('filter-stock')?.addEventListener('change', e => {
    currentFilterStock = e.target.value;
    renderTable();
  });

  // Export 1-click catalogue-data.js
  document.getElementById('export-catalog-btn')?.addEventListener('click', () => {
    const fileContent = `/**
 * Ruha Aura - Catalogue Data
 * Exported via Admin Manager on ${new Date().toISOString()}
 */
window.RUHA_CATALOG = ${JSON.stringify(catalog, null, 2)};
`;
    const blob = new Blob([fileContent], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'catalogue-data.js';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Downloaded catalogue-data.js! Replace your local file to commit permanently.');
  });

  // Bulk Import Products Modal Controller
  const importModal = document.getElementById('import-products-modal');
  const importBtn = document.getElementById('import-catalog-csv-btn');
  const importInput = document.getElementById('catalog-csv-file-input');
  const importCloseBtn = document.getElementById('import-modal-close-btn');
  const importCancelBtn = document.getElementById('import-modal-cancel-btn');
  const triggerFileBtn = document.getElementById('btn-trigger-file-select');
  const downloadTemplateBtn = document.getElementById('btn-download-template');
  const quickImportYenttoBtn = document.getElementById('btn-quick-import-yentto');
  const replaceModeCheckbox = document.getElementById('import-replace-mode');

  function openImportModal() {
    if (importModal) {
      importModal.style.setProperty('display', 'flex', 'important');
      importModal.style.alignItems = 'center';
      importModal.style.justifyContent = 'center';
      importModal.classList.add('is-open');
    }
  }

  function closeImportModal() {
    if (importModal) {
      importModal.style.setProperty('display', 'none', 'important');
      importModal.classList.remove('is-open');
    }
  }

  window.openImportProductsModal = openImportModal;
  window.closeImportProductsModal = closeImportModal;

  importBtn?.addEventListener('click', openImportModal);
  importCloseBtn?.addEventListener('click', closeImportModal);
  importCancelBtn?.addEventListener('click', closeImportModal);
  importModal?.addEventListener('click', (e) => {
    if (e.target === importModal) closeImportModal();
  });

  // Direct trigger for file chooser (100% reliable direct user gesture)
  triggerFileBtn?.addEventListener('click', () => {
    if (importInput) {
      importInput.value = '';
      importInput.click();
    }
  });

  // 1-Click Sync from Yentto (210 Products)
  quickImportYenttoBtn?.addEventListener('click', async () => {
    try {
      quickImportYenttoBtn.disabled = true;
      quickImportYenttoBtn.textContent = '⏳ Importing 210 Products...';

      const res = await fetch('ruha_aura_210_products.json');
      if (!res.ok) throw new Error('Could not load ruha_aura_210_products.json');
      const items = await res.json();

      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Product file is empty or invalid.');
      }

      const shouldReplace = replaceModeCheckbox ? replaceModeCheckbox.checked : true;
      if (shouldReplace) {
        catalog = items;
      } else {
        catalog = catalog.concat(items);
      }

      saveCatalogAndSync(catalog, `Successfully imported ${items.length} products from Yentto!`);
      closeImportModal();
      showToast(`🎉 210 Hair & Jewellery products live in catalogue!`);
    } catch (err) {
      console.error('Yentto import error:', err);
      alert('Import failed: ' + err.message);
    } finally {
      if (quickImportYenttoBtn) {
        quickImportYenttoBtn.disabled = false;
        quickImportYenttoBtn.textContent = '⚡ Import 210 Products Now';
      }
    }
  });

  downloadTemplateBtn?.addEventListener('click', () => {
    downloadProductCSVTemplate();
  });

  function downloadProductCSVTemplate() {
    const csvContent = 
`Product ID,Name,Collection,Type,Price,Cost Price,Stock,Description,Material,Dimensions,Badge,Image URL
RA-HC-01,Classic Acetate Claw Clip,Hair accessories,Hair Claw Clip,299,120,15,Elegant handcrafted hair claw clip with strong spring grip.,Cellulose Acetate,8.5 cm,Bestseller,assets/products/claw-01.jpg
RA-JW-01,Pearl Drop Gold Earrings,Jewellery accessories,Earrings,499,190,20,Hypoallergenic 18k gold plated drop earrings with freshwater pearl.,Gold Plated Brass & Pearl,4 cm,New,assets/products/earring-01.jpg
RA-SC-01,Pure Mulberry Silk Scrunchie,Hair accessories,Silk Scrunchie,199,80,25,Gentle anti-breakage hair scrunchie made of 100% 22-momme silk.,100% Mulberry Silk,10 cm,Popular,assets/products/scrunchie-01.jpg`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ruha_aura_products_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded ruha_aura_products_template.csv');
  }

  importInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        let imported = [];

        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          imported = Array.isArray(parsed) ? parsed : (parsed.products || []);
        } else {
          imported = parseProductCSV(text);
        }

        if (!imported || imported.length === 0) {
          alert('Could not find any valid product rows in this file. Please verify the CSV format.');
          return;
        }

        const shouldReplace = replaceModeCheckbox ? replaceModeCheckbox.checked : true;
        if (shouldReplace) {
          catalog = imported;
        } else {
          catalog = catalog.concat(imported);
        }

        saveCatalogAndSync(catalog, `Successfully imported ${imported.length} products!`);
        closeImportModal();
        showToast(`Imported ${imported.length} products successfully!`);
      } catch (err) {
        console.error('Import error:', err);
        alert('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  function parseProductCSV(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return [];

    const parseRow = (line) => {
      const row = [];
      let inQuotes = false;
      let cur = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === ',' && !inQuotes) {
          row.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      row.push(cur.trim());
      return row;
    };

    const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    const findCol = (aliases) => {
      return headers.findIndex(h => aliases.some(a => h.includes(a)));
    };

    const idxId = findCol(['productid', 'sku', 'code', 'barcode', 'id']);
    const idxName = findCol(['name', 'title', 'itemname', 'productname']);
    const idxColl = findCol(['collection', 'category']);
    const idxType = findCol(['type', 'style', 'subcategory']);
    const idxPrice = findCol(['price', 'retailprice', 'sellingprice', 'mrp']);
    const idxCost = findCol(['cost', 'costprice', 'purchaseprice']);
    const idxStock = findCol(['stock', 'qty', 'quantity', 'inventory']);
    const idxDesc = findCol(['description', 'desc', 'details', 'about']);
    const idxMat = findCol(['material', 'fabric']);
    const idxDim = findCol(['dimension', 'size']);
    const idxBadge = findCol(['badge', 'tag']);
    const idxImg = findCol(['image', 'photo', 'img', 'src', 'picture', 'url']);

    const items = [];
    let counter = catalog.length + 1;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseRow(lines[i]);
      if (cols.length === 0 || !cols.some(c => c.length > 0)) continue;

      const name = idxName !== -1 && cols[idxName] ? cols[idxName] : ('Product ' + counter);
      const coll = idxColl !== -1 && cols[idxColl] ? cols[idxColl] : 'Hair accessories';
      const type = idxType !== -1 && cols[idxType] ? cols[idxType] : 'Accessories';

      let prefix = 'AC';
      const collLower = (coll + ' ' + type).toLowerCase();
      if (collLower.includes('toy')) prefix = 'TY';
      else if (collLower.includes('jewel') || collLower.includes('earring') || collLower.includes('necklace') || collLower.includes('ring')) prefix = 'JW';
      else if (collLower.includes('claw') || collLower.includes('clip')) prefix = 'HC';
      else if (collLower.includes('scrunch')) prefix = 'SC';
      else if (collLower.includes('bow')) prefix = 'BW';

      const autoId = `RA-${prefix}-${String(counter).padStart(2, '0')}`;
      const id = (idxId !== -1 && cols[idxId]) ? cols[idxId] : autoId;
      const price = idxPrice !== -1 && cols[idxPrice] ? (parseFloat(cols[idxPrice].replace(/[^0-9.]/g, '')) || 299) : 299;
      const cost = idxCost !== -1 && cols[idxCost] ? (parseFloat(cols[idxCost].replace(/[^0-9.]/g, '')) || Math.round(price * 0.4)) : Math.round(price * 0.4);
      const stock = idxStock !== -1 && cols[idxStock] ? (parseInt(cols[idxStock].replace(/[^0-9]/g, ''), 10) || 10) : 10;
      const desc = idxDesc !== -1 && cols[idxDesc] ? cols[idxDesc] : `${name} from Ruha Aura.`;
      const material = idxMat !== -1 && cols[idxMat] ? cols[idxMat] : 'Premium Alloy & Acetate';
      const dimensions = idxDim !== -1 && cols[idxDim] ? cols[idxDim] : 'Standard size';
      const badge = idxBadge !== -1 && cols[idxBadge] ? cols[idxBadge] : 'New';
      const img = idxImg !== -1 && cols[idxImg] ? cols[idxImg] : 'assets/brand-logo.jpeg';

      items.push({
        id: id,
        code: id,
        sku: id,
        name: name,
        collection: coll,
        collectionLabel: coll,
        category: coll,
        type: type,
        price: price,
        costPrice: cost,
        currency: 'INR',
        stock: stock,
        description: desc,
        material: material,
        dimensions: dimensions,
        suitability: 'All ages & styles',
        badge: badge,
        src: img,
        images: [{ src: img, alt: name }],
        gallery: [{ src: img, alt: name }],
        options: ['Default'],
        variants: ['Default'],
        swatches: ['#460329', '#c58b72'],
        colors: ['#460329', '#c58b72'],
        status: stock > 0 ? 'available' : 'sold-out'
      });
      counter++;
    }

    return items;
  }

  window.adminReloadCatalog = function(newCatalog) {
    catalog = newCatalog;
    saveCatalogAndSync(catalog, `Catalogue synced with ${newCatalog.length} products.`);
  };

  // Sidebar: Restore Full Catalogue (219 items)
  document.getElementById('reset-toys-only-btn')?.addEventListener('click', () => {
    if (confirm('Restore the complete Ruha Aura catalogue with all 219 Hair, Jewellery and Toy products?')) {
      localStorage.removeItem('ruha-aura-custom-catalog');
      catalog = [...(window.RUHA_CATALOG || [])];
      saveCatalogAndSync(catalog, 'Catalogue restored with all 219 products.');
    }
  });

  // Sidebar: Wipe All (Empty Database)
  document.getElementById('wipe-all-catalog-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to WIPE all products? Your catalogue will have 0 products so you can add fresh products.')) {
      localStorage.setItem('ruha-aura-custom-catalog', JSON.stringify([]));
      catalog = [];
      saveCatalogAndSync([], 'Catalogue wiped clean. 0 products remaining.');
    }
  });

  // Legacy reset fallback
  document.getElementById('reset-catalog-btn')?.addEventListener('click', () => {
    localStorage.removeItem('ruha-aura-custom-catalog');
    catalog = [...(window.RUHA_CATALOG || [])];
    saveCatalogAndSync(catalog, 'Catalogue reset to defaults.');
  });

  // ========================================================
  // 5. SCAN & BILL / DISPATCH POS ENGINE
  // ========================================================
  const posBarcodeInput = document.getElementById('pos-barcode-input');
  const posCartTbody = document.getElementById('pos-cart-tbody');
  const posCartEmpty = document.getElementById('pos-cart-empty');
  const posItemCountText = document.getElementById('pos-item-count-text');
  const posCartBadge = document.getElementById('pos-cart-badge');
  const posQuickAddSelect = document.getElementById('pos-quick-add-select');

  function populateQuickAddSelect() {
    if (!posQuickAddSelect) return;
    posQuickAddSelect.innerHTML = `<option value="">Or select product to add...</option>` +
      catalog.map(p => `<option value="${p.id}">${p.name} (${(p.sku || p.id).toUpperCase()}) - ₹${p.price}</option>`).join('');
  }

  function addProductToPOS(product) {
    if (!product) return;
    const existing = posCart.find(item => item.product.id === product.id);
    if (existing) {
      existing.quantity += 1;
      existing.lineTotal = existing.quantity * (Number(existing.product.price) || 0);
    } else {
      posCart.push({
        product,
        quantity: 1,
        lineTotal: Number(product.price) || 0
      });
    }

    playScannerBeep();
    renderPOSCart();
    showToast(`Added: ${product.name}`);
  }

  function handleBarcodeScan(code) {
    const raw = String(code || '').trim();
    if (!raw) return;
    const clean = raw.toLowerCase();
    const cleanAlphanum = clean.replace(/[^a-z0-9]/g, '');

    // Search by SKU, ID, code, or sanitized alphanumeric match
    const found = catalog.find(p => {
      const sku = (p.sku || '').toLowerCase();
      const id = (p.id || '').toLowerCase();
      const codeField = (p.code || '').toLowerCase();
      return sku === clean || id === clean || codeField === clean ||
             (cleanAlphanum && (sku.replace(/[^a-z0-9]/g, '') === cleanAlphanum || id.replace(/[^a-z0-9]/g, '') === cleanAlphanum));
    });

    if (found) {
      playScannerBeep();
      if (posBarcodeInput) posBarcodeInput.value = '';

      const autoBillToggle = document.getElementById('pos-auto-bill-toggle');
      const isAutoBill = autoBillToggle ? autoBillToggle.checked : true;

      if (isAutoBill) {
        // Instant Auto-Bill on Scan:
        addProductToPOS(found);
        generateAndOpenBill(`Auto-Billed Barcode: ${found.sku || found.id}`, true);
        showToast(`⚡ Instant Bill Generated for ${found.name} (₹${found.price})!`);
      } else {
        // Multi-Item Cart Scan:
        addProductToPOS(found);
        showToast(`✓ Scanned: ${found.name}`);
      }
    } else {
      showToast(`⚠️ Item not found for barcode: "${raw}"`);
      if (posBarcodeInput) {
        posBarcodeInput.value = '';
        posBarcodeInput.focus();
      }
    }
    posBarcodeInput?.focus();
  }

  posBarcodeInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = posBarcodeInput.value.trim();
      if (val) {
        handleBarcodeScan(val);
      } else if (posCart.length > 0) {
        generateAndOpenBill('Enter Key Checkout', false);
      }
    }
  });

  // Dedicated "Instant Bill" button in scanner bar
  document.getElementById('pos-scan-bill-btn')?.addEventListener('click', () => {
    const val = posBarcodeInput?.value.trim();
    if (val) {
      handleBarcodeScan(val);
    } else if (posCart.length > 0) {
      generateAndOpenBill('Instant Bill Button', false);
    } else {
      alert('Please scan or type a barcode / SKU first (e.g. RA-HC-01).');
      posBarcodeInput?.focus();
    }
  });

  // Camera Scanner Support (Laptop webcam or mobile phone camera)
  let html5Scanner = null;
  const cameraModal = document.getElementById('camera-scanner-modal');
  const cameraCloseBtn = document.getElementById('camera-scanner-close-btn');
  const cameraStatus = document.getElementById('camera-scanner-status');

  async function startCameraScanner() {
    if (!cameraModal) return;
    cameraModal.style.display = 'flex';
    if (cameraStatus) cameraStatus.textContent = 'Initializing camera preview...';

    try {
      if (typeof Html5Qrcode === 'undefined') {
        if (cameraStatus) cameraStatus.textContent = 'Camera scanner library loading... Please try in a moment.';
        return;
      }
      if (!html5Scanner) {
        html5Scanner = new Html5Qrcode('camera-scanner-viewport');
      }

      await html5Scanner.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 300, height: 160 }
        },
        decodedText => {
          stopCameraScanner();
          handleBarcodeScan(decodedText);
        },
        () => {}
      );
      if (cameraStatus) cameraStatus.textContent = '📷 Point camera at any Ruha Aura barcode sticker...';
    } catch (err) {
      console.warn('Camera scanner error:', err);
      if (cameraStatus) {
        cameraStatus.innerHTML = `<span style="color:#b91c1c;">Camera access error: ${err.message || 'Permission denied'}. You can type the SKU directly into the box.</span>`;
      }
    }
  }

  function stopCameraScanner() {
    if (html5Scanner && html5Scanner.isScanning) {
      html5Scanner.stop().catch(() => {}).then(() => {
        if (cameraModal) cameraModal.style.display = 'none';
      });
    } else {
      if (cameraModal) cameraModal.style.display = 'none';
    }
  }

  document.getElementById('pos-camera-scan-btn')?.addEventListener('click', startCameraScanner);
  cameraCloseBtn?.addEventListener('click', stopCameraScanner);
  cameraModal?.addEventListener('click', e => {
    if (e.target === cameraModal) stopCameraScanner();
  });

  // Global Hardware Scanner Listener: Automatically captures rapid keystrokes from USB/Bluetooth scanner guns
  let hwScanBuffer = '';
  let hwLastKeyTime = 0;

  window.addEventListener('keydown', e => {
    // If typing in another input (like search, customer name, price edit), ignore
    const activeEl = document.activeElement;
    const tag = activeEl ? activeEl.tagName.toLowerCase() : '';
    const id = activeEl ? activeEl.id : '';
    if ((tag === 'input' || tag === 'textarea') && id !== 'pos-barcode-input') {
      return;
    }

    const now = Date.now();
    // Hardware scanners output characters < 45ms apart
    if (now - hwLastKeyTime > 120) {
      hwScanBuffer = '';
    }
    hwLastKeyTime = now;

    if (e.key === 'Enter') {
      if (hwScanBuffer.length >= 3) {
        e.preventDefault();
        const code = hwScanBuffer.trim();
        hwScanBuffer = '';
        // If not in POS tab, automatically jump to POS view
        if (currentView !== 'pos') {
          switchTab('pos');
        }
        handleBarcodeScan(code);
      }
    } else if (e.key.length === 1) {
      hwScanBuffer += e.key;
    }
  });

  // Toggle listener for Auto-Bill status
  const autoBillToggle = document.getElementById('pos-auto-bill-toggle');
  const autoBillStatusText = document.getElementById('pos-mode-status-text');
  autoBillToggle?.addEventListener('change', () => {
    if (autoBillStatusText) {
      if (autoBillToggle.checked) {
        autoBillStatusText.textContent = 'Scanner Gun Ready: Point & Scan to Auto-Bill';
        showToast('⚡ Auto-Bill on Scan is active. 1 scan creates bill & shipping slip!');
      } else {
        autoBillStatusText.textContent = 'Cart Mode: Scanning adds items to cart';
        showToast('🛒 Cart Mode active. Scan multiple items, then click Generate Bill.');
      }
    }
  });

  posQuickAddSelect?.addEventListener('change', e => {
    const id = e.target.value;
    if (!id) return;
    const prod = catalog.find(p => p.id === id);
    if (prod) {
      const autoBillToggle = document.getElementById('pos-auto-bill-toggle');
      if (autoBillToggle && autoBillToggle.checked) {
        addProductToPOS(prod);
        generateAndOpenBill(`Quick Add Auto-Bill: ${prod.sku || prod.id}`, true);
        showToast(`⚡ Instant Bill Generated for ${prod.name}!`);
      } else {
        addProductToPOS(prod);
      }
    }
    posQuickAddSelect.value = '';
  });

  function renderPOSCart() {
    if (!posCartTbody) return;

    if (posCart.length === 0) {
      posCartTbody.innerHTML = '';
      if (posCartEmpty) posCartEmpty.style.display = 'block';
      if (posItemCountText) posItemCountText.textContent = '0 items';
      if (posCartBadge) posCartBadge.style.display = 'none';
      updatePOSTotals();
      return;
    }

    if (posCartEmpty) posCartEmpty.style.display = 'none';
    const totalQty = posCart.reduce((s, i) => s + i.quantity, 0);
    if (posItemCountText) posItemCountText.textContent = `${totalQty} item${totalQty === 1 ? '' : 's'}`;
    if (posCartBadge) {
      posCartBadge.style.display = 'inline-block';
      posCartBadge.textContent = totalQty;
    }

    posCartTbody.innerHTML = posCart.map((item, idx) => `
      <tr>
        <td>
          <div class="pos-line-item">
            <img src="${item.product.src}" alt="${item.product.name}" class="pos-line-thumb" onerror="this.src='assets/brand-logo.jpeg'">
            <div>
              <strong style="display:block; font-size:0.88rem;">${item.product.name}</strong>
              <span style="font-size:0.75rem; color:var(--admin-muted);">${item.product.category || ''}</span>
            </div>
          </div>
        </td>
        <td>
          <span style="font-family:monospace; font-size:0.78rem; font-weight:700; color:var(--admin-plum); background:#fcf1f4; padding:2px 6px; border-radius:4px;">
            ${(item.product.sku || item.product.id).toUpperCase()}
          </span>
        </td>
        <td style="font-size:0.9rem; font-weight:600;">₹${item.product.price}</td>
        <td>
          <div class="pos-qty-ctrl">
            <button type="button" class="pos-qty-btn" data-pos-action="minus" data-idx="${idx}">&minus;</button>
            <span class="pos-qty-val">${item.quantity}</span>
            <button type="button" class="pos-qty-btn" data-pos-action="plus" data-idx="${idx}">&plus;</button>
          </div>
        </td>
        <td style="font-size:0.92rem; font-weight:700; color:var(--admin-plum);">₹${item.lineTotal}</td>
        <td>
          <button type="button" class="row-btn row-btn-delete" data-pos-action="remove" data-idx="${idx}" title="Remove item" style="padding:4px 8px;">
            &times;
          </button>
        </td>
      </tr>
    `).join('');

    updatePOSTotals();
  }

  posCartTbody?.addEventListener('click', e => {
    const btn = e.target.closest('[data-pos-action]');
    if (!btn) return;
    const action = btn.dataset.posAction;
    const idx = parseInt(btn.dataset.idx, 10);
    if (isNaN(idx) || !posCart[idx]) return;

    if (action === 'plus') {
      posCart[idx].quantity += 1;
      posCart[idx].lineTotal = posCart[idx].quantity * (Number(posCart[idx].product.price) || 0);
    } else if (action === 'minus') {
      posCart[idx].quantity -= 1;
      if (posCart[idx].quantity <= 0) {
        posCart.splice(idx, 1);
      } else {
        posCart[idx].lineTotal = posCart[idx].quantity * (Number(posCart[idx].product.price) || 0);
      }
    } else if (action === 'remove') {
      posCart.splice(idx, 1);
    }
    renderPOSCart();
  });

  document.getElementById('pos-clear-cart-btn')?.addEventListener('click', () => {
    if (posCart.length === 0) return;
    if (confirm('Clear all items from current bill?')) {
      posCart = [];
      renderPOSCart();
    }
  });

  function updatePOSTotals() {
    const subtotal = posCart.reduce((s, i) => s + i.lineTotal, 0);
    const tax = Math.round(subtotal * 0.05); // 5% inclusive
    const shipping = parseInt(document.getElementById('pos-shipping-val')?.value, 10) || 0;
    const discount = parseInt(document.getElementById('pos-discount-val')?.value, 10) || 0;
    const grandTotal = Math.max(0, subtotal + shipping - discount);

    const elSub = document.getElementById('pos-subtotal-val');
    const elTax = document.getElementById('pos-tax-val');
    const elGrand = document.getElementById('pos-grand-total-val');

    if (elSub) elSub.textContent = formatPrice(subtotal);
    if (elTax) elTax.textContent = formatPrice(tax);
    if (elGrand) elGrand.textContent = formatPrice(grandTotal);
  }

  document.getElementById('pos-shipping-val')?.addEventListener('input', updatePOSTotals);
  document.getElementById('pos-discount-val')?.addEventListener('input', updatePOSTotals);

  // Generate Bill & Shipping Slip
  function generateAndOpenBill(reason = 'POS Order', isAutoBilled = false) {
    if (posCart.length === 0) {
      alert('Please scan or add at least one product to generate a bill.');
      posBarcodeInput?.focus();
      return null;
    }

    const orderId = `RA-ORD-${Date.now().toString().slice(-6)}`;
    const custName = document.getElementById('pos-cust-name')?.value.trim() || 'Valued Customer (Direct)';
    const custPhone = document.getElementById('pos-cust-phone')?.value.trim() || '—';
    const custAddress = document.getElementById('pos-cust-address')?.value.trim() || 'Direct Store / Counter Dispatch';
    const custCity = document.getElementById('pos-cust-city')?.value.trim() || '';
    const custPincode = document.getElementById('pos-cust-pincode')?.value.trim() || '';
    const channel = document.getElementById('pos-channel')?.value || 'In-Store';

    const subtotal = posCart.reduce((s, i) => s + i.lineTotal, 0);
    const tax = Math.round(subtotal * 0.05);
    const shipping = parseInt(document.getElementById('pos-shipping-val')?.value, 10) || 0;
    const discount = parseInt(document.getElementById('pos-discount-val')?.value, 10) || 0;
    const grandTotal = Math.max(0, subtotal + shipping - discount);

    // 1. Deduct Inventory Stock in Real-Time
    const updatedCatalog = catalog.map(p => {
      const soldItem = posCart.find(i => i.product.id === p.id);
      if (soldItem) {
        const newStock = Math.max(0, (Number(p.stock) || 0) - soldItem.quantity);
        return { ...p, stock: newStock };
      }
      return p;
    });
    saveCatalogAndSync(updatedCatalog, null);

    // 2. Record Order
    const newOrder = {
      id: orderId,
      date: new Date().toISOString(),
      customer: {
        name: custName,
        phone: custPhone,
        address: `${custAddress}${custCity ? ', ' + custCity : ''}${custPincode ? ' - ' + custPincode : ''}`
      },
      channel,
      items: [...posCart],
      subtotal,
      tax,
      shipping,
      discount,
      total: grandTotal,
      status: 'Packed',
      reason
    };

    orders.unshift(newOrder);
    saveOrders();
    renderOrdersTable();
    renderOrdersKPIs();

    // Sync real live order to Supabase if connected
    if (window.RuhaDB && window.RuhaDB.isConfigured() && window.RuhaDB.createOrder) {
      window.RuhaDB.createOrder(newOrder, newOrder.items).catch(e => console.warn('[RuhaDB] Cloud order sync note:', e));
    }

    // 3. Populate and Open Invoice Modal
    openInvoiceModal(newOrder, isAutoBilled);

    // 4. Reset POS Cart
    posCart = [];
    if (document.getElementById('pos-cust-name')) document.getElementById('pos-cust-name').value = '';
    if (document.getElementById('pos-cust-phone')) document.getElementById('pos-cust-phone').value = '';
    if (document.getElementById('pos-cust-address')) document.getElementById('pos-cust-address').value = '';
    if (document.getElementById('pos-cust-city')) document.getElementById('pos-cust-city').value = '';
    if (document.getElementById('pos-cust-pincode')) document.getElementById('pos-cust-pincode').value = '';
    if (document.getElementById('pos-shipping-val')) document.getElementById('pos-shipping-val').value = '0';
    if (document.getElementById('pos-discount-val')) document.getElementById('pos-discount-val').value = '0';
    renderPOSCart();

    return newOrder;
  }

  document.getElementById('pos-generate-bill-btn')?.addEventListener('click', () => {
    generateAndOpenBill('Manual Generate Bill', false);
  });

  // ========================================================
  // 6. INVOICE & SHIPPING SLIP MODAL
  // ========================================================
  const invoiceModal = document.getElementById('invoice-modal');

  function openInvoiceModal(order, isAutoBilled = false) {
    if (!invoiceModal) return;

    try {
      const autobillBadge = document.getElementById('inv-autobill-badge');
      if (autobillBadge) {
        autobillBadge.style.display = isAutoBilled ? 'inline-flex' : 'none';
      }

      const orderId = order.id || 'RA-INV-1001';
      if (document.getElementById('inv-display-number')) {
        document.getElementById('inv-display-number').textContent = orderId;
      }
      if (document.getElementById('inv-display-date')) {
        const orderDate = order.date ? new Date(order.date) : new Date();
        document.getElementById('inv-display-date').textContent = orderDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }

      const chanEl = document.getElementById('inv-display-channel');
      if (chanEl) {
        chanEl.textContent = order.channel || 'Website';
        chanEl.className = `channel-badge channel-${(order.channel || 'website').toLowerCase().replace(/[^a-z]/g, '')}`;
      }

      // Customer Info
      const cust = order.customer || {};
      if (document.getElementById('inv-display-cust-name')) {
        document.getElementById('inv-display-cust-name').textContent = cust.name || 'Customer';
      }
      if (document.getElementById('inv-display-cust-phone')) {
        document.getElementById('inv-display-cust-phone').textContent = `Phone: ${cust.phone || '—'}`;
      }
      if (document.getElementById('inv-display-cust-email')) {
        document.getElementById('inv-display-cust-email').textContent = cust.email ? `Email: ${cust.email}` : '';
        document.getElementById('inv-display-cust-email').style.display = cust.email ? 'block' : 'none';
      }
      if (document.getElementById('inv-display-cust-address')) {
        document.getElementById('inv-display-cust-address').textContent = cust.address || '—';
      }

      // Payment Method & Status Logic
      const payMethodRaw = (order.payment_method || order.paymentMethod || '').toLowerCase();
      const isCOD = payMethodRaw === 'cod' || payMethodRaw.includes('cash');
      const isPaid = (order.payment_status || '').toLowerCase() === 'paid' || (order.payment_status || '').toLowerCase() === 'verified';
      const paymentModeText = isCOD ? 'Cash on Delivery (COD)' : (order.payment_method || 'Prepaid / UPI Verified');
      const paymentStatusText = isPaid ? 'Paid & Verified' : (isCOD ? 'Pending on Delivery' : (order.payment_status || 'Pending Verification'));

      const payModeEl = document.getElementById('inv-display-payment-mode');
      if (payModeEl) payModeEl.textContent = paymentModeText;

      const payStatusEl = document.getElementById('inv-display-payment-status');
      if (payStatusEl) {
        payStatusEl.textContent = paymentStatusText;
        if (isPaid) {
          payStatusEl.style.background = '#dcfce7';
          payStatusEl.style.color = '#166534';
        } else if (isCOD) {
          payStatusEl.style.background = '#fef9c3';
          payStatusEl.style.color = '#854d0e';
        } else {
          payStatusEl.style.background = '#fee2e2';
          payStatusEl.style.color = '#991b1b';
        }
      }

      // Financials & Breakdown
      const subtotal = Number(order.subtotal) || 0;
      const shipping = Number(order.shipping) || 0;
      const tax = Number(order.tax) || 0;
      const total = Number(order.total) || (subtotal + shipping + tax);

      if (document.getElementById('inv-display-total')) {
        document.getElementById('inv-display-total').textContent = `₹${total.toLocaleString('en-IN')}`;
      }
      if (document.getElementById('inv-summary-total-label')) {
        document.getElementById('inv-summary-total-label').textContent = isCOD ? 'Amount to Collect (COD):' : 'Grand Total Paid:';
      }
      if (document.getElementById('inv-subtotal-text')) {
        document.getElementById('inv-subtotal-text').textContent = `₹${subtotal.toLocaleString('en-IN')}`;
      }
      if (document.getElementById('inv-shipping-text')) {
        document.getElementById('inv-shipping-text').textContent = shipping > 0 ? `₹${shipping.toLocaleString('en-IN')}` : 'FREE';
      }
      if (document.getElementById('inv-tax-text')) {
        document.getElementById('inv-tax-text').textContent = tax > 0 ? `₹${tax.toLocaleString('en-IN')}` : '₹0 (Included)';
      }
      if (document.getElementById('inv-grand-total-label')) {
        document.getElementById('inv-grand-total-label').textContent = isCOD ? 'Amount Payable (COD):' : 'Amount Paid:';
      }
      if (document.getElementById('inv-grand-total-text')) {
        document.getElementById('inv-grand-total-text').textContent = `₹${total.toLocaleString('en-IN')}`;
      }

      // Itemized Table Rows
      const tbody = document.getElementById('inv-display-tbody');
      const items = Array.isArray(order.items) ? order.items : [];
      if (tbody) {
        tbody.innerHTML = items.map((item, i) => {
          const prodName = item.product?.name || item.name || 'Product';
          const prodCat = item.product?.category || item.category || 'Accessories';
          const prodSku = (item.product?.sku || item.sku || item.product?.id || `RA-SKU-${i+1}`).toUpperCase();
          const prodPrice = Number(item.product?.price || item.price) || 0;
          const qty = Number(item.quantity) || 1;
          const lineTotal = Number(item.lineTotal) || (prodPrice * qty);
          const optStr = item.option ? ` <span style="font-size:0.75rem; color:#666;">(${item.option})</span>` : '';
          return `
            <tr>
              <td style="color:#777;">${i + 1}</td>
              <td><strong>${prodName}</strong>${optStr} <span style="color:#777; font-size:0.8rem;">(${prodCat})</span></td>
              <td style="font-family:monospace; font-weight:700; color:#333;">${prodSku}</td>
              <td style="text-align:right;">₹${prodPrice.toLocaleString('en-IN')}</td>
              <td style="text-align:center;">${qty}</td>
              <td style="text-align:right; font-weight:700;">₹${lineTotal.toLocaleString('en-IN')}</td>
            </tr>
          `;
        }).join('');
      }

      // Integrated Courier Dispatch Slip Details
      if (document.getElementById('dispatch-barcode-text')) {
        document.getElementById('dispatch-barcode-text').textContent = orderId;
      }
      if (document.getElementById('dispatch-cust-name')) {
        document.getElementById('dispatch-cust-name').textContent = cust.name || 'Customer';
      }
      if (document.getElementById('dispatch-cust-address')) {
        document.getElementById('dispatch-cust-address').textContent = cust.address || '—';
      }
      if (document.getElementById('dispatch-cust-phone')) {
        document.getElementById('dispatch-cust-phone').textContent = `Phone: ${cust.phone || '—'}`;
      }

      const dispatchBadge = document.getElementById('dispatch-payment-badge');
      if (dispatchBadge) {
        if (isCOD) {
          dispatchBadge.textContent = `📦 COD: Collect ₹${total.toLocaleString('en-IN')} at Delivery`;
          dispatchBadge.style.background = '#fef9c3';
          dispatchBadge.style.color = '#854d0e';
          dispatchBadge.style.border = '1px solid #fde047';
        } else {
          dispatchBadge.textContent = `✅ PREPAID: Do Not Collect Cash`;
          dispatchBadge.style.background = '#dcfce7';
          dispatchBadge.style.color = '#166534';
          dispatchBadge.style.border = '1px solid #86efac';
        }
      }

      // Render Order Barcode for Dispatch Scan
      const barcodeContainer = document.getElementById('dispatch-barcode-svg-container');
      if (barcodeContainer) {
        barcodeContainer.innerHTML = generateCode128SVG(orderId, 65, 2.2, true);
      }

      // Customer WhatsApp Share Link
      const waBtn = document.getElementById('inv-whatsapp-btn');
      if (waBtn) {
        const rawPhone = String(cust.phone || '').replace(/[^0-9]/g, '');
        const cleanPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : '';
        if (cleanPhone) {
          const itemsSummary = items.map(it => {
            const pName = it.product?.name || it.name || 'Item';
            const q = it.quantity || 1;
            const p = it.lineTotal || ((it.product?.price || it.price || 0) * q);
            return `• ${pName} (×${q}) - ₹${p}`;
          }).join('\n');

          const waMsg = encodeURIComponent(
            `Hello ${cust.name || 'Customer'},\n\nThank you for shopping with *Ruha Aura*! ✨\nHere is your Tax Invoice & Dispatch confirmation for order *#${orderId}*:\n\n*Ordered Items:*\n${itemsSummary}\n\n*Subtotal:* ₹${subtotal}\n*Shipping:* ${shipping > 0 ? '₹' + shipping : 'FREE'}\n*Grand Total:* ₹${total}\n*Payment Mode:* ${paymentModeText}\n*Status:* ${paymentStatusText}\n\n*Shipping Address:*\n${cust.address || '—'}\n\nWe are carefully packing your handcrafted order with care. If you have any questions, feel free to reply to this message!\n\nWarm regards,\n*Ruha Aura Handcrafted*\nEmail: ruhaaura.store@gmail.com\nWhatsApp: +91 82204 31210`
          );
          waBtn.href = `https://wa.me/91${cleanPhone}?text=${waMsg}`;
          waBtn.style.display = 'inline-flex';
        } else {
          waBtn.style.display = 'none';
        }
      }

      // Inline Customer Edit Form handlers
      const editBox = document.getElementById('inv-cust-edit-form');
      const toggleBtn = document.getElementById('inv-edit-cust-toggle-btn');
      const cancelBtn = document.getElementById('inv-edit-cancel-btn');
      const saveBtn = document.getElementById('inv-edit-save-btn');
      const nameInput = document.getElementById('inv-edit-input-name');
      const phoneInput = document.getElementById('inv-edit-input-phone');
      const emailInput = document.getElementById('inv-edit-input-email');
      const addressInput = document.getElementById('inv-edit-input-address');

      if (editBox) editBox.style.display = 'none';

      if (toggleBtn && editBox) {
        toggleBtn.onclick = () => {
          const isHidden = editBox.style.display === 'none';
          if (isHidden) {
            editBox.style.display = 'block';
            if (nameInput) nameInput.value = cust.name || '';
            if (phoneInput) phoneInput.value = cust.phone || '7708542509';
            if (emailInput) emailInput.value = cust.email || '';
            if (addressInput) addressInput.value = cust.address || '';
            nameInput?.focus();
          } else {
            editBox.style.display = 'none';
          }
        };
      }

      if (cancelBtn && editBox) {
        cancelBtn.onclick = () => {
          editBox.style.display = 'none';
        };
      }

      if (saveBtn && editBox) {
        saveBtn.onclick = async () => {
          const newName = (nameInput?.value || '').trim() || 'Customer';
          const newPhone = (phoneInput?.value || '').trim();
          const newEmail = (emailInput?.value || '').trim();
          const newAddress = (addressInput?.value || '').trim();

          order.customer = {
            ...order.customer,
            name: newName,
            phone: newPhone,
            email: newEmail,
            address: newAddress
          };

          // Update local orders
          const ordIdx = orders.findIndex(o => o.id === order.id);
          if (ordIdx >= 0) orders[ordIdx] = order;
          saveOrders();

          // Sync order to Supabase Cloud
          if (window.RuhaDB && window.RuhaDB.createOrder) {
            window.RuhaDB.createOrder(order, order.items).catch(() => {});
          }

          // Update or insert into customers directory
          let custTarget = customers.find(c => (newEmail && c.email && c.email.toLowerCase() === newEmail.toLowerCase()) || (newPhone && c.phone && c.phone === newPhone));
          if (custTarget) {
            custTarget.name = newName;
            custTarget.phone = newPhone;
            custTarget.email = newEmail;
            if (newAddress) custTarget.address = newAddress;
          } else {
            custTarget = {
              id: 'CUST-' + Math.floor(100000 + Math.random() * 900000),
              name: newName,
              email: newEmail,
              phone: newPhone,
              address: newAddress,
              role: 'customer',
              orders_count: 1,
              total_spent: order.total || 0,
              joined_date: order.date || new Date().toISOString(),
              last_active: new Date().toISOString()
            };
            customers.unshift(custTarget);
          }
          saveCustomers();

          // Sync customer to Supabase Cloud
          if (window.RuhaDB && window.RuhaDB.saveCustomer) {
            window.RuhaDB.saveCustomer(custTarget).catch(() => {});
          }

          showToast('Customer information updated and synced to Supabase Cloud!');
          openInvoiceModal(order, isAutoBilled);
        };
      }
    } catch (err) {
      console.error('Invoice modal population note:', err);
    }

    invoiceModal.classList.add('is-open');
  }

  function closeInvoiceModalAndFocus() {
    invoiceModal?.classList.remove('is-open');
    const scanInput = document.getElementById('pos-barcode-input');
    setTimeout(() => scanInput?.focus(), 150);
  }

  document.getElementById('invoice-modal-close-btn')?.addEventListener('click', closeInvoiceModalAndFocus);
  document.getElementById('invoice-modal-cancel-btn')?.addEventListener('click', closeInvoiceModalAndFocus);

  document.getElementById('invoice-print-btn')?.addEventListener('click', () => {
    document.body.classList.add('printing-invoice');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-invoice');
    }, 500);
  });

  // Print & Scan Next Item button
  document.getElementById('invoice-print-next-btn')?.addEventListener('click', () => {
    document.body.classList.add('printing-invoice');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-invoice');
      closeInvoiceModalAndFocus();
      showToast('🖨️ Bill printed. Scanner ready for next product scan.');
    }, 500);
  });

  // Escape key closes modal and refocuses scanner
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && invoiceModal?.classList.contains('is-open')) {
      closeInvoiceModalAndFocus();
    }
  });

  // ========================================================
  // 7. BARCODE LABELS & STICKER STATION
  // ========================================================
  const labelProductSelect = document.getElementById('label-product-select');
  const labelCopiesInput = document.getElementById('label-copies-input');
  const labelFormatSelect = document.getElementById('label-format-select');
  const labelGridContainer = document.getElementById('label-grid-container');

  function populateLabelSelect() {
    if (!labelProductSelect) return;
    labelProductSelect.innerHTML = `<option value="all">★ All Products in Catalogue</option>` +
      catalog.map(p => `<option value="${p.id}">${p.name} (${(p.sku || p.id).toUpperCase()}) - ₹${p.price}</option>`).join('');
  }

  function renderBarcodeLabels() {
    if (!labelGridContainer) return;

    const selectedId = labelProductSelect?.value || 'all';
    const copies = Math.max(1, parseInt(labelCopiesInput?.value, 10) || 1);
    const format = labelFormatSelect?.value || 'a4-24';

    labelGridContainer.className = `label-grid label-grid-${format}`;

    let targetProducts = [];
    if (selectedId === 'all') {
      targetProducts = catalog;
    } else {
      const prod = catalog.find(p => p.id === selectedId);
      if (prod) targetProducts = [prod];
    }

    if (!targetProducts.length) {
      labelGridContainer.innerHTML = '<p style="text-align:center; padding:30px; color:#999;">No products selected.</p>';
      return;
    }

    let stickerList = [];
    targetProducts.forEach(prod => {
      for (let c = 0; c < copies; c++) {
        stickerList.push(prod);
      }
    });

    labelGridContainer.innerHTML = stickerList.map(p => {
      const sku = (p.sku || p.id).toUpperCase();
      const barcodeSVG = generateCode128SVG(sku, 65, 2.2, true);

      return `
        <div class="label-sticker-item">
          <span class="label-brand-name">RUHA AURA</span>
          <div class="label-product-name" title="${p.name}">${p.name}</div>
          <span class="label-price-tag">MRP: ₹${p.price} <small style="font-size:0.7rem;font-weight:normal;color:#666;">(Incl. taxes)</small></span>
          <div class="label-barcode-svg">
            ${barcodeSVG}
          </div>
        </div>
      `;
    }).join('');
  }

  labelProductSelect?.addEventListener('change', renderBarcodeLabels);
  labelCopiesInput?.addEventListener('input', renderBarcodeLabels);
  labelFormatSelect?.addEventListener('change', renderBarcodeLabels);

  document.getElementById('print-labels-btn')?.addEventListener('click', () => {
    document.body.classList.add('printing-labels');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-labels');
    }, 500);
  });

  // ========================================================
  // 8. MULTI-CHANNEL SALES HUB
  // ========================================================
  function isDummyOrder(o) {
    if (!o || typeof o !== 'object') return true;
    const id = String(o.id || '');
    return /^RA-ORD-88\d+/.test(id) || /^RA-ORD-87\d+/.test(id) || /^RA-ORD-89\d+/.test(id) || /^RA-ORD-90\d+/.test(id);
  }

  function getAuthenticCustomer() {
    let authCust = null;
    try {
      const auth = localStorage.getItem('ruha-aura-auth');
      if (auth) {
        const u = JSON.parse(auth);
        if (u && u.email && u.role !== 'admin') {
          authCust = {
            name: u.name || (u.email ? u.email.split('@')[0] : 'Customer'),
            email: u.email,
            phone: u.phone || '7708542509',
            address: u.address || 'Delivery on Call (Cash on Delivery)'
          };
        }
      }
    } catch {}

    if (!authCust) {
      try {
        const stored = localStorage.getItem('ruha-aura-customers');
        if (stored) {
          const list = JSON.parse(stored);
          if (Array.isArray(list)) {
            const found = list.find(c => c && c.role !== 'admin' && c.name !== 'Ruha Aura Customer' && c.email !== 'ruhaaura.store@gmail.com');
            if (found) {
              authCust = {
                name: found.name || 'Customer',
                email: found.email || '',
                phone: found.phone || '7708542509',
                address: found.address || 'Delivery on Call (Cash on Delivery)'
              };
            }
          }
        }
      } catch {}
    }

    if (!authCust) {
      authCust = {
        name: 'Customer',
        email: '',
        phone: '7708542509',
        address: 'Delivery on Call (Cash on Delivery)'
      };
    }
    return authCust;
  }

  function sanitizeOrderCustomer(o) {
    if (!o || typeof o !== 'object') return;
    if (!o.customer) o.customer = {};
    const name = (o.customer.name || '').trim();
    const email = (o.customer.email || '').trim().toLowerCase();
    const phone = String(o.customer.phone || '').trim();

    // If order has the placeholder fallback credentials, upgrade to authentic customer
    if (name === 'Ruha Aura Customer' || email === 'ruhaaura.store@gmail.com' || phone === '8220431210' || !phone) {
      const auth = getAuthenticCustomer();
      if (name === 'Ruha Aura Customer' || !name) {
        o.customer.name = auth.name !== 'Customer' ? auth.name : (o.customer.name || 'Customer');
      }
      if (email === 'ruhaaura.store@gmail.com' || !email) {
        o.customer.email = auth.email || '';
      }
      if (phone === '8220431210' || !phone) {
        o.customer.phone = auth.phone || '7708542509';
      }
    }
  }

  function getOrders() {
    try {
      const stored = localStorage.getItem('ruha-aura-orders');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter(o => !isDummyOrder(o));
          if (clean.length > 0) {
            clean.forEach(sanitizeOrderCustomer);
            localStorage.setItem('ruha-aura-orders', JSON.stringify(clean));
            return clean;
          }
        }
      }
    } catch {}

    return [];
  }

  function saveOrders() {
    try {
      localStorage.setItem('ruha-aura-orders', JSON.stringify(orders));
    } catch {}
    renderOrdersTable();
    renderOrdersKPIs();
    renderAnalyticsDashboard();
    renderOverviewRecentOrders();
  }

  function renderOrdersKPIs() {
    const total = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const instaTotal = orders.filter(o => (o.channel || '').toLowerCase().includes('insta') || (o.channel || '').toLowerCase().includes('whats'))
                             .reduce((s, o) => s + (Number(o.total) || 0), 0);
    const meeshoTotal = orders.filter(o => (o.channel || '').toLowerCase().includes('meesho'))
                              .reduce((s, o) => s + (Number(o.total) || 0), 0);
    const marketTotal = orders.filter(o => (o.channel || '').toLowerCase().includes('amazon') || (o.channel || '').toLowerCase().includes('website'))
                              .reduce((s, o) => s + (Number(o.total) || 0), 0);

    const elTotal = document.getElementById('stat-channel-total');
    const elCount = document.getElementById('stat-order-count');
    const elInsta = document.getElementById('stat-channel-insta');
    const elMeesho = document.getElementById('stat-channel-meesho');
    const elMarket = document.getElementById('stat-channel-marketplaces');
    const badgeCount = document.getElementById('orders-count-badge');

    if (elTotal) elTotal.textContent = formatPrice(total);
    if (elCount) elCount.textContent = `${orders.length} ${orders.length === 1 ? 'recorded order' : 'recorded orders'}`;
    if (elInsta) elInsta.textContent = formatPrice(instaTotal);
    if (elMeesho) elMeesho.textContent = formatPrice(meeshoTotal);
    if (elMarket) elMarket.textContent = formatPrice(marketTotal);
    if (badgeCount) {
      badgeCount.textContent = orders.length;
      badgeCount.style.display = orders.length > 0 ? 'inline-flex' : 'none';
    }
  }

  function renderOrdersTable() {
    const tbody = document.getElementById('admin-orders-tbody');
    if (!tbody) return;

    if (!orders.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:54px 20px; color:var(--admin-muted);">
            <div style="max-width:420px; margin:0 auto;">
              <div style="width:48px; height:48px; border-radius:50%; background:rgba(74,21,37,0.06); display:flex; align-items:center; justify-content:center; margin:0 auto 14px; color:var(--admin-plum);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg>
              </div>
              <h4 style="font-family:'Playfair Display', serif; font-size:1.15rem; color:var(--admin-plum); margin:0 0 6px;">No Sales Recorded Yet</h4>
              <p style="font-size:0.84rem; line-height:1.5; color:var(--admin-muted); margin:0 0 16px;">
                All dummy mock data has been removed. Original sales will appear here as orders are placed via POS, Online Storefront, or Marketplace channels.
              </p>
              <button type="button" class="btn-admin btn-admin-plum" id="empty-state-record-sale-btn" style="padding:8px 18px; font-size:0.85rem; margin:0 auto;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Record First Sale
              </button>
            </div>
          </td>
        </tr>
      `;
      document.getElementById('empty-state-record-sale-btn')?.addEventListener('click', () => {
        document.getElementById('record-sale-shortcut')?.click();
      });
      return;
    }

    const channelFilter = document.getElementById('filter-order-channel')?.value || 'all';
    const statusFilter = document.getElementById('filter-order-status')?.value || 'all';
    const q = (document.getElementById('order-search')?.value || '').toLowerCase().trim();

    const filtered = orders.filter(o => {
      if (channelFilter !== 'all' && (o.channel || '').toLowerCase() !== channelFilter.toLowerCase()) return false;
      if (statusFilter !== 'all' && (o.status || 'Pending').toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (q) {
        const text = `${o.id} ${o.customer?.name || ''} ${o.customer?.phone || ''} ${o.channel || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });

    const countPill = document.getElementById('orders-filter-count');
    if (countPill) {
      countPill.textContent = `${filtered.length} of ${orders.length} orders`;
    }

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:50px 20px; color:var(--admin-muted);">
            <div style="font-size:1rem; font-weight:600; margin-bottom:4px; color:var(--admin-plum);">No matching orders found</div>
            <div style="font-size:0.82rem;">Try adjusting your search terms or clearing channel/status filters.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(o => {
      let chanClass = 'channel-direct';
      const c = (o.channel || '').toLowerCase();
      if (c.includes('insta')) chanClass = 'channel-instagram';
      else if (c.includes('web')) chanClass = 'channel-website';
      else if (c.includes('meesho')) chanClass = 'channel-meesho';
      else if (c.includes('amazon')) chanClass = 'channel-amazon';
      else if (c.includes('whats')) chanClass = 'channel-whatsapp';

      const itemsArr = Array.isArray(o.items) ? o.items : [];
      const cleanPhone = (o.customer?.phone || '').replace(/[^0-9]/g, '');

      return `
        <tr>
          <td>
            <strong class="order-id-code" style="display:block;">${o.id}</strong>
            <span style="font-size:0.75rem; color:var(--admin-muted); display:block; margin-top:3px;">
              ${new Date(o.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
            </span>
          </td>
          <td>
            <span class="channel-badge ${chanClass}">${o.channel || 'Website'}</span>
          </td>
          <td>
            <strong style="display:block; color:#221b19; font-size:0.86rem;">${o.customer?.name || 'Customer'}</strong>
            <div style="display:flex; align-items:center; gap:8px; margin-top:3px;">
              <span style="font-size:0.78rem; color:var(--admin-muted);">${o.customer?.phone || '—'}</span>
              ${cleanPhone.length >= 10 ? `
                <a href="https://wa.me/91${cleanPhone.slice(-10)}" target="_blank" class="order-wa-link" title="Chat on WhatsApp with ${o.customer?.name || 'Customer'}">
                  💬 Chat
                </a>
              ` : ''}
            </div>
          </td>
          <td style="max-width:260px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
              ${itemsArr.slice(0, 2).map(i => `
                <div style="font-size:0.82rem; font-weight:600; color:#332826; line-height:1.3;">
                  ${i.product?.name || i.name || 'Product'}
                  <span style="font-size:0.72rem; font-weight:700; color:var(--admin-plum); background:rgba(74,21,37,0.06); padding:1px 6px; border-radius:4px; margin-left:4px;">×${i.quantity || 1}</span>
                </div>
              `).join('')}
              ${itemsArr.length > 2 ? `
                <span style="font-size:0.72rem; color:var(--admin-muted);">+ ${itemsArr.length - 2} more item(s)</span>
              ` : ''}
            </div>
          </td>
          <td>
            <div style="font-weight:700; font-size:1.02rem; color:var(--admin-plum);">${formatPrice(o.total || 0)}</div>
            <span style="display:block; font-size:0.72rem; color:#8c7e7b; margin-top:2px;">
              ${o.payment_method === 'cod' ? 'Cash on Delivery' : (o.payment_method === 'upi' ? 'Direct UPI' : 'WhatsApp / UPI')}
            </span>
          </td>
          <td>
            <button type="button" class="status-badge status-${(o.status || 'pending').toLowerCase()}" data-order-action="status" data-id="${o.id}" title="Click to cycle status: Pending → Packed → Shipped → Delivered">
              ● ${o.status || 'Pending'}
            </button>
          </td>
          <td>
            <div class="row-actions" style="display:flex; justify-content:flex-end;">
              <button type="button" class="row-btn" data-order-action="view" data-id="${o.id}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                Bill &amp; Slip
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Order row action delegation
  document.getElementById('admin-orders-tbody')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-order-action]');
    if (!btn) return;
    const action = btn.dataset.orderAction;
    const id = btn.dataset.id;
    const ord = orders.find(o => o.id === id);
    if (!ord) return;

    if (action === 'view') {
      openInvoiceModal(ord);
    } else if (action === 'status') {
      const orderStatuses = ['Pending', 'Packed', 'Shipped', 'Delivered'];
      const curIdx = orderStatuses.indexOf(ord.status || 'Pending');
      const nextStatus = orderStatuses[(curIdx + 1) % orderStatuses.length];
      ord.status = nextStatus;
      saveOrders();
      showToast(`Order ${ord.id} status updated to ${nextStatus}.`);
    }
  });

  document.getElementById('order-search')?.addEventListener('input', renderOrdersTable);
  document.getElementById('filter-order-channel')?.addEventListener('change', renderOrdersTable);
  document.getElementById('filter-order-status')?.addEventListener('change', renderOrdersTable);

  // Clear all dummy/recorded orders button
  document.getElementById('clear-orders-btn')?.addEventListener('click', async () => {
    if (confirm('Clear all recorded sales?\n\nThis will remove all orders and reset revenue to ₹0 so you start completely clean with original live data.')) {
      orders = [];
      saveOrders();
      if (window.RuhaDB && window.RuhaDB.isConfigured()) {
        try {
          await window.RuhaDB.purgeDummyOrders();
        } catch (e) {
          console.warn(e);
        }
      }
      showToast('All sales records cleared. Multi-Channel Hub is clean and ready for original live data.');
    }
  });

  // Sync live orders from Supabase button
  document.getElementById('sync-orders-cloud-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('sync-orders-cloud-btn');
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Syncing...';
    try {
      if (window.RuhaDB && window.RuhaDB.isConfigured() && window.RuhaDB.getOrders) {
        const cloudOrders = await window.RuhaDB.getOrders();
        if (Array.isArray(cloudOrders) && cloudOrders.length > 0) {
          orders = cloudOrders;
          saveOrders();
          showToast(`Synced ${cloudOrders.length} order(s) from Supabase Cloud.`);
        } else {
          orders = getOrders();
          saveOrders();
          showToast('Loaded active orders from storage.');
        }
      } else {
        orders = getOrders();
        saveOrders();
        showToast('Orders refreshed from local storage.');
      }
    } catch (e) {
      showToast('Sync note: ' + (e.message || 'Failed to sync orders.'));
    } finally {
      btn.disabled = false;
      btn.innerHTML = oldText;
    }
  });

  // ========================================================
  // CUSTOMERS & REGISTERED USERS DIRECTORY SYSTEM
  // ========================================================
  function getCustomers() {
    try {
      const stored = localStorage.getItem('ruha-aura-customers');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter(c => c && c.name !== 'Ruha Aura Customer' && c.email !== 'ruhaaura.store@gmail.com');
          if (clean.length > 0) {
            localStorage.setItem('ruha-aura-customers', JSON.stringify(clean));
            return clean;
          }
        }
      }
    } catch {}

    // Check if authentic customer account is currently logged in locally
    try {
      const auth = localStorage.getItem('ruha-aura-auth');
      if (auth) {
        const u = JSON.parse(auth);
        if (u && u.email && u.role !== 'admin') {
          const activeUser = [{
            id: u.id || ('CUST-' + Math.floor(100000 + Math.random() * 900000)),
            name: u.name || u.email.split('@')[0],
            email: u.email,
            phone: u.phone || '',
            address: u.address || '',
            role: 'customer',
            orders_count: 0,
            total_spent: 0,
            joined_date: new Date().toISOString(),
            last_active: new Date().toISOString()
          }];
          localStorage.setItem('ruha-aura-customers', JSON.stringify(activeUser));
          return activeUser;
        }
      }
    } catch {}

    return [];
  }

  function saveCustomers() {
    try {
      localStorage.setItem('ruha-aura-customers', JSON.stringify(customers));
    } catch {}
    renderCustomersTable();
    renderCustomersKPIs();
  }

  function renderCustomersKPIs() {
    const totalCust = customers.length;
    const totalLTV = customers.reduce((sum, c) => sum + (Number(c.total_spent) || 0), 0);
    const totalOrders = customers.reduce((sum, c) => sum + (Number(c.orders_count) || 0), 0);
    const aov = totalOrders > 0 ? Math.round(totalLTV / totalOrders) : 0;

    const elCount = document.getElementById('stat-cust-count');
    const elLtv = document.getElementById('stat-cust-ltv');
    const elOrders = document.getElementById('stat-cust-orders');
    const elAov = document.getElementById('stat-cust-aov');
    const badge = document.getElementById('customers-count-badge');

    if (elCount) elCount.textContent = totalCust;
    if (elLtv) elLtv.textContent = formatPrice(totalLTV);
    if (elOrders) elOrders.textContent = totalOrders;
    if (elAov) elAov.textContent = formatPrice(aov);
    if (badge) {
      badge.textContent = totalCust;
      badge.style.display = totalCust > 0 ? 'inline-flex' : 'none';
    }
  }

  function renderCustomersTable() {
    const tbody = document.getElementById('admin-customers-tbody');
    if (!tbody) return;

    if (!customers.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:48px 20px; color:var(--admin-muted);">
            <div style="font-size:1.05rem; font-weight:700; color:var(--admin-plum); margin-bottom:6px;">No Registered Customers Yet</div>
            <div style="font-size:0.85rem;">As users register or check out on the storefront, their profiles and order summaries will appear here.</div>
          </td>
        </tr>
      `;
      return;
    }

    const q = (document.getElementById('customer-search')?.value || '').toLowerCase().trim();
    const filtered = customers.filter(c => {
      if (!q) return true;
      const str = `${c.name || ''} ${c.email || ''} ${c.phone || ''} ${c.address || ''}`.toLowerCase();
      return str.includes(q);
    });

    const countLabel = document.getElementById('customers-filter-count');
    if (countLabel) {
      countLabel.textContent = `Showing ${filtered.length} of ${customers.length} registered customer(s)`;
    }

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:36px 20px; color:var(--admin-muted);">
            No matching customers found for "${q}".
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(c => {
      const cleanPhone = String(c.phone || '').replace(/[^0-9]/g, '');
      const initials = (c.name || 'C').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'CU';
      const formattedDate = c.joined_date ? new Date(c.joined_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : 'Recent';

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:36px; height:36px; border-radius:50%; background:rgba(74,21,37,0.08); color:var(--admin-plum); font-weight:700; font-size:0.82rem; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                ${initials}
              </div>
              <div>
                <strong style="display:block; color:#221b19; font-size:0.88rem;">${c.name || 'Member'}</strong>
                <span style="font-size:0.75rem; color:var(--admin-muted);">${c.role === 'admin' ? 'Store Administrator' : 'Verified Customer'}</span>
              </div>
            </div>
          </td>
          <td>
            <div style="font-size:0.85rem; color:#333; font-weight:600;">${c.email || '—'}</div>
            <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
              <span style="font-size:0.78rem; color:var(--admin-muted);">${c.phone || '—'}</span>
              ${cleanPhone.length >= 10 ? `
                <a href="https://wa.me/91${cleanPhone.slice(-10)}" target="_blank" class="order-wa-link" title="Chat with ${c.name} on WhatsApp" style="font-size:0.75rem; padding:1px 6px;">
                  💬 WA
                </a>
              ` : ''}
            </div>
          </td>
          <td style="font-size:0.82rem; color:#444; max-width:200px; line-height:1.4;">
            ${c.address || '—'}
          </td>
          <td style="text-align:center;">
            <span style="display:inline-block; font-weight:700; background:rgba(74,21,37,0.06); color:var(--admin-plum); padding:2px 8px; border-radius:12px; font-size:0.82rem;">
              ${c.orders_count || 0}
            </span>
          </td>
          <td style="text-align:right; font-weight:700; color:var(--admin-plum); font-size:0.92rem;">
            ${formatPrice(c.total_spent || 0)}
          </td>
          <td style="font-size:0.8rem; color:var(--admin-muted);">
            ${formattedDate}
          </td>
          <td style="text-align:right;">
            <div style="display:flex; justify-content:flex-end; gap:6px;">
              <button type="button" class="row-btn" data-cust-edit-id="${c.id}" title="Edit customer details">
                ✏️ Edit
              </button>
              <button type="button" class="row-btn" data-cust-view-orders="${c.email || c.phone || ''}" title="Filter Multi-Channel Hub to this customer's orders">
                View Orders
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-cust-edit-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.custEditId;
        const cust = customers.find(x => x.id === id);
        if (!cust) return;

        const modal = document.getElementById('customer-edit-modal');
        if (!modal) return;

        document.getElementById('cust-modal-id').value = cust.id;
        document.getElementById('cust-modal-name').value = cust.name || '';
        document.getElementById('cust-modal-email').value = cust.email || '';
        document.getElementById('cust-modal-phone').value = cust.phone || '7708542509';
        document.getElementById('cust-modal-address').value = cust.address || '';

        modal.style.display = 'flex';
      });
    });

    tbody.querySelectorAll('[data-cust-view-orders]').forEach(btn => {
      btn.addEventListener('click', () => {
        const query = btn.dataset.custViewOrders;
        document.getElementById('tab-multichannel-btn')?.click();
        const searchInput = document.getElementById('order-search');
        if (searchInput) {
          searchInput.value = query;
          renderOrdersTable();
        }
      });
    });
  }

  // Customer Edit Modal listeners
  const custModal = document.getElementById('customer-edit-modal');
  const closeCustModal = () => { if (custModal) custModal.style.display = 'none'; };
  document.getElementById('customer-edit-close-btn')?.addEventListener('click', closeCustModal);
  document.getElementById('customer-edit-cancel-btn')?.addEventListener('click', closeCustModal);
  custModal?.addEventListener('click', e => {
    if (e.target === custModal) closeCustModal();
  });

  document.getElementById('customer-edit-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('cust-modal-id')?.value;
    const name = document.getElementById('cust-modal-name')?.value.trim() || 'Customer';
    const email = document.getElementById('cust-modal-email')?.value.trim();
    const phone = document.getElementById('cust-modal-phone')?.value.trim() || '7708542509';
    const address = document.getElementById('cust-modal-address')?.value.trim();

    const cust = customers.find(x => x.id === id);
    if (!cust) return;

    const oldPhone = cust.phone;
    const oldEmail = cust.email;

    cust.name = name;
    cust.email = email;
    cust.phone = phone;
    cust.address = address;

    saveCustomers();

    if (window.RuhaDB && window.RuhaDB.saveCustomer) {
      await window.RuhaDB.saveCustomer(cust);
    }

    // Also update any orders associated with this customer
    let ordersUpdated = false;
    orders.forEach(o => {
      if (
        (oldEmail && o.customer?.email && o.customer.email.toLowerCase() === oldEmail.toLowerCase()) ||
        (oldPhone && o.customer?.phone && o.customer.phone === oldPhone) ||
        o.customer?.name === 'Ruha Aura Customer'
      ) {
        o.customer.name = name;
        o.customer.email = email;
        o.customer.phone = phone;
        if (address) o.customer.address = address;
        ordersUpdated = true;
        if (window.RuhaDB && window.RuhaDB.createOrder) {
          window.RuhaDB.createOrder(o, o.items).catch(() => {});
        }
      }
    });

    if (ordersUpdated) {
      saveOrders();
    }

    closeCustModal();
    showToast('Customer profile & matching orders updated and synced to cloud!');
  });

  // Customer search filter listener
  document.getElementById('customer-search')?.addEventListener('input', () => {
    renderCustomersTable();
  });

  // Customer cloud sync button
  document.getElementById('sync-customers-cloud-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('sync-customers-cloud-btn');
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Syncing...';
    try {
      if (window.RuhaDB && window.RuhaDB.isConfigured() && window.RuhaDB.getCustomers) {
        const cloudCusts = await window.RuhaDB.getCustomers();
        if (Array.isArray(cloudCusts) && cloudCusts.length > 0) {
          customers = cloudCusts;
          saveCustomers();
          showToast(`Synced ${cloudCusts.length} customer(s) from Supabase Cloud.`);
        } else {
          customers = getCustomers();
          saveCustomers();
          showToast('Loaded active customers from storage.');
        }
      } else {
        customers = getCustomers();
        saveCustomers();
        showToast('Customers refreshed from local storage.');
      }
    } catch (e) {
      showToast('Customer sync note: ' + (e.message || 'Failed to sync.'));
    } finally {
      btn.disabled = false;
      btn.innerHTML = oldText;
    }
  });

  // Import Marketplace CSV modal / prompt
  document.getElementById('import-marketplace-csv-btn')?.addEventListener('click', () => {
    const sample = `OrderID,Date,Channel,CustomerName,Phone,Address,SKU,Quantity,TotalAmount
MEESHO-10928,2026-10-28,Meesho,Deepa Rao,9812345678,"Indiranagar, Bangalore",RA-001,1,299
AMZN-402-9921,2026-10-28,Amazon,Rahul Jain,9876543210,"Civil Lines, Jaipur",RA-002,2,558`;

    const choice = confirm('Import Marketplace Orders:\n\nClick OK to download a Sample CSV Template, or Cancel to import your own file.');
    if (choice) {
      const blob = new Blob([sample], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ruha-aura-marketplace-orders-sample.csv';
      link.click();
      URL.revokeObjectURL(url);
      showToast('Sample template downloaded!');
    }
  });

  // Sign out
  document.getElementById('admin-signout-btn')?.addEventListener('click', () => {
    if (window.RuhaShop && window.RuhaShop.setAuthUser) {
      window.RuhaShop.setAuthUser(null);
    } else {
      localStorage.removeItem('ruha-aura-auth');
    }
    window.location.href = 'index.html';
  });

  // ========================================================
  // 12. ADMIN GATEKEEPER & INITIALIZATION
  // ========================================================
  const gatekeeperModal = document.getElementById('admin-gatekeeper-modal');
  const gatekeeperForm = document.getElementById('admin-gatekeeper-form');
  const gatekeeperPass = document.getElementById('gatekeeper-password');
  const gatekeeperErr = document.getElementById('gatekeeper-error');
  const gatekeeperQuickBtn = document.getElementById('gatekeeper-quick-btn');

  function checkAdminAccess() {
    let auth = null;
    try {
      const saved = localStorage.getItem('ruha-aura-auth');
      if (saved) auth = JSON.parse(saved);
    } catch {}

    if (auth && auth.role === 'admin') {
      if (gatekeeperModal) gatekeeperModal.style.display = 'none';
      return true;
    }

    if (gatekeeperModal) {
      gatekeeperModal.style.display = 'flex';
      setTimeout(() => gatekeeperPass?.focus(), 150);
    }
    return false;
  }

  function unlockAdmin(pass) {
    if (pass === 'admin123' || pass === 'admin') {
      const user = { name: 'Admin', role: 'admin', email: 'admin@ruhaaura.com' };
      if (window.RuhaShop && window.RuhaShop.setAuthUser) {
        window.RuhaShop.setAuthUser(user);
      } else {
        localStorage.setItem('ruha-aura-auth', JSON.stringify(user));
      }
      if (gatekeeperModal) gatekeeperModal.style.display = 'none';
      initDashboard();
      showToast('Welcome back, Admin! Dashboard unlocked.');
      return true;
    } else {
      if (gatekeeperErr) gatekeeperErr.style.display = 'block';
      if (gatekeeperPass) {
        gatekeeperPass.value = '';
        gatekeeperPass.focus();
      }
      return false;
    }
  }

  gatekeeperForm?.addEventListener('submit', e => {
    e.preventDefault();
    unlockAdmin(gatekeeperPass?.value.trim());
  });

  gatekeeperQuickBtn?.addEventListener('click', () => {
    unlockAdmin('admin123');
  });

  // ========================================================
  // 13. CLOUD DATABASE (SUPABASE) SETTINGS & SYNC
  // ========================================================
  const dbStatusBtn = document.getElementById('db-status-btn');
  const dbStatusDot = document.getElementById('db-status-dot');
  const dbStatusText = document.getElementById('db-status-text');
  const dbSettingsModal = document.getElementById('db-settings-modal');
  const dbSettingsCloseBtn = document.getElementById('db-settings-close-btn');
  const dbSettingsCancelBtn = document.getElementById('db-settings-cancel-btn');
  const dbSettingsForm = document.getElementById('db-settings-form');
  const dbInputUrl = document.getElementById('db-input-url');
  const dbInputKey = document.getElementById('db-input-key');
  const dbDisconnectBtn = document.getElementById('db-disconnect-btn');
  const dbSeedBtn = document.getElementById('db-seed-btn');
  const dbSeedStatus = document.getElementById('db-seed-status');

  function updateDBStatusUI() {
    const isConn = window.RuhaDB && window.RuhaDB.isConfigured();
    if (dbStatusDot) {
      dbStatusDot.style.background = isConn ? '#16a34a' : '#eab308';
      dbStatusDot.style.boxShadow = isConn ? '0 0 7px #16a34a' : '0 0 6px #eab308';
    }
    if (dbStatusText) {
      dbStatusText.textContent = isConn ? 'Cloud DB Connected' : 'Cloud DB (Local Mode)';
    }
    if (dbDisconnectBtn) {
      dbDisconnectBtn.style.display = isConn ? 'inline-flex' : 'none';
    }
  }

  function openDBSettings() {
    if (window.RuhaDB) {
      const cfg = window.RuhaDB.getConfig();
      if (dbInputUrl) dbInputUrl.value = cfg.url || 'https://jtfcrkhpgbmdqwhspywi.supabase.co';
      if (dbInputKey) dbInputKey.value = cfg.anonKey || '';
    }
    updateDBStatusUI();
    if (dbSettingsModal) {
      dbSettingsModal.style.display = 'flex';
      dbSettingsModal.classList.add('is-open');
      setTimeout(() => dbInputKey?.focus(), 100);
    }
  }

  function closeDBSettings() {
    if (dbSettingsModal) {
      dbSettingsModal.style.display = 'none';
      dbSettingsModal.classList.remove('is-open');
    }
    if (dbSeedStatus) dbSeedStatus.style.display = 'none';
  }

  dbStatusBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openDBSettings();
  });
  dbSettingsCloseBtn?.addEventListener('click', closeDBSettings);
  dbSettingsCancelBtn?.addEventListener('click', closeDBSettings);

  dbSettingsForm?.addEventListener('submit', e => {
    e.preventDefault();
    const url = dbInputUrl?.value.trim();
    const key = dbInputKey?.value.trim();
    if (!url || !key) {
      showToast('Please enter both Project URL and Public Anon Key.');
      return;
    }

    if (window.RuhaDB) {
      const ok = window.RuhaDB.saveConfig(url, key);
      updateDBStatusUI();
      if (ok) {
        showToast('Connected to Supabase Cloud Database!');
        initDashboard();
        closeDBSettings();
      } else {
        showToast('Saved credentials. Checking connection...');
        closeDBSettings();
      }
    }
  });

  dbDisconnectBtn?.addEventListener('click', () => {
    if (confirm('Disconnect Supabase Cloud Database and return to Local Mode?')) {
      if (window.RuhaDB) window.RuhaDB.clearConfig();
      updateDBStatusUI();
      if (dbInputUrl) dbInputUrl.value = '';
      if (dbInputKey) dbInputKey.value = '';
      showToast('Switched to Local Mode.');
      closeDBSettings();
    }
  });

  dbSeedBtn?.addEventListener('click', async () => {
    if (!window.RuhaDB || !window.RuhaDB.isConfigured()) {
      alert('Please enter and save your Supabase Project URL and Anon Key first.');
      return;
    }
    if (dbSeedStatus) {
      dbSeedStatus.style.display = 'block';
      dbSeedStatus.textContent = 'Syncing clean toys catalogue and orders to Supabase...';
    }
    try {
      await window.RuhaDB.seedLocalDataToSupabase((pct, msg) => {
        if (dbSeedStatus) dbSeedStatus.textContent = `[${pct}%] ${msg}`;
      });
      showToast('Toys catalogue & orders successfully synced to Supabase!');
      setTimeout(() => {
        closeDBSettings();
        initDashboard();
      }, 1200);
    } catch (err) {
      if (dbSeedStatus) {
        dbSeedStatus.textContent = `Error: ${err.message || 'Push failed. Please check table schema.'}`;
      }
    }
  });

  window.addEventListener('ruha:db-status-changed', updateDBStatusUI);

  function renderOverviewRecentOrders() {
    const tbody = document.getElementById('overview-recent-orders-tbody');
    if (!tbody) return;

    if (!orders || orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:32px 20px; color:var(--admin-muted);">
            No storefront orders recorded yet. As orders are placed online or via WhatsApp, they will appear here in real-time.
          </td>
        </tr>
      `;
      return;
    }

    const recent = orders.slice(0, 5);
    tbody.innerHTML = recent.map(o => {
      let chanClass = 'channel-direct';
      const c = (o.channel || '').toLowerCase();
      if (c.includes('insta')) chanClass = 'channel-instagram';
      else if (c.includes('web')) chanClass = 'channel-website';
      else if (c.includes('meesho')) chanClass = 'channel-meesho';
      else if (c.includes('amazon')) chanClass = 'channel-amazon';

      const itemsArr = Array.isArray(o.items) ? o.items : [];
      const itemsSummary = itemsArr.map(i => `${i.product?.name || i.name || 'Product'} (×${i.quantity || 1})`).join(', ') || 'Product';

      return `
        <tr>
          <td>
            <strong style="display:block; font-family:monospace; font-size:0.86rem; color:var(--admin-plum);">${o.id}</strong>
            <span style="font-size:0.75rem; color:var(--admin-muted);">${new Date(o.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
          </td>
          <td>
            <strong>${o.customer?.name || 'Customer'}</strong>
            <span style="display:block; font-size:0.75rem; color:var(--admin-muted);">${o.customer?.phone || '—'}</span>
          </td>
          <td>
            <span class="channel-badge ${chanClass}">${o.channel || 'Website'}</span>
          </td>
          <td style="max-width:240px; font-size:0.8rem; color:#444;" title="${itemsSummary}">
            ${itemsSummary.length > 45 ? itemsSummary.slice(0, 43) + '...' : itemsSummary}
          </td>
          <td style="font-weight:700; font-size:0.92rem; color:var(--admin-plum);">
            ${formatPrice(o.total || 0)}
          </td>
          <td>
            <span class="status-badge status-${(o.status || 'pending').toLowerCase()}">
              ● ${o.status || 'Pending'}
            </span>
          </td>
          <td style="text-align:right;">
            <button type="button" class="row-btn" data-overview-order-id="${o.id}" style="padding:4px 10px; font-size:0.75rem;">
              View Bill
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-overview-order-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ord = orders.find(x => x.id === btn.dataset.overviewOrderId);
        if (ord) openInvoiceModal(ord, false);
      });
    });
  }

  document.getElementById('overview-view-all-orders-btn')?.addEventListener('click', () => {
    document.getElementById('tab-multichannel-btn')?.click();
  });

  function initDashboard() {
    catalog = getCatalog();
    orders = getOrders();
    customers = getCustomers();

    if (window.RuhaDB && window.RuhaDB.isConfigured()) {
      if (window.RuhaDB.getOrders) {
        window.RuhaDB.getOrders().then(cloudOrders => {
          if (Array.isArray(cloudOrders) && cloudOrders.length > 0) {
            orders = cloudOrders;
            renderOrdersTable();
            renderOrdersKPIs();
            renderAnalyticsDashboard();
            renderOverviewRecentOrders();
          }
        }).catch(() => {});
      }
      if (window.RuhaDB.getCustomers) {
        window.RuhaDB.getCustomers().then(cloudCusts => {
          if (Array.isArray(cloudCusts) && cloudCusts.length > 0) {
            customers = cloudCusts;
            renderCustomersTable();
            renderCustomersKPIs();
          }
        }).catch(() => {});
      }
    }

    updateDBStatusUI();
    renderAnalyticsDashboard();
    renderOverviewRecentOrders();
    renderKPIs();
    renderTable();
    populateQuickAddSelect();
    populateLabelSelect();
    populateCategoryFilter();
    renderOrdersKPIs();
    renderOrdersTable();
    renderCustomersKPIs();
    renderCustomersTable();
  }

  // Live real-time update when an order is placed from website checkout or user registers
  function refreshOrdersFromEvent() {
    orders = getOrders();
    customers = getCustomers();
    renderOrdersTable();
    renderOrdersKPIs();
    renderAnalyticsDashboard();
    renderOverviewRecentOrders();
    renderCustomersTable();
    renderCustomersKPIs();
  }

  window.addEventListener('storage', e => {
    if (e.key === 'ruha-aura-orders' || e.key === 'ruha-aura-customers') refreshOrdersFromEvent();
  });

  window.addEventListener('ruha:order-created', refreshOrdersFromEvent);
  window.addEventListener('ruha:auth', refreshOrdersFromEvent);

  // Initialization
  document.addEventListener('DOMContentLoaded', () => {
    if (checkAdminAccess()) {
      initDashboard();
    }
  });
})();

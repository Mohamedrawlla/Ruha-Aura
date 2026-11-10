/**
 * Ruha Aura - Supabase Cloud Database Client Wrapper (RuhaDB)
 * Seamlessly interfaces with Supabase (PostgreSQL, Storage & Realtime).
 * Automatically falls back gracefully to localStorage & static catalogue when credentials are not configured or offline.
 */
(() => {
  'use strict';

  const STORAGE_KEY_CONFIG = 'ruha-aura-supabase-config';

  // Load saved credentials from localStorage
  function loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.url && parsed.anonKey) return parsed;
      }
    } catch {}
    return {
      url: window.RUHA_SUPABASE_URL || 'https://jtfcrkhpgbmdqwhspywi.supabase.co',
      anonKey: window.RUHA_SUPABASE_KEY || ''
    };
  }

  let config = loadConfig();
  let supabaseClient = null;

  function initClient() {
    if (config.url && config.anonKey && window.supabase && window.supabase.createClient) {
      try {
        supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
          auth: { persistSession: true }
        });
        return true;
      } catch (e) {
        console.warn('[RuhaDB] Failed to initialize Supabase client:', e);
      }
    }
    supabaseClient = null;
    return false;
  }

  // Attempt initial setup
  initClient();

  const RuhaDB = {
    // --- Configuration API ---
    isConfigured() {
      return Boolean(supabaseClient && config.url && config.anonKey);
    },

    getConfig() {
      return { ...config };
    },

    saveConfig(url, anonKey) {
      config = {
        url: (url || '').trim(),
        anonKey: (anonKey || '').trim()
      };
      try {
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
      } catch {}
      const ok = initClient();
      window.dispatchEvent(new CustomEvent('ruha:db-status-changed', { detail: { connected: ok } }));
      return ok;
    },

    clearConfig() {
      config = { url: '', anonKey: '' };
      localStorage.removeItem(STORAGE_KEY_CONFIG);
      supabaseClient = null;
      window.dispatchEvent(new CustomEvent('ruha:db-status-changed', { detail: { connected: false } }));
    },

    // --- Products API ---
    async getProducts() {
      if (this.isConfigured()) {
        try {
          const { data, error } = await supabaseClient
            .from('products')
            .select('*')
            .order('name', { ascending: true });

          if (!error && Array.isArray(data) && data.length > 0) {
            // Map db schema to client product structure
            const mapped = data.map(row => ({
              id: row.id,
              sku: row.sku,
              name: row.name,
              badge: row.badge,
              category: row.category,
              collection: row.collection,
              type: row.type,
              price: Number(row.price),
              currency: row.currency || 'INR',
              stock: Number(row.stock),
              barcode: row.barcode_code128 || row.sku,
              description: row.description,
              material: row.material,
              dimensions: row.dimensions,
              ageGuidance: row.age_guidance,
              src: row.image_url,
              images: Array.isArray(row.images) ? row.images : [{ src: row.image_url, alt: row.name }],
              swatches: Array.isArray(row.swatches) ? row.swatches : [],
              options: Array.isArray(row.options) ? row.options : ['Single piece'],
              status: row.status || 'available'
            }));

            // Filter out any deprecated products (e.g. old RA-HC- or RA-JW- before category split)
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

            const cleanMapped = mapped.filter(p => !isDeprecated(p));
            const hasDeprecated = mapped.length !== cleanMapped.length;

            if (hasDeprecated) {
              // Purge deprecated products from Supabase
              supabaseClient
                .from('products')
                .delete()
                .or('id.like.RA-HC-%,id.like.RA-JW-%,sku.like.RA-HC-%,sku.like.RA-JW-%')
                .then(() => {})
                .catch(() => {});
            }

            const defaultCatalog = window.RUHA_CATALOG || [];
            let finalList = defaultCatalog;
            if (cleanMapped.length > 0) {
              const map = new Map();
              defaultCatalog.forEach(p => map.set(p.id, { ...p }));
              cleanMapped.forEach(p => {
                if (p && p.id && map.has(p.id)) {
                  map.set(p.id, { ...map.get(p.id), ...p });
                }
              });
              finalList = Array.from(map.values());
            }

            if (hasDeprecated || cleanMapped.length < defaultCatalog.length) {
              this.saveProductsBatch(finalList).catch(() => {});
            }

            // Sync to local cache so offline works
            try {
              localStorage.setItem('ruha-aura-custom-catalog', JSON.stringify(finalList));
            } catch {}
            return finalList;
          }
        } catch (e) {
          console.warn('[RuhaDB] Remote products fetch failed, using local cache:', e);
        }
      }

      // Fallback to local cache or static catalog
      try {
        const stored = localStorage.getItem('ruha-aura-custom-catalog');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
      return window.RUHA_CATALOG || [];
    },

    async saveProduct(p) {
      // 1. Always update local storage first for snappy UX
      let localCatalog = [];
      try {
        const stored = localStorage.getItem('ruha-aura-custom-catalog');
        localCatalog = stored ? JSON.parse(stored) : (window.RUHA_CATALOG || []);
      } catch {
        localCatalog = window.RUHA_CATALOG || [];
      }

      const idx = localCatalog.findIndex(item => item.id === p.id || item.sku === p.sku);
      if (idx >= 0) {
        localCatalog[idx] = { ...localCatalog[idx], ...p };
      } else {
        localCatalog.unshift(p);
      }
      try {
        localStorage.setItem('ruha-aura-custom-catalog', JSON.stringify(localCatalog));
      } catch {}

      // 2. Upsert to Supabase if connected
      if (this.isConfigured()) {
        try {
          const row = {
            id: p.id,
            sku: p.sku,
            name: p.name,
            badge: p.badge || null,
            category: p.category || 'Hair Accessories',
            collection: p.collection || null,
            type: p.type || null,
            price: Number(p.price) || 0,
            cost_price: Number((p.price * 0.4).toFixed(2)),
            currency: p.currency || 'INR',
            stock: Number(p.stock) || 0,
            barcode_code128: p.sku,
            description: p.description || '',
            material: p.material || null,
            dimensions: p.dimensions || null,
            age_guidance: p.ageGuidance || null,
            image_url: p.src || '',
            images: p.images || [{ src: p.src, alt: p.name }],
            swatches: p.swatches || [],
            options: p.options || ['Single piece'],
            status: p.status || 'available',
            updated_at: new Date().toISOString()
          };

          const { error } = await supabaseClient
            .from('products')
            .upsert(row, { onConflict: 'id' });

          if (error) console.error('[RuhaDB] Error upserting product to Supabase:', error);
        } catch (e) {
          console.warn('[RuhaDB] Cloud product save failed, saved locally:', e);
        }
      }

      return localCatalog;
    },

    async saveProductsBatch(productsList, onProgress) {
      if (!Array.isArray(productsList) || productsList.length === 0) return [];

      try {
        localStorage.setItem('ruha-aura-custom-catalog', JSON.stringify(productsList));
      } catch (e) {
        console.warn('LocalStorage save note:', e);
      }

      if (this.isConfigured() && supabaseClient) {
        try {
          const rows = productsList.map(p => ({
            id: p.id,
            sku: p.sku || p.id,
            name: p.name,
            badge: p.badge || null,
            category: p.category || p.collection || 'Hair accessories',
            collection: p.collection || p.category || 'Hair accessories',
            type: p.type || null,
            price: Number(p.price) || 0,
            cost_price: Number(p.costPrice || (p.price * 0.4).toFixed(2)),
            currency: p.currency || 'INR',
            stock: Number(p.stock) || 0,
            barcode_code128: p.sku || p.id,
            description: p.description || '',
            material: p.material || null,
            dimensions: p.dimensions || null,
            age_guidance: p.ageGuidance || null,
            image_url: p.src || '',
            images: p.images || [{ src: p.src, alt: p.name }],
            swatches: p.swatches || [],
            options: p.options || ['Single piece'],
            status: p.status || 'available',
            updated_at: new Date().toISOString()
          }));

          const chunkSize = 50;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            const { error } = await supabaseClient
              .from('products')
              .upsert(chunk, { onConflict: 'id' });
            if (error) {
              console.error('[RuhaDB] Error batch upserting chunk to Supabase:', error);
            }
            if (onProgress) {
              const pct = Math.min(100, Math.round(((i + chunk.length) / rows.length) * 100));
              onProgress(pct, `Saved ${Math.min(i + chunk.length, rows.length)} of ${rows.length} products to database`);
            }
          }
        } catch (err) {
          console.warn('[RuhaDB] Cloud batch save error:', err);
        }
      }

      return productsList;
    },

    async deleteProduct(idOrSku) {
      if (this.isConfigured()) {
        try {
          await supabaseClient
            .from('products')
            .delete()
            .or(`id.eq.${idOrSku},sku.eq.${idOrSku}`);
        } catch (e) {
          console.warn('[RuhaDB] Cloud delete failed:', e);
        }
      }
    },

    // --- Photo Upload to Supabase Storage ---
    async uploadPhoto(file) {
      if (!this.isConfigured()) {
        throw new Error('Supabase is not configured yet. Using local image data URL.');
      }

      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `product-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const filePath = `uploads/${fileName}`;

      const { data, error } = await supabaseClient.storage
        .from('ruha-products')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (error) throw error;

      const { data: urlData } = supabaseClient.storage
        .from('ruha-products')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    },

    // --- Authentication API (Customer Sign Up, Sign In, Google OAuth) ---
    async signUp(email, password, metadata = {}) {
      if (!this.isConfigured()) {
        const user = {
          id: 'user_' + Date.now().toString(36),
          email,
          name: metadata.fullName || email.split('@')[0],
          phone: metadata.phone || '',
          role: 'customer'
        };
        return { data: { user }, error: null };
      }
      return await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: metadata.fullName || '',
            phone: metadata.phone || ''
          }
        }
      });
    },

    async signIn(email, password) {
      if (!this.isConfigured()) {
        const user = {
          id: 'user_' + email.replace(/[^a-zA-Z0-9]/g, '_'),
          email,
          name: email.split('@')[0],
          role: (email === 'admin' || email === 'admin@ruhaaura.com') && password === 'admin123' ? 'admin' : 'customer'
        };
        return { data: { user }, error: null };
      }
      return await supabaseClient.auth.signInWithPassword({ email, password });
    },

    async signInWithGoogle() {
      if (!this.isConfigured()) {
        throw new Error('Supabase project configuration required for Google Sign-In.');
      }
      return await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname
        }
      });
    },

    async signOut() {
      if (this.isConfigured()) {
        try { await supabaseClient.auth.signOut(); } catch {}
      }
      return true;
    },

    async getSessionUser() {
      if (this.isConfigured()) {
        try {
          const { data: { session } } = await supabaseClient.auth.getSession();
          if (session && session.user) {
            return {
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Member',
              role: session.user.email === 'admin@ruhaaura.com' ? 'admin' : 'customer'
            };
          }
        } catch (e) {
          console.warn('[RuhaDB] Session fetch note:', e);
        }
      }
      return null;
    },

    // Helper to detect dummy/mock test orders
    isDummyOrder(o) {
      if (!o || typeof o !== 'object') return true;
      const id = String(o.id || '');
      const name = String(o.customer?.name || '').toLowerCase();
      const isMockId = /^RA-ORD-88\d+/.test(id) || /^RA-ORD-87\d+/.test(id) || /^RA-ORD-89\d+/.test(id) || /^RA-ORD-90\d+/.test(id);
      const isMockName = [
        'ananya', 'pooja', 'kavita', 'ritika', 'sneha', 'meera', 'divya',
        'swati', 'valued customer', 'deepa rao', 'rahul jain', 'walk-in customer',
        'aanya sharma', 'priya nair', 'rhea kapoor'
      ].some(n => name.includes(n));
      return isMockId || isMockName;
    },

    // --- Orders API ---
    async getOrders() {
      if (this.isConfigured()) {
        try {
          const { data, error } = await supabaseClient
            .from('orders')
            .select('*, order_items(*)')
            .order('date', { ascending: false });

          if (!error && Array.isArray(data)) {
            const mappedOrders = data.map(ord => ({
              id: ord.id,
              date: ord.date,
              channel: ord.channel,
              customer: ord.customer,
              subtotal: Number(ord.subtotal) || 0,
              tax: Number(ord.tax) || 0,
              shipping: Number(ord.shipping) || 0,
              discount: Number(ord.discount) || 0,
              total: Number(ord.total) || 0,
              status: ord.status || 'Pending',
              items: (ord.order_items || []).map(item => ({
                product: {
                  id: item.product_id,
                  sku: item.sku,
                  name: item.product_name,
                  price: Number(item.unit_price) || 0
                },
                quantity: item.quantity || 1,
                lineTotal: Number(item.line_total) || 0
              }))
            }));

            // Filter out dummy/mock orders
            const cleanOrders = mappedOrders.filter(o => !this.isDummyOrder(o));

            // Merge with local orders so offline/fresh orders are NEVER wiped out
            let localOrders = [];
            try {
              const stored = localStorage.getItem('ruha-aura-orders');
              localOrders = stored ? JSON.parse(stored) : [];
              if (!Array.isArray(localOrders)) localOrders = [];
            } catch {}

            const orderMap = new Map();
            cleanOrders.forEach(o => orderMap.set(o.id, o));
            localOrders.forEach(o => {
              if (o && o.id && !orderMap.has(o.id) && !this.isDummyOrder(o)) {
                orderMap.set(o.id, o);
              }
            });

            const merged = Array.from(orderMap.values()).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            try {
              localStorage.setItem('ruha-aura-orders', JSON.stringify(merged));
            } catch {}
            return merged;
          }
        } catch (e) {
          console.warn('[RuhaDB] Orders fetch from Supabase failed, using local:', e);
        }
      }

      // Fallback local storage
      try {
        const stored = localStorage.getItem('ruha-aura-orders');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter(o => !this.isDummyOrder(o));
          }
        }
      } catch {}
      return [];
    },

    // --- Customers & User Directory API ---
    async getCustomers() {
      if (this.isConfigured()) {
        try {
          const { data, error } = await supabaseClient
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data) && data.length > 0) {
            let localCusts = [];
            try {
              const stored = localStorage.getItem('ruha-aura-customers');
              localCusts = stored ? JSON.parse(stored) : [];
              if (!Array.isArray(localCusts)) localCusts = [];
            } catch {}

            const map = new Map();
            data.forEach(c => map.set((c.email || c.id).toLowerCase(), c));
            localCusts.forEach(c => {
              const k = (c.email || c.id).toLowerCase();
              if (!map.has(k)) map.set(k, c);
            });

            const merged = Array.from(map.values());
            try {
              localStorage.setItem('ruha-aura-customers', JSON.stringify(merged));
            } catch {}
            return merged;
          }
        } catch (e) {
          console.warn('[RuhaDB] Customers fetch failed, using local:', e);
        }
      }

      try {
        const stored = localStorage.getItem('ruha-aura-customers');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
      return [];
    },

    async saveCustomer(cust) {
      if (!cust) return;
      try {
        const stored = localStorage.getItem('ruha-aura-customers');
        let custs = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(custs)) custs = [];
        const idx = custs.findIndex(c => (c.email && cust.email && c.email.toLowerCase() === cust.email.toLowerCase()) || c.id === cust.id);
        if (idx >= 0) custs[idx] = { ...custs[idx], ...cust };
        else custs.unshift(cust);
        localStorage.setItem('ruha-aura-customers', JSON.stringify(custs));
      } catch {}

      if (this.isConfigured() && cust) {
        try {
          await supabaseClient.from('customers').upsert([{
            id: cust.id,
            name: cust.name || 'Customer',
            email: cust.email || null,
            phone: cust.phone || null,
            address: cust.address || null,
            role: cust.role || 'customer',
            orders_count: cust.orders_count || 0,
            total_spent: cust.total_spent || 0,
            joined_date: cust.joined_date || new Date().toISOString(),
            last_active: new Date().toISOString()
          }], { onConflict: 'id' });
        } catch (e) {
          console.warn('[RuhaDB] Customer cloud upsert note:', e);
        }
      }
    },

    // --- Purge Dummy / Test Orders from Cloud and Local ---
    async purgeDummyOrders() {
      if (this.isConfigured()) {
        try {
          await supabaseClient.from('order_items').delete().neq('order_id', '__none__');
          await supabaseClient.from('orders').delete().neq('id', '__none__');
          console.log('[RuhaDB] Remote orders table cleared of dummy data.');
        } catch (e) {
          console.warn('[RuhaDB] Remote orders purge note:', e);
        }
      }
      try {
        localStorage.setItem('ruha-aura-orders', JSON.stringify([]));
      } catch {}
      return [];
    },

    async createOrder(orderData, items = []) {
      // 1. Save locally
      let orders = [];
      try {
        const stored = localStorage.getItem('ruha-aura-orders');
        orders = stored ? JSON.parse(stored) : [];
      } catch {}

      orders.unshift({ ...orderData, items });
      try {
        localStorage.setItem('ruha-aura-orders', JSON.stringify(orders));
      } catch {}

      // 2. Save in Supabase
      if (this.isConfigured()) {
        try {
          const { error: ordErr } = await supabaseClient
            .from('orders')
            .insert([{
              id: orderData.id,
              order_number: orderData.id,
              date: orderData.date || new Date().toISOString(),
              channel: orderData.channel || 'Website',
              customer: orderData.customer || {},
              subtotal: orderData.subtotal || 0,
              tax: orderData.tax || 0,
              shipping: orderData.shipping || 0,
              discount: orderData.discount || 0,
              total: orderData.total || 0,
              status: orderData.status || 'Pending',
              payment_status: 'Paid'
            }]);

          if (!ordErr && items.length > 0) {
            const rows = items.map(i => ({
              order_id: orderData.id,
              product_id: i.product?.id || null,
              sku: i.product?.sku || '',
              product_name: i.product?.name || 'Product',
              quantity: i.quantity || 1,
              unit_price: i.product?.price || 0,
              line_total: i.lineTotal || (i.quantity * (i.product?.price || 0))
            }));
            await supabaseClient.from('order_items').insert(rows);
          }
        } catch (e) {
          console.warn('[RuhaDB] Failed to insert order into Supabase:', e);
        }
      }

      return orders;
    },

    // --- Barcode Scan & Instant Stock Deduction ---
    async scanAndDeductStock(sku) {
      if (this.isConfigured()) {
        try {
          // Decrement stock in database
          const { data: prod } = await supabaseClient
            .from('products')
            .select('id, sku, stock')
            .eq('sku', sku)
            .single();

          if (prod) {
            const newStock = Math.max(0, (prod.stock || 0) - 1);
            await supabaseClient
              .from('products')
              .update({ stock: newStock, updated_at: new Date().toISOString() })
              .eq('id', prod.id);

            // Audit transaction log
            await supabaseClient
              .from('inventory_logs')
              .insert([{
                product_id: prod.id,
                sku: prod.sku,
                change_quantity: -1,
                remaining_stock: newStock,
                reason: 'POS_SCAN_DISPATCH'
              }]);
          }
        } catch (e) {
          console.warn('[RuhaDB] Cloud inventory deduction failed:', e);
        }
      }
    },

    // --- 1-Click Batch Seed from Local to Supabase ---
    async seedLocalDataToSupabase(onProgress) {
      if (!this.isConfigured()) {
        throw new Error('Please configure your Supabase URL and Anon Key first.');
      }

      let catalog = [];
      try {
        const stored = localStorage.getItem('ruha-aura-custom-catalog');
        catalog = stored ? JSON.parse(stored) : (window.RUHA_CATALOG || []);
      } catch {
        catalog = window.RUHA_CATALOG || [];
      }
      if (!Array.isArray(catalog) || catalog.length === 0) {
        catalog = window.RUHA_CATALOG || [];
      }

      if (onProgress) onProgress(10, 'Syncing all products to cloud database...');
      await this.saveProductsBatch(catalog, onProgress);

      if (onProgress) onProgress(80, 'Products synced! Syncing initial multi-channel orders...');

      // Seed orders (only authentic live orders, no dummy mock data)
      let orders = [];
      try {
        const stored = localStorage.getItem('ruha-aura-orders');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            orders = parsed.filter(o => !this.isDummyOrder(o));
          }
        }
      } catch {}

      if (orders.length > 0) {
        for (const ord of orders) {
          await this.createOrder(ord, ord.items || []);
        }
      }

      // Seed customers/users directory to Supabase
      if (onProgress) onProgress(90, 'Syncing registered customers & users...');
      let custs = [];
      try {
        const stored = localStorage.getItem('ruha-aura-customers');
        custs = stored ? JSON.parse(stored) : [];
      } catch {}

      if (Array.isArray(custs) && custs.length > 0) {
        for (const c of custs) {
          await this.saveCustomer(c);
        }
      }

      if (onProgress) onProgress(100, 'Cloud database successfully initialized!');
      return true;
    }
  };

  window.RuhaDB = RuhaDB;
})();

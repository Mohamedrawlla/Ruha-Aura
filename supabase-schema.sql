-- ====================================================================
-- RUHA AURA E-COMMERCE DATABASE SCHEMA (SUPABASE / POSTGRESQL)
-- ====================================================================
-- Instructions for Supabase Dashboard:
-- 1. Go to https://supabase.com -> Open your project
-- 2. Click on "SQL Editor" in the left sidebar
-- 3. Click "New Query", paste this entire script, and click "Run" (CMD/CTRL + Enter)
-- ====================================================================

-- Enable UUID & Crypto extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 1. PRODUCTS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    badge TEXT,
    category TEXT NOT NULL,
    collection TEXT,
    type TEXT,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_price NUMERIC(10,2) DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    stock INTEGER NOT NULL DEFAULT 0,
    barcode_code128 TEXT,
    description TEXT,
    material TEXT,
    dimensions TEXT,
    age_guidance TEXT,
    image_url TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    swatches JSONB DEFAULT '[]'::jsonb,
    options JSONB DEFAULT '["Single piece"]'::jsonb,
    status TEXT DEFAULT 'available',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);

-- ====================================================================
-- 2. ORDERS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_number TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    channel TEXT NOT NULL DEFAULT 'Website',
    customer JSONB NOT NULL DEFAULT '{}'::jsonb,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax NUMERIC(10,2) DEFAULT 0,
    shipping NUMERIC(10,2) DEFAULT 0,
    discount NUMERIC(10,2) DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending',
    payment_status TEXT NOT NULL DEFAULT 'Paid',
    tracking_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_channel ON public.orders(channel);
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders(date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- ====================================================================
-- 3. ORDER ITEMS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id TEXT,
    sku TEXT,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    line_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON public.order_items(sku);

-- ====================================================================
-- 4. INVENTORY TRANSACTIONS / AUDIT LOG
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT,
    sku TEXT,
    change_quantity INTEGER NOT NULL,
    remaining_stock INTEGER NOT NULL,
    reason TEXT NOT NULL,
    order_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_sku ON public.inventory_logs(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_date ON public.inventory_logs(created_at DESC);

-- ====================================================================
-- 5. CHANNEL INTEGRATIONS (Amazon, Meesho, Instagram, WhatsApp)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.channel_integrations (
    channel TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    sync_status TEXT DEFAULT 'active',
    api_key_masked TEXT,
    webhook_secret TEXT,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    synced_orders_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- 6. CUSTOMERS & REGISTERED USER DIRECTORY
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    address TEXT,
    role TEXT DEFAULT 'customer',
    orders_count INTEGER DEFAULT 0,
    total_spent NUMERIC(10,2) DEFAULT 0,
    joined_date TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

-- ====================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Customers" ON public.customers;
CREATE POLICY "Public Read Customers" ON public.customers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Insert Customers" ON public.customers;
CREATE POLICY "Public Insert Customers" ON public.customers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public Update Customers" ON public.customers;
CREATE POLICY "Public Update Customers" ON public.customers FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Public Delete Customers" ON public.customers;
CREATE POLICY "Public Delete Customers" ON public.customers FOR DELETE USING (true);

-- Auto-sync Supabase Auth sign-ups into public.customers directory
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.customers (id, name, email, phone, role, joined_date, last_active)
    VALUES (
        new.id::text,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Member'),
        new.email,
        new.phone,
        'customer',
        NOW(),
        NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
        last_active = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP POLICY IF EXISTS "Public Read Products" ON public.products;
CREATE POLICY "Public Read Products" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Insert Products" ON public.products;
CREATE POLICY "Public Insert Products" ON public.products FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Products" ON public.products;
CREATE POLICY "Public Update Products" ON public.products FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public Delete Products" ON public.products;
CREATE POLICY "Public Delete Products" ON public.products FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public Read Orders" ON public.orders;
CREATE POLICY "Public Read Orders" ON public.orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Insert Orders" ON public.orders;
CREATE POLICY "Public Insert Orders" ON public.orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Orders" ON public.orders;
CREATE POLICY "Public Update Orders" ON public.orders FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public Delete Orders" ON public.orders;
CREATE POLICY "Public Delete Orders" ON public.orders FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public Read Order Items" ON public.order_items;
CREATE POLICY "Public Read Order Items" ON public.order_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Insert Order Items" ON public.order_items;
CREATE POLICY "Public Insert Order Items" ON public.order_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Order Items" ON public.order_items;
CREATE POLICY "Public Update Order Items" ON public.order_items FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public Delete Order Items" ON public.order_items;
CREATE POLICY "Public Delete Order Items" ON public.order_items FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public Read Inventory Logs" ON public.inventory_logs;
CREATE POLICY "Public Read Inventory Logs" ON public.inventory_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Insert Inventory Logs" ON public.inventory_logs;
CREATE POLICY "Public Insert Inventory Logs" ON public.inventory_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Channels" ON public.channel_integrations;
CREATE POLICY "Public Read Channels" ON public.channel_integrations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Update Channels" ON public.channel_integrations;
CREATE POLICY "Public Update Channels" ON public.channel_integrations FOR UPDATE USING (true);

-- ====================================================================
-- 7. STORAGE BUCKET FOR PRODUCT PHOTOS
-- ====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('ruha-products', 'ruha-products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Storage Access" ON storage.objects;
CREATE POLICY "Public Storage Access" ON storage.objects FOR SELECT USING (bucket_id = 'ruha-products');

DROP POLICY IF EXISTS "Public Storage Upload" ON storage.objects;
CREATE POLICY "Public Storage Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ruha-products');

-- ====================================================================
-- 8. PRE-POPULATE CHANNEL INTEGRATIONS
-- ====================================================================
INSERT INTO public.channel_integrations (channel, display_name, sync_status, api_key_masked, synced_orders_count)
VALUES 
    ('website', 'Ruha Aura Webstore', 'active', 'live_web_store_key', 12),
    ('instagram', 'Instagram DM & Shop', 'active', 'ig_dm_token_****', 38),
    ('whatsapp', 'WhatsApp Direct Business', 'active', 'wa_biz_api_****', 24),
    ('meesho', 'Meesho Marketplace', 'active', 'msh_prod_key_****', 18),
    ('amazon', 'Amazon India (SP-API)', 'active', 'amzn_sp_api_****', 9)
ON CONFLICT (channel) DO UPDATE SET 
    display_name = EXCLUDED.display_name,
    sync_status = EXCLUDED.sync_status;

-- ====================================================================
-- 9. SEED 9 RUHA AURA KIDS' TOYS
-- ====================================================================
INSERT INTO public.products (id, sku, name, badge, category, collection, type, price, cost_price, currency, stock, barcode_code128, description, material, dimensions, age_guidance, image_url, images, swatches, options, status)
VALUES
('RA-TY-01', 'RA-TY-01', '5-in-1 Hammer Toy', 'Top Rated', 'Kids'' toys', 'Kids’ toys', 'Activity toys', 899, 359.6, 'INR', 8, 'RA-TY-01', 'A colourful developmental activity toy with a hammering bench, xylophone musical bars, and wooden mallets.', 'Natural beechwood, non-toxic water-based paints, metal musical bars', '24 cm × 14 cm × 14 cm', '18 months – 4 years', 'assets/toys/hammer.png', '[{"src":"assets/toys/hammer.png","alt":"5-in-1 Hammer Toy"},{"src":"assets/toys/hammer-detail.png","alt":"5-in-1 Hammer Toy — additional photograph"}]'::jsonb, '["#d97c65","#629b9f","#e5b85a"]'::jsonb, '["Standard Set"]'::jsonb, 'available'),
('RA-TY-02', 'RA-TY-02', 'Weather Busy Book', 'Sensory Play', 'Kids'' toys', 'Kids’ toys', 'Busy books', 749, 299.6, 'INR', 12, 'RA-TY-02', 'A tactile, weather-themed sensory busy book packed with interactive learning activities for little explorers.', 'Soft durable felt, embroidered fabric, sturdy child-safe binder', '21 cm × 21 cm × 4.0 cm', '2 – 5 years', 'assets/toys/weather.png', '[{"src":"assets/toys/weather.png","alt":"Weather Busy Book"},{"src":"assets/toys/weather-detail.png","alt":"Weather Busy Book — additional photograph"}]'::jsonb, '["#678ea8","#eed168","#e08d81"]'::jsonb, '["English Edition"]'::jsonb, 'available'),
('RA-TY-03', 'RA-TY-03', 'Vehicle Busy Book', 'Interactive', 'Kids'' toys', 'Kids’ toys', 'Busy books', 749, 299.6, 'INR', 10, 'RA-TY-03', 'A vehicle-themed sensory book featuring cars, airplanes, and trains with button and zip motor-skill activities.', 'Premium felt & interactive velcro / zipper attachments', '21 cm × 21 cm × 4.0 cm', '2 – 5 years', 'assets/toys/vehicle.png', '[{"src":"assets/toys/vehicle.png","alt":"Vehicle Busy Book"}]'::jsonb, '["#4c7f99","#d65d56","#f2c75a"]'::jsonb, '["Vehicles Theme"]'::jsonb, 'available'),
('RA-TY-04', 'RA-TY-04', 'Wooden Cat Puzzle', 'Montessori', 'Kids'' toys', 'Kids’ toys', 'Puzzles', 599, 239.6, 'INR', 14, 'RA-TY-04', 'A charming wooden puzzle featuring interlocking cat figures that develop spatial recognition and problem solving.', 'Smooth laser-cut natural plywood with non-toxic botanical stain', '20 cm × 20 cm × 1.5 cm', '3+ years', 'assets/toys/cat-puzzle.png', '[{"src":"assets/toys/cat-puzzle.png","alt":"Wooden Cat Puzzle"},{"src":"assets/toys/cat-puzzle-detail.png","alt":"Wooden Cat Puzzle — additional photograph"}]'::jsonb, '["#cda37b","#8b654a","#523b2d"]'::jsonb, '["Standard Puzzle"]'::jsonb, 'available'),
('RA-TY-05', 'RA-TY-05', 'Magnetic Maze', 'Brain Teaser', 'Kids'' toys', 'Kids’ toys', 'Puzzles', 699, 279.6, 'INR', 10, 'RA-TY-05', 'A sealed magnetic maze board where kids guide colourful steel spheres through pathways using a magnetic pen.', 'Shatter-resistant acrylic cover, polished wood base, magnetic stylus', '25 cm × 20 cm × 2.0 cm', '3 – 6 years', 'assets/toys/maze.png', '[{"src":"assets/toys/maze.png","alt":"Magnetic Maze"},{"src":"assets/toys/maze-detail.png","alt":"Magnetic Maze — additional photograph"}]'::jsonb, '["#5a9391","#d87a63","#edd27c"]'::jsonb, '["Maze Board"]'::jsonb, 'available'),
('RA-TY-06', 'RA-TY-06', 'Memory Chess', 'Family Game', 'Kids'' toys', 'Kids’ toys', 'Wooden games', 649, 259.6, 'INR', 15, 'RA-TY-06', 'A classic wooden memory game with colour-coded pegs and dice that sharpens recall and turns game night into fun.', 'Natural solid wood base & smooth painted pegs', '17.5 cm diameter × 5.0 cm', '3+ years', 'assets/toys/chess.png', '[{"src":"assets/toys/chess.png","alt":"Memory Chess"}]'::jsonb, '["#b88a64","#528591","#d75e5b"]'::jsonb, '["Wooden Board + 24 Pegs"]'::jsonb, 'available'),
('RA-TY-07', 'RA-TY-07', 'Colour Shut the Box', 'Math & Play', 'Kids'' toys', 'Kids’ toys', 'Wooden games', 799, 319.6, 'INR', 9, 'RA-TY-07', 'A colour-coded, 4-player traditional wooden board game teaching early math and tactical thinking.', 'Premium pine wood & wooden dice', '22 cm × 22 cm × 3.5 cm', '4+ years', 'assets/toys/colour-box.png', '[{"src":"assets/toys/colour-box.png","alt":"Colour Shut the Box"}]'::jsonb, '["#d65b53","#528994","#e2ae4c"]'::jsonb, '["4-Player Board + Dice"]'::jsonb, 'available'),
('RA-TY-08', 'RA-TY-08', 'Wooden XO Game', 'Artisan Decor', 'Kids'' toys', 'Kids’ toys', 'Wooden games', 499, 199.6, 'INR', 16, 'RA-TY-08', 'An artisanal wooden tic-tac-toe coffee-table set with solid tactile X and O blocks.', 'Solid hardwood board with rounded counters', '14 cm × 14 cm × 2.5 cm', '3+ years', 'assets/toys/xo.png', '[{"src":"assets/toys/xo.png","alt":"Wooden XO Game"}]'::jsonb, '["#9f7457","#cbb094","#4a3528"]'::jsonb, '["Complete 9-Piece Set"]'::jsonb, 'available'),
('RA-TY-09', 'RA-TY-09', 'Mikado Stick Game', 'Traditional', 'Kids'' toys', 'Kids’ toys', 'Wooden games', 449, 179.6, 'INR', 20, 'RA-TY-09', 'Timeless Mikado pick-up sticks in a fine wooden sliding storage box for precision and patience.', 'Natural bamboo sticks with sliding wooden box', '19 cm × 4.5 cm × 2.5 cm', '5+ years', 'assets/toys/mikado.png', '[{"src":"assets/toys/mikado.png","alt":"Mikado Stick Game"}]'::jsonb, '["#bfa07e","#913b35","#3a5b6d"]'::jsonb, '["Boxed 41-Stick Set"]'::jsonb, 'available')
ON CONFLICT (id) DO UPDATE SET
    sku = EXCLUDED.sku,
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    stock = EXCLUDED.stock,
    category = EXCLUDED.category,
    image_url = EXCLUDED.image_url,
    barcode_code128 = EXCLUDED.barcode_code128,
    updated_at = NOW();

-- ====================================================================
-- 10. NO DUMMY ORDERS SEEDED (Clean original data only)
-- ====================================================================


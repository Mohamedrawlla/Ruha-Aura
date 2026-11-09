-- ====================================================================
-- RUHA AURA: CLEAN DATABASE TO KEEP ONLY TOYS DATA
-- ====================================================================
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ====================================================================

-- 1. Remove old order items referencing non-toy products
DELETE FROM public.order_items
WHERE product_id NOT LIKE 'RA-TY-%'
   OR sku NOT LIKE 'RA-TY-%';

-- 2. Remove any inventory logs for non-toy products
DELETE FROM public.inventory_logs
WHERE sku NOT LIKE 'RA-TY-%';

-- 3. Delete ALL non-toy products from the products table
DELETE FROM public.products
WHERE id NOT LIKE 'RA-TY-%';

-- 4. Verify only the 9 Kids' Toys remain
SELECT 
    id, 
    sku, 
    name, 
    category, 
    price, 
    stock, 
    status 
FROM public.products
ORDER BY id ASC;

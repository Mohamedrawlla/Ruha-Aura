# Ruha Aura — The Everyday Edit

A standalone, responsive landing page built with HTML, CSS and plain JavaScript. No installation or build step is required. This version includes the landing page plus Stage 2 product discovery: a searchable catalogue and product-detail pages. It does not accept orders, create accounts or take payments.

## Open the website
1. Unzip the download.
2. Open `index.html` in Chrome, Safari, Edge or Firefox.
3. For development, open the folder in Antigravity or VS Code. You can use its Live Server preview, or run `python3 -m http.server 8000` in this folder and visit http://localhost:8000.

## Files
- `index.html`: the landing page.
- `catalogue.html`: catalogue with category/type filters, search, sorting, saved favourites and show-more browsing.
- `product.html?id=maze`: a shareable detail page, selected by its product ID.
- `catalogue-data.js`: the 26 product records, descriptions, photo galleries, prices, stock and specification fields.
- `shop-core.js`: shared product-card rendering and browser-local favourites.
- `catalogue.js`: catalogue state, URL filters and pagination.
- `product.js`: detail pages, thumbnails, full-size images, related products and link sharing.
- `shop.css`: catalogue and detail-page styling.
- `styles.css`: colours, typography, layout, responsive styles and animations.
- `app.js`: carousel, accessory filters, show-more behaviour, mobile menu and accessible photo lightbox.
- `products.js`: editable accessory and toy photo lists.
- `assets/brand-logo.jpeg`: your original logo.
- `assets/products/`: your 17 original clip photographs and the earlier toy overview.
- `assets/toys/`: nine original toy images downloaded from your supplied Google Drive folder.

## Replace your photographs
You can replace an image with a better-lit photograph using exactly the same filename. For example, replace `assets/products/bow.jpg` to update the bow photo wherever it appears.

To add a new product, copy an entry in `products.js`, assign a unique `id`, set the display `name`, choose `Floral`, `Statement` or `Everyday`, and point `src` to the new photo. Keep all paths relative, such as `assets/products/new-clip.jpg`.

The three hero slides are in `index.html` under `hero-photo-window`; update their image path, alt text and `data-name`. Update the corresponding product entry in `products.js` as well. For new toy photos, update `window.RUHA_TOYS` in `products.js` and any featured photo paths in `index.html`. Update the matching record in `catalogue-data.js` for catalogue/detail-page changes. Four toy products include a second original image (`*-detail.png`).

All supplied photographs and the original logo are preserved without retouching or generative edits. The full-size viewer shows the original asset. Prices, materials, toy age guidance and availability must be added from your confirmed product records when the shopping stage is built.

## Confirm product data before sales
Edit `catalogue-data.js` to set each product’s `price` (a number in INR), `stock` (whole number), `options`, `material`, `dimensions` and `ageGuidance`. Unknown values are currently `null` or an empty array and display as pending. No selling prices or stock levels have been invented. The generated `RA-xxx` product codes are provisional catalogue reference codes; replace them with your actual SKUs if required.

The catalogue reads these records directly. Changing a price updates its card and detail page. Adding stock or a price does not enable ordering; cart, inventory transactions, authentication and checkout are separate future work. Favourites are stored only in the visitor’s browser, and are not synced across accounts/devices.

## Change the design
The top of `styles.css` defines colour variables. Edit `--cream`, `--plum`, `--copper` and `--blush` to change the palette. Google Fonts are optional: if they cannot load, the page uses local serif/sans-serif fallbacks.

## Next stages
- Confirm prices, materials, dimensions, options, toy age guidance and availability.
- Add a database-backed catalogue and inventory when the admin stage is built.
- Customer authentication, cart, payment provider and shipping setup.
- A separately secured owner dashboard for stock, orders and profit.
- Approved marketplace integrations after API access is verified.

## Development prompt
"Use this existing Ruha Aura codebase. Preserve the original logo, all real product photos and the current landing-page behaviour. Inspect the files before editing. Implement only the next requested stage, and keep the UI mobile-friendly and keyboard-accessible. Do not invent product prices, claims, customer reviews or integrations."

## Checks completed
- JavaScript syntax validation.
- Local image and anchor references.
- Browser checks for accessory filtering, full-size viewing, previous/next image navigation and the nine-image toy collection.
- Catalogue search, combined collection/type filters, alphabetical sorting, empty/reset states and pagination.
- Favourites persisted between catalogue/detail pages, product thumbnail changes and full-size zoom.
- Desktop visual inspection. Responsive layouts are implemented in CSS; device-specific visual testing is still recommended.

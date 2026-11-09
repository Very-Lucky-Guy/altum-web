# ORIGO — publication and order routing

The public catalog uses the black Heavyweight Classic Boxy Tee, XS, S, M, L, XL and 2XL. All have the approved banana on the chest and the ALTUM logo plus the selected size inside the neck.

| Store listing | Airventory template | Back |
| --- | --- | --- |
| ORIGO Original | 4347 | Original |
| ORIGO Cobalt | 6255 | Cobalt |
| ORIGO Fuchsia | 6256 | Fuchsia |

After the merchant reactivates Shopify, install Airventory in the ALTUM shop. Use **Product Templates → Add to store** for each row; select black only and the six sizes, set retail price and shipping, and publish to the online store. Confirm all three templates show the same connected store. Validate approval, fulfillment payment and tracking settings in Airventory; do not process the existing sample.

For Vercel, set SITE_URL to https://altum-wear.com. Set ORIGO_SHOPIFY_MAP to a JSON object keyed by original, cobalt and fuchsia. Each entry has template (string from table), color ("Black"), and variants (object keyed by the exact six size labels, each value the numeric Shopify variant ID as a string). Read back the IDs from the actual products, verify color, size, template and retail price in the store, and inspect the Shopify checkout for each selection without placing an order. Only then set ORIGO_SHOPIFY_LIVE=true and redeploy. The web refuses incomplete and duplicate mappings. New ORIGO checkouts never enter the old Stripe/Apliiq order queue.

## Automatic fulfillment through WooCommerce and Stripe

Install WooCommerce (with checkout links) and its Stripe gateway on the merchant's checkout domain. Connect that store in Airventory and publish the three templates above. Use WooCommerce variation IDs from the linked black products. The map shape matches the table above. Set ORIGO_WOO_ORIGIN to the store's HTTPS origin and ORIGO_WOO_MAP to the verified variation map. Configure shipping zones, approved retail prices and Stripe in WooCommerce. Confirm Airventory's automatic payment settings. Verify an order imports with its purchased variant and destination before launch, using a controlled test that does not start production. ORIGO_WOO_LIVE=true selects this checkout instead of Shopify.

import axios from 'axios';
import debug from 'debug';
import config from '../config/index.js';

const log = debug('app:talabat-sa');
const TALABAT_API_ENDPOINT = 'https://www.talabat.com/nextSearchApi/v3/vendor';

// Saudi Arabia defaults (Riyadh)
const SA_DEFAULTS = { lat: 24.7136, lon: 46.6753 };

export async function searchTalabatSA(query, lat = SA_DEFAULTS.lat, lon = SA_DEFAULTS.lon) {
  log('searching SA: "%s" at (%d, %d)', query, lat, lon);

  try {
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      'appbrand': '1',
      'content-type': 'application/json',
      'origin': 'https://www.talabat.com',
      'referer': 'https://www.talabat.com/saudi',
      'sourceapp': 'web',
      'x-device-source': '0',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    const payload = {
      latitude: lat,
      longitude: lon,
      query,
      vertical_ids: [0, 1, 2, 3, 4, 5, 6],
      limit: config.search.talabatLimit,
      country_id: 1, // Saudi Arabia
      page_number: 0,
      sort: { by: 'RELEVANCE', order: 'ASC' },
    };

    const response = await axios.post(TALABAT_API_ENDPOINT, payload, {
      headers,
      timeout: config.search.platformTimeout,
    });

    const products = [];
    const vendors = response.data?.result?.vendors || response.data?.vendors || [];

    log('found %d vendors', vendors.length);

    for (const vendor of vendors) {
      const vendorName = vendor.vendor_name || vendor.name || '';
      const vendorId = vendor.vendor_id || vendor.id || '';
      let vendorImage = vendor.vendor_image || vendor.logo || '';

      if (vendorImage && !vendorImage.startsWith('http')) {
        vendorImage = `https://images.deliveryhero.io/image/talabat/restaurants/${vendorImage}`;
      }

      let rating = vendor.total_ratings || vendor.rating || 'N/A';
      if (typeof rating === 'string' && rating.length >= 2) {
        rating = parseInt(rating.slice(0, 2)) / 10;
      }

      const pickupTime = vendor.pickup_time || vendor.delivery_time || 30;
      const restaurantEta = `${pickupTime} mins`;

      for (const product of vendor.products || []) {
        const productName = product.name || '';
        const productPrice = product.price || null;
        let productImage = product.image || '';

        if (productImage && !productImage.startsWith('http')) {
          productImage = `https://images.deliveryhero.io/image/talabat/products/${productImage}`;
        }

        const vendorSlug = vendorName.toLowerCase().replace(/ /g, '-');
        const productUrl = `https://www.talabat.com/saudi/restaurant/${vendorId}/${vendorSlug}?aid=3855`;

        products.push({
          product_name: productName,
          product_price: productPrice,
          product_image: productImage,
          product_url: productUrl,
          restaurant_name: vendorName,
          restaurant_image: vendorImage,
          restaurant_rating: rating,
          restaurant_eta: restaurantEta,
          eta_minutes: pickupTime,
          source: 'Talabat SA',
        });
      }
    }

    log('returning %d products', products.length);
    return products;
  } catch (error) {
    log('error: %s', error.message);
    return [];
  }
}

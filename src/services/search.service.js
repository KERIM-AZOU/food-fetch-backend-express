import { searchSnoonu } from '../platforms/snoonu.js';
import { searchRafeeq } from '../platforms/rafeeq.js';
import { searchTalabat } from '../platforms/talabat.js';
import {
  groupProductsBySimilarity,
  applyFilters,
  paginateResults,
  getAllRestaurants,
} from '../utils/comparison.js';
import config from '../config/index.js';

const PLATFORM_MAP = {
  snoonu: searchSnoonu,
  rafeeq: searchRafeeq,
  talabat: searchTalabat,
};

/**
 * Search across selected platforms, filter, group and paginate.
 */
export async function searchProducts({
  term,
  lat,
  lon,
  sort = 'price',
  page = 1,
  platforms = ['snoonu', 'rafeeq', 'talabat'],
  price_min,
  price_max,
  time_min,
  time_max,
  restaurant_filter = '',
}) {
  const promises = platforms
    .filter((p) => PLATFORM_MAP[p])
    .map((p) => PLATFORM_MAP[p](term, lat, lon));

  const results = await Promise.all(promises);
  let allProducts = results.flat();

  const allRestaurants = getAllRestaurants(allProducts);

  allProducts = applyFilters(allProducts, {
    price_min,
    price_max,
    time_min,
    time_max,
    restaurant_filter,
    platforms,
  });

  const groupedProducts = groupProductsBySimilarity(allProducts, sort);
  const { products, pagination } = paginateResults(groupedProducts, page, config.search.perPage);

  return {
    products,
    pagination,
    all_restaurants: allRestaurants,
  };
}

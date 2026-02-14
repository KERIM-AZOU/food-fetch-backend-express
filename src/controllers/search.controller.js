import { searchProducts } from '../services/search.service.js';
import { AppError } from '../middleware/errorHandler.js';
import config from '../config/index.js';

export async function search(req, res) {
  const {
    term,
    lat = config.defaults.lat,
    lon = config.defaults.lon,
    sort = 'price',
    page = 1,
    platforms,
    country = 'QA',
    price_min,
    price_max,
    time_min,
    time_max,
    restaurant_filter = '',
  } = req.body;

  if (!term) throw new AppError('Search term is required', 400);

  const result = await searchProducts({
    term, lat, lon, sort, page, platforms, country,
    price_min, price_max, time_min, time_max,
    restaurant_filter,
  });

  res.json(result);
}

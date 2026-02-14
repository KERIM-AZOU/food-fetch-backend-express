import SearchLog from '../models/SearchLog.js';

/**
 * Search analytics logger middleware.
 * Non-blocking — fires and forgets so it doesn't slow down the response.
 */
const logSearch = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300 && body?.results) {
      const { query, platforms, lat, lon, country } = req.body;

      SearchLog.create({
        userId: req.user?.id ?? null,
        query: query || '',
        platforms: Array.isArray(platforms) ? platforms : [],
        resultCount: Array.isArray(body.results) ? body.results.length : 0,
        country: country || 'QA',
        lat: lat ?? 0,
        lon: lon ?? 0,
      }).catch((err) => {
        console.warn('Failed to log search:', err.message);
      });
    }

    return originalJson(body);
  };

  next();
};

export default logSearch;

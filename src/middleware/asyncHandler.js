/**
 * Wraps an async controller so thrown errors go to the global error handler.
 * Usage: router.post('/', asyncHandler(controller.method))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;

/**
 * Limiteur de requêtes en mémoire (par adresse IP), sans dépendance externe.
 *
 * Suffisant pour un déploiement mono-process (Railway / VPS) : l'état vit dans
 * la mémoire du process. Fenêtre glissante simple : on garde les horodatages
 * des requêtes récentes par IP et on refuse au-delà de `max` sur `windowMs`.
 *
 * Note : derrière un reverse proxy, `req.ip` reflète X-Forwarded-For grâce à
 * `app.set('trust proxy', 1)` (voir server/index.js).
 */

function createRateLimiter({ windowMs, max, message } = {}) {
  const window = Number(windowMs) || 60 * 1000;
  const limit = Number(max) || 60;
  const hits = new Map(); // ip -> number[] (horodatages ms)

  // Nettoyage périodique pour éviter que la Map ne grossisse indéfiniment.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, times] of hits) {
      const kept = times.filter((t) => now - t < window);
      if (kept.length) hits.set(ip, kept);
      else hits.delete(ip);
    }
  }, window);
  // Ne pas empêcher le process de se terminer à cause de ce timer.
  if (typeof sweep.unref === 'function') sweep.unref();

  return function rateLimit(req, res, next) {
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const now = Date.now();
    const times = (hits.get(ip) || []).filter((t) => now - t < window);
    times.push(now);
    hits.set(ip, times);

    if (times.length > limit) {
      res.set('Retry-After', String(Math.ceil(window / 1000)));
      return res
        .status(429)
        .json({ error: message || 'Trop de requêtes. Réessaie dans un instant.' });
    }
    next();
  };
}

module.exports = { createRateLimiter };

const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map();

exports.blockedFor = (key) => {
  const a = attempts.get(key);
  if (!a || !a.blockedUntil) return 0;
  const left = a.blockedUntil - Date.now();
  if (left <= 0) { attempts.delete(key); return 0; }
  return left;
};

exports.fail = (key) => {
  const now = Date.now();
  let a = attempts.get(key);
  if (!a || now - a.firstAt > WINDOW_MS) a = { count: 0, firstAt: now, blockedUntil: 0 };
  a.count += 1;
  if (a.count >= MAX_FAILS) a.blockedUntil = now + WINDOW_MS;
  attempts.set(key, a);
};

exports.reset = (key) => attempts.delete(key);

setInterval(() => {
  const now = Date.now();
  for (const [k, a] of attempts) {
    if (now - a.firstAt > WINDOW_MS && (!a.blockedUntil || a.blockedUntil < now)) attempts.delete(k);
  }
}, 5 * 60 * 1000).unref();

// Per-process limiter for the single backend instance used by this deployment.
const rateLimit = (limit = 20, windowMs = 15*60*1000) => {
  const clients = new Map();
  return (req,res,next) => {
    const now = Date.now();
    for (const [key,value] of clients) if (value.until <= now) clients.delete(key);
    const key = req.ip;
    const bucket = clients.get(key) || {until:now+windowMs,count:0};
    bucket.count++;
    clients.set(key,bucket);
    if (bucket.count>limit || clients.size>10000) {
      res.set('Retry-After',String(Math.ceil((bucket.until-now)/1000)));
      return res.status(429).json({message:'Demasiados intentos. Espera unos minutos.'});
    }
    next();
  };
};
module.exports = {rateLimit};

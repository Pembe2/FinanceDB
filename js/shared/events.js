// Tiny in-app event bus (no dependencies)
const listeners = new Map();

export function on(eventName, handler){
  if (!listeners.has(eventName)) listeners.set(eventName, []);
  listeners.get(eventName).push(handler);
}

export function emit(eventName, payload){
  const arr = listeners.get(eventName) || [];
  for (const fn of arr) {
    try { fn(payload); } catch(e) { console.error(e); }
  }
}

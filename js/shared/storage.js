export function safeParseJSON(raw){
  try { return JSON.parse(raw); } catch(e){ return null; }
}

export function loadJson(key){
  try{
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e){
    return null;
  }
}

export function saveJson(key, obj){
  try { localStorage.setItem(key, JSON.stringify(obj)); } catch(e){}
}

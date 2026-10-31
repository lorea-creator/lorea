// Almacenamiento local en el iPhone (IndexedDB). Todo el estado vive en un único objeto.
const Store = (() => {
  const DB_NAME = "lorea", STORE = "kv", KEY = "data";
  let dbp;
  function open() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => res(req?.result);
      t.onerror = () => rej(t.error);
    });
  }
  return {
    load: () => tx("readonly", (s) => s.get(KEY)),
    save: (data) => tx("readwrite", (s) => s.put(data, KEY)),
    // Pide al navegador que no borre los datos aunque falte espacio
    persist: () => navigator.storage?.persist?.().catch(() => false),
  };
})();

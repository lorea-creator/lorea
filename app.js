// Lorea - web app (PWA). Datos en el iPhone + copia semanal exportando un archivo (sin conexión directa con Google).
const SEASONS = ["primavera", "verano", "otono", "invierno"];
const SEASON_LABEL = { primavera: "Primavera", verano: "Verano", otono: "Otoño", invierno: "Invierno" };
const LOG_TYPES = { riego: "💧 Riego", abono: "🌱 Abono", poda: "✂️ Poda", tratamiento: "🧴 Tratamiento",
  trasplante: "🪴 Trasplante", observacion: "📝 Observación" };
const BACKUP_EVERY_DAYS = 7;

// Valores orientativos de partida: ajústalos en la app.
const SEED = {
  settings: { location: "Castellbisbal", lat: 41.4753, lon: 1.9814, rain_skip_mm: 5, heat_c: 32, frost_c: 2 },
  plants: [
    { name: "Buganvilla lila", species: "Bougainvillea", place: "Exterior", zone: "", container: "Maceta", light: "Sol directo", frost_sensitive: true,
      water: { primavera: 4, verano: 2, otono: 6, invierno: 14 }, feed: { primavera: 15, verano: 15, otono: 0, invierno: 0 },
      notes: "Con tutores de caña. Prefiere quedarse algo seca entre riegos." },
    { name: "Buganvilla", species: "Bougainvillea", place: "Exterior", zone: "", container: "Maceta", light: "Sol directo", frost_sensitive: true,
      water: { primavera: 4, verano: 2, otono: 6, invierno: 14 }, feed: { primavera: 15, verano: 15, otono: 0, invierno: 0 }, notes: "" },
    { name: "Hibiscos", species: "Hibiscus", place: "Exterior", zone: "Bancal", container: "Suelo", light: "Sol directo", frost_sensitive: true,
      water: { primavera: 4, verano: 2, otono: 6, invierno: 12 }, feed: { primavera: 15, verano: 15, otono: 0, invierno: 0 }, notes: "" },
    { name: "Plantones de níspero", species: "Eriobotrya japonica", place: "Exterior", zone: "", container: "Maceta", light: "Sol directo", frost_sensitive: false,
      water: { primavera: 3, verano: 2, otono: 5, invierno: 10 }, feed: { primavera: 30, verano: 30, otono: 0, invierno: 0 }, notes: "Varios brotes en macetas pequeñas." },
    { name: "Morera", species: "Morus", place: "Exterior", zone: "", container: "Maceta", light: "Sol directo", frost_sensitive: false,
      water: { primavera: 3, verano: 2, otono: 5, invierno: 10 }, feed: { primavera: 30, verano: 30, otono: 0, invierno: 0 },
      notes: "En maceta pequeña. Caduca: en invierno pierde la hoja, es normal." },
  ],
};

let DB = null;
let WEATHER = null;
let editingId = null;

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 86400000);
const fmtDate = (d) => new Date(d + "T12:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const newId = () => Math.random().toString(36).slice(2, 12);

function seasonOf(d = new Date()) {
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 5) return "primavera";
  if (m >= 6 && m <= 8) return "verano";
  if (m >= 9 && m <= 11) return "otono";
  return "invierno";
}

function toast(msg, ms = 2200) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), ms);
}

// ---------- Datos ----------
function freshDB() {
  return { version: 1, settings: { ...SEED.settings },
    plants: SEED.plants.map((p) => ({ ...p, id: newId(), photo: null, log: [], created: today() })),
    sync: { lastBackup: null } };
}

function normalize(data, keepSync) {
  const db = { version: 1, settings: { ...SEED.settings, ...(data.settings || {}) }, plants: data.plants || [],
    sync: keepSync || { lastBackup: null } };
  for (const p of db.plants) {
    p.id ||= newId(); p.log ||= [];
    if (p.photo && !String(p.photo).startsWith("data:")) p.photo = null; // fotos de la versión de ordenador no viajan
  }
  return db;
}

async function save() { await Store.save(DB); }

function exportable() {
  const { sync, ...rest } = DB;
  return { ...rest, exported: new Date().toISOString() };
}

// ---------- Tiempo (Open-Meteo, gratis y sin clave) ----------
async function loadWeather() {
  const { lat, lon } = DB.settings;
  if (!lat || !lon) return;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max` +
      `&past_days=2&forecast_days=5&timezone=auto`;
    const d = (await (await fetch(url)).json()).daily;
    WEATHER = d.time.map((t, i) => ({ date: t, max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
      rain: d.precipitation_sum[i] ?? 0, prob: d.precipitation_probability_max[i] ?? 0 }));
  } catch { WEATHER = null; }
  renderToday();
}

function weatherSummary() {
  if (!WEATHER) return null;
  const idx = WEATHER.findIndex((w) => w.date === today());
  if (idx < 0) return null;
  const recent = WEATHER.slice(Math.max(0, idx - 2), idx + 1).reduce((s, w) => s + w.rain, 0);
  const next3 = WEATHER.slice(idx, idx + 3);
  return { rain: recent + (WEATHER[idx + 1]?.rain ?? 0),
    minNext: Math.min(...next3.map((w) => w.min)), maxNext: Math.max(...next3.map((w) => w.max)) };
}

// ---------- Lógica de cuidados ----------
function status(plant, type) {
  const every = Number((type === "riego" ? plant.water : plant.feed)?.[seasonOf()] || 0);
  if (!every) return { active: false };
  const last = plant.log.filter((e) => e.type === type).map((e) => e.date).sort().pop() || null;
  const since = last ? daysBetween(last, today()) : null;
  return { active: true, every, last, since, dueIn: last ? every - since : 0 };
}

function computeTasks() {
  const ws = weatherSummary();
  const due = [], upcoming = [];
  for (const p of DB.plants) {
    for (const type of ["riego", "abono"]) {
      const st = status(p, type);
      if (!st.active) continue;
      const skip = type === "riego" && ws && p.place === "Exterior" && ws.rain >= Number(DB.settings.rain_skip_mm || 5)
        ? `lluvia ${ws.rain.toFixed(1)} mm` : null;
      const item = { p, type, st, skip };
      if (st.dueIn <= 0) due.push(item); else if (st.dueIn <= 3) upcoming.push(item);
    }
  }
  upcoming.sort((a, b) => a.st.dueIn - b.st.dueIn);
  return { due, upcoming, ws };
}

function addLog(plantId, entry) {
  const p = DB.plants.find((x) => x.id === plantId);
  p.log.push({ id: newId(), type: entry.type || "riego", date: entry.date || today(), note: entry.note || "" });
  p.log.sort((a, b) => b.date.localeCompare(a.date));
}

// ---------- Render ----------
const thumb = (p, cls = "thumb") => p.photo
  ? `<div class="${cls}" style="background-image:url('${p.photo}')"></div>` : `<div class="${cls}">🌿</div>`;

function render() { renderToday(); renderPlants(); renderSettings(); }

function backupAge() {
  return DB.sync.lastBackup ? daysBetween(DB.sync.lastBackup.slice(0, 10), today()) : null;
}

function renderSyncBanner() {
  const age = backupAge();
  $("#sync-banner").innerHTML = age === null || age >= BACKUP_EVERY_DAYS
    ? `<div class="banner"><span>${age === null ? "Aún no tienes copia de tus plantas." : `Última copia hace ${age} días.`}</span>
      <button class="btn small primary" id="export-banner">Hacer copia</button></div>` : "";
}

function renderToday() {
  renderSyncBanner();
  $("#season").textContent = "· " + SEASON_LABEL[seasonOf()];
  const t = today();
  $("#weather").innerHTML = WEATHER
    ? WEATHER.map((w) => `<div class="day ${w.date < t ? "past" : ""}">
        <div class="d">${w.date === t ? "Hoy" : new Date(w.date + "T12:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })}</div>
        <div class="t">${Math.round(w.max)}° / ${Math.round(w.min)}°</div>
        <div class="r">💧 ${w.rain.toFixed(1)} mm${w.date >= t ? `<br>${w.prob}%` : ""}</div></div>`).join("")
    : `<div class="day" style="flex-basis:100%"><div class="d">Tiempo</div><div class="r">Sin datos (¿sin conexión?)</div></div>`;

  const { due, upcoming, ws } = computeTasks();
  const s = DB.settings, alerts = [];
  if (ws) {
    const ext = DB.plants.filter((p) => p.place === "Exterior");
    const sens = ext.filter((p) => p.frost_sensitive);
    if (ws.minNext <= Number(s.frost_c ?? 2) && sens.length)
      alerts.push(`<div class="alert frost">❄️ Mínimas de ${Math.round(ws.minNext)}° en los próximos días. Protege: ${sens.map((p) => esc(p.name)).join(", ")}.</div>`);
    if (ws.maxNext >= Number(s.heat_c ?? 32) && ext.length)
      alerts.push(`<div class="alert heat">🔥 Máximas de ${Math.round(ws.maxNext)}°. Revisa la tierra de las macetas de exterior: pueden necesitar riego antes.</div>`);
    if (ws.rain >= Number(s.rain_skip_mm || 5))
      alerts.push(`<div class="alert rain">🌧️ ${ws.rain.toFixed(1)} mm de lluvia (recientes + mañana). Riego de exterior pospuesto; lo que esté bajo techo sí puede necesitarlo.</div>`);
  }
  $("#alerts").innerHTML = alerts.join("");

  const taskHtml = (it, showBtn) => {
    const tag = it.skip ? `<span class="tag skip">Pospuesto · ${it.skip}</span>`
      : `<span class="tag ${it.type === "riego" ? "water" : "feed"}">${it.type === "riego" ? "Regar" : "Abonar"}</span>`;
    const when = it.st.last ? `hace ${it.st.since} d · cada&nbsp;${it.st.every}&nbsp;d` : `sin registros · cada&nbsp;${it.st.every}&nbsp;d`;
    return `<div class="task">${thumb(it.p)}
      <div class="info"><b>${esc(it.p.name)}</b><span>${tag} ${when}${showBtn ? "" : ` · en ${it.st.dueIn} d`}</span></div>
      ${showBtn ? `<button class="btn small" data-done="${it.p.id}" data-type="${it.type}">Hecho</button>` : ""}</div>`;
  };
  $("#tasks").innerHTML = due.length ? due.map((i) => taskHtml(i, true)).join("") : `<div class="empty">Nada pendiente hoy 🌞</div>`;
  $("#upcoming").innerHTML = upcoming.length ? upcoming.map((i) => taskHtml(i, false)).join("") : `<div class="empty">Nada en los próximos 3 días.</div>`;
}

function renderPlants() {
  $("#plant-grid").innerHTML = DB.plants.map((p) => `
    <div class="pcard" data-open="${p.id}">${thumb(p, "img")}
      <div class="body"><b>${esc(p.name)}</b><span>${esc(p.place)}${p.zone ? " · " + esc(p.zone) : ""}</span></div>
    </div>`).join("") || `<div class="empty">Aún no hay plantas.</div>`;
}

function renderSettings() {
  const f = $("#settings-form");
  for (const k of ["location", "lat", "lon", "rain_skip_mm", "heat_c", "frost_c"]) f.elements[k].value = DB.settings[k] ?? "";
  const age = backupAge();
  $("#sync-status").innerHTML = DB.sync.lastBackup
    ? `Última copia: <b>${new Date(DB.sync.lastBackup).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}</b> (${age === 0 ? "hoy" : `hace ${age} d`}). Te avisaré cada ${BACKUP_EVERY_DAYS} días.`
    : "Aún no has hecho ninguna copia.";
}

function renderDetail(id) {
  const p = DB.plants.find((x) => x.id === id);
  if (!p) return show("plantas");
  const cur = seasonOf();
  const cell = (obj, s) => `<td class="${s === cur ? "now" : ""}">${Number(obj?.[s]) ? obj[s] + " d" : "—"}</td>`;
  const line = (st) => !st.active ? "no en esta estación" : !st.last ? "sin registros"
    : `último ${fmtDate(st.last)}, ${st.dueIn <= 0 ? "<b>toca ya</b>" : `toca en ${st.dueIn} d`}`;
  $("#view-detalle").innerHTML = `
    <div class="row-between" style="margin-top:1rem">
      <button class="btn" data-back>← Plantas</button>
      <div><button class="btn" data-edit="${p.id}">Editar</button>
      <button class="btn danger" data-del="${p.id}">Eliminar</button></div>
    </div>
    <div class="detail-head">
      <div>${thumb(p, "img")}
        <label class="btn small" style="display:block;text-align:center;margin-top:.5rem">📷 ${p.photo ? "Cambiar" : "Añadir"} foto
          <input type="file" accept="image/*" data-photo="${p.id}" hidden></label>
      </div>
      <div>
        <h2 style="margin-top:0">${esc(p.name)}</h2>
        <div class="muted"><i>${esc(p.species)}</i></div>
        <div class="facts"><span>${esc(p.place)}</span>${p.zone ? `<span>${esc(p.zone)}</span>` : ""}<span>${esc(p.container)}</span>
          <span>${esc(p.light)}</span>${p.frost_sensitive ? "<span>❄️ Sensible a heladas</span>" : ""}</div>
      </div>
    </div>
        <div class="card">
          <table class="plan"><tr><th></th>${SEASONS.map((s) => `<th>${SEASON_LABEL[s].slice(0, 4)}.</th>`).join("")}</tr>
            <tr><th>💧</th>${SEASONS.map((s) => cell(p.water, s)).join("")}</tr>
            <tr><th>🌱</th>${SEASONS.map((s) => cell(p.feed, s)).join("")}</tr></table>
          <p class="small muted" style="margin:.6rem 0 0">💧 ${line(status(p, "riego"))}<br>🌱 ${line(status(p, "abono"))}</p>
        </div>
        ${p.notes ? `<div class="card small">${esc(p.notes).replace(/\n/g, "<br>")}</div>` : ""}
    <h3 style="margin-top:1.2rem">Diario</h3>
    <form class="log-form" data-log="${p.id}">
      <select name="type">${Object.entries(LOG_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      <input name="date" type="date" value="${today()}">
      <input name="note" placeholder="Nota (opcional)" style="flex:2 1 200px">
      <button class="btn primary">Registrar</button>
    </form>
    <div class="card">${p.log.map((e) => `
      <div class="log-item"><span><b>${LOG_TYPES[e.type] || e.type}</b> · ${fmtDate(e.date)}${e.note ? " — " + esc(e.note) : ""}</span>
      <button title="Borrar" data-dellog="${e.id}" data-plant="${p.id}">✕</button></div>`).join("") || `<div class="empty">Sin registros todavía.</div>`}
    </div>`;
  show("detalle");
}

function show(view) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
  document.querySelectorAll(".tabbar button").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === view || (view === "detalle" && b.dataset.view === "plantas")));
  window.scrollTo(0, 0);
}

// ---------- Copia de seguridad (exportar / importar archivo) ----------
// En iPhone abre el menú Compartir: elige "Guardar en Archivos" → Google Drive → carpeta Lorea.
async function exportFile() {
  const name = `lorea-${today()}.json`;
  const file = new File([JSON.stringify(exportable())], name, { type: "application/json" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); }
    catch { return toast("Copia cancelada"); }
  } else {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(file), download: name });
    a.click();
  }
  DB.sync.lastBackup = new Date().toISOString();
  await save(); render(); toast("Copia hecha ✓");
}

// ---------- Formulario de planta ----------
function openPlantForm(p) {
  editingId = p?.id || null;
  const f = $("#plant-form");
  f.reset();
  $("#plant-form-title").textContent = p ? "Editar planta" : "Nueva planta";
  if (p) {
    for (const k of ["name", "species", "place", "zone", "container", "light", "notes"]) f.elements[k].value = p[k] ?? "";
    f.elements.frost_sensitive.checked = !!p.frost_sensitive;
    for (const s of SEASONS) {
      f.elements["water." + s].value = p.water?.[s] ?? "";
      f.elements["feed." + s].value = p.feed?.[s] ?? "";
    }
  }
  $("#plant-dialog").showModal();
}

$("#plant-dialog").addEventListener("close", async () => {
  if ($("#plant-dialog").returnValue !== "ok") return;
  const f = $("#plant-form");
  const data = { water: {}, feed: {} };
  for (const k of ["name", "species", "place", "zone", "container", "light", "notes"]) data[k] = f.elements[k].value.trim();
  data.frost_sensitive = f.elements.frost_sensitive.checked;
  for (const s of SEASONS) {
    data.water[s] = Number(f.elements["water." + s].value || 0);
    data.feed[s] = Number(f.elements["feed." + s].value || 0);
  }
  if (editingId) Object.assign(DB.plants.find((p) => p.id === editingId), data);
  else { editingId = newId(); DB.plants.push({ ...data, id: editingId, photo: null, log: [], created: today() }); }
  await save(); render(); renderDetail(editingId); toast("Guardado");
});

// Reduce la foto (máx. 1000 px) para que la copia no pese mucho
function resizeImage(file, max = 1000) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

// ---------- Eventos ----------
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, .pcard");
  if (!t) return;
  if (t.dataset.view) return show(t.dataset.view);
  if (t.dataset.open) return renderDetail(t.dataset.open);
  if (t.dataset.back !== undefined) return show("plantas");
  if (t.id === "export" || t.id === "export-banner") return exportFile();
  if (t.id === "add-plant") return openPlantForm(null);
  if (t.dataset.edit) return openPlantForm(DB.plants.find((p) => p.id === t.dataset.edit));
  if (t.dataset.del) {
    if (!confirm("¿Eliminar esta planta y su diario?")) return;
    DB.plants = DB.plants.filter((p) => p.id !== t.dataset.del);
    await save(); render(); show("plantas"); return toast("Eliminada");
  }
  if (t.dataset.done) {
    addLog(t.dataset.done, { type: t.dataset.type });
    await save(); renderToday(); renderPlants();
    return toast(t.dataset.type === "riego" ? "Riego registrado 💧" : "Abono registrado 🌱");
  }
  if (t.dataset.dellog) {
    const p = DB.plants.find((x) => x.id === t.dataset.plant);
    p.log = p.log.filter((x) => x.id !== t.dataset.dellog);
    await save(); render(); renderDetail(p.id);
  }
});

document.addEventListener("submit", async (e) => {
  const f = e.target;
  if (f.dataset.log) {
    e.preventDefault();
    addLog(f.dataset.log, Object.fromEntries(new FormData(f)));
    await save(); render(); renderDetail(f.dataset.log); toast("Registrado");
  } else if (f.id === "settings-form") {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    for (const k of ["lat", "lon", "rain_skip_mm", "heat_c", "frost_c"]) d[k] = Number(d[k]);
    Object.assign(DB.settings, d);
    await save(); render(); loadWeather(); toast("Ajustes guardados");
  }
});

document.addEventListener("change", async (e) => {
  if (e.target.id === "import" && e.target.files[0]) {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(data.plants)) throw new Error();
      if (!confirm(`¿Sustituir los datos actuales por este archivo (${data.plants.length} plantas)?`)) return;
      DB = normalize(data, DB.sync);
      await save(); render(); show("hoy"); toast("Datos importados ✓");
    } catch { toast("Ese archivo no es una copia de Lorea"); }
    e.target.value = "";
    return;
  }
  const id = e.target.dataset.photo;
  if (!id || !e.target.files[0]) return;
  DB.plants.find((p) => p.id === id).photo = await resizeImage(e.target.files[0]);
  await save(); render(); renderDetail(id); toast("Foto guardada");
});

// ---------- Arranque ----------
(async function init() {
  const stored = await Store.load();
  DB = stored ? normalize(stored, stored.sync) : freshDB();
  if (!stored) await save();
  Store.persist();
  render();
  loadWeather();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();

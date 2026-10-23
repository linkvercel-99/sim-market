/* ===== KONFIGURASI ===== */
const SUPABASE_URL = "https://iashoonbusiyonhinvke.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhc2hvb25idXNpeW9uaGludmtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MTQxMzUsImV4cCI6MjEwODA5MDEzNX0.syeh_ZTmKZqgeM0A2LmrrB8zXyjQVT-ZEe31_92PhsY";
const WHATSAPP_NUMBER = "94XXXXXXXXX";   // format internasional tanpa +
const TELEGRAM_USERNAME = "username_telegram"; // tanpa @
const LOGO = "https://i.imgur.com/8l7kxaW.png";
const BANNER = "https://i.imgur.com/by7sk5x.png";

const $ = s => document.querySelector(s);
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const NOIMG = "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='#181818'/><text x='50' y='54' font-size='9' fill='#777' text-anchor='middle' font-family='sans-serif'>Foto tidak tersedia</text></svg>");
document.addEventListener("error", e => {   // gambar gagal dimuat -> pengganti
  const el = e.target; if (!el || el.tagName !== "IMG" || el.dataset.fb) return; el.dataset.fb = 1;
  el.src = el.id === "logo" ? DEF_LOGO : el.id === "banner" ? DEF_BANNER : NOIMG;
}, true);
const lkr = n => "LKR " + Number(n).toLocaleString("en-US");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let products = [], cats = [], active = "Semua", term = "";
let cart = JSON.parse(localStorage.getItem("cv_cart2") || "[]"); // [{id,size,q}]
let m = null;
const imgsOf = p => (Array.isArray(p.images) && p.images.length ? p.images : (p.image_url ? [p.image_url] : []));
const sizesOf = p => (p.sizes || "").split(",").map(x => x.trim()).filter(Boolean);

const DEF_LOGO = "https://i.imgur.com/8l7kxaW.png", DEF_BANNER = "https://i.imgur.com/by7sk5x.png";
let S = {};
try { S = JSON.parse(localStorage.getItem("cv_settings") || "{}"); } catch (e) {}
const waNum = () => String(S.whatsapp || WHATSAPP_NUMBER).replace(/\D/g, "");
const tgUser = () => String(S.telegram || TELEGRAM_USERNAME).replace(/^https?:\/\/t\.me\//, "").replace(/^@/, "");
function applySettings() {
  const r = document.documentElement.style;
  r.setProperty("--accent", S.accent_color || "#b84040"); r.setProperty("--bg", S.bg_color || "#050505"); r.setProperty("--text", S.text_color || "#eeeeee");
  const logo = S.logo_url || DEF_LOGO, banner = S.banner_url || DEF_BANNER;
  if ($("#logo").getAttribute("src") !== logo) $("#logo").src = logo;
  if ($("#banner").getAttribute("src") !== banner) $("#banner").src = banner;
  const audio = document.getElementById("bgm"), song = S.music_url || "musiku.mp3", off = S.music_enabled === false;
  if (audio.getAttribute("src") !== song) { const was = !audio.paused; audio.src = song; if (was && !off) audio.play().catch(() => {}); }
  if (off) audio.pause();
  document.getElementById("musicBtn").classList.toggle("hidden", off);
  document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(l => l.href = logo);
}
async function loadSettings() {
  if (!db) return;
  const { data, error } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) return;
  S = data || {}; localStorage.setItem("cv_settings", JSON.stringify(S)); applySettings();
}
applySettings();

const withTimeout = (pr, ms = 12000) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
function showError(on) { $("#err").classList.toggle("hidden", !on); if (on) { $("#grid").innerHTML = ""; $("#empty").classList.add("hidden"); $("#count").textContent = ""; } }
async function load() {
  try {
    if (!db) throw new Error("no-supabase");
    const [p, c] = await withTimeout(Promise.all([
      db.from("products").select("*").order("created_at", { ascending: false }),
      db.from("categories").select("name").order("name")
    ]));
    if (p.error || c.error) throw (p.error || c.error);
    products = p.data; cats = c.data.map(x => x.name);
    showError(false); renderCats(); render(); renderCart();
  } catch (e) { if (!products.length) showError(true); }   // jika data lama ada, biarkan tampil
}
$("#retry").onclick = () => { $("#err").classList.add("hidden"); $("#grid").innerHTML = '<div class="card animate-pulse aspect-[3/4]"></div>'.repeat(5); load(); };
window.addEventListener("online", load);
function renderCats() {
  $("#cats").innerHTML = ["Semua", ...cats].map(n => `<button class="pill ${n === active ? "on" : ""}" data-c="${esc(n)}">${esc(n)}</button>`).join("");
}
function render() {
  const t = term.toLowerCase();
  let list = products.filter(p => (active === "Semua" || p.category === active) &&
    (!t || `${p.name} ${p.category} ${p.description || ""}`.toLowerCase().includes(t)));
  const featuredView = active === "Semua" && !t;
  if (featuredView) { const f = list.filter(p => p.is_featured); if (f.length) list = f; }
  $("#title").textContent = featuredView ? "Produk Pilihan" : t ? "Hasil Pencarian" : active;
  $("#count").textContent = list.length + " produk";
  $("#empty").classList.toggle("hidden", list.length > 0);
  $("#grid").innerHTML = list.map(p => {
    const out = p.stock <= 0;
    const badge = out ? ["Habis", "text-red-500"] : p.stock <= 5 ? ["Sisa " + p.stock, "text-amber-400"] : ["Tersedia", "text-emerald-400"];
    return `<article class="card flex flex-col">
      <div data-open="${p.id}" class="relative cursor-pointer aspect-square bg-black/40 flex items-center justify-center"><img loading="lazy" decoding="async" width="400" height="400" src="${esc(imgsOf(p)[0] || NOIMG)}" alt="${esc(p.name)}" class="w-full h-full object-cover"><span class="absolute bottom-1.5 left-1.5 text-[11px] bg-black/70 rounded-full px-2 py-0.5">📷 ${imgsOf(p).length} foto</span></div>
      <div class="p-2.5 sm:p-3 flex flex-col gap-1 flex-1">
        <h3 data-open="${p.id}" class="font-semibold text-xs sm:text-sm line-clamp-2 cursor-pointer hover:opacity-80">${esc(p.name)}</h3>
        <p class="text-xs text-neutral-400">${esc(p.category)}</p>
        <b class="acc text-sm sm:text-base">${lkr(p.price)}</b>
        <span class="text-xs ${badge[1]}">${badge[0]}</span>
        <button ${sizesOf(p).length ? "data-open" : "data-add"}="${p.id}" ${out ? "disabled" : ""} class="red mt-auto min-h-[44px] rounded-lg py-1.5 sm:py-2 text-xs sm:text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed">Tambah ke Keranjang</button>
      </div></article>`;
  }).join("");
}
function save() { localStorage.setItem("cv_cart2", JSON.stringify(cart)); renderCart(); }
function addToCart(id, size, q) {
  const p = products.find(x => x.id === id), l = cart.find(x => x.id === id && x.size === size);
  const n = Math.min((l ? l.q : 0) + q, p.stock);
  if (l) l.q = n; else cart.push({ id, size, q: n });
  save();
}
function cartLines() { return cart.map((l, i) => ({ p: products.find(x => x.id === l.id), q: l.q, size: l.size, i })).filter(l => l.p); }
function renderCart() {
  const lines = cartLines();
  $("#badge").textContent = lines.reduce((s, l) => s + l.q, 0);
  $("#total").textContent = lkr(lines.reduce((s, l) => s + l.q * l.p.price, 0));
  $("#items").innerHTML = lines.length ? lines.map(({ p, q, size, i }) => `<div class="flex gap-3 items-center">
    <img src="${esc(imgsOf(p)[0] || NOIMG)}" class="w-14 h-14 rounded-lg object-cover bg-black">
    <div class="flex-1 min-w-0 text-sm break-words"><div class="font-medium">${esc(p.name)}${size ? ` <span class="text-neutral-400">(${esc(size)})</span>` : ""}</div><div class="acc">${lkr(p.price)}</div></div>
    <div class="flex items-center gap-2"><button data-dec="${i}" class="qty" aria-label="Kurangi">−</button><span class="w-5 text-center">${q}</span><button data-inc="${i}" class="qty" aria-label="Tambah">+</button></div></div>`).join("")
    : `<p class="text-neutral-400 text-sm text-center mt-10">Keranjang masih kosong. Pilih produk untuk mulai berbelanja.</p>`;
}
function order() {
  const lines = cartLines(); if (!lines.length) return null;
  const sum = lines.map(({ p, q, size }, i) => `${i + 1}. ${p.name}${size ? " (" + size + ")" : ""} x${q} = ${lkr(p.price * q)}`).join("\n");
  return `Halo Sim Market (SIM), saya ingin memesan:\n\n${sum}\n\nTotal: ${lkr(lines.reduce((s, l) => s + l.q * l.p.price, 0))}`;
}
let cartOpen = false, lbOpen = false, tt;
const lockScroll = () => { document.documentElement.style.overflow = (m || cartOpen || lbOpen) ? "hidden" : ""; };
function openModal(id) { const p = products.find(x => x.id === id); if (!p) return; m = { p, size: null, q: 1, i: 0 }; drawModal(); $("#modal").classList.replace("hidden", "flex"); history.pushState({ ui: "modal" }, ""); lockScroll(); }
function hideModal() { $("#modal").classList.replace("flex", "hidden"); m = null; lockScroll(); }
function closeModal() { history.state && history.state.ui === "modal" ? history.back() : hideModal(); }
function openCart() { if (cartOpen) return; cartOpen = true; clearTimeout(tt); $("#toast").classList.replace("flex", "hidden"); $("#drawer").classList.remove("translate-x-full"); $("#shade").classList.remove("hidden"); history.pushState({ ui: "cart" }, ""); lockScroll(); }
function hideCart() { cartOpen = false; $("#drawer").classList.add("translate-x-full"); $("#shade").classList.add("hidden"); lockScroll(); }
function closeCart() { history.state && history.state.ui === "cart" ? history.back() : hideCart(); }
function openLb(src) { Z = { s: 1, x: 0, y: 0 }; applyZ(); $("#lbimg").src = src; lbOpen = true; $("#lb").classList.replace("hidden", "flex"); history.pushState({ ui: "lb" }, ""); lockScroll(); }
function hideLb() { lbOpen = false; $("#lb").classList.replace("flex", "hidden"); lockScroll(); }
function closeLb() { history.state && history.state.ui === "lb" ? history.back() : hideLb(); }
history.replaceState(null, "");
window.addEventListener("popstate", () => { if (lbOpen) hideLb(); else { if (m) hideModal(); if (cartOpen) hideCart(); } });
function toast(text) {
  const t = $("#toast"); $("#toastTxt").textContent = text; t.classList.replace("hidden", "flex");
  clearTimeout(tt); tt = setTimeout(() => t.classList.replace("flex", "hidden"), 2800);
}
function drawModal(err = "") {
  const { p, size, q } = m, out = p.stock <= 0, sz = sizesOf(p);
  const badge = out ? ["Habis", "text-red-500"] : p.stock <= 5 ? ["Sisa " + p.stock + " item", "text-amber-400"] : ["Stok tersedia: " + p.stock, "text-emerald-400"];
  const im = imgsOf(p), gi = Math.min(m.i, Math.max(0, im.length - 1));
  const gallery = `<div id="gal" class="relative bg-black/40 aspect-square select-none"><img data-zoom src="${esc(im[gi] || NOIMG)}" alt="${esc(p.name)}" class="w-full h-full object-cover cursor-zoom-in"><span class="absolute top-2 left-2 text-[11px] bg-black/70 rounded-full px-2 py-0.5 pointer-events-none">🔍 Ketuk untuk zoom</span>
    ${im.length > 1 ? `<button data-mgo="-1" class="gnav l" aria-label="Foto sebelumnya">‹</button><button data-mgo="1" class="gnav r" aria-label="Foto berikutnya">›</button><span class="absolute bottom-2 right-2 text-xs bg-black/70 rounded-full px-2 py-0.5">${gi + 1}/${im.length}</span>` : ""}</div>
    ${im.length > 1 ? `<div class="flex gap-2 p-2 overflow-x-auto">${im.map((u, k) => `<img data-mset="${k}" src="${esc(u)}" alt="Foto ${k + 1}" class="w-14 h-14 shrink-0 rounded-lg object-cover cursor-pointer ${k === gi ? "ring-2 ring-[var(--accent)]" : "opacity-60"}">`).join("")}</div>` : ""}`;
  $("#mbox").innerHTML = `<button data-mclose class="absolute top-2 right-2 w-11 h-11 rounded-full bg-black/60 text-2xl leading-none z-10 flex items-center justify-center" aria-label="Tutup">&times;</button>
  <div class="grid md:grid-cols-2">
    <div>${gallery}</div>
    <div class="p-5 flex flex-col gap-3">
      <p class="text-xs text-neutral-400">${esc(p.category)}</p>
      <h3 class="text-xl font-bold pr-10">${esc(p.name)}</h3>
      <b class="text-2xl acc">${lkr(p.price)}</b>
      <span class="text-sm ${badge[1]}">${badge[0]}</span>
      <p class="text-sm text-neutral-300 whitespace-pre-line">${esc(p.description) || "Belum ada deskripsi."}</p>
      ${sz.length ? `<div><div class="text-sm mb-2">Ukuran</div><div class="flex flex-wrap gap-2">${sz.map(x => `<button data-msz="${esc(x)}" class="pill ${x === size ? "on" : ""}">${esc(x)}</button>`).join("")}</div></div>` : ""}
      <div class="flex items-center gap-3"><span class="text-sm">Jumlah</span><button data-mq="-1" class="qty" aria-label="Kurangi">−</button><span class="w-6 text-center">${q}</span><button data-mq="1" class="qty" aria-label="Tambah">+</button></div>
      <div class="buy flex flex-col gap-2">
        ${err ? `<p class="text-amber-400 text-xs">${err}</p>` : ""}
        <div class="flex justify-between font-semibold"><span>Subtotal</span><span>${lkr(p.price * q)}</span></div>
        <button data-madd ${out ? "disabled" : ""} class="red rounded-xl py-3 font-semibold disabled:opacity-30 disabled:cursor-not-allowed">Tambah ke Keranjang</button>
      </div>
    </div></div>`;
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-c],[data-add],[data-inc],[data-dec],[data-open],[data-mclose],[data-msz],[data-mq],[data-madd],[data-mgo],[data-mset],[data-opencart],[data-zoom],[data-lbclose]"); if (!t) return;
  const d = t.dataset;
  if (d.c) { active = d.c; renderCats(); render(); }
  if (d.add) { addToCart(d.add, null, 1); toast("Ditambahkan ke keranjang"); }
  if (d.inc !== undefined) { const l = cart[d.inc], p = products.find(x => x.id === l.id); if (l.q < p.stock) l.q++; save(); }
  if (d.dec !== undefined) { if (--cart[d.dec].q <= 0) cart.splice(d.dec, 1); save(); }
  if (d.open) openModal(d.open);
  if (d.mclose !== undefined) closeModal();
  if (d.opencart !== undefined) openCart();
  if (d.zoom !== undefined && m) openLb(imgsOf(m.p)[Math.min(m.i, imgsOf(m.p).length - 1)] || NOIMG);
  if (d.lbclose !== undefined) closeLb();
  if (d.mgo) goTo(+d.mgo);
  if (d.mset !== undefined) { m.i = +d.mset; drawModal(); }
  if (d.msz) { m.size = d.msz; drawModal(); }
  if (d.mq) { m.q = Math.min(Math.max(1, m.q + +d.mq), Math.max(1, m.p.stock)); drawModal(); }
  if (d.madd !== undefined) {
    if (sizesOf(m.p).length && !m.size) return drawModal("Pilih ukuran dulu.");
    addToCart(m.p.id, m.size, m.q); closeModal(); toast("Ditambahkan ke keranjang");
  }
});
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
function goTo(step) { const n = imgsOf(m.p).length; if (n < 2) return; m.i = (m.i + step + n) % n; drawModal(); }
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { if (lbOpen) closeLb(); else if (cartOpen) closeCart(); else if (m) closeModal(); return; }
  if (!m || lbOpen) return; if (e.key === "ArrowLeft") goTo(-1); if (e.key === "ArrowRight") goTo(1);
});
let tx = null;
$("#mbox").addEventListener("touchstart", e => { tx = e.target.closest("#gal") ? e.touches[0].clientX : null; }, { passive: true });
$("#mbox").addEventListener("touchend", e => { if (tx === null || !m) return; const dx = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(dx) > 40) goTo(dx < 0 ? 1 : -1); });
$("#q").addEventListener("input", e => { term = e.target.value.trim(); render(); });
$("#openCart").onclick = openCart;
$("#closeCart").onclick = $("#shade").onclick = closeCart;
$("#wa").onclick = () => { const o = order(); if (o) window.open(`https://wa.me/${waNum()}?text=${encodeURIComponent(o)}`, "_blank"); };
$("#tg").onclick = () => { const o = order(); if (o) window.open(`https://t.me/${tgUser()}?text=${encodeURIComponent(o)}`, "_blank"); };
/* ===== MUSIK LATAR ===== */
const bgm = $("#bgm"); bgm.volume = 0.4; let userPaused = false;
const setBtn = () => { $("#musicBtn").textContent = bgm.paused ? "🔇" : "🔊"; };
const EVS = ["click", "touchend", "keydown"];
function startOnInteract(e) {
  if (userPaused || S.music_enabled === false || (e.target.closest && e.target.closest("#musicBtn"))) return;
  bgm.play().then(() => { EVS.forEach(ev => document.removeEventListener(ev, startOnInteract)); setBtn(); }).catch(() => {});
}
EVS.forEach(ev => document.addEventListener(ev, startOnInteract));
$("#musicBtn").onclick = () => { if (bgm.paused) { userPaused = false; bgm.play().catch(() => {}); } else { userPaused = true; bgm.pause(); } setBtn(); };
bgm.addEventListener("play", setBtn); bgm.addEventListener("pause", setBtn);

/* ===== ZOOM FOTO (cubit 2 jari / ketuk 2x / roda mouse) ===== */
let Z = { s: 1, x: 0, y: 0 }; const pts = new Map(); let pinch0 = 0, s0 = 1, lastTap = 0;
const applyZ = () => { $("#lbimg").style.transform = `translate(${Z.x}px,${Z.y}px) scale(${Z.s})`; };
const lb = $("#lb");
lb.addEventListener("pointerdown", e => {
  if (e.target.closest("[data-lbclose]")) return;
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); s0 = Z.s; }
  const now = Date.now();
  if (pts.size === 1 && now - lastTap < 300) { Z = Z.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 }; applyZ(); }
  lastTap = now;
});
lb.addEventListener("pointermove", e => {
  const p = pts.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (pts.size === 2) { const [a, b] = [...pts.values()]; Z.s = Math.min(5, Math.max(1, s0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch0)); }
  else if (Z.s > 1) { Z.x += dx; Z.y += dy; }
  applyZ();
});
const lbUp = e => { pts.delete(e.pointerId); if (Z.s <= 1.02) { Z = { s: 1, x: 0, y: 0 }; applyZ(); } };
lb.addEventListener("pointerup", lbUp); lb.addEventListener("pointercancel", lbUp);
lb.addEventListener("wheel", e => { e.preventDefault(); Z.s = Math.min(5, Math.max(1, Z.s * (e.deltaY < 0 ? 1.15 : 0.87))); if (Z.s === 1) { Z.x = 0; Z.y = 0; } applyZ(); }, { passive: false });

/* ===== REALTIME ===== */
let rt;
const reload = () => { clearTimeout(rt); rt = setTimeout(load, 300); };
if (db) db.channel("live-store")
  .on("postgres_changes", { event: "*", schema: "public", table: "products" }, reload)
  .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, reload)
  .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, loadSettings)
  .subscribe();
document.addEventListener("visibilitychange", () => { if (!document.hidden) reload(); });

load(); loadSettings();

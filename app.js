/* ===== KONFIGURASI ===== */
const SUPABASE_URL = "https://iashoonbusiyonhinvke.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhc2hvb25idXNpeW9uaGludmtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MTQxMzUsImV4cCI6MjEwODA5MDEzNX0.syeh_ZTmKZqgeM0A2LmrrB8zXyjQVT-ZEe31_92PhsY";
const WHATSAPP_NUMBER = "94XXXXXXXXX";
const TELEGRAM_USERNAME = "username_telegram";
const LOGO = "https://i.imgur.com/8l7kxaW.png";
const BANNER = "https://imgg.fr/r/ehx61nnc.webp";

const $ = s => document.querySelector(s);
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const NOIMG = "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='#151518'/><text x='50' y='54' font-size='9' fill='#666' text-anchor='middle' font-family='sans-serif'>Foto tidak tersedia</text></svg>");

document.addEventListener("error", e => {
  const el = e.target; if (!el || el.tagName !== "IMG" || el.dataset.fb) return; el.dataset.fb = 1;
  el.src = el.id === "logo" ? DEF_LOGO : el.id === "banner" ? DEF_BANNER : NOIMG;
}, true);

const lkr = n => "LKR " + Number(n).toLocaleString("en-US");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

let products = [], cats = [], active = "Semua", term = "";
let cart = JSON.parse(localStorage.getItem("cv_cart2") || "[]");
let m = null;

const imgsOf = p => (Array.isArray(p.images) && p.images.length ? p.images : (p.image_url ? [p.image_url] : []));
const sizesOf = p => (p.sizes || "").split(",").map(x => x.trim()).filter(Boolean);

const DEF_LOGO = "https://imgg.fr/r/TJFJEMW2.webp", DEF_BANNER = "https://imgg.fr/r/ehx61nnc.webp";
let S = {};
try { S = JSON.parse(localStorage.getItem("cv_settings") || "{}"); } catch (e) {}

const waNum = () => String(S.whatsapp || WHATSAPP_NUMBER).replace(/\D/g, "");
const tgUser = () => String(S.telegram || TELEGRAM_USERNAME).replace(/^https?:\/\/t\.me\//, "").replace(/^@/, "");

function applySettings() {
  const r = document.documentElement.style;
  r.setProperty("--accent", S.accent_color || "#b84040");
  r.setProperty("--bg", S.bg_color || "#0c0c0e");
  r.setProperty("--text", S.text_color || "#eeeeee");

  const logo = S.logo_url || DEF_LOGO, banner = S.banner_url || DEF_BANNER;
  if ($("#logo").getAttribute("src") !== logo) $("#logo").src = logo;
  if ($("#banner").getAttribute("src") !== banner) $("#banner").src = banner;

  const audio = document.getElementById("bgm"), song = S.music_url || "musiku.mp3", off = S.music_enabled === false;
  if (audio.getAttribute("src") !== song) {
    const was = !audio.paused;
    audio.src = song;
    if (was && !off) audio.play().catch(() => {});
  }
  if (off) audio.pause();
  document.getElementById("musicBtn").classList.toggle("hidden", off);
  document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(l => l.href = logo);
}

async function loadSettings() {
  if (!db) return;
  const { data, error } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) return;
  S = data || {};
  localStorage.setItem("cv_settings", JSON.stringify(S));
  applySettings();
}

/* Panggil di luar fungsi */
applySettings();
loadSettings();


const withTimeout = (pr, ms = 12000) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

function showError(on) {
  $("#err").classList.toggle("hidden", !on);
  if (on) { $("#grid").innerHTML = ""; $("#empty").classList.add("hidden"); $("#count").textContent = ""; }
}

async function load() {
  try {
    if (!db) throw new Error("no-supabase");
    const [p, c] = await withTimeout(Promise.all([
      db.from("products").select("*").order("created_at", { ascending: false }),
      db.from("categories").select("name").order("name")
    ]));
    if (p.error || c.error) throw (p.error || c.error);
    products = p.data || [];
    cats = (c.data || []).map(x => x.name);
    showError(false);
    renderCats();
    render();
    renderCart();
  } catch (e) {
    if (!products.length) showError(true);
  }
}

$("#retry").onclick = () => {
  $("#err").classList.add("hidden");
  $("#grid").innerHTML = '<div class="card animate-pulse aspect-[3/4] bg-neutral-900/50"></div>'.repeat(5);
  load();
};
window.addEventListener("online", load);

function renderCats() {
  $("#cats").innerHTML = ["Semua", ...cats].map(n =>
    `<button class="pill ${n === active ? "on" : ""}" data-c="${esc(n)}">${esc(n)}</button>`
  ).join("");
}

function render() {
  const t = term.toLowerCase();
  let list = products.filter(p => (active === "Semua" || p.category === active) &&
    (!t || `${p.name} ${p.category} ${p.description || ""}`.toLowerCase().includes(t)));

  const featuredView = active === "Semua" && !t;
  if (featuredView) {
    const f = list.filter(p => p.is_featured);
    if (f.length) list = f;
  }

  $("#title").textContent = featuredView ? "Produk Pilihan" : t ? "Hasil Pencarian" : active;
  $("#count").textContent = list.length + " produk";
  $("#empty").classList.toggle("hidden", list.length > 0);

  $("#grid").innerHTML = list.map(p => {
    const out = p.stock <= 0;
    const badge = out ? ["Habis", "text-red-400"] : p.stock <= 5 ? ["Sisa " + p.stock + " item", "text-amber-400"] : ["Tersedia (" + p.stock + ")", "text-neutral-400"];
    const imgCount = imgsOf(p).length;

    return `<article class="card flex flex-col group">
      <div data-open="${p.id}" class="relative cursor-pointer aspect-square bg-neutral-950 overflow-hidden flex items-center justify-center">
        <img loading="lazy" decoding="async" width="400" height="400" src="${esc(imgsOf(p)[0] || NOIMG)}" alt="${esc(p.name)}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
        ${imgCount > 1 ? `<span class="absolute bottom-2 left-2 text-[10px] font-medium bg-black/75 backdrop-blur-xs text-white rounded-full px-2 py-0.5 border border-white/10">📷 ${imgCount} foto</span>` : ""}
      </div>
      <div class="p-3 sm:p-3.5 flex flex-col gap-1.5 flex-1">
        <p class="text-[11px] text-neutral-400 font-medium uppercase tracking-wider">${esc(p.category)}</p>
        <h3 data-open="${p.id}" class="font-semibold text-xs sm:text-sm line-clamp-2 cursor-pointer hover:text-[var(--accent)] transition-colors">${esc(p.name)}</h3>
        <div class="mt-auto pt-2 flex items-center justify-between gap-1">
          <b class="acc text-sm sm:text-base tracking-tight font-bold">${lkr(p.price)}</b>
          <span class="text-xs ${badge[1]} font-medium">${badge[0]}</span>
        </div>
        <button ${sizesOf(p).length ? "data-open" : "data-add"}="${p.id}" ${out ? "disabled" : ""} class="red mt-2 min-h-[40px] rounded-xl py-2 text-xs sm:text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed shadow-sm">
          Tambah ke Keranjang
        </button>
      </div>
    </article>`;
  }).join("");
}

function triggerCartPop() {
  const b = $("#badge");
  b.classList.remove("cart-bounce");
  void b.offsetWidth;
  b.classList.add("cart-bounce");
}

function save() {
  localStorage.setItem("cv_cart2", JSON.stringify(cart));
  renderCart();
}

function addToCart(id, size, q) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const l = cart.find(x => x.id === id && x.size === size);
  const n = Math.min((l ? l.q : 0) + q, p.stock);
  if (l) l.q = n; else cart.push({ id, size, q: n });
  save();
  triggerCartPop();
}

function cartLines() {
  return cart.map((l, i) => ({ p: products.find(x => x.id === l.id), q: l.q, size: l.size, i })).filter(l => l.p);
}

function renderCart() {
  const lines = cartLines();
  $("#badge").textContent = lines.reduce((s, l) => s + l.q, 0);
  $("#total").textContent = lkr(lines.reduce((s, l) => s + l.q * l.p.price, 0));
  $("#items").innerHTML = lines.length ? lines.map(({ p, q, size, i }) => `<div class="flex gap-3 items-center bg-neutral-900/40 p-2.5 rounded-xl border border-neutral-800/80">
    <img src="${esc(imgsOf(p)[0] || NOIMG)}" class="w-14 h-14 rounded-lg object-cover bg-black shrink-0">
    <div class="flex-1 min-w-0 text-sm break-words">
      <div class="font-medium text-xs sm:text-sm line-clamp-1">${esc(p.name)}</div>
      ${size ? `<div class="text-xs text-neutral-400 font-medium">Ukuran: ${esc(size)}</div>` : ""}
      <div class="acc font-semibold text-xs mt-0.5">${lkr(p.price)}</div>
    </div>
    <div class="flex items-center gap-1.5 shrink-0">
      <button data-dec="${i}" class="qty" aria-label="Kurangi">−</button>
      <span class="w-5 text-center text-sm font-semibold">${q}</span>
      <button data-inc="${i}" class="qty" aria-label="Tambah">+</button>
    </div></div>`).join("")
    : `<div class="text-center py-12 px-4"><p class="text-neutral-400 text-sm">Keranjang masih kosong.</p><p class="text-neutral-500 text-xs mt-1">Pilih produk untuk mulai berbelanja.</p></div>`;
}

function order() {
  const lines = cartLines();
  if (!lines.length) return null;
  const sum = lines.map(({ p, q, size }, i) => `${i + 1}. ${p.name}${size ? " (" + size + ")" : ""} x${q} = ${lkr(p.price * q)}`).join("\n");
  return `Halo Sim Market (SIM), saya ingin memesan:\n\n${sum}\n\nTotal: ${lkr(lines.reduce((s, l) => s + l.q * l.p.price, 0))}`;
}

let cartOpen = false, lbOpen = false, tt;
const lockScroll = () => { document.documentElement.style.overflow = (m || cartOpen || lbOpen) ? "hidden" : ""; };

function openModal(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  m = { p, size: null, q: 1, i: 0 };
  drawModal();
  $("#modal").classList.replace("hidden", "flex");
  history.pushState({ ui: "modal" }, "");
  lockScroll();
}

function hideModal() {
  $("#modal").classList.replace("flex", "hidden");
  m = null;
  lockScroll();
}

function closeModal() {
  history.state && history.state.ui === "modal" ? history.back() : hideModal();
}

function openCart() {
  if (cartOpen) return;
  cartOpen = true;
  clearTimeout(tt);
  $("#toast").classList.replace("flex", "hidden");
  $("#drawer").classList.remove("translate-x-full");
  $("#shade").classList.remove("hidden");
  history.pushState({ ui: "cart" }, "");
  lockScroll();
}

function hideCart() {
  cartOpen = false;
  $("#drawer").classList.add("translate-x-full");
  $("#shade").classList.add("hidden");
  lockScroll();
}

function closeCart() {
  history.state && history.state.ui === "cart" ? history.back() : hideCart();
}

function openLb(src) {
  Z = { s: 1, x: 0, y: 0 };
  applyZ();
  $("#lbimg").src = src;
  lbOpen = true;
  $("#lb").classList.replace("hidden", "flex");
  history.pushState({ ui: "lb" }, "");
  lockScroll();
}

function hideLb() {
  lbOpen = false;
  $("#lb").classList.replace("flex", "hidden");
  lockScroll();
}

function closeLb() {
  history.state && history.state.ui === "lb" ? history.back() : hideLb();
}

history.replaceState(null, "");
window.addEventListener("popstate", () => {
  if (lbOpen) hideLb();
  else {
    if (m) hideModal();
    if (cartOpen) hideCart();
  }
});

function toast(text) {
  const t = $("#toast");
  $("#toastTxt").textContent = text;
  t.classList.replace("hidden", "flex");
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.replace("flex", "hidden"), 2800);
}

function drawModal(err = "") {
  const { p, size, q } = m, out = p.stock <= 0, sz = sizesOf(p);
  const badge = out
    ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">Habis</span>`
    : p.stock <= 5
    ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Sisa ${p.stock} item</span>`
    : `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Tersedia (${p.stock})</span>`;

  const im = imgsOf(p), gi = Math.min(m.i, Math.max(0, im.length - 1));
  const gallery = `<div id="gal" class="relative bg-black/50 aspect-square select-none">
    <img data-zoom src="${esc(im[gi] || NOIMG)}" alt="${esc(p.name)}" class="w-full h-full object-cover cursor-zoom-in">
    <span class="absolute top-2.5 left-2.5 text-[11px] bg-black/75 backdrop-blur-xs rounded-full px-2.5 py-0.5 pointer-events-none border border-white/10">🔍 Ketuk untuk zoom</span>
    ${im.length > 1 ? `<button data-mgo="-1" class="gnav l" aria-label="Foto sebelumnya">‹</button><button data-mgo="1" class="gnav r" aria-label="Foto berikutnya">›</button><span class="absolute bottom-2.5 right-2.5 text-xs bg-black/75 rounded-full px-2.5 py-0.5 border border-white/10">${gi + 1}/${im.length}</span>` : ""}
  </div>
  ${im.length > 1 ? `<div class="flex gap-2 p-2.5 overflow-x-auto">${im.map((u, k) => `<img data-mset="${k}" src="${esc(u)}" alt="Foto ${k + 1}" class="w-14 h-14 shrink-0 rounded-lg object-cover cursor-pointer ${k === gi ? "ring-2 ring-[var(--accent)]" : "opacity-60"}">`).join("")}</div>` : ""}`;

  $("#mbox").innerHTML = `
    <button data-mclose class="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-2xl leading-none z-10 flex items-center justify-center text-white" aria-label="Tutup">&times;</button>
    <div class="grid md:grid-cols-2">
      <div>${gallery}</div>
      <div class="p-5 flex flex-col gap-3">
        <p class="text-xs text-neutral-400 font-semibold tracking-wider uppercase">${esc(p.category)}</p>
        <h3 class="text-xl font-bold pr-10 leading-snug">${esc(p.name)}</h3>
        <div class="flex items-center gap-3">
  <b class="text-2xl acc font-bold">${lkr(p.price)}</b>
  <span class="text-sm ${badge[1]} font-medium">${badge[0]}</span>
</div>
        <p class="text-sm text-neutral-300 whitespace-pre-line leading-relaxed">${esc(p.description) || "Belum ada deskripsi untuk produk ini."}</p>
        
        ${sz.length ? `<div class="pt-1"><div class="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Pilih Ukuran</div><div class="flex flex-wrap gap-2">${sz.map(x => `<button data-msz="${esc(x)}" class="pill ${x === size ? "on" : ""}">${esc(x)}</button>`).join("")}</div></div>` : ""}
        
        <div class="flex items-center gap-3 pt-2">
          <span class="text-sm font-medium">Jumlah</span>
          <button data-mq="-1" class="qty" aria-label="Kurangi">−</button>
          <span class="w-6 text-center font-bold">${q}</span>
          <button data-mq="1" class="qty" aria-label="Tambah">+</button>
        </div>

        <div class="buy flex flex-col gap-2 mt-4">
          ${err ? `<p class="text-amber-400 text-xs">${err}</p>` : ""}
          <div class="flex justify-between font-semibold text-sm"><span>Subtotal</span><span class="acc">${lkr(p.price * q)}</span></div>
          <button data-madd ${out ? "disabled" : ""} class="red rounded-xl py-3 font-semibold text-sm disabled:opacity-30 disabled:cursor-not-allowed shadow-md">
            Tambah ke Keranjang
          </button>
        </div>
      </div>
    </div>`;
}

/* Event Delegation Klik */
document.addEventListener("click", e => {
  const t = e.target.closest("[data-c],[data-add],[data-inc],[data-dec],[data-open],[data-mclose],[data-msz],[data-mq],[data-madd],[data-mgo],[data-mset],[data-opencart],[data-zoom],[data-lbclose]");
  if (!t) return;
  const d = t.dataset;
  if (d.c) { active = d.c; renderCats(); render(); }
  if (d.add) { addToCart(d.add, null, 1); toast("Ditambahkan ke keranjang"); }
  if (d.inc !== undefined) { const l = cart[d.inc], p = products.find(x => x.id === l.id); if (l && p && l.q < p.stock) l.q++; save(); }
  if (d.dec !== undefined && cart[d.dec]) { if (--cart[d.dec].q <= 0) cart.splice(d.dec, 1); save(); }
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
    if (sizesOf(m.p).length && !m.size) return drawModal("Pilih ukuran dulu sebelum memesan.");
    addToCart(m.p.id, m.size, m.q);
    closeModal();
    toast("Ditambahkan ke keranjang");
  }
});

$("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });

function goTo(step) {
  const n = imgsOf(m.p).length;
  if (n < 2) return;
  m.i = (m.i + step + n) % n;
  drawModal();
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") { if (lbOpen) closeLb(); else if (cartOpen) closeCart(); else if (m) closeModal(); return; }
  if (!m || lbOpen) return;
  if (e.key === "ArrowLeft") goTo(-1);
  if (e.key === "ArrowRight") goTo(1);
});

let tx = null;
$("#mbox").addEventListener("touchstart", e => { tx = e.target.closest("#gal") ? e.touches[0].clientX : null; }, { passive: true });
$("#mbox").addEventListener("touchend", e => {
  if (tx === null || !m) return;
  const dx = e.changedTouches[0].clientX - tx;
  tx = null;
  if (Math.abs(dx) > 40) goTo(dx < 0 ? 1 : -1);
});

/* Pencarian Cepat dengan Debounce */
let searchDebounce;
$("#q").addEventListener("input", e => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    term = e.target.value.trim();
    render();
  }, 180);
});

$("#openCart").onclick = openCart;
$("#closeCart").onclick = $("#shade").onclick = closeCart;
$("#wa").onclick = () => { const o = order(); if (o) window.open(`https://wa.me/${waNum()}?text=${encodeURIComponent(o)}`, "_blank"); };
$("#tg").onclick = () => { const o = order(); if (o) window.open(`https://t.me/${tgUser()}?text=${encodeURIComponent(o)}`, "_blank"); };

/* ===== MUSIK LATAR (Auto-Play pada Sentuhan/Klik Pertama) ===== */
const bgm = $("#bgm");
bgm.volume = 0.4;
let userPaused = false;

const setBtn = () => {
  $("#musicBtn").textContent = bgm.paused ? "🔇" : "🔊";
};

const EVS = ["click", "touchend", "keydown"];

function startOnInteract(e) {
  if (userPaused || S.music_enabled === false || (e.target.closest && e.target.closest("#musicBtn"))) return;
  bgm.play().then(() => {
    EVS.forEach(ev => document.removeEventListener(ev, startOnInteract));
    setBtn();
  }).catch(() => {});
}

EVS.forEach(ev => document.addEventListener(ev, startOnInteract));

$("#musicBtn").onclick = () => {
  if (bgm.paused) {
    userPaused = false;
    bgm.play().catch(() => {});
  } else {
    userPaused = true;
    bgm.pause();
  }
  setBtn();
};

bgm.addEventListener("play", setBtn);
bgm.addEventListener("pause", setBtn);

/* ===== ZOOM FOTO LIGHTBOX ===== */
let Z = { s: 1, x: 0, y: 0 };
const pts = new Map();
let pinch0 = 0, s0 = 1, lastTap = 0;
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
lb.addEventListener("pointerup", lbUp);
lb.addEventListener("pointercancel", lbUp);
lb.addEventListener("wheel", e => {
  e.preventDefault();
  Z.s = Math.min(5, Math.max(1, Z.s * (e.deltaY < 0 ? 1.15 : 0.87)));
  if (Z.s === 1) { Z.x = 0; Z.y = 0; }
  applyZ();
}, { passive: false });

/* ===== REALTIME SUPABASE ===== */
let rt;
const reload = () => { clearTimeout(rt); rt = setTimeout(load, 300); };
if (db) {
  db.channel("live-store")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, reload)
    .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, reload)
    .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, loadSettings)
    .subscribe();
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) reload(); });

/* Load data awal */
load();
loadSettings();

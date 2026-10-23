const SUPABASE_URL = "https://iashoonbusiyonhinvke.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhc2hvb25idXNpeW9uaGludmtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MTQxMzUsImV4cCI6MjEwODA5MDEzNX0.syeh_ZTmKZqgeM0A2LmrrB8zXyjQVT-ZEe31_92PhsY";
const LOGO = "https://i.imgur.com/8l7kxaW.png";

const $ = s => document.querySelector(s);
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const lkr = n => "LKR " + Number(n).toLocaleString("en-US");
let products = [];
document.querySelectorAll(".logo").forEach(i => i.src = LOGO);

function msg(t, ok = true) { const m = $("#msg"); m.textContent = t; m.className = "md:col-span-2 text-sm " + (ok ? "text-emerald-400" : "text-red-400"); }
let shown = null;
function show(session) {
  const on = !!session;
  $("#login").classList.toggle("hidden", on); $("#panel").classList.toggle("hidden", !on);
  if (on && shown !== session.user.id) { shown = session.user.id; setTimeout(refresh, 0); }
  if (!on) shown = null;
}

$("#loginBtn").onclick = async () => {
  const err = $("#lerr"); err.textContent = "";
  if (SUPABASE_URL.startsWith("ISI_") || SUPABASE_ANON_KEY.startsWith("ISI_")) { err.textContent = "SUPABASE_URL / SUPABASE_ANON_KEY di admin.html belum diisi."; return; }
  $("#loginBtn").disabled = true;
  const { data, error } = await db.auth.signInWithPassword({ email: $("#email").value.trim(), password: $("#pass").value });
  $("#loginBtn").disabled = false;
  if (error) { err.textContent = "Gagal masuk: " + error.message; return; }
  show(data.session);
};
$("#pass").addEventListener("keydown", e => e.key === "Enter" && $("#loginBtn").click());
$("#logout").onclick = async () => { await db.auth.signOut(); show(null); };
// Jangan panggil query Supabase langsung di dalam callback ini (bisa menyebabkan deadlock)
db.auth.onAuthStateChange((_e, s) => setTimeout(() => show(s), 0));

const BUCKET = "product-images";
let imgs = []; const MAX_IMGS = 8;   // [{url} | {file, preview}]
function renderImgs() {
  $("#imglist").innerHTML = imgs.map((it, i) => `<div class="relative w-20 h-20">
    <img src="${esc(it.preview || it.url)}" class="w-20 h-20 rounded-lg object-cover bg-black ${i === 0 ? "ring-2 ring-red-500" : ""}">
    <button type="button" data-rm="${i}" class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-sm leading-none" aria-label="Hapus foto">×</button>
    ${i === 0 ? `<span class="absolute bottom-0 inset-x-0 text-[10px] text-center bg-red-700/90 rounded-b-lg">Utama</span>` : `<button type="button" data-first="${i}" class="absolute bottom-0 inset-x-0 text-[10px] bg-black/80 rounded-b-lg">Jadikan utama</button>`}</div>`).join("");
  $("#imgcount").textContent = imgs.length;
}
function addImgs(list) {
  for (const it of list) { if (imgs.length >= MAX_IMGS) { msg("Maksimal " + MAX_IMGS + " foto per produk.", false); break; } imgs.push(it); }
  renderImgs();
}
$("#imglist").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.rm !== undefined) imgs.splice(+b.dataset.rm, 1);
  if (b.dataset.first !== undefined) imgs.unshift(...imgs.splice(+b.dataset.first, 1));
  renderImgs();
});
$("#drop").onclick = () => $("#file").click();
$("#file").onchange = e => { addImgs([...e.target.files].map(f => ({ file: f, preview: URL.createObjectURL(f) }))); e.target.value = ""; };
$("#addUrl").onclick = () => { const u = $("#image_url").value.trim(); if (!u) return; addImgs([{ url: u }]); $("#image_url").value = ""; };
async function shrink(file, max = 800, alpha = false) {
  const bmp = await createImageBitmap(file), r = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
  const x = c.getContext("2d"); if (!alpha) { x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); } x.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(res, "image/webp", .8));
}
async function upload(file, max = 800, alpha = false) {
  const blob = await shrink(file, max, alpha), path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const { error } = await db.storage.from(BUCKET).upload(path, blob, { contentType: "image/webp" });
  if (error) throw error;
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
/* ===== PENGATURAN ===== */
const DEF_LOGO = "https://i.imgur.com/8l7kxaW.png", DEF_BANNER = "https://i.imgur.com/by7sk5x.png";
const PRESETS = { Merah: ["#b84040", "#050505", "#eeeeee"], Biru: ["#2f6fd6", "#05080f", "#eef3ff"], Hijau: ["#2e9f66", "#040a07", "#eefaf3"], Ungu: ["#8b5cc9", "#08050f", "#f3eeff"], Emas: ["#c9a02f", "#0a0804", "#fff8e6"] };
const sFiles = { logo: null, banner: null, music: null };
const DEF_MUSIC = "musiku.mp3";
async function uploadAudio(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Ukuran lagu maksimal 10 MB");
  const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp3";
  const path = `music/${Date.now()}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type || "audio/mpeg" });
  if (error) throw error;
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
$("#s_music_pick").onclick = () => $("#s_music_file").click();
$("#s_music_file").onchange = e => { const f = e.target.files[0]; if (!f) return; sFiles.music = f; $("#s_music_audio").src = URL.createObjectURL(f); $("#s_music_name").textContent = f.name + " (belum disimpan)"; };
function sMsg(t, ok = true) { const m = $("#smsg"); m.textContent = t; m.className = "text-sm " + (ok ? "text-emerald-400" : "text-red-400"); }
function setColors(acc, bg, tx) { $("#c_accent").value = acc; $("#c_bg").value = bg; $("#c_text").value = tx; prevColors(); }
function prevColors() { $("#cprev").style.background = $("#c_bg").value; $("#cprev").style.color = $("#c_text").value; $("#cprevb").style.background = $("#c_accent").value; }
["c_accent", "c_bg", "c_text"].forEach(id => $("#" + id).addEventListener("input", prevColors));
$("#presets").innerHTML = Object.keys(PRESETS).map(n => `<button type="button" data-p="${n}" class="tab !py-1.5" style="border-color:${PRESETS[n][0]}">${n}</button>`).join("") + `<span class="text-xs text-neutral-500 self-center">pilih preset atau atur manual</span>`;
$("#presets").addEventListener("click", e => { const b = e.target.closest("[data-p]"); if (b) setColors(...PRESETS[b.dataset.p]); });
["logo", "banner"].forEach(k => {
  $(`#s_${k}_drop`).onclick = () => $(`#s_${k}_file`).click();
  $(`#s_${k}_file`).onchange = e => { const f = e.target.files[0]; if (!f) return; sFiles[k] = f; $(`#s_${k}_img`).src = URL.createObjectURL(f); };
});
async function loadSettings() {
  const { data, error } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) return sMsg("Gagal memuat pengaturan: " + error.message + " (sudah menjalankan settings.sql?)", false);
  const s = data || {};
  $("#s_wa").value = s.whatsapp || ""; $("#s_tg").value = s.telegram || "";
  $("#s_logo_img").src = s.logo_url || DEF_LOGO; $("#s_banner_img").src = s.banner_url || DEF_BANNER;
  setColors(s.accent_color || "#b84040", s.bg_color || "#050505", s.text_color || "#eeeeee");
  $("#s_music_audio").src = s.music_url || "/" + DEF_MUSIC; $("#s_music_name").textContent = s.music_url ? "Lagu kustom" : "Lagu bawaan (musiku.mp3)";
  $("#s_music_on").checked = s.music_enabled !== false;
  sFiles.logo = sFiles.banner = sFiles.music = null;
}
$("#sform").onsubmit = async e => {
  e.preventDefault();
  const row = { id: 1, whatsapp: $("#s_wa").value.replace(/\D/g, "") || null, telegram: $("#s_tg").value.trim().replace(/^https?:\/\/t\.me\//, "").replace(/^@/, "") || null,
    accent_color: $("#c_accent").value, bg_color: $("#c_bg").value, text_color: $("#c_text").value, music_enabled: $("#s_music_on").checked, updated_at: new Date().toISOString() };
  try {
    sMsg("Menyimpan...");
    if (sFiles.logo) row.logo_url = await upload(sFiles.logo, 512, true);
    if (sFiles.banner) row.banner_url = await upload(sFiles.banner, 1600, false);
    if (sFiles.music) row.music_url = await uploadAudio(sFiles.music);
  } catch (err) { return sMsg("Gagal mengunggah gambar: " + err.message, false); }
  const { error } = await db.from("settings").upsert(row);
  if (error) return sMsg("Gagal menyimpan: " + error.message, false);
  sMsg("Pengaturan tersimpan. Halaman toko akan ikut berubah."); sFiles.logo = sFiles.banner = sFiles.music = null; loadSettings();
};
document.querySelectorAll("[data-reset]").forEach(b => b.onclick = async () => {
  const { error } = await db.from("settings").upsert({ id: 1, [b.dataset.reset]: null });
  error ? sMsg("Gagal: " + error.message, false) : (sMsg("Dikembalikan ke bawaan."), loadSettings());
});
document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => {
  $("#tabProducts").classList.toggle("hidden", b.dataset.tab !== "products");
  $("#tabSettings").classList.toggle("hidden", b.dataset.tab !== "settings");
  document.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("on", x === b));
  if (b.dataset.tab === "settings") loadSettings();
});

async function loadCats(sel) {
  const { data } = await db.from("categories").select("name").order("name");
  $("#category").innerHTML = (data || []).map(c => `<option>${esc(c.name)}</option>`).join("");
  if (sel) $("#category").value = sel;
}
async function refresh() {
  await loadCats();
  const { data, error } = await db.from("products").select("*").order("created_at", { ascending: false });
  if (error) return msg("Gagal memuat produk: " + error.message, false);
  products = data;
  $("#rows").innerHTML = products.map(p => `<tr class="border-t border-red-950">
    <td class="p-2 flex items-center gap-2"><img src="${esc(p.image_url)}" class="w-10 h-10 rounded object-cover bg-black">${esc(p.name)}</td>
    <td>${esc(p.category)}</td><td>${lkr(p.price)}</td><td>${p.stock}</td><td>${p.is_featured ? "Ya" : "-"}</td>
    <td class="text-right whitespace-nowrap"><button data-e="${p.id}" class="text-sky-400 mr-3">Edit</button><button data-d="${p.id}" class="text-red-400">Hapus</button></td></tr>`).join("")
    || `<tr><td colspan="6" class="p-4 text-neutral-400">Belum ada produk. Tambahkan produk pertama lewat form di atas.</td></tr>`;
}
function reset() { $("#form").reset(); imgs = []; renderImgs(); $("#pid").value = ""; $("#ftitle").textContent = "Tambah Produk"; $("#cancel").classList.add("hidden"); }
$("#cancel").onclick = reset;

$("#form").onsubmit = async e => {
  e.preventDefault();
  const urls = [];
  try { msg("Mengunggah gambar..."); for (const it of imgs) urls.push(it.file ? await upload(it.file) : it.url); }
  catch (err) { return msg("Gagal mengunggah gambar: " + err.message, false); }
  const row = { name: $("#name").value.trim(), category: $("#category").value, price: +$("#price").value, stock: parseInt($("#stock").value),
    image_url: urls[0] || null, images: urls, sizes: $("#sizes").value.trim() || null, description: $("#description").value.trim() || null, is_featured: $("#is_featured").checked };
  const id = $("#pid").value;
  const { error } = id ? await db.from("products").update(row).eq("id", id) : await db.from("products").insert(row);
  if (error) return msg("Gagal menyimpan: " + error.message, false);
  msg(id ? "Produk diperbarui." : "Produk ditambahkan."); reset(); refresh();
};
$("#addCat").onclick = async () => {
  const name = prompt("Nama kategori baru:"); if (!name || !name.trim()) return;
  const { error } = await db.from("categories").insert({ name: name.trim() });
  if (error) return msg("Gagal menambah kategori: " + error.message, false);
  loadCats(name.trim());
};
$("#rows").addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.e) {
    const p = products.find(x => x.id === b.dataset.e);
    $("#pid").value = p.id; $("#name").value = p.name; $("#category").value = p.category; $("#price").value = p.price;
    $("#stock").value = p.stock; imgs = (p.images && p.images.length ? p.images : (p.image_url ? [p.image_url] : [])).map(u => ({ url: u })); renderImgs(); $("#sizes").value = p.sizes || ""; $("#description").value = p.description || "";
    $("#is_featured").checked = p.is_featured; $("#ftitle").textContent = "Edit Produk"; $("#cancel").classList.remove("hidden");
    scrollTo({ top: 0, behavior: "smooth" });
  }
  if (b.dataset.d && confirm("Hapus produk ini?")) {
    const { error } = await db.from("products").delete().eq("id", b.dataset.d);
    error ? msg("Gagal menghapus: " + error.message, false) : refresh();
  }
});

/* ===== BERSIHKAN FILE SAMPAH (Supabase Storage) ===== */
let junk = [], junkSize = 0;
const fmt = n => n > 1048576 ? (n / 1048576).toFixed(2) + " MB" : (n / 1024).toFixed(1) + " KB";
function cMsg(t, ok = true) { const m = $("#cmsg"); m.textContent = t; m.className = "text-sm " + (ok ? "text-emerald-400" : "text-red-400"); }
const pathOf = u => { const k = "/object/public/" + BUCKET + "/", i = String(u || "").indexOf(k); return i < 0 ? null : decodeURIComponent(u.slice(i + k.length).split("?")[0]); };
async function listAll(prefix = "") {
  const out = []; let offset = 0;
  for (;;) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    for (const f of data) {
      const p = prefix ? prefix + "/" + f.name : f.name;
      if (f.id === null) out.push(...await listAll(p));
      else if (!f.name.startsWith(".")) out.push({ path: p, size: (f.metadata && f.metadata.size) || 0, time: new Date(f.created_at || f.updated_at || 0).getTime() });
    }
    if (data.length < 100) break; offset += 100;
  }
  return out;
}
$("#scanBtn").onclick = async () => {
  $("#cleanBtn").classList.add("hidden"); $("#clist").innerHTML = ""; $("#cinfo").textContent = ""; cMsg("Memindai penyimpanan...");
  try {
    const [files, pr, st] = await Promise.all([listAll(), db.from("products").select("image_url,images"), db.from("settings").select("logo_url,banner_url,music_url")]);
    if (pr.error) throw pr.error; if (st.error) throw st.error;
    const used = new Set();
    pr.data.forEach(p => [p.image_url, ...(p.images || [])].forEach(u => { const x = pathOf(u); if (x) used.add(x); }));
    st.data.forEach(s => [s.logo_url, s.banner_url, s.music_url].forEach(u => { const x = pathOf(u); if (x) used.add(x); }));
    const now = Date.now();   // file < 10 menit tidak disentuh (mungkin baru diunggah)
    junk = files.filter(f => !used.has(f.path) && now - f.time > 10 * 60 * 1000);
    junkSize = junk.reduce((s, f) => s + f.size, 0);
    const total = files.reduce((s, f) => s + f.size, 0);
    $("#cinfo").textContent = `Total ${files.length} file (${fmt(total)}). Terpakai ${files.length - junk.length} file. Sampah: ${junk.length} file (${fmt(junkSize)}).`;
    $("#clist").innerHTML = junk.map(f => `<li>${esc(f.path)} — ${fmt(f.size)}</li>`).join("");
    cMsg(junk.length ? "Pindai selesai." : "Penyimpanan sudah bersih, tidak ada file sampah.");
    $("#cleanBtn").classList.toggle("hidden", !junk.length);
  } catch (err) { cMsg("Gagal memindai: " + err.message, false); }
};
$("#cleanBtn").onclick = async () => {
  if (!junk.length || !confirm(`Hapus ${junk.length} file sampah (${fmt(junkSize)}) secara permanen? Tindakan ini tidak bisa dibatalkan.`)) return;
  const paths = junk.map(f => f.path); let removed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const { data, error } = await db.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) return cMsg("Gagal menghapus: " + error.message, false);
    removed += data.length;
  }
  cMsg(removed === paths.length ? `Berhasil menghapus ${removed} file (${fmt(junkSize)}).` : `Terhapus ${removed} dari ${paths.length} file. Periksa kebijakan Storage di Supabase.`, removed === paths.length);
  junk = []; $("#cleanBtn").classList.add("hidden"); $("#clist").innerHTML = ""; $("#cinfo").textContent = "";
};

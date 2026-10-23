// Dijalankan Vercel saat deploy: membuat tailwind.css lalu menyalin situs ke folder "public"
const fs = require("fs"), { execSync } = require("child_process");
execSync("npx tailwindcss -i ./input.css -o ./tailwind.css --minify", { stdio: "inherit" });
fs.rmSync("public", { recursive: true, force: true });
fs.mkdirSync("public");
const skip = new Set(["build.js", "tailwind.config.js", "package.json", "package-lock.json", "vercel.json"]);
for (const f of fs.readdirSync(".")) {
  if (skip.has(f) || !fs.statSync(f).isFile()) continue;
  if (/\.(html|js|css|mp3|png|jpe?g|webp|svg|ico|txt|webmanifest)$/i.test(f)) fs.copyFileSync(f, "public/" + f);
}
console.log("Build selesai:", fs.readdirSync("public").join(", "));

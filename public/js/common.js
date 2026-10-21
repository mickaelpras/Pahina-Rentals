import { getLang } from "./i18n.js";

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const peso = (n) => n == null ? "—" : "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function fmtDate(d, opts = { weekday: "short", month: "short", day: "numeric" }) {
  if (!d) return "—";
  const loc = getLang() === "tl" ? "fil-PH" : "en-PH";
  try { return new Date(d + "T12:00:00Z").toLocaleDateString(loc, { ...opts, timeZone: "UTC" }); } catch { return d; }
}
export const fmtRange = (a, b) => (a === b ? fmtDate(a) : `${fmtDate(a)} – ${fmtDate(b)}`);
export const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
export const fmtPhone = (p) => (p && p.startsWith("+63") ? "0" + p.slice(3, 6) + " " + p.slice(6, 9) + " " + p.slice(9) : p || "");

export class ApiError extends Error { constructor(code, status, extra) { super(code); this.code = code; this.status = status; this.extra = extra; } }

export async function api(path, { method = "GET", body, headers = {}, raw = false } = {}) {
  const init = { method, headers: { ...headers } };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) { init.body = JSON.stringify(body); init.headers["content-type"] = "application/json"; }
  let r;
  try { r = await fetch(path, init); } catch { throw new ApiError("network", 0); }
  if (r.status === 429) throw new ApiError("rate", 429);
  if (raw) { if (!r.ok) throw new ApiError("http_" + r.status, r.status); return r; }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const { error, ...extra } = data; throw new ApiError(error || "generic", r.status, extra); }
  return data;
}

// Shrink photos on the phone before upload (GCash screenshots can be 3-8 MB).
export async function compressImage(file, maxSide = 1600, quality = 0.82) {
  if (!file || !file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", quality));
    return blob ? new File([blob], (file.name || "image").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

let toastTimer;
export function toast(msg, kind = "") {
  let el = $("#toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); document.body.append(el); }
  el.textContent = msg; el.className = "toast show " + kind;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.className = "toast " + kind), 3200);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.append(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  }
}

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

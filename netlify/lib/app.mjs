// Pahina Rentals API — framework-free so it can run on Netlify Functions or a local test server.
// createApp({ data, files, env }) returns handle(request, params) -> Response.
//   data  : key/value store for JSON (items/*, bookings/*, settings)
//   files : binary store (proof screenshots, item photos)
import { SEED_ITEMS, DEFAULT_SETTINGS, CATEGORIES, TOWNS } from "./seed.mjs";

const ACTIVE = new Set(["requested", "confirmed", "out"]);
const STATUSES = ["requested", "confirmed", "out", "returned", "cancelled"];
const MAX_UPLOAD = 4.5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// ---------- helpers ----------
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const fail = (code, status = 400, extra = {}) => json({ error: code, ...extra }, status);

export const todayManila = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
export const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
const eachDay = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = (n) => { const b = crypto.getRandomValues(new Uint8Array(n)); return Array.from(b, (x) => ALPHA[x % ALPHA.length]).join(""); };
const randomHex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => x.toString(16).padStart(2, "0")).join("");
const safeEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0;
};
const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v, min, max) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
const money = (v) => { const n = Math.round(Number(v) * 100) / 100; return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? n : null; };
const normPhone = (p) => {
  const d = String(p || "").replace(/[^\d+]/g, "");
  if (/^09\d{9}$/.test(d)) return "+63" + d.slice(1);
  if (/^\+639\d{9}$/.test(d)) return d;
  if (/^639\d{9}$/.test(d)) return "+" + d;
  return null;
};

// ---------- money / status derived values ----------
export function summarize(b) {
  const damages = (b.damages || []).reduce((s, d) => s + (d.charge || 0), 0);
  const grandTotal = b.subtotal + (b.deliveryFee || 0) + damages;
  const paid = (b.payments || []).filter((p) => p.status === "verified").reduce((s, p) => s + p.amount, 0);
  const pending = (b.payments || []).filter((p) => p.status === "submitted").reduce((s, p) => s + p.amount, 0);
  return { damages, grandTotal, paid, pending, balance: Math.max(0, Math.round((grandTotal - paid) * 100) / 100), depositMet: paid >= b.depositRequired };
}

function holdsStock(b, settings, now = Date.now()) {
  if (!ACTIVE.has(b.status)) return false;
  if (b.status === "requested" && !(b.payments || []).length) {
    const age = now - Date.parse(b.createdAt);
    if (age > settings.holdHours * 3600_000) return false; // unpaid request expired
  }
  return true;
}

export function availability(items, bookings, settings, from, to, ignoreRef = null) {
  const days = eachDay(from, to);
  const used = {}; // itemId -> {day -> qty}
  for (const b of bookings) {
    if (b.ref === ignoreRef || !holdsStock(b, settings)) continue;
    if (b.blockTo < from || b.blockFrom > to) continue;
    for (const l of b.lines) {
      const m = (used[l.itemId] ||= {});
      for (const d of days) if (d >= b.blockFrom && d <= b.blockTo) m[d] = (m[d] || 0) + l.qty;
    }
  }
  const out = {};
  for (const it of items) {
    const peak = Math.max(0, ...days.map((d) => used[it.id]?.[d] || 0));
    out[it.id] = Math.max(0, it.qty - (it.outOfService || 0) - peak);
  }
  return out;
}

function publicBooking(b) {
  const { token, notes, ...rest } = b;
  return {
    ...rest,
    payments: (b.payments || []).map(({ proofKey, ...p }) => ({ ...p, hasProof: !!proofKey })),
    damages: (b.damages || []).map(({ id, itemId, qty, note, charge, at }) => ({ id, itemId, qty, note, charge, at })),
    summary: summarize(b),
  };
}
const adminBooking = (b) => ({ ...b, summary: summarize(b), token: undefined, statusLink: `/#/b/${b.ref}?t=${b.token}` });

// ---------- app ----------
export function createApp({ data, files, env }) {
  const getJSON = (k) => data.get(k, { type: "json" });

  async function loadSettings() {
    const s = await getJSON("settings");
    return { ...DEFAULT_SETTINGS, ...(s || {}), deliveryFees: { ...(s?.deliveryFees || DEFAULT_SETTINGS.deliveryFees) } };
  }
  async function listJSON(prefix) {
    const { blobs } = await data.list({ prefix });
    const vals = await Promise.all(blobs.map((x) => getJSON(x.key)));
    return vals.filter(Boolean);
  }
  async function loadItems() {
    let items = await listJSON("items/");
    if (!items.length && !(await getJSON("meta/seeded"))) {
      await Promise.all(SEED_ITEMS.map((it) => data.setJSON(`items/${it.id}`, { ...it, outOfService: 0, active: true, sort: SEED_ITEMS.indexOf(it) })));
      await data.setJSON("meta/seeded", { at: new Date().toISOString() });
      items = await listJSON("items/");
    }
    return items.sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999) || a.id.localeCompare(b.id));
  }
  const loadBookings = () => listJSON("bookings/");
  const getBooking = (ref) => (/^PR-[A-Z0-9]{6}$/.test(ref || "") ? getJSON(`bookings/${ref}`) : null);
  const saveBooking = (b) => { b.updatedAt = new Date().toISOString(); return data.setJSON(`bookings/${b.ref}`, b); };

  function priceLines(lines, items, days) {
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    const out = []; const seen = new Set();
    for (const l of Array.isArray(lines) ? lines : []) {
      const it = byId[l?.itemId]; const qty = int(l?.qty, 1, 10000);
      if (!it || !it.active || qty === null || seen.has(it.id)) return null;
      seen.add(it.id);
      out.push({ itemId: it.id, name: it.name, qty, price: it.price, days, amount: it.price * qty * days });
    }
    return out.length ? out : null;
  }

  async function createBooking(body, { admin = false } = {}) {
    const settings = await loadSettings();
    const today = todayManila();
    const c = body?.customer || {};
    const customer = {
      name: str(c.name, 80), phone: normPhone(c.phone), messenger: str(c.messenger, 100),
      address: str(c.address, 300), landmark: str(c.landmark, 200), town: TOWNS.includes(c.town) ? c.town : null,
    };
    if (customer.name.length < 2) return fail("invalid_name");
    if (!customer.phone) return fail("invalid_phone");
    if (customer.address.length < 5) return fail("invalid_address");
    if (!customer.town) return fail("invalid_town");

    const { startDate, endDate } = body || {};
    if (!isDate(startDate) || !isDate(endDate) || endDate < startDate) return fail("invalid_dates");
    if (!admin && startDate < addDays(today, settings.minLeadDays)) return fail("too_soon", 400, { earliest: addDays(today, settings.minLeadDays) });
    const days = daysBetween(startDate, endDate) + 1;
    if (!admin && days > settings.maxDays) return fail("too_long", 400, { maxDays: settings.maxDays });
    if (startDate > addDays(today, 365)) return fail("too_far");

    const items = await loadItems();
    const lines = priceLines(body.lines, items, days);
    if (!lines) return fail("invalid_items");

    const blockFrom = addDays(startDate, -settings.bufferDays), blockTo = addDays(endDate, settings.bufferDays);
    const avail = availability(items, await loadBookings(), settings, blockFrom, blockTo);
    const short = lines.filter((l) => l.qty > avail[l.itemId]).map((l) => ({ itemId: l.itemId, available: avail[l.itemId] }));
    if (short.length && !(admin && body.force)) return fail("not_available", 409, { short });

    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const fee = admin && body.deliveryFee != null ? money(body.deliveryFee) : settings.deliveryFees[customer.town];
    const deliveryFee = fee == null ? null : fee;
    const total = subtotal + (deliveryFee || 0);
    const depositRequired = Math.min(total, Math.max(settings.minDeposit, Math.ceil((total * settings.depositPercent) / 100 / 10) * 10));

    let ref;
    for (let i = 0; i < 5; i++) { ref = "PR-" + randomCode(6); if (!(await getJSON(`bookings/${ref}`))) break; }
    const now = new Date().toISOString();
    const b = {
      ref, token: randomHex(16), createdAt: now, updatedAt: now, source: admin ? "admin" : "online",
      status: admin && body.status === "confirmed" ? "confirmed" : "requested", lang: body.lang === "tl" ? "tl" : "en",
      customer, startDate, endDate, days, blockFrom, blockTo,
      deliveryDate: startDate, deliverySlot: str(body.deliverySlot, 40) || "", pickupDate: addDays(endDate, 1),
      lines, subtotal, deliveryFee, depositRequired,
      payments: [], damages: [], logistics: { delivered: null, pickedUp: null, driver: "" },
      customerNotes: str(body.notes, 1000), notes: "", history: [{ at: now, by: admin ? "admin" : "customer", what: "created" }],
    };
    await saveBooking(b);
    return json({ ref, token: b.token, booking: publicBooking(b) }, 201);
  }

  async function readUpload(req) {
    let form; try { form = await req.formData(); } catch { return { error: "invalid_form" }; }
    const file = form.get("file");
    if (!file || typeof file === "string") return { form, error: "missing_file" };
    if (file.size > MAX_UPLOAD) return { form, error: "file_too_large" };
    const type = file.type || "image/jpeg";
    if (!IMAGE_TYPES.has(type)) return { form, error: "invalid_file_type" };
    return { form, file, type };
  }

  function isAdmin(req) {
    const pin = env("ADMIN_PIN");
    return !!pin && safeEqual(req.headers.get("x-admin-pin") || "", pin);
  }

  // ---------- routes ----------
  return async function handle(req) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
    const seg = path.split("/").filter(Boolean);
    const M = req.method;
    const body = async () => { try { return await req.json(); } catch { return null; } };

    try {
      // ---- public ----
      if (M === "GET" && path === "/catalog") {
        const [settings, items, bookings] = await Promise.all([loadSettings(), loadItems(), loadBookings()]);
        const s = url.searchParams.get("start"), e = url.searchParams.get("end");
        let avail = null;
        if (isDate(s) && isDate(e) && e >= s) avail = availability(items, bookings, settings, addDays(s, -settings.bufferDays), addDays(e, settings.bufferDays));
        return json({
          today: todayManila(), categories: CATEGORIES, towns: TOWNS,
          settings: (({ businessName, serviceArea, contactPhone, messengerUrl, depositPercent, minDeposit, minLeadDays, maxDays, deliveryFees, gcashName, gcashNumber }) =>
            ({ businessName, serviceArea, contactPhone, messengerUrl, depositPercent, minDeposit, minLeadDays, maxDays, deliveryFees, gcashName, gcashNumber }))(settings),
          items: items.filter((i) => i.active).map(({ outOfService, sort, active, ...i }) => ({ ...i, available: avail ? avail[i.id] : null })),
        });
      }
      if (M === "POST" && path === "/bookings") return createBooking(await body());

      if (seg[0] === "bookings" && seg[1]) {
        const b = await getBooking(seg[1]);
        if (!b || !safeEqual(url.searchParams.get("t") || "", b.token)) return fail("not_found", 404);
        if (M === "GET" && seg.length === 2) return json({ booking: publicBooking(b), settings: await loadSettings().then((s) => ({ gcashName: s.gcashName, gcashNumber: s.gcashNumber, contactPhone: s.contactPhone, messengerUrl: s.messengerUrl })) });
        if (M === "POST" && seg[2] === "proof") {
          if (!ACTIVE.has(b.status)) return fail("booking_closed");
          if ((b.payments || []).filter((p) => p.status === "submitted").length >= 5) return fail("too_many_pending");
          const up = await readUpload(req);
          if (up.error) return fail(up.error);
          const amount = money(up.form.get("amount"));
          if (!amount || amount < 1) return fail("invalid_amount");
          const id = randomHex(6);
          const proofKey = `proofs/${b.ref}/${id}`;
          await files.set(proofKey, await up.file.arrayBuffer(), { metadata: { type: up.type } });
          b.payments.push({ id, amount, method: "gcash", reference: str(up.form.get("reference"), 40), sender: str(up.form.get("sender"), 80), status: "submitted", proofKey, at: new Date().toISOString() });
          b.history.push({ at: new Date().toISOString(), by: "customer", what: `proof ${amount}` });
          await saveBooking(b);
          return json({ booking: publicBooking(b) }, 201);
        }
        return fail("not_found", 404);
      }

      // ---- admin ----
      if (seg[0] === "admin") {
        if (!env("ADMIN_PIN")) return fail("admin_pin_not_configured", 503);
        if (!isAdmin(req)) return fail("unauthorized", 401);
        const r = seg.slice(1);

        if (M === "GET" && r[0] === "overview") {
          const [settings, items, bookings] = await Promise.all([loadSettings(), loadItems(), loadBookings()]);
          return json({ today: todayManila(), settings, items, towns: TOWNS, categories: CATEGORIES, bookings: bookings.map(adminBooking).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
        }
        if (M === "GET" && r[0] === "availability") {
          const [settings, items, bookings] = await Promise.all([loadSettings(), loadItems(), loadBookings()]);
          const s = url.searchParams.get("start"), e = url.searchParams.get("end") || s;
          if (!isDate(s) || !isDate(e) || e < s) return fail("invalid_dates");
          return json({ available: availability(items, bookings, settings, s, e, url.searchParams.get("ignore")) });
        }
        if (M === "PUT" && r[0] === "settings") {
          const b = (await body()) || {}; const cur = await loadSettings();
          const next = { ...cur };
          for (const k of ["businessName", "serviceArea", "contactPhone", "messengerUrl", "gcashName", "gcashNumber"]) if (k in b) next[k] = str(b[k], 200);
          for (const [k, lo, hi] of [["depositPercent", 0, 100], ["minDeposit", 0, 100000], ["bufferDays", 0, 3], ["holdHours", 1, 720], ["minLeadDays", 0, 60], ["maxDays", 1, 30]])
            if (k in b) { const n = int(b[k], lo, hi); if (n === null) return fail("invalid_" + k); next[k] = n; }
          if (b.deliveryFees) {
            next.deliveryFees = {};
            for (const t of TOWNS) { const v = b.deliveryFees[t]; if (v !== null && v !== "" && v !== undefined) { const m = money(v); if (m === null) return fail("invalid_fee"); next.deliveryFees[t] = m; } }
          }
          await data.setJSON("settings", next);
          return json({ settings: next });
        }

        // items
        if (r[0] === "items") {
          const items = await loadItems();
          const cleanItem = (b, base = {}) => {
            const it = { ...base };
            if (b.name) it.name = { en: str(b.name.en, 80), tl: str(b.name.tl, 80) || str(b.name.en, 80) };
            if (b.unit) it.unit = { en: str(b.unit.en, 80), tl: str(b.unit.tl, 80) || str(b.unit.en, 80) };
            if (b.description) it.description = { en: str(b.description.en, 400), tl: str(b.description.tl, 400) };
            if ("category" in b) it.category = CATEGORIES.includes(b.category) ? b.category : "decor";
            if ("price" in b) it.price = money(b.price);
            if ("qty" in b) it.qty = int(b.qty, 0, 100000);
            if ("outOfService" in b) it.outOfService = int(b.outOfService, 0, 100000);
            if ("active" in b) it.active = !!b.active;
            if ("sort" in b) it.sort = int(b.sort, 0, 9999) ?? it.sort;
            if (!it.name?.en || it.price === null || it.qty === null || it.outOfService === null || it.outOfService > it.qty) return null;
            return it;
          };
          if (M === "POST" && r.length === 1) {
            const b = await body();
            const base = { id: "", category: "decor", price: 0, qty: 1, outOfService: 0, active: true, sort: items.length, image: "/img/items/generic.svg", unit: { en: "per piece", tl: "bawat isa" }, description: { en: "", tl: "" } };
            const it = cleanItem(b || {}, base);
            if (!it) return fail("invalid_item");
            it.id = (it.name.en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item") + "-" + randomCode(3).toLowerCase();
            await data.setJSON(`items/${it.id}`, it);
            return json({ item: it }, 201);
          }
          const cur = items.find((i) => i.id === r[1]);
          if (!cur) return fail("not_found", 404);
          if (M === "PUT" && r.length === 2) {
            const it = cleanItem((await body()) || {}, cur);
            if (!it) return fail("invalid_item");
            await data.setJSON(`items/${it.id}`, it);
            return json({ item: it });
          }
          if (M === "POST" && r[2] === "photo") {
            const up = await readUpload(req);
            if (up.error) return fail(up.error);
            await files.set(`items/${cur.id}`, await up.file.arrayBuffer(), { metadata: { type: up.type } });
            cur.image = `/photo/item/${cur.id}?v=${Date.now()}`;
            await data.setJSON(`items/${cur.id}`, cur);
            return json({ item: cur });
          }
        }

        // bookings
        if (r[0] === "bookings") {
          if (M === "POST" && r.length === 1) return createBooking(await body(), { admin: true });
          const b = await getBooking(r[1]);
          if (!b) return fail("not_found", 404);
          const now = new Date().toISOString();
          const log = (what) => b.history.push({ at: now, by: "admin", what });

          if (M === "PATCH" && r.length === 2) {
            const p = (await body()) || {};
            if ("status" in p) {
              if (!STATUSES.includes(p.status)) return fail("invalid_status");
              if (p.status !== b.status && ACTIVE.has(p.status) && !ACTIVE.has(b.status)) {
                // re-activating a cancelled/returned booking: check stock again
                const [settings, items, bookings] = await Promise.all([loadSettings(), loadItems(), loadBookings()]);
                const av = availability(items, bookings, settings, b.blockFrom, b.blockTo, b.ref);
                if (b.lines.some((l) => l.qty > av[l.itemId]) && !p.force) return fail("not_available", 409);
              }
              if (p.status !== b.status) log(`status ${b.status} → ${p.status}`);
              b.status = p.status;
              if (p.status === "out" && !b.logistics.delivered) b.logistics.delivered = now;
              if (p.status === "returned" && !b.logistics.pickedUp) b.logistics.pickedUp = now;
            }
            for (const k of ["deliveryDate", "pickupDate"]) if (k in p) { if (!isDate(p[k])) return fail("invalid_" + k); b[k] = p[k]; }
            if (b.pickupDate < b.deliveryDate) return fail("invalid_pickupDate");
            if ("deliverySlot" in p) b.deliverySlot = str(p.deliverySlot, 40);
            if ("pickupSlot" in p) b.pickupSlot = str(p.pickupSlot, 40);
            if ("driver" in p) b.logistics.driver = str(p.driver, 60);
            if ("notes" in p) b.notes = str(p.notes, 2000);
            if ("deliveryFee" in p) {
              const f = p.deliveryFee === null || p.deliveryFee === "" ? null : money(p.deliveryFee);
              if (p.deliveryFee !== null && p.deliveryFee !== "" && f === null) return fail("invalid_fee");
              b.deliveryFee = f; log(`delivery fee ${f}`);
            }
            if ("depositRequired" in p) { const d = money(p.depositRequired); if (d === null) return fail("invalid_amount"); b.depositRequired = d; }
            // block window follows the real delivery / pick-up dates
            b.blockFrom = b.deliveryDate < b.startDate ? b.deliveryDate : b.blockFrom;
            b.blockTo = b.pickupDate > b.endDate ? b.pickupDate : b.blockTo;
            await saveBooking(b);
            return json({ booking: adminBooking(b) });
          }
          if (r[2] === "payments") {
            if (M === "POST" && r.length === 3) {
              const p = (await body()) || {};
              const amount = money(p.amount);
              if (!amount || amount <= 0) return fail("invalid_amount");
              const method = ["cash", "gcash", "bank", "other"].includes(p.method) ? p.method : "cash";
              b.payments.push({ id: randomHex(6), amount, method, reference: str(p.reference, 40), status: "verified", at: now, verifiedAt: now, recordedBy: "admin" });
              log(`payment ${method} ${amount}`);
              if (b.status === "requested" && summarize(b).depositMet && p.autoConfirm !== false) { b.status = "confirmed"; log("status requested → confirmed"); }
              await saveBooking(b);
              return json({ booking: adminBooking(b) }, 201);
            }
            const pay = b.payments.find((x) => x.id === r[3]);
            if (!pay) return fail("not_found", 404);
            if (M === "PATCH") {
              const p = (await body()) || {};
              if (!["verified", "rejected", "submitted"].includes(p.status)) return fail("invalid_status");
              pay.status = p.status; pay.verifiedAt = now; if ("note" in p) pay.note = str(p.note, 200);
              if ("amount" in p) { const a = money(p.amount); if (!a) return fail("invalid_amount"); pay.amount = a; }
              log(`payment ${pay.id} ${p.status}`);
              if (p.status === "verified" && b.status === "requested" && summarize(b).depositMet && p.autoConfirm !== false) { b.status = "confirmed"; log("status requested → confirmed"); }
              await saveBooking(b);
              return json({ booking: adminBooking(b) });
            }
            if (M === "GET" && r[4] === "proof") {
              if (!pay.proofKey) return fail("not_found", 404);
              const f = await files.getWithMetadata(pay.proofKey, { type: "arrayBuffer" });
              if (!f) return fail("not_found", 404);
              return new Response(f.data, { headers: { "content-type": f.metadata?.type || "image/jpeg", "cache-control": "private, max-age=3600" } });
            }
          }
          if (r[2] === "damages") {
            if (M === "POST" && r.length === 3) {
              const p = (await body()) || {};
              const line = b.lines.find((l) => l.itemId === p.itemId);
              const qty = int(p.qty, 1, 10000), charge = money(p.charge ?? 0);
              if (!line || qty === null || qty > line.qty || charge === null) return fail("invalid_damage");
              const d = { id: randomHex(6), itemId: p.itemId, qty, note: str(p.note, 300), charge, outOfService: !!p.outOfService, at: now };
              b.damages.push(d);
              if (d.outOfService) {
                const it = await getJSON(`items/${d.itemId}`);
                if (it) { it.outOfService = Math.min(it.qty, (it.outOfService || 0) + qty); await data.setJSON(`items/${it.id}`, it); }
              }
              log(`damage ${p.itemId} x${qty} ₱${charge}`);
              await saveBooking(b);
              return json({ booking: adminBooking(b) }, 201);
            }
            if (M === "DELETE" && r[3]) {
              const i = b.damages.findIndex((d) => d.id === r[3]);
              if (i < 0) return fail("not_found", 404);
              b.damages.splice(i, 1); log(`damage ${r[3]} removed`);
              await saveBooking(b);
              return json({ booking: adminBooking(b) });
            }
          }
        }
        return fail("not_found", 404);
      }
      return fail("not_found", 404);
    } catch (e) {
      console.error(e);
      return fail("server_error", 500);
    }
  };
}

export async function servePhoto(files, id) {
  if (!/^[a-z0-9-]{1,60}$/.test(id || "")) return new Response("Not found", { status: 404 });
  const f = await files.getWithMetadata(`items/${id}`, { type: "arrayBuffer" });
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(f.data, { headers: { "content-type": f.metadata?.type || "image/jpeg", "cache-control": "public, max-age=86400" } });
}

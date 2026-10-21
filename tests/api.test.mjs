import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp, addDays, todayManila } from "../netlify/lib/app.mjs";
import { memoryStore } from "../dev-server.mjs";

const PIN = "13572468";
const mk = () => createApp({ data: memoryStore(), files: memoryStore(), env: (k) => (k === "ADMIN_PIN" ? PIN : undefined) });
const call = async (app, method, path, body, headers = {}) => {
  const init = { method, headers: { ...headers } };
  if (body instanceof FormData) init.body = body;
  else if (body) { init.body = JSON.stringify(body); init.headers["content-type"] = "application/json"; }
  const r = await app(new Request("http://x" + path, init));
  return { status: r.status, data: r.headers.get("content-type")?.includes("json") ? await r.json() : await r.arrayBuffer() };
};
const admin = { "x-admin-pin": PIN };
const day = (n) => addDays(todayManila(), n);
const cust = { name: "Maria Santos", phone: "0917 123 4567", address: "123 Rizal St, Brgy. San Isidro", town: "Angono" };

test("catalog seeds items and computes availability", async () => {
  const app = mk();
  const r = await call(app, "GET", `/api/catalog?start=${day(3)}&end=${day(3)}`);
  assert.equal(r.status, 200);
  assert.equal(r.data.items.length, 12);
  assert.equal(r.data.items.find((i) => i.id === "videoke").available, 3);
});

test("booking flow: request → proof → verify → confirmed, and stock is held", async () => {
  const app = mk();
  const c = await call(app, "POST", "/api/bookings", { customer: cust, startDate: day(5), endDate: day(5), lines: [{ itemId: "videoke", qty: 2 }, { itemId: "monobloc-chair", qty: 50 }] });
  assert.equal(c.status, 201, JSON.stringify(c.data));
  const { ref, token, booking } = c.data;
  assert.equal(booking.subtotal, 2 * 1500 + 50 * 10);
  assert.equal(booking.deliveryFee, 150);
  assert.equal(booking.depositRequired, Math.ceil(3650 * 0.3 / 10) * 10);
  assert.equal(booking.customer.phone, "+639171234567");
  assert.equal(booking.token, undefined);

  // stock held on the event day and on the buffer day before
  let cat = await call(app, "GET", `/api/catalog?start=${day(5)}&end=${day(5)}`);
  assert.equal(cat.data.items.find((i) => i.id === "videoke").available, 1);
  cat = await call(app, "GET", `/api/catalog?start=${day(8)}&end=${day(8)}`);
  assert.equal(cat.data.items.find((i) => i.id === "videoke").available, 3);

  // overbooking refused
  const o = await call(app, "POST", "/api/bookings", { customer: cust, startDate: day(6), endDate: day(6), lines: [{ itemId: "videoke", qty: 2 }] });
  assert.equal(o.status, 409);

  // wrong token
  assert.equal((await call(app, "GET", `/api/bookings/${ref}?t=nope`)).status, 404);

  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }), "gcash.jpg");
  fd.append("amount", "1100"); fd.append("reference", "1234567890123");
  const p = await call(app, "POST", `/api/bookings/${ref}/proof?t=${token}`, fd);
  assert.equal(p.status, 201, JSON.stringify(p.data));
  assert.equal(p.data.booking.summary.pending, 1100);

  assert.equal((await call(app, "GET", "/api/admin/overview")).status, 401);
  const ov = await call(app, "GET", "/api/admin/overview", null, admin);
  const ab = ov.data.bookings.find((b) => b.ref === ref);
  assert.ok(ab.statusLink.includes(token));
  const pid = ab.payments[0].id;
  const proof = await call(app, "GET", `/api/admin/bookings/${ref}/payments/${pid}/proof`, null, admin);
  assert.equal(proof.status, 200);

  const v = await call(app, "PATCH", `/api/admin/bookings/${ref}/payments/${pid}`, { status: "verified" }, admin);
  assert.equal(v.data.booking.status, "confirmed");
  assert.equal(v.data.booking.summary.paid, 1100);

  // delivery, damage, cash balance, return
  await call(app, "PATCH", `/api/admin/bookings/${ref}`, { status: "out", driver: "Jun" }, admin);
  const d = await call(app, "POST", `/api/admin/bookings/${ref}/damages`, { itemId: "monobloc-chair", qty: 2, charge: 300, note: "cracked", outOfService: true }, admin);
  assert.equal(d.data.booking.summary.grandTotal, 3500 + 150 + 300);
  const pay = await call(app, "POST", `/api/admin/bookings/${ref}/payments`, { amount: d.data.booking.summary.balance, method: "cash" }, admin);
  assert.equal(pay.data.booking.summary.balance, 0);
  const ret = await call(app, "PATCH", `/api/admin/bookings/${ref}`, { status: "returned" }, admin);
  assert.equal(ret.data.booking.status, "returned");

  cat = await call(app, "GET", `/api/catalog?start=${day(5)}&end=${day(5)}`);
  assert.equal(cat.data.items.find((i) => i.id === "monobloc-chair").available, 298); // 2 out of service
});

test("validation", async () => {
  const app = mk();
  const bad = (b) => call(app, "POST", "/api/bookings", { customer: cust, startDate: day(5), endDate: day(5), lines: [{ itemId: "videoke", qty: 1 }], ...b });
  assert.equal((await bad({ customer: { ...cust, phone: "12345" } })).data.error, "invalid_phone");
  assert.equal((await bad({ startDate: day(0), endDate: day(0) })).data.error, "too_soon");
  assert.equal((await bad({ endDate: day(15) })).data.error, "too_long");
  assert.equal((await bad({ lines: [{ itemId: "nope", qty: 1 }] })).data.error, "invalid_items");
  assert.equal((await bad({ customer: { ...cust, town: "Other" } })).data.booking.deliveryFee, null);
});

test("admin settings, items and photo", async () => {
  const app = mk();
  const s = await call(app, "PUT", "/api/admin/settings", { gcashName: "Juan D.", gcashNumber: "0917 000 0000", depositPercent: 50 }, admin);
  assert.equal(s.data.settings.depositPercent, 50);
  const it = await call(app, "POST", "/api/admin/items", { name: { en: "Stand fan" }, price: 250, qty: 8, category: "decor" }, admin);
  assert.equal(it.status, 201);
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), "fan.png");
  const ph = await call(app, "POST", `/api/admin/items/${it.data.item.id}/photo`, fd, admin);
  assert.match(ph.data.item.image, /^\/photo\/item\//);
  const cat = await call(app, "GET", "/api/catalog");
  assert.equal(cat.data.items.length, 13);
  assert.equal(cat.data.settings.gcashName, "Juan D.");
});

import { t, tr, getLang, setLang } from "./i18n.js";
import { $, $$, esc, peso, fmtDate, fmtRange, addDays, daysBetween, fmtPhone, api, ApiError, compressImage, toast, copyText, store } from "./common.js";

const app = $("#app");
const CART_KEY = "pahina.cart", MINE_KEY = "pahina.mybookings";
const S = {
  catalog: null,          // { today, categories, towns, settings, items }
  start: "", end: "", cat: "all",
  cart: {},               // itemId -> qty
  booking: null,
};
const saved = store.get(CART_KEY, {});
Object.assign(S, { start: saved.start || "", end: saved.end || "", cart: saved.cart || {} });
const persistCart = () => store.set(CART_KEY, { start: S.start, end: S.end, cart: S.cart });

const errMsg = (e) => {
  if (e instanceof ApiError) {
    if (e.code === "rate") return t("err_rate");
    const k = "err_" + e.code; const vars = { ...(e.extra || {}) };
    if (vars.earliest) vars.earliest = fmtDate(vars.earliest);
    const m = t(k, vars); return m === k ? t("err_generic") : m;
  }
  return t("err_generic");
};

// ---------- data ----------
async function loadCatalog() {
  const q = S.start && S.end ? `?start=${S.start}&end=${S.end}` : "";
  S.catalog = await api("/api/catalog" + q);
  const ids = new Set(S.catalog.items.map((i) => i.id));
  for (const id of Object.keys(S.cart)) if (!ids.has(id)) delete S.cart[id];
  // dates in the past? reset
  const earliest = addDays(S.catalog.today, S.catalog.settings.minLeadDays);
  if (S.start && S.start < earliest) { S.start = ""; S.end = ""; }
  let clamped = false;
  for (const it of S.catalog.items) {
    if (it.available != null && S.cart[it.id] > it.available) { clamped = true; if (it.available > 0) S.cart[it.id] = it.available; else delete S.cart[it.id]; }
  }
  persistCart();
  return clamped;
}
const days = () => (S.start && S.end ? daysBetween(S.start, S.end) + 1 : 1);
const cartLines = () => (S.catalog?.items || []).filter((i) => S.cart[i.id] > 0).map((i) => ({ item: i, qty: S.cart[i.id], amount: i.price * S.cart[i.id] * days() }));
const cartTotal = () => cartLines().reduce((s, l) => s + l.amount, 0);

// ---------- chrome ----------
function chrome() {
  setLang(getLang());
  $$(".seg [data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === getLang())));
  $("#my-link").setAttribute("aria-label", t("my_bookings"));
  const s = S.catalog?.settings;
  if (s) $("#area").textContent = s.serviceArea;
  const contact = [s?.messengerUrl ? `<a href="${esc(s.messengerUrl)}" target="_blank" rel="noopener">${t("contact_us")}</a>` : "", s?.contactPhone ? `<a href="tel:${esc(s.contactPhone.replace(/\s/g, ""))}">${esc(s.contactPhone)}</a>` : ""].filter(Boolean).join(" · ");
  $("#footer").innerHTML = `${contact ? `<p>${contact}</p>` : ""}<p style="margin-top:6px">${t("footer")} · <a href="https://www.facebook.com/pahinadigitalstudio" target="_blank" rel="noopener">Facebook</a></p>`;
  const mine = store.get(MINE_KEY, []);
  $("#my-link").querySelector(".dot")?.remove();
  if (mine.length) $("#my-link").insertAdjacentHTML("beforeend", `<span class="dot">${mine.length}</span>`);
  updateCartBar();
}
function updateCartBar() {
  const route = location.hash.split("?")[0];
  const n = Object.values(S.cart).reduce((a, b) => a + b, 0);
  const show = n > 0 && (route === "" || route === "#/" || route === "#");
  $("#cartbar").classList.toggle("show", show);
  document.body.classList.toggle("has-cart", show);
  $("#cartsum").innerHTML = `<b>${peso(cartTotal())}</b><br><span class="tiny" style="opacity:.8">${t("cart_count", { n: cartLines().length })}${S.start ? " · " + t("days", { d: days() }) : ""}</span>`;
  $("#cartgo").textContent = t("review");
}

// ---------- home ----------
const BUNTING = (() => {
  const cols = ["#f6b32a", "#ef5b4c", "#ffffff", "#3c8fd9", "#2f9e6e"]; let s = "";
  for (let i = 0; i < 40; i++) s += `<path d="M${i * 30} 4 l15 26 l15 -26z" fill="${cols[i % 5]}" opacity="${cols[i % 5] === "#ffffff" ? .85 : 1}"/>`;
  return `<svg class="bunting" viewBox="0 0 1200 34" preserveAspectRatio="xMinYMin slice" aria-hidden="true"><path d="M0 4 Q600 12 1200 4" stroke="#0a3a3e" stroke-width="2" fill="none"/>${s}</svg>`;
})();

function renderHome() {
  const c = S.catalog, set = c.settings;
  const min = addDays(c.today, set.minLeadDays);
  app.innerHTML = `
  <section class="hero">${BUNTING}
    <div class="wrap">
      <h1>${t("hero_title")}</h1>
      <p class="sub">${t("hero_sub")}</p>
      <ol class="steps"><li><b>1</b>${t("how_1")}</li><li><b>2</b>${t("how_2")}</li><li><b>3</b>${t("how_3")}</li></ol>
    </div>
  </section>
  <div class="wrap">
    <section class="card datecard" id="dates">
      <h2>${t("when")}</h2>
      <div class="row inputs" style="margin-top:12px">
        <label class="field"><span>${t("start_date")}</span><input class="input" type="date" id="start" min="${min}" max="${addDays(c.today, 365)}" value="${S.start}"></label>
        <label class="field"><span>${t("end_date")}</span><input class="input" type="date" id="end" min="${S.start || min}" max="${S.start ? addDays(S.start, set.maxDays - 1) : ""}" value="${S.end}"></label>
      </div>
      <p class="small muted" style="margin-top:10px">${t("dates_hint")}</p>
    </section>
    <nav class="chips" aria-label="Categories">
      ${["all", ...c.categories].filter((k) => k === "all" || c.items.some((i) => i.category === k)).map((k) => `<button class="chip" data-cat="${k}" aria-pressed="${S.cat === k}">${t("cat_" + k)}</button>`).join("")}
    </nav>
    ${S.start ? "" : `<p class="notice info" style="margin-bottom:12px">${t("pick_dates_first")}</p>`}
    <section class="items" id="items"></section>
  </div>`;
  renderItems();
  const start = $("#start"), end = $("#end");
  start.addEventListener("change", async () => {
    S.start = start.value;
    if (!S.end || S.end < S.start || daysBetween(S.start, S.end) >= set.maxDays) S.end = S.start;
    await refreshDates();
  });
  end.addEventListener("change", async () => { S.end = end.value && end.value >= S.start ? end.value : S.start; await refreshDates(); });
  $$(".chip").forEach((b) => b.addEventListener("click", () => { S.cat = b.dataset.cat; $$(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); renderItems(); }));
}
async function refreshDates() {
  persistCart();
  $("#items").innerHTML = `<div class="skeleton"></div><div class="skeleton"></div>`;
  try { const clamped = await loadCatalog(); renderHome(); chrome(); if (clamped) toast(t("err_not_available"), "bad"); }
  catch (e) { toast(errMsg(e), "bad"); }
}

function renderItems() {
  const list = S.catalog.items.filter((i) => S.cat === "all" || i.category === S.cat);
  $("#items").innerHTML = list.map((i) => {
    const q = S.cart[i.id] || 0, av = i.available;
    let badge = "";
    if (av != null) badge = av <= 0 ? `<span class="badge b-bad">${t("sold_out")}</span>` : av <= 3 && i.qty > 3 ? `<span class="badge b-warn">${t("only_n", { n: av })}</span>` : `<span class="badge b-ok">${t("available_n", { n: av })}</span>`;
    const max = av ?? 9999;
    return `<article class="item ${q ? "picked" : ""}" data-id="${esc(i.id)}">
      <div class="ph"><img src="${esc(i.image)}" alt="" loading="lazy">${badge}</div>
      <div class="body">
        <h3>${esc(tr(i.name))}</h3>
        <div><span class="price">${peso(i.price)}</span> <span class="unit">${esc(tr(i.unit))}</span></div>
        <p class="desc">${esc(tr(i.description))}</p>
        <div class="foot">${q
          ? `<div class="stepper"><button type="button" data-d="-1" aria-label="−">−</button><input type="number" inputmode="numeric" min="0" max="${max}" value="${q}" aria-label="${t("qty")}"><button type="button" data-d="1" aria-label="+" ${q >= max ? "disabled" : ""}>+</button></div>`
          : `<button type="button" class="btn btn-teal btn-sm btn-block add" ${av === 0 ? "disabled" : ""}>${t("add")}</button>`}</div>
      </div></article>`;
  }).join("");
  $$("#items .item").forEach((card) => {
    const id = card.dataset.id, it = S.catalog.items.find((x) => x.id === id), max = it.available ?? 9999;
    const setQ = (n) => { n = Math.max(0, Math.min(max, Math.floor(Number(n) || 0))); if (n) S.cart[id] = n; else delete S.cart[id]; persistCart(); renderItems(); updateCartBar(); };
    card.querySelector(".add")?.addEventListener("click", () => {
      if (!S.start) { $("#dates").scrollIntoView({ behavior: "smooth", block: "center" }); $("#start").focus(); toast(t("pick_dates_first")); return; }
      setQ(it.category === "chairs" ? Math.min(max, 10) : 1);
    });
    $$(".stepper button", card).forEach((b) => b.addEventListener("click", () => setQ((S.cart[id] || 0) + Number(b.dataset.d) * (it.category === "chairs" && (S.cart[id] || 0) >= 10 ? 5 : 1))));
    card.querySelector(".stepper input")?.addEventListener("change", (e) => setQ(e.target.value));
  });
}

// ---------- checkout ----------
function renderCheckout() {
  const lines = cartLines(), set = S.catalog.settings;
  if (!lines.length || !S.start) { location.hash = "#/"; return; }
  const draft = store.get("pahina.customer", {});
  app.innerHTML = `<div class="wrap page">
    <a href="#/" class="btn btn-ghost btn-sm">← ${t("edit_items")}</a>
    <h1 style="margin:14px 0 4px;font-size:1.6rem">${t("checkout_title")}</h1>
    <p class="muted">${t("event")}: <b>${fmtRange(S.start, S.end)}</b> · ${t("days", { d: days() })}</p>
    <div class="layout2" style="margin-top:14px">
      <form class="card stack" id="form" novalidate>
        <h2>${t("your_details")}</h2>
        <label class="field"><span>${t("f_name")}</span><input class="input" name="name" autocomplete="name" required value="${esc(draft.name)}"></label>
        <label class="field"><span>${t("f_phone")}</span><input class="input" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="09XX XXX XXXX" required value="${esc(draft.phone)}"></label>
        <label class="field"><span>${t("f_messenger")}</span><input class="input" name="messenger" value="${esc(draft.messenger)}"></label>
        <label class="field"><span>${t("f_town")}</span><select class="input" name="town" required>
          <option value="">${t("choose")}</option>${S.catalog.towns.map((tw) => `<option value="${tw}" ${draft.town === tw ? "selected" : ""}>${tw === "Other" ? t("town_other") : tw}</option>`).join("")}</select></label>
        <label class="field"><span>${t("f_address")}</span><textarea class="input" name="address" rows="2" autocomplete="street-address" required>${esc(draft.address)}</textarea></label>
        <label class="field"><span>${t("f_landmark")}</span><input class="input" name="landmark" value="${esc(draft.landmark)}"></label>
        <label class="field"><span>${t("f_notes")}</span><textarea class="input" name="notes" rows="2" placeholder="${t("f_notes_ph")}"></textarea></label>
        <label class="check"><input type="checkbox" name="agree" required><span>${t("agree")}</span></label>
        <p class="err" id="ferr" role="alert"></p>
        <button class="btn btn-primary btn-block" type="submit">${t("send_request")}</button>
      </form>
      <aside class="side card">
        <h2>${t("items")}</h2>
        <div class="lines" style="margin-top:6px">${lines.map((l) => `<div class="line"><img src="${esc(l.item.image)}" alt=""><div class="grow"><b>${esc(tr(l.item.name))}</b><div class="tiny muted">${l.qty} × ${peso(l.item.price)} ${days() > 1 ? t("per_day_note", { d: days() }) : ""}</div></div><b>${peso(l.amount)}</b></div>`).join("")}</div>
        <div id="totals" style="margin-top:8px"></div>
      </aside>
    </div></div>`;
  const form = $("#form");
  const totals = () => {
    const town = form.town.value, fee = town ? set.deliveryFees[town] : undefined;
    const sub = cartTotal(), total = sub + (fee || 0);
    const dep = Math.min(total, Math.max(set.minDeposit, Math.ceil((total * set.depositPercent) / 100 / 10) * 10));
    $("#totals").innerHTML = `<div class="kv"><span>${t("subtotal")}</span><b>${peso(sub)}</b></div>
      <div class="kv"><span>${t("delivery")}</span><b>${!town ? "—" : fee == null ? `<span class="badge b-warn">${t("to_confirm")}</span>` : peso(fee)}</b></div>
      <div class="kv total"><span>${t("total")}</span><span>${peso(total)}</span></div>
      <div class="kv"><span>${t("deposit")}</span><b style="color:var(--coral-ink)">${peso(dep)}</b></div>
      <p class="tiny muted" style="margin-top:6px">${t("deposit_note", { p: set.depositPercent })}</p>`;
  };
  totals();
  form.town.addEventListener("change", totals);
  form.addEventListener("input", () => store.set("pahina.customer", { name: form.name.value, phone: form.phone.value, messenger: form.messenger.value, town: form.town.value, address: form.address.value, landmark: form.landmark.value }));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ferr = $("#ferr"); ferr.textContent = "";
    if (!form.agree.checked) { ferr.textContent = t("agree"); form.agree.focus(); return; }
    const btn = form.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = t("sending");
    try {
      const r = await api("/api/bookings", { method: "POST", body: {
        startDate: S.start, endDate: S.end, lang: getLang(), notes: form.notes.value,
        customer: { name: form.name.value, phone: form.phone.value, messenger: form.messenger.value, town: form.town.value, address: form.address.value, landmark: form.landmark.value },
        lines: cartLines().map((l) => ({ itemId: l.item.id, qty: l.qty })),
      } });
      const mine = store.get(MINE_KEY, []).filter((m) => m.ref !== r.ref);
      mine.unshift({ ref: r.ref, token: r.token, startDate: S.start, endDate: S.end, total: r.booking.subtotal + (r.booking.deliveryFee || 0) });
      store.set(MINE_KEY, mine.slice(0, 20));
      S.cart = {}; persistCart();
      toast(t("request_sent"), "ok");
      location.hash = `#/b/${r.ref}?t=${r.token}`;
    } catch (err) {
      ferr.textContent = errMsg(err);
      if (err.code === "not_available") { await loadCatalog().catch(() => {}); }
      btn.disabled = false; btn.textContent = t("send_request");
    }
  });
}

// ---------- booking status page ----------
async function renderBooking(ref, token) {
  app.innerHTML = `<div class="wrap page"><div class="skeleton"></div></div>`;
  let data;
  try { data = await api(`/api/bookings/${encodeURIComponent(ref)}?t=${encodeURIComponent(token)}`); }
  catch (e) { app.innerHTML = `<div class="wrap page"><p class="notice bad">${errMsg(e)}</p></div>`; return; }
  const b = data.booking, s = b.summary, g = data.settings;
  S.booking = { ref, token };
  const order = ["requested", "confirmed", "out", "returned"], idx = order.indexOf(b.status);
  const stBadge = { requested: "b-warn", confirmed: "b-ok", out: "b-info", returned: "b-mute", cancelled: "b-bad" }[b.status];
  const link = `${location.origin}/#/b/${ref}?t=${token}`;
  const open = ["requested", "confirmed", "out"].includes(b.status);
  const needDeposit = !s.depositMet;
  const toPay = needDeposit ? Math.max(0, b.depositRequired - s.paid - s.pending) : s.balance - s.pending;
  const showPay = open && s.balance > 0 && toPay > 0;
  const checking = open && s.pending > 0 && !showPay;
  const payStatus = (p) => ({ submitted: `<span class="badge b-warn">${t("pay_submitted")}</span>`, verified: `<span class="badge b-ok">${t("pay_verified")}</span>`, rejected: `<span class="badge b-bad">${t("pay_rejected")}</span>` }[p.status]);
  app.innerHTML = `<div class="wrap page">
    <div class="row spread wrapx">
      <div><p class="muted small">${t("booking")}</p><h1 style="font-size:1.7rem">${esc(b.ref)}</h1></div>
      <span class="badge ${stBadge}" style="font-size:.9rem;padding:6px 12px">${t("st_" + b.status)}</span>
    </div>
    ${b.status !== "cancelled" ? `<div class="timeline" style="margin-top:14px">${order.map((k, i) => `<div class="${i <= idx ? "done" : i === idx + 1 ? "now" : ""}">${t("t_" + k)}</div>`).join("")}</div>` : ""}
    <div class="layout2" style="margin-top:16px">
      <div class="stack">
        ${checking ? `<p class="notice ok">${t("pay_checking")}</p>` : ""}
        ${showPay ? `
        <section class="gcash-box">
          <h2>${needDeposit ? t("pay_title") : t("pay_balance_title")}</h2>
          ${!needDeposit ? `<p class="small" style="margin-top:6px;opacity:.9">${t("pay_balance_note")}</p>` : ""}
          ${g.gcashNumber ? `<ol>
            <li>${t("pay_1", { amount: `<b>${peso(toPay > 0 ? toPay : needDeposit ? b.depositRequired : s.balance)}</b>`, number: "" })}
              <div class="row" style="margin:6px 0 2px"><span class="num">${esc(g.gcashNumber)}</span><button class="btn btn-ghost btn-sm" type="button" id="copynum">${t("copy_link").split(" ")[0]}</button></div>
              ${g.gcashName ? `<div class="small" style="opacity:.9">${t("pay_1_name", { name: esc(g.gcashName) })}</div>` : ""}</li>
            <li>${t("pay_2")}</li><li>${t("pay_3")}</li></ol>` : `<p style="margin-top:8px">${t("gcash_pending")}</p>`}
        </section>
        <form class="card stack" id="proof">
          <h2>${t("upload_proof")}</h2>
          <label class="filepick"><input type="file" accept="image/*" name="file"><span id="fp-prev" class="muted">📎</span><span id="fp-label"><b>${t("choose_image")}</b></span></label>
          <div class="grid2">
            <label class="field"><span>${t("amount_sent")}</span><input class="input" name="amount" type="number" inputmode="decimal" min="1" step="0.01" value="${toPay > 0 ? toPay : ""}" required></label>
            <label class="field"><span>${t("ref_no")}</span><input class="input" name="reference" inputmode="numeric" maxlength="40"></label>
          </div>
          <label class="field"><span>${t("sender")}</span><input class="input" name="sender" maxlength="80"></label>
          <p class="err" id="perr" role="alert"></p>
          <button class="btn btn-primary btn-block" type="submit">${t("submit_proof")}</button>
        </form>` : ""}
        <section class="card">
          <h2>${t("items")}</h2>
          <p class="muted small" style="margin-top:4px">${t("event")}: <b>${fmtRange(b.startDate, b.endDate)}</b> · ${t("days", { d: b.days })}</p>
          <div class="lines" style="margin-top:6px">${b.lines.map((l) => `<div class="line"><div class="grow"><b>${esc(tr(l.name))}</b><div class="tiny muted">${l.qty} × ${peso(l.price)}${l.days > 1 ? " " + t("per_day_note", { d: l.days }) : ""}</div></div><b>${peso(l.amount)}</b></div>`).join("")}</div>
          <div class="kv" style="margin-top:6px"><span>${t("delivery_on")}</span><b>${fmtDate(b.deliveryDate)}${b.deliverySlot ? " · " + esc(b.deliverySlot) : ""}</b></div>
          <div class="kv"><span>${t("pickup_on")}</span><b>${fmtDate(b.pickupDate)}</b></div>
          <p class="small muted" style="margin-top:8px">${esc(b.customer.name)} · ${esc(fmtPhone(b.customer.phone))}<br>${esc(b.customer.address)}, ${esc(b.customer.town)}</p>
        </section>
      </div>
      <aside class="side stack">
        <section class="card">
          <div class="kv"><span>${t("subtotal")}</span><b>${peso(b.subtotal)}</b></div>
          <div class="kv"><span>${t("delivery")}</span><b>${b.deliveryFee == null ? `<span class="badge b-warn">${t("to_confirm")}</span>` : peso(b.deliveryFee)}</b></div>
          ${s.damages ? `<div class="kv"><span>${t("damages")}</span><b>${peso(s.damages)}</b></div>` : ""}
          <div class="kv total"><span>${t("total")}</span><span>${peso(s.grandTotal)}</span></div>
          <div class="kv"><span>${t("deposit")}</span><b>${peso(b.depositRequired)}</b></div>
          <div class="kv"><span>${t("paid")}</span><b style="color:var(--ok)">${peso(s.paid)}</b></div>
          <div class="kv"><span>${t("balance")}</span><b>${peso(s.balance)}</b></div>
        </section>
        ${b.payments.length ? `<section class="card"><h3>${t("payments")}</h3>${b.payments.map((p) => `<div class="pay-row"><div style="flex:1"><b>${peso(p.amount)}</b> <span class="tiny muted">${p.method.toUpperCase()} · ${fmtDate(p.at.slice(0, 10))}</span></div>${payStatus(p)}</div>`).join("")}</section>` : ""}
        ${b.damages.length ? `<section class="card"><h3>${t("damages")}</h3>${b.damages.map((d) => `<div class="pay-row"><div style="flex:1">${d.qty} × ${esc(tr(b.lines.find((l) => l.itemId === d.itemId)?.name))}<div class="tiny muted">${esc(d.note)}</div></div><b>${peso(d.charge)}</b></div>`).join("")}</section>` : ""}
        <section class="card stack-sm">
          <p class="small"><b>${t("save_link")}</b></p>
          <button class="btn btn-ghost btn-block" type="button" id="copylink">${t("copy_link")}</button>
          <div class="row">
            ${g.messengerUrl ? `<a class="btn btn-teal" style="flex:1" href="${esc(g.messengerUrl)}" target="_blank" rel="noopener">${t("contact_us")}</a>` : ""}
            ${g.contactPhone ? `<a class="btn btn-ghost" style="flex:1" href="tel:${esc(g.contactPhone.replace(/\s/g, ""))}">${t("call_us")}</a>` : ""}
          </div>
        </section>
      </aside>
    </div></div>`;
  // remember on this phone
  const mine = store.get(MINE_KEY, []);
  if (!mine.some((m) => m.ref === ref)) { mine.unshift({ ref, token, startDate: b.startDate, endDate: b.endDate, total: s.grandTotal }); store.set(MINE_KEY, mine.slice(0, 20)); chrome(); }
  $("#copylink").addEventListener("click", async () => { if (await copyText(link)) toast(t("copied"), "ok"); });
  $("#copynum")?.addEventListener("click", async () => { if (await copyText(g.gcashNumber.replace(/\s/g, ""))) toast(t("copied"), "ok"); });
  const pf = $("#proof");
  if (pf) {
    const fileIn = pf.file;
    fileIn.addEventListener("change", () => {
      const f = fileIn.files[0]; if (!f) return;
      $("#fp-prev").innerHTML = `<img src="${URL.createObjectURL(f)}" alt="">`;
      $("#fp-label").innerHTML = `<b>${t("change_image")}</b><br><span class="tiny muted">${esc(f.name)}</span>`;
    });
    pf.addEventListener("submit", async (e) => {
      e.preventDefault(); const perr = $("#perr"); perr.textContent = "";
      if (!fileIn.files[0]) { perr.textContent = t("err_missing_file"); return; }
      if (!(Number(pf.amount.value) > 0)) { perr.textContent = t("err_invalid_amount"); return; }
      const btn = pf.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = t("uploading");
      try {
        const fd = new FormData();
        fd.append("file", await compressImage(fileIn.files[0]));
        fd.append("amount", pf.amount.value); fd.append("reference", pf.reference.value); fd.append("sender", pf.sender.value);
        await api(`/api/bookings/${ref}/proof?t=${token}`, { method: "POST", body: fd });
        toast(t("proof_sent"), "ok");
        renderBooking(ref, token);
      } catch (err) { perr.textContent = errMsg(err); btn.disabled = false; btn.textContent = t("submit_proof"); }
    });
  }
}

function renderMine() {
  const mine = store.get(MINE_KEY, []);
  app.innerHTML = `<div class="wrap page"><h1 style="font-size:1.6rem;margin-bottom:14px">${t("my_bookings")}</h1>
    ${mine.length ? mine.map((m) => `<a class="bk" href="#/b/${esc(m.ref)}?t=${esc(m.token)}" style="text-decoration:none;color:inherit"><div class="row spread"><span class="who">${esc(m.ref)}</span><b>${peso(m.total)}</b></div><div class="what">${fmtRange(m.startDate, m.endDate)}</div></a>`).join("")
      : `<p class="empty">${t("no_bookings")}</p><a class="btn btn-primary btn-block" href="#/">${t("check")}</a>`}</div>`;
}

// ---------- router ----------
async function route() {
  const [path, qs] = location.hash.slice(1).split("?");
  const params = new URLSearchParams(qs || "");
  try {
    if (!S.catalog) { app.innerHTML = `<div class="wrap page"><div class="skeleton"></div></div>`; await loadCatalog(); }
  } catch (e) {
    app.innerHTML = `<div class="wrap page"><p class="notice bad">${errMsg(e)}</p><button class="btn btn-ghost" style="margin-top:12px" onclick="location.reload()">${t("retry")}</button></div>`; return;
  }
  chrome();
  const m = path?.match(/^\/b\/(PR-[A-Z0-9]{6})$/);
  if (m) await renderBooking(m[1], params.get("t") || "");
  else if (path === "/checkout") renderCheckout();
  else if (path === "/my") renderMine();
  else renderHome();
  updateCartBar();
  if (!m) window.scrollTo(0, 0);
}
$$(".seg [data-lang]").forEach((b) => b.addEventListener("click", () => { setLang(b.dataset.lang); route(); }));
window.addEventListener("hashchange", route);
route();

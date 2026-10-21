import { t, tr, getLang, setLang, tLang } from "./i18n.js";
import { $, $$, esc, peso, fmtDate, fmtRange, addDays, fmtPhone, api, ApiError, compressImage, toast, copyText } from "./common.js";

const PIN_KEY = "pahina.adminpin";
const A = { pin: sessionStorage.getItem(PIN_KEY) || "", data: null, tab: "today", day: null, filter: "active", q: "", stockDay: null, avail: null, open: null };
const root = () => $("#app .wrap");
const ACTIVE = ["requested", "confirmed", "out"];
const ICONS = {
  today: '<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
  bookings: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',
  payments: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  stock: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
};
const ic = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
const stBadge = (s) => `<span class="badge ${{ requested: "b-warn", confirmed: "b-ok", out: "b-info", returned: "b-mute", cancelled: "b-bad" }[s]}">${t("a_s_" + s)}</span>`;
const errMsg = (e) => { if (e instanceof ApiError) { const k = "err_" + e.code; const m = t(k, e.extra || {}); return m === k ? `${t("err_generic")} (${e.code})` : m; } return t("err_generic"); };

async function call(path, opts = {}) {
  try { return await api("/api/admin" + path, { ...opts, headers: { "x-admin-pin": A.pin } }); }
  catch (e) { if (e.status === 401) { logout(); } throw e; }
}
function logout() { A.pin = ""; sessionStorage.removeItem(PIN_KEY); A.data = null; render(); }

async function load() {
  A.data = await call("/overview");
  A.day ||= A.data.today; A.stockDay ||= A.data.today;
}
const bookings = () => A.data.bookings;
const itemById = (id) => A.data.items.find((i) => i.id === id);
const linesText = (b) => b.lines.map((l) => `${l.qty}× ${tr(l.name)}`).join(", ");
const isExpired = (b) => b.status === "requested" && !b.payments.length && Date.now() - Date.parse(b.createdAt) > A.data.settings.holdHours * 3600000;
function replaceBooking(nb) { const i = A.data.bookings.findIndex((b) => b.ref === nb.ref); if (i >= 0) A.data.bookings[i] = nb; else A.data.bookings.unshift(nb); }

// ---------- shell ----------
function render() {
  setLang(getLang());
  $$(".seg [data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === getLang())));
  document.title = t("a_title");
  if (!A.pin || !A.data) { $("#tabbar").classList.add("hidden"); return renderLogin(); }
  const tb = $("#tabbar"); tb.classList.remove("hidden");
  const toCheck = bookings().reduce((n, b) => n + b.payments.filter((p) => p.status === "submitted").length, 0);
  const newReq = bookings().filter((b) => b.status === "requested" && !isExpired(b)).length;
  tb.innerHTML = [["today", "a_today", 0], ["bookings", "a_bookings", newReq], ["payments", "a_payments", toCheck], ["stock", "a_stock", 0], ["more", "a_more", 0]]
    .map(([k, l, n]) => `<button role="tab" data-tab="${k}" aria-selected="${A.tab === k}">${ic(k)}${t(l)}${n ? `<span class="dot">${n}</span>` : ""}</button>`).join("");
  $$("button", tb).forEach((b) => b.addEventListener("click", () => { A.tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
  ({ today: viewToday, bookings: viewBookings, payments: viewPayments, stock: viewStock, more: viewMore })[A.tab]();
  if (A.open) openBooking(A.open, true);
}

function renderLogin(msg = "") {
  root().innerHTML = `<form class="card login stack" id="login">
    <h1 style="font-size:1.5rem">${t("a_login_title")}</h1>
    <label class="field"><span>${t("a_pin")}</span><input class="input pinput" type="password" inputmode="numeric" autocomplete="current-password" name="pin" required autofocus></label>
    <p class="err" role="alert">${esc(msg)}</p>
    <button class="btn btn-teal btn-block" type="submit">${t("a_enter")}</button>
  </form>`;
  $("#login").addEventListener("submit", async (e) => {
    e.preventDefault(); A.pin = e.target.pin.value.trim();
    try { await load(); sessionStorage.setItem(PIN_KEY, A.pin); render(); }
    catch (err) { A.pin = ""; renderLogin(err.status === 503 ? t("a_pin_missing") : err.status === 401 ? t("a_wrong_pin") : errMsg(err)); }
  });
}

// ---------- planning ----------
function bookingCard(b, action = "") {
  const s = b.summary;
  return `<div class="bk" data-ref="${b.ref}" role="button" tabindex="0">
    <div class="row spread"><span class="who">${esc(b.customer.name)}</span>${stBadge(b.status)}</div>
    <div class="what">${esc(b.customer.town)} · ${fmtRange(b.startDate, b.endDate)} · <b>${esc(b.ref)}</b></div>
    <div class="what">${esc(linesText(b))}</div>
    <div class="row spread" style="margin-top:8px">
      <span class="small">${s.balance > 0 ? `${t("balance")}: <b>${peso(s.balance)}</b>` : `<span class="badge b-ok">${t("paid")}</span>`}${s.pending ? ` <span class="badge b-warn">${t("pay_submitted")}</span>` : ""}${isExpired(b) ? ` <span class="badge b-mute">${t("a_expired")}</span>` : ""}</span>
      ${action}
    </div></div>`;
}
function bindCards(scope = document) {
  $$(".bk[data-ref]", scope).forEach((el) => {
    const open = (e) => { if (e.target.closest("[data-act]")) return; openBooking(el.dataset.ref); };
    el.addEventListener("click", open); el.addEventListener("keydown", (e) => e.key === "Enter" && open(e));
  });
  $$("[data-act]", scope).forEach((btn) => btn.addEventListener("click", async (e) => {
    e.stopPropagation(); btn.disabled = true;
    try { const r = await call(`/bookings/${btn.dataset.ref}`, { method: "PATCH", body: { status: btn.dataset.act } }); replaceBooking(r.booking); toast(t("a_saved"), "ok"); render(); }
    catch (err) { toast(errMsg(err), "bad"); btn.disabled = false; }
  }));
}

function viewToday() {
  const today = A.data.today, day = A.day, set = A.data.settings;
  const act = bookings().filter((b) => ACTIVE.includes(b.status));
  const weekEnd = addDays(today, 6);
  const toCollect = act.reduce((s, b) => s + b.summary.balance, 0);
  const evDays = new Set(); act.forEach((b) => { evDays.add(b.deliveryDate); evDays.add(b.pickupDate); });
  const deliveries = act.filter((b) => b.deliveryDate === day && b.status !== "out" && !isExpired(b));
  const pickups = act.filter((b) => b.pickupDate === day && b.status === "out");
  const overdue = day === today ? act.filter((b) => b.status === "out" && b.pickupDate < today) : [];
  const late = day === today ? act.filter((b) => b.status !== "out" && b.deliveryDate < today && !isExpired(b)) : [];
  const toCheck = bookings().filter((b) => b.payments.some((p) => p.status === "submitted"));
  root().innerHTML = `
    ${!set.gcashNumber ? `<p class="notice warn" style="margin-bottom:12px">${t("a_setup_gcash")}</p>` : ""}
    ${toCheck.length ? `<button class="notice info btn-block" style="border:0;text-align:left;cursor:pointer;margin-bottom:12px;width:100%" id="go-pay">🧾 ${t("a_to_check")}: <b>${toCheck.length}</b></button>` : ""}
    <div class="kpis">
      <div class="kpi"><b>${act.filter((b) => b.status === "requested" && !isExpired(b)).length}</b><span>${t("a_kpi_requests")}</span></div>
      <div class="kpi"><b>${act.filter((b) => b.startDate >= today && b.startDate <= weekEnd).length}</b><span>${t("a_kpi_week")}</span></div>
      <div class="kpi"><b style="font-size:1.05rem;line-height:1.6">${peso(toCollect)}</b><span>${t("a_kpi_to_collect")}</span></div>
    </div>
    <div class="daystrip" style="margin-top:16px">${Array.from({ length: 21 }, (_, i) => addDays(today, i)).map((d) => `<button data-day="${d}" aria-pressed="${d === day}"><small>${i18nDow(d)}</small><b>${Number(d.slice(8))}</b><span class="pip ${evDays.has(d) ? "on" : ""}"></span></button>`).join("")}</div>
    <h2 style="margin:12px 0 4px">${day === today ? t("a_today_label") : day === addDays(today, 1) ? t("a_tomorrow") : ""} <span class="muted" style="font-weight:600">${fmtDate(day, { weekday: "long", month: "long", day: "numeric" })}</span></h2>
    ${late.length || overdue.length ? `<div class="section-title" style="color:var(--bad)">⚠</div>${late.map((b) => bookingCard(b, `<button class="btn btn-ok btn-sm" data-act="out" data-ref="${b.ref}">${t("a_mark_delivered")}</button>`)).join("")}${overdue.map((b) => bookingCard(b, `<button class="btn btn-ok btn-sm" data-act="returned" data-ref="${b.ref}">${t("a_mark_returned")}</button>`)).join("")}` : ""}
    <div class="section-title">🚚 ${t("a_deliveries")} (${deliveries.length})</div>
    ${deliveries.map((b) => bookingCard(b, b.status === "confirmed" ? `<button class="btn btn-ok btn-sm" data-act="out" data-ref="${b.ref}">${t("a_mark_delivered")}</button>` : "")).join("") || `<p class="empty">${t("a_none")}</p>`}
    <div class="section-title">↩️ ${t("a_pickups")} (${pickups.length})</div>
    ${pickups.map((b) => bookingCard(b, `<button class="btn btn-ok btn-sm" data-act="returned" data-ref="${b.ref}">${t("a_mark_returned")}</button>`)).join("") || `<p class="empty">${t("a_none")}</p>`}`;
  $$(".daystrip [data-day]").forEach((b) => b.addEventListener("click", () => { A.day = b.dataset.day; viewToday(); }));
  $(".daystrip [aria-pressed=true]")?.scrollIntoView({ inline: "center", block: "nearest" });
  $("#go-pay")?.addEventListener("click", () => { A.tab = "payments"; render(); });
  bindCards(root());
}
const i18nDow = (d) => new Date(d + "T12:00:00Z").toLocaleDateString(getLang() === "tl" ? "fil-PH" : "en-PH", { weekday: "short", timeZone: "UTC" });

// ---------- bookings list ----------
function viewBookings() {
  const all = bookings();
  const groups = { active: (b) => ACTIVE.includes(b.status), requested: (b) => b.status === "requested", confirmed: (b) => b.status === "confirmed", out: (b) => b.status === "out", returned: (b) => b.status === "returned", cancelled: (b) => b.status === "cancelled", all: () => true };
  const q = A.q.trim().toLowerCase();
  let list = all.filter(groups[A.filter]).filter((b) => !q || [b.ref, b.customer.name, b.customer.phone, fmtPhone(b.customer.phone), b.customer.town].join(" ").toLowerCase().includes(q));
  list = A.filter === "active" ? list.sort((a, b) => a.startDate.localeCompare(b.startDate)) : list;
  root().innerHTML = `
    <div class="row spread"><h1 style="font-size:1.5rem">${t("a_bookings")}</h1><button class="btn btn-primary btn-sm" id="newbk">＋ ${t("a_new_booking")}</button></div>
    <input class="input" type="search" id="q" placeholder="${t("a_search")}" value="${esc(A.q)}" style="margin-top:12px">
    <nav class="chips" style="margin-top:8px">${Object.keys(groups).map((k) => `<button class="chip" data-f="${k}" aria-pressed="${A.filter === k}">${k === "active" ? t("a_upcoming") : t("a_s_" + k)} <span class="muted">${all.filter(groups[k]).length}</span></button>`).join("")}</nav>
    <div id="list">${list.map((b) => bookingCard(b)).join("") || `<p class="empty">—</p>`}</div>`;
  $("#q").addEventListener("input", (e) => { A.q = e.target.value; const pos = e.target.selectionStart; viewBookings(); const n = $("#q"); n.focus(); n.setSelectionRange(pos, pos); });
  $$("[data-f]").forEach((b) => b.addEventListener("click", () => { A.filter = b.dataset.f; viewBookings(); }));
  $("#newbk").addEventListener("click", newBookingSheet);
  bindCards(root());
}

// ---------- payments ----------
function viewPayments() {
  const month = A.data.today.slice(0, 7);
  const collected = bookings().flatMap((b) => b.payments).filter((p) => p.status === "verified" && (p.verifiedAt || p.at).slice(0, 7) === month).reduce((s, p) => s + p.amount, 0);
  const pend = bookings().flatMap((b) => b.payments.filter((p) => p.status === "submitted").map((p) => ({ b, p })));
  const owing = bookings().filter((b) => ["confirmed", "out", "requested"].includes(b.status) && b.summary.balance > 0 && !isExpired(b)).sort((a, b) => a.startDate.localeCompare(b.startDate));
  root().innerHTML = `
    <h1 style="font-size:1.5rem">${t("a_payments")}</h1>
    <div class="kpis" style="grid-template-columns:1fr 1fr;margin-top:12px">
      <div class="kpi"><b>${peso(collected)}</b><span>${t("a_collected_month")}</span></div>
      <div class="kpi"><b>${peso(owing.reduce((s, b) => s + b.summary.balance, 0))}</b><span>${t("a_outstanding")}</span></div>
    </div>
    <div class="section-title">🧾 ${t("a_to_check")} (${pend.length})</div>
    ${pend.map(({ b, p }) => `<div class="card flat" style="margin-bottom:8px">
        <div class="row spread"><b>${peso(p.amount)}</b><span class="small muted">${fmtDate(p.at.slice(0, 10))}</span></div>
        <div class="small" style="margin-top:2px">${esc(b.customer.name)} · <a href="#" data-open="${b.ref}">${b.ref}</a> · ${t("deposit")} ${peso(b.depositRequired)}</div>
        <div class="tiny muted">${p.reference ? "Ref " + esc(p.reference) : ""} ${p.sender ? "· " + esc(p.sender) : ""}</div>
        <div class="proof" data-ref="${b.ref}" data-pid="${p.id}"><button class="btn btn-ghost btn-sm" style="margin-top:8px" data-loadproof>${t("a_load_proof")}</button></div>
        <div class="row" style="margin-top:10px"><button class="btn btn-ok btn-sm" style="flex:1" data-pay="verified" data-ref="${b.ref}" data-pid="${p.id}">✓ ${t("a_verify")}</button><button class="btn btn-danger btn-sm" style="flex:1" data-pay="rejected" data-ref="${b.ref}" data-pid="${p.id}">${t("a_reject")}</button></div>
      </div>`).join("") || `<p class="empty">${t("a_nothing_check")}</p>`}
    <div class="section-title">💰 ${t("a_outstanding")} (${owing.length})</div>
    ${owing.map((b) => bookingCard(b)).join("") || `<p class="empty">${t("a_no_balance")}</p>`}`;
  bindProofs(root()); bindPayButtons(root()); bindCards(root());
  $$("[data-open]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); openBooking(a.dataset.open); }));
}
function bindProofs(scope) {
  $$("[data-loadproof]", scope).forEach((btn) => btn.addEventListener("click", async () => {
    const box = btn.closest(".proof"); btn.disabled = true; btn.textContent = t("loading");
    try {
      const r = await api(`/api/admin/bookings/${box.dataset.ref}/payments/${box.dataset.pid}/proof`, { headers: { "x-admin-pin": A.pin }, raw: true });
      const url = URL.createObjectURL(await r.blob());
      box.innerHTML = `<a href="${url}" target="_blank" rel="noopener"><img class="proof-img" src="${url}" alt="${t("a_proof")}"></a>`;
    } catch (e) { btn.disabled = false; btn.textContent = t("a_load_proof"); toast(errMsg(e), "bad"); }
  }));
}
function bindPayButtons(scope) {
  $$("[data-pay]", scope).forEach((btn) => btn.addEventListener("click", async () => {
    btn.disabled = true;
    try { const r = await call(`/bookings/${btn.dataset.ref}/payments/${btn.dataset.pid}`, { method: "PATCH", body: { status: btn.dataset.pay } }); replaceBooking(r.booking); toast(t("a_saved"), "ok"); render(); }
    catch (e) { toast(errMsg(e), "bad"); btn.disabled = false; }
  }));
}

// ---------- stock ----------
async function viewStock() {
  const day = A.stockDay;
  root().innerHTML = `<div class="row spread"><h1 style="font-size:1.5rem">${t("a_stock")}</h1><button class="btn btn-primary btn-sm" id="additem">＋ ${t("a_add_item")}</button></div>
    <label class="field" style="margin-top:12px"><span>${t("a_avail_on")}</span><input class="input" type="date" id="sday" value="${day}"></label>
    <div id="stocklist" style="margin-top:12px"><div class="skeleton"></div></div>`;
  $("#sday").addEventListener("change", (e) => { A.stockDay = e.target.value || A.data.today; viewStock(); });
  $("#additem").addEventListener("click", () => itemSheet(null));
  try { A.avail = (await call(`/availability?start=${day}&end=${day}`)).available; } catch (e) { toast(errMsg(e), "bad"); A.avail = {}; }
  if (A.tab !== "stock") return;
  $("#stocklist").innerHTML = A.data.items.map((i) => {
    const usable = i.qty - (i.outOfService || 0), av = A.avail[i.id] ?? usable, booked = usable - av;
    return `<div class="bk" data-item="${i.id}" role="button" tabindex="0" style="${i.active ? "" : "opacity:.6"}">
      <div class="stock-row"><img src="${esc(i.image)}" alt="">
        <div style="flex:1;min-width:0"><div class="row spread"><b>${esc(tr(i.name))}</b><span>${peso(i.price)}</span></div>
          <div class="small muted">${t("a_total_qty")} ${i.qty}${i.outOfService ? ` · <span style="color:var(--bad)">${t("a_oos")} ${i.outOfService}</span>` : ""} · ${t("a_booked")} ${booked} · <b style="color:var(--ink)">${t("available_n", { n: av })}</b>${i.active ? "" : ` · ${t("a_hidden")}`}</div>
          <div class="meter"><i style="width:${usable ? Math.round((booked / usable) * 100) : 100}%;${av === 0 ? "background:var(--coral)" : ""}"></i></div></div></div></div>`;
  }).join("");
  $$("[data-item]").forEach((el) => el.addEventListener("click", () => itemSheet(itemById(el.dataset.item))));
}

function itemSheet(it) {
  const isNew = !it; it ||= { name: { en: "", tl: "" }, unit: { en: "per piece", tl: "bawat isa" }, description: { en: "", tl: "" }, category: "decor", price: "", qty: 1, outOfService: 0, active: true, image: "/img/items/generic.svg" };
  sheet(isNew ? t("a_add_item") : tr(it.name), `<form class="stack" id="itemf">
    ${!isNew ? `<div class="row"><img src="${esc(it.image)}" alt="" style="width:96px;height:72px;object-fit:cover;border-radius:10px;background:var(--soft)" id="itimg"><label class="btn btn-ghost btn-sm">${t("a_upload_photo")}<input type="file" accept="image/*" id="itphoto" hidden></label></div>` : ""}
    <div class="grid2"><label class="field"><span>${t("a_name_en")}</span><input class="input" name="name_en" value="${esc(it.name.en)}" required></label><label class="field"><span>${t("a_name_tl")}</span><input class="input" name="name_tl" value="${esc(it.name.tl)}"></label></div>
    <div class="grid2"><label class="field"><span>${t("a_price")}</span><input class="input" name="price" type="number" min="0" step="1" value="${it.price}" required></label>
      <label class="field"><span>${t("a_category")}</span><select class="input" name="category">${A.data.categories.map((c) => `<option value="${c}" ${it.category === c ? "selected" : ""}>${t("cat_" + c)}</option>`).join("")}</select></label></div>
    <div class="grid2"><label class="field"><span>${t("a_unit_en")}</span><input class="input" name="unit_en" value="${esc(it.unit.en)}"></label><label class="field"><span>${t("a_unit_tl")}</span><input class="input" name="unit_tl" value="${esc(it.unit.tl)}"></label></div>
    <div class="grid2"><label class="field"><span>${t("a_total_qty")}</span><input class="input" name="qty" type="number" min="0" value="${it.qty}"></label><label class="field"><span>${t("a_oos")}</span><input class="input" name="oos" type="number" min="0" value="${it.outOfService || 0}"></label></div>
    <label class="field"><span>${t("a_desc_en")}</span><textarea class="input" name="desc_en" rows="2">${esc(it.description.en)}</textarea></label>
    <label class="field"><span>${t("a_desc_tl")}</span><textarea class="input" name="desc_tl" rows="2">${esc(it.description.tl)}</textarea></label>
    <label class="check"><input type="checkbox" name="active" ${it.active ? "checked" : ""}><span>${t("a_active")}</span></label>
    <button class="btn btn-teal btn-block" type="submit">${t("a_save")}</button></form>`);
  const f = $("#itemf");
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = { name: { en: f.name_en.value, tl: f.name_tl.value }, unit: { en: f.unit_en.value, tl: f.unit_tl.value }, description: { en: f.desc_en.value, tl: f.desc_tl.value }, price: Number(f.price.value), category: f.category.value, qty: Number(f.qty.value), outOfService: Number(f.oos.value), active: f.active.checked };
    try {
      const r = isNew ? await call("/items", { method: "POST", body }) : await call(`/items/${it.id}`, { method: "PUT", body });
      const i = A.data.items.findIndex((x) => x.id === r.item.id); if (i >= 0) A.data.items[i] = r.item; else A.data.items.push(r.item);
      toast(t("a_saved"), "ok"); closeSheet(); viewStock();
    } catch (err) { toast(errMsg(err), "bad"); }
  });
  $("#itphoto")?.addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append("file", await compressImage(file, 1200));
    try { const r = await call(`/items/${it.id}/photo`, { method: "POST", body: fd }); Object.assign(it, r.item); $("#itimg").src = r.item.image; const i = A.data.items.findIndex((x) => x.id === it.id); A.data.items[i] = r.item; toast(t("a_saved"), "ok"); }
    catch (err) { toast(errMsg(err), "bad"); }
  });
}

// ---------- more: settings + damages ----------
function viewMore() {
  const s = A.data.settings;
  const dmg = bookings().flatMap((b) => b.damages.map((d) => ({ b, d }))).sort((x, y) => y.d.at.localeCompare(x.d.at));
  root().innerHTML = `<h1 style="font-size:1.5rem">${t("a_more")}</h1>
    <form class="card stack" id="setf" style="margin-top:12px">
      <h2>${t("a_settings")}</h2>
      <div class="grid2"><label class="field"><span>${t("a_gcash_number")}</span><input class="input" name="gcashNumber" inputmode="tel" value="${esc(s.gcashNumber)}" placeholder="09XX XXX XXXX"></label>
        <label class="field"><span>${t("a_gcash_name")}</span><input class="input" name="gcashName" value="${esc(s.gcashName)}"></label></div>
      <div class="grid2"><label class="field"><span>${t("a_contact_phone")}</span><input class="input" name="contactPhone" inputmode="tel" value="${esc(s.contactPhone)}"></label>
        <label class="field"><span>${t("a_messenger")}</span><input class="input" name="messengerUrl" type="url" value="${esc(s.messengerUrl)}" placeholder="https://m.me/…"></label></div>
      <div class="grid2"><label class="field"><span>${t("a_business")}</span><input class="input" name="businessName" value="${esc(s.businessName)}"></label>
        <label class="field"><span>${t("a_area")}</span><input class="input" name="serviceArea" value="${esc(s.serviceArea)}"></label></div>
      <div class="grid2"><label class="field"><span>${t("a_deposit_pct")}</span><input class="input" name="depositPercent" type="number" min="0" max="100" value="${s.depositPercent}"></label>
        <label class="field"><span>${t("a_min_deposit")}</span><input class="input" name="minDeposit" type="number" min="0" value="${s.minDeposit}"></label></div>
      <div class="grid2"><label class="field"><span>${t("a_lead")}</span><input class="input" name="minLeadDays" type="number" min="0" value="${s.minLeadDays}"></label>
        <label class="field"><span>${t("a_max_days")}</span><input class="input" name="maxDays" type="number" min="1" value="${s.maxDays}"></label></div>
      <div class="grid2"><label class="field"><span>${t("a_buffer")}</span><input class="input" name="bufferDays" type="number" min="0" max="3" value="${s.bufferDays}"></label>
        <label class="field"><span>${t("a_hold")}</span><input class="input" name="holdHours" type="number" min="1" value="${s.holdHours}"></label></div>
      <p class="section-title" style="margin-top:6px">${t("a_fees")}</p>
      <div class="grid2">${A.data.towns.filter((x) => x !== "Other").map((tw) => `<label class="field"><span>${tw}</span><input class="input" name="fee_${tw}" type="number" min="0" value="${s.deliveryFees[tw] ?? ""}"></label>`).join("")}</div>
      <button class="btn btn-teal btn-block" type="submit">${t("a_save")}</button>
    </form>
    <section class="card" style="margin-top:14px"><h2>${t("a_damages_log")}</h2>
      ${dmg.map(({ b, d }) => `<div class="pay-row"><div style="flex:1"><b>${d.qty}× ${esc(tr(itemById(d.itemId)?.name || { en: d.itemId }))}</b><div class="tiny muted">${fmtDate(d.at.slice(0, 10))} · <a href="#" data-open="${b.ref}">${b.ref}</a> · ${esc(b.customer.name)}${d.note ? " · " + esc(d.note) : ""}</div></div><b>${peso(d.charge)}</b></div>`).join("") || `<p class="empty">${t("a_no_damages")}</p>`}
    </section>
    <div class="row" style="margin-top:14px"><a class="btn btn-ghost" style="flex:1" href="/" target="_blank" rel="noopener">${t("a_open_link")} ↗</a><button class="btn btn-danger" style="flex:1" id="logout">${t("a_logout")}</button></div>`;
  $("#logout").addEventListener("click", logout);
  $$("[data-open]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); openBooking(a.dataset.open); }));
  const f = $("#setf");
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {}; for (const k of ["gcashNumber", "gcashName", "contactPhone", "messengerUrl", "businessName", "serviceArea"]) body[k] = f[k].value;
    for (const k of ["depositPercent", "minDeposit", "minLeadDays", "maxDays", "bufferDays", "holdHours"]) body[k] = Number(f[k].value);
    body.deliveryFees = {}; A.data.towns.filter((x) => x !== "Other").forEach((tw) => { const v = f["fee_" + tw].value; body.deliveryFees[tw] = v === "" ? null : Number(v); });
    try { const r = await call("/settings", { method: "PUT", body }); A.data.settings = r.settings; toast(t("a_saved"), "ok"); }
    catch (err) { toast(errMsg(err), "bad"); }
  });
}

// ---------- sheets ----------
function sheet(title, html, head = "") {
  $("#sheet").innerHTML = `<div class="sheet-back" id="sb"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-head"><h2 style="flex:1;font-size:1.15rem">${esc(title)}</h2>${head}<button class="icon-btn" id="sx" aria-label="Close">✕</button></div>
    <div class="sheet-body">${html}</div></div></div>`;
  document.body.style.overflow = "hidden";
  $("#sx").addEventListener("click", closeSheet);
  $("#sb").addEventListener("click", (e) => { if (e.target.id === "sb") closeSheet(); });
}
function closeSheet() { $("#sheet").innerHTML = ""; document.body.style.overflow = ""; A.open = null; }
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#sb")) closeSheet(); });

function customerMessage(b) {
  const T = tLang(b.lang || "en"), s = A.data.settings, link = location.origin + b.statusLink;
  const vars = { name: b.customer.name.split(" ")[0], biz: s.businessName, ref: b.ref, dates: fmtRange(b.startDate, b.endDate), total: peso(b.summary.grandTotal), deposit: peso(Math.max(0, b.depositRequired - b.summary.paid)), gnum: s.gcashNumber || "—", gname: s.gcashName || "", link, delivery: `${fmtDate(b.deliveryDate)}${b.deliverySlot ? " " + b.deliverySlot : ""}`, pickup: fmtDate(b.pickupDate), balance: peso(b.summary.balance) };
  return T("a_msg_" + b.status, vars);
}

function openBooking(ref, keepScroll = false) {
  const b = bookings().find((x) => x.ref === ref); if (!b) return;
  const prevScroll = keepScroll ? $(".sheet")?.scrollTop : 0;
  A.open = ref;
  const s = b.summary, c = b.customer;
  const actions = {
    requested: [["confirmed", "a_confirm", "btn-ok"], ["cancelled", "a_cancel_booking", "btn-danger"]],
    confirmed: [["out", "a_mark_delivered", "btn-ok"], ["cancelled", "a_cancel_booking", "btn-danger"]],
    out: [["returned", "a_mark_returned", "btn-ok"]],
    returned: [["confirmed", "a_reopen", "btn-ghost"]], cancelled: [["confirmed", "a_reopen", "btn-ghost"]],
  }[b.status];
  const tel = c.phone.replace(/\s/g, "");
  const msg = customerMessage(b);
  sheet(`${b.ref} · ${c.name}`, `
    <div class="row wrapx">${stBadge(b.status)}${isExpired(b) ? `<span class="badge b-mute">${t("a_expired")}</span>` : ""}<span class="tiny muted">${b.source === "admin" ? "staff" : "online"} · ${fmtDate(b.createdAt.slice(0, 10))}</span></div>
    <div class="row wrapx" style="margin-top:12px">${actions.map(([st, l, cls]) => `<button class="btn ${cls}" style="flex:1" data-status="${st}">${t(l)}</button>`).join("")}</div>

    <p class="section-title">${t("a_customer")}</p>
    <div class="card flat stack-sm">
      <div><b>${esc(c.name)}</b> · ${esc(fmtPhone(c.phone))}${c.messenger ? ` · FB: ${esc(c.messenger)}` : ""}</div>
      <div class="small">${esc(c.address)}, ${esc(c.town)}${c.landmark ? `<br><span class="muted">${esc(c.landmark)}</span>` : ""}</div>
      <div class="row"><a class="btn btn-ghost btn-sm" href="tel:${esc(tel)}">📞 ${t("a_call")}</a><a class="btn btn-ghost btn-sm" href="sms:${esc(tel)}">💬 ${t("a_sms")}</a><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address + ", " + c.town + ", Rizal")}">📍 ${t("a_map")}</a></div>
      ${b.customerNotes ? `<div class="notice info small"><b>${t("a_customer_notes")}:</b> ${esc(b.customerNotes)}</div>` : ""}
    </div>

    <p class="section-title">${t("a_msg_customer")}</p>
    <div class="card flat"><p class="small" style="white-space:pre-line">${esc(msg)}</p>
      <div class="row wrapx" style="margin-top:10px"><button class="btn btn-teal btn-sm" id="copymsg" style="flex:1">${t("copy_link").split(" ")[0]} ✓</button><a class="btn btn-ghost btn-sm" style="flex:1" href="sms:${esc(tel)}?&body=${encodeURIComponent(msg)}">💬 ${t("a_sms")}</a><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${esc(b.statusLink)}">${t("a_open_link")} ↗</a></div></div>

    <p class="section-title">${t("a_dates")} · ${fmtRange(b.startDate, b.endDate)}</p>
    <form class="card flat stack-sm" id="logi">
      <div class="grid2"><label class="field"><span>${t("a_delivery_date")}</span><input class="input" type="date" name="deliveryDate" value="${b.deliveryDate}"></label><label class="field"><span>${t("a_slot")}</span><input class="input" name="deliverySlot" value="${esc(b.deliverySlot)}" placeholder="8–10 AM"></label></div>
      <div class="grid2"><label class="field"><span>${t("a_pickup_date")}</span><input class="input" type="date" name="pickupDate" value="${b.pickupDate}"></label><label class="field"><span>${t("a_slot")}</span><input class="input" name="pickupSlot" value="${esc(b.pickupSlot || "")}" placeholder="9–11 AM"></label></div>
      <label class="field"><span>${t("a_driver")}</span><input class="input" name="driver" value="${esc(b.logistics.driver)}"></label>
      <button class="btn btn-ghost btn-sm" type="submit">${t("a_save")}</button>
    </form>

    <p class="section-title">${t("items")}</p>
    <div class="card flat"><div class="lines">${b.lines.map((l) => `<div class="line"><div class="grow"><b>${l.qty}× ${esc(tr(l.name))}</b><div class="tiny muted">${peso(l.price)}${l.days > 1 ? " × " + l.days : ""}</div></div><b>${peso(l.amount)}</b></div>`).join("")}</div>
      <div class="kv"><span>${t("subtotal")}</span><b>${peso(b.subtotal)}</b></div>
      <form id="feef" class="kv" style="align-items:center"><span>${t("a_fee_quote")}</span><span class="row"><input class="input" name="fee" type="number" min="0" style="width:110px;min-height:38px" value="${b.deliveryFee ?? ""}" placeholder="${t("to_confirm")}"><button class="btn btn-ghost btn-sm">✓</button></span></form>
      ${s.damages ? `<div class="kv"><span>${t("damages")}</span><b>${peso(s.damages)}</b></div>` : ""}
      <div class="kv total"><span>${t("total")}</span><span>${peso(s.grandTotal)}</span></div>
      <form id="depf" class="kv" style="align-items:center"><span>${t("a_deposit_due")}</span><span class="row"><input class="input" name="dep" type="number" min="0" style="width:110px;min-height:38px" value="${b.depositRequired}"><button class="btn btn-ghost btn-sm">✓</button></span></form>
      <div class="kv"><span>${t("paid")}</span><b style="color:var(--ok)">${peso(s.paid)}</b></div>
      <div class="kv"><span>${t("balance")}</span><b>${peso(s.balance)}</b></div>
    </div>

    <p class="section-title">${t("payments")}</p>
    <div class="card flat">
      ${b.payments.map((p) => `<div style="padding:8px 0;border-bottom:1px dashed var(--line)">
        <div class="row spread"><span><b>${peso(p.amount)}</b> <span class="tiny muted">${t("a_m_" + p.method)} · ${fmtDate(p.at.slice(0, 10))}${p.reference ? " · " + esc(p.reference) : ""}</span></span>${{ submitted: `<span class="badge b-warn">${t("pay_submitted")}</span>`, verified: `<span class="badge b-ok">${t("pay_verified")}</span>`, rejected: `<span class="badge b-bad">${t("a_reject")}</span>` }[p.status]}</div>
        ${p.proofKey ? `<div class="proof" data-ref="${b.ref}" data-pid="${p.id}"><button class="btn btn-ghost btn-sm" style="margin-top:6px" data-loadproof>${t("a_load_proof")}</button></div>` : ""}
        ${p.status === "submitted" ? `<div class="row" style="margin-top:8px"><button class="btn btn-ok btn-sm" style="flex:1" data-pay="verified" data-ref="${b.ref}" data-pid="${p.id}">✓ ${t("a_verify")}</button><button class="btn btn-danger btn-sm" style="flex:1" data-pay="rejected" data-ref="${b.ref}" data-pid="${p.id}">${t("a_reject")}</button></div>` : ""}
      </div>`).join("")}
      <form id="payf" class="stack-sm" style="margin-top:10px">
        <b class="small">${t("a_add_payment")}</b>
        <div class="grid2"><input class="input" name="amount" type="number" min="1" step="0.01" placeholder="${t("a_amount")}" value="${s.balance || ""}"><select class="input" name="method">${["cash", "gcash", "bank", "other"].map((m) => `<option value="${m}">${t("a_m_" + m)}</option>`).join("")}</select></div>
        <div class="grid2"><input class="input" name="reference" placeholder="${t("a_reference")}"><button class="btn btn-teal" type="submit">${t("a_save")}</button></div>
      </form>
    </div>

    <p class="section-title">${t("damages")}</p>
    <div class="card flat">
      ${b.damages.map((d) => `<div class="pay-row"><div style="flex:1">${d.qty}× ${esc(tr(b.lines.find((l) => l.itemId === d.itemId)?.name))}${d.outOfService ? ` <span class="badge b-bad">${t("a_oos")}</span>` : ""}<div class="tiny muted">${esc(d.note)}</div></div><b>${peso(d.charge)}</b><button class="icon-btn" style="width:32px;height:32px" data-deldmg="${d.id}" aria-label="Delete">✕</button></div>`).join("")}
      <form id="dmgf" class="stack-sm" style="margin-top:8px">
        <b class="small">${t("a_damage_add")}</b>
        <div class="grid2"><select class="input" name="itemId">${b.lines.map((l) => `<option value="${l.itemId}">${esc(tr(l.name))}</option>`).join("")}</select><input class="input" name="qty" type="number" min="1" value="1" aria-label="${t("qty")}"></div>
        <div class="grid2"><input class="input" name="charge" type="number" min="0" placeholder="${t("a_charge")}"><input class="input" name="note" placeholder="${t("a_note")}"></div>
        <label class="check"><input type="checkbox" name="oos" checked><span>${t("a_out_service")}</span></label>
        <button class="btn btn-ghost btn-sm" type="submit">${t("a_save")}</button>
      </form>
    </div>

    <p class="section-title">${t("a_internal_notes")}</p>
    <form id="notef" class="stack-sm"><textarea class="input" name="notes" rows="2">${esc(b.notes)}</textarea><button class="btn btn-ghost btn-sm">${t("a_save")}</button></form>

    <p class="section-title">${t("a_history")}</p>
    <div class="hist">${b.history.slice().reverse().map((h) => `<div>${new Date(h.at).toLocaleString(getLang() === "tl" ? "fil-PH" : "en-PH", { timeZone: "Asia/Manila", dateStyle: "short", timeStyle: "short" })} · ${esc(h.by)} · ${esc(h.what)}</div>`).join("")}</div>`);
  if (prevScroll) $(".sheet").scrollTop = prevScroll;
  const patch = async (body, okMsg = t("a_saved")) => {
    try { const r = await call(`/bookings/${b.ref}`, { method: "PATCH", body }); replaceBooking(r.booking); toast(okMsg, "ok"); render(); }
    catch (e) {
      if (e.code === "not_available" && confirm(t("err_not_available") + "\n\n" + t("a_force") + "?")) return patch({ ...body, force: true });
      toast(errMsg(e), "bad");
    }
  };
  $$("[data-status]").forEach((btn) => btn.addEventListener("click", () => { if (btn.dataset.status === "cancelled" && !confirm(t("a_cancel_q"))) return; patch({ status: btn.dataset.status }); }));
  $("#copymsg").addEventListener("click", async () => { if (await copyText(msg)) toast(t("copied"), "ok"); });
  $("#logi").addEventListener("submit", (e) => { e.preventDefault(); const f = e.target; patch({ deliveryDate: f.deliveryDate.value, deliverySlot: f.deliverySlot.value, pickupDate: f.pickupDate.value, pickupSlot: f.pickupSlot.value, driver: f.driver.value }); });
  $("#feef").addEventListener("submit", (e) => { e.preventDefault(); patch({ deliveryFee: e.target.fee.value === "" ? null : Number(e.target.fee.value) }); });
  $("#depf").addEventListener("submit", (e) => { e.preventDefault(); patch({ depositRequired: Number(e.target.dep.value) }); });
  $("#notef").addEventListener("submit", (e) => { e.preventDefault(); patch({ notes: e.target.notes.value }); });
  $("#payf").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target;
    try { const r = await call(`/bookings/${b.ref}/payments`, { method: "POST", body: { amount: Number(f.amount.value), method: f.method.value, reference: f.reference.value } }); replaceBooking(r.booking); toast(t("a_saved"), "ok"); render(); }
    catch (err) { toast(errMsg(err), "bad"); }
  });
  $("#dmgf").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target;
    try {
      const r = await call(`/bookings/${b.ref}/damages`, { method: "POST", body: { itemId: f.itemId.value, qty: Number(f.qty.value), charge: Number(f.charge.value || 0), note: f.note.value, outOfService: f.oos.checked } });
      replaceBooking(r.booking); if (f.oos.checked) await load(); toast(t("a_saved"), "ok"); render();
    } catch (err) { toast(errMsg(err), "bad"); }
  });
  $$("[data-deldmg]").forEach((btn) => btn.addEventListener("click", async () => {
    try { const r = await call(`/bookings/${b.ref}/damages/${btn.dataset.deldmg}`, { method: "DELETE" }); replaceBooking(r.booking); render(); } catch (err) { toast(errMsg(err), "bad"); }
  }));
  const sh = $(".sheet"); bindProofs(sh); bindPayButtons(sh);
}

function newBookingSheet() {
  const today = A.data.today;
  sheet(t("a_new_booking"), `<form class="stack" id="nbf">
    <div class="grid2"><label class="field"><span>${t("start_date")}</span><input class="input" type="date" name="start" value="${addDays(today, 1)}" required></label><label class="field"><span>${t("end_date")}</span><input class="input" type="date" name="end" value="${addDays(today, 1)}" required></label></div>
    <div id="nbitems" class="card flat"></div>
    <div class="grid2"><label class="field"><span>${t("f_name")}</span><input class="input" name="name" required></label><label class="field"><span>${t("f_phone")}</span><input class="input" name="phone" type="tel" required placeholder="09XX XXX XXXX"></label></div>
    <div class="grid2"><label class="field"><span>${t("f_town")}</span><select class="input" name="town">${A.data.towns.map((x) => `<option>${x}</option>`).join("")}</select></label><label class="field"><span>${t("a_fee_quote")}</span><input class="input" name="fee" type="number" min="0" placeholder="auto"></label></div>
    <label class="field"><span>${t("f_address")}</span><input class="input" name="address" required></label>
    <label class="field"><span>${t("f_messenger")}</span><input class="input" name="messenger"></label>
    <label class="field"><span>${t("f_notes")}</span><textarea class="input" name="notes" rows="2"></textarea></label>
    <div class="grid2"><label class="field"><span>${t("a_language")}</span><select class="input" name="lang"><option value="tl">Tagalog</option><option value="en">English</option></select></label><span></span></div>
    <label class="check"><input type="checkbox" name="confirmed"><span>${t("a_status_confirmed_now")}</span></label>
    <label class="check"><input type="checkbox" name="force"><span>${t("a_force")}</span></label>
    <p class="err" id="nberr"></p>
    <button class="btn btn-primary btn-block" type="submit">${t("a_create")}</button></form>`);
  const f = $("#nbf");
  const drawItems = async () => {
    const s = f.start.value, e = f.end.value < s ? s : f.end.value;
    let av = {}; try { av = (await call(`/availability?start=${addDays(s, -A.data.settings.bufferDays)}&end=${addDays(e, A.data.settings.bufferDays)}`)).available; } catch {}
    const prev = Object.fromEntries($$("[data-q]", f).map((x) => [x.dataset.q, x.value]));
    $("#nbitems").innerHTML = A.data.items.filter((i) => i.active).map((i) => `<div class="pay-row"><div style="flex:1"><b class="small">${esc(tr(i.name))}</b><div class="tiny muted">${peso(i.price)} · ${t("available_n", { n: av[i.id] ?? "?" })}</div></div><input class="input" style="width:84px;min-height:38px" type="number" min="0" data-q="${i.id}" value="${prev[i.id] || ""}" placeholder="0"></div>`).join("");
  };
  drawItems(); f.start.addEventListener("change", () => { if (f.end.value < f.start.value) f.end.value = f.start.value; drawItems(); }); f.end.addEventListener("change", drawItems);
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); $("#nberr").textContent = "";
    const lines = $$("[data-q]", f).filter((x) => Number(x.value) > 0).map((x) => ({ itemId: x.dataset.q, qty: Number(x.value) }));
    try {
      const r = await call("/bookings", { method: "POST", body: { startDate: f.start.value, endDate: f.end.value, lines, lang: f.lang.value, notes: f.notes.value, deliveryFee: f.fee.value === "" ? null : Number(f.fee.value), status: f.confirmed.checked ? "confirmed" : "requested", force: f.force.checked,
        customer: { name: f.name.value, phone: f.phone.value, town: f.town.value, address: f.address.value, messenger: f.messenger.value } } });
      await load(); toast(t("a_saved"), "ok"); closeSheet(); A.tab = "bookings"; render(); openBooking(r.ref);
    } catch (err) { $("#nberr").textContent = errMsg(err); }
  });
}

// ---------- boot ----------
$$(".seg [data-lang]").forEach((b) => b.addEventListener("click", () => { setLang(b.dataset.lang); render(); }));
$("#refresh").addEventListener("click", async () => { if (!A.pin) return; try { await load(); render(); toast(t("a_saved"), "ok"); } catch (e) { toast(errMsg(e), "bad"); } });
(async () => {
  if (A.pin) { try { await load(); } catch { A.pin = ""; sessionStorage.removeItem(PIN_KEY); } }
  render();
})();

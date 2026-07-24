(() => {
  "use strict";

  const CONFIG = window.BOOKSALE_CONFIG || {};
  const API_BASE_URL = String(CONFIG.API_BASE_URL || "").replace(/\/+$/, "");
  const SESSION_KEY = "booksale_session_v1";
  let plans = [];
  let billingStatus = null;

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  function hasSession() {
    return Boolean(localStorage.getItem(SESSION_KEY));
  }

  function toast(message) {
    const el = $("#toast");
    if (!el) return alert(message);
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3500);
  }

  function esc(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = localStorage.getItem(SESSION_KEY) || "";
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Errore ${response.status}`);
    return data;
  }

  function requireAccount(reason = "billing") {
    if (hasSession()) return true;
    window.dispatchEvent(new CustomEvent("booksale:auth-required", { detail: { reason } }));
    return false;
  }

  function formatAmount(amount, currency = "eur", interval = null) {
    if (amount === null || amount === undefined) return "Da configurare";
    let value;
    try {
      value = new Intl.NumberFormat("it-IT", {
        style: "currency", currency: String(currency).toUpperCase()
      }).format(Number(amount) / 100);
    } catch {
      value = `${(Number(amount) / 100).toFixed(2)} ${currency}`;
    }
    return interval ? `${value}/${interval === "month" ? "mese" : interval}` : value;
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function planFeatures(code) {
    const map = {
      featured_7d: ["Priorità nel catalogo", "Badge In evidenza", "Durata 7 giorni"],
      featured_15d: ["Priorità nel catalogo", "Badge In evidenza", "Durata 15 giorni"],
      plus_monthly: ["Fino a 25 annunci attivi", "Badge Venditore Plus", "Gestione abbonamento dal portale Stripe"],
      pro_monthly: ["Fino a 100 annunci attivi", "Badge Venditore Pro", "Statistiche e priorità professionale"]
    };
    return map[code] || [];
  }

  async function loadPlans(force = false) {
    if (plans.length && !force) return plans;
    const data = await api("/api/billing/plans");
    plans = Array.isArray(data.plans) ? data.plans : [];
    renderPricing(data.testMode);
    return plans;
  }

  function renderPricing(testMode = false) {
    const container = $("#pricingCards");
    if (!container) return;
    const order = ["featured_7d", "featured_15d", "plus_monthly", "pro_monthly"];
    const sorted = [...plans].sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
    container.innerHTML = sorted.length ? sorted.map(plan => {
      const subscription = plan.kind === "subscription";
      const button = subscription
        ? `<button class="primary-btn full-btn" data-service-checkout="${esc(plan.code)}" ${plan.available ? "" : "disabled"}>Scegli ${esc(plan.title)}</button>`
        : `<button class="secondary-btn full-btn" data-pricing-promotion type="button">Scegli da I miei annunci</button>`;
      return `<article class="pricing-card ${plan.code === "pro_monthly" ? "recommended" : ""}">
        ${plan.code === "pro_monthly" ? '<span class="pricing-ribbon">Per professionisti</span>' : ""}
        <span class="eyebrow">${subscription ? "Abbonamento" : "Visibilità"}</span>
        <h3>${esc(plan.title)}</h3>
        <div class="pricing-price">${formatAmount(plan.amount, plan.currency, plan.interval)}</div>
        <ul>${planFeatures(plan.code).map(feature => `<li>${esc(feature)}</li>`).join("")}</ul>
        ${button}
      </article>`;
    }).join("") : '<div class="empty-state"><h3>Prezzi non disponibili</h3><p>Completa la configurazione Stripe nel Worker.</p></div>';
    const note = $("#pricingModeNote");
    if (note) note.textContent = testMode
      ? "Modalità Stripe TEST: non verrà addebitato denaro reale."
      : "I pagamenti vengono gestiti nella pagina sicura ospitata da Stripe.";
  }

  async function openPricing() {
    const dialog = $("#pricingDialog");
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    try {
      await loadPlans();
    } catch (error) {
      $("#pricingCards").innerHTML = `<div class="empty-state"><h3>Impossibile caricare i piani</h3><p>${esc(error.message)}</p></div>`;
    }
  }

  async function loadBillingStatus() {
    if (!hasSession()) {
      renderSignedOut();
      return null;
    }
    try {
      const data = await api("/api/billing/status");
      billingStatus = data;
      renderBillingStatus(data);
      return data;
    } catch (error) {
      if (/Accedi|Sessione/i.test(error.message)) renderSignedOut();
      else toast(error.message);
      return null;
    }
  }

  function renderSignedOut() {
    const name = $("#billingPlanName");
    const text = $("#billingPlanText");
    if (name) name.textContent = "Piano gratuito";
    if (text) text.textContent = "Accedi per gestire abbonamenti, pagamenti e annunci in evidenza.";
    if ($("#billingPlanStatus")) $("#billingPlanStatus").textContent = "Non connesso";
    if ($("#billingListingLimit")) $("#billingListingLimit").textContent = "5 annunci attivi";
    $("#billingRenewal")?.classList.add("hidden");
    $("#manageBillingBtn")?.classList.add("hidden");
    if ($("#billingHistory")) $("#billingHistory").innerHTML = "";
  }

  function renderBillingStatus(data) {
    const user = data.user || {};
    const active = ["active", "trialing"].includes(user.planStatus);
    const label = active && user.planCode === "pro" ? "BookSale Professionale"
      : active && user.planCode === "plus" ? "BookSale Plus" : "Piano gratuito";
    $("#billingPlanName").textContent = label;
    $("#billingPlanText").textContent = active
      ? "Il tuo piano è attivo. Puoi gestire rinnovo, metodo di pagamento e cancellazione nel portale Stripe."
      : "Puoi acquistare visibilità per un singolo annuncio oppure attivare un abbonamento.";
    $("#billingPlanStatus").textContent = active ? `Stato: ${user.planStatus}` : "Nessun abbonamento attivo";
    $("#billingListingLimit").textContent = `${data.listingLimit || 5} annunci attivi`;
    const renewal = $("#billingRenewal");
    if (renewal && data.subscription?.current_period_end) {
      renewal.textContent = `${data.subscription.cancel_at_period_end ? "Termina" : "Rinnovo"}: ${formatDate(data.subscription.current_period_end)}`;
      renewal.classList.remove("hidden");
    } else renewal?.classList.add("hidden");
    $("#manageBillingBtn")?.classList.toggle("hidden", !user.billingConfigured);

    const history = $("#billingHistory");
    if (!history) return;
    const payments = data.payments || [];
    const promotions = data.promotions || [];
    if (!payments.length && !promotions.length) {
      history.innerHTML = '<p class="field-note">Non risultano ancora pagamenti o promozioni.</p>';
      return;
    }
    history.innerHTML = `
      <div class="billing-history-grid">
        <div><strong>Pagamenti recenti</strong>${payments.slice(0,5).map(item => `<p>${esc(serviceLabel(item.service_code))} · ${formatAmount(item.amount_total, item.currency)} · ${esc(statusLabel(item.status))}</p>`).join("") || "<p>Nessuno</p>"}</div>
        <div><strong>Promozioni</strong>${promotions.slice(0,5).map(item => `<p>${esc(item.listing_title || "Annuncio")} · fino al ${formatDate(item.ends_at)}</p>`).join("") || "<p>Nessuna</p>"}</div>
      </div>`;
  }

  function serviceLabel(code) {
    return plans.find(plan => plan.code === code)?.title || ({
      featured_7d: "Evidenza 7 giorni", featured_15d: "Evidenza 15 giorni",
      plus_monthly: "BookSale Plus", pro_monthly: "BookSale Professionale"
    }[code] || code || "Servizio BookSale");
  }

  function statusLabel(status) {
    return ({ pending: "in attesa", processing: "in elaborazione", paid: "pagato", failed: "non riuscito", refunded: "rimborsato" }[status] || status || "-");
  }

  async function startCheckout(serviceCode, listingId = "") {
    if (!requireAccount("billing")) return;
    const button = document.activeElement;
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      const data = await api("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ serviceCode, listingId })
      });
      if (!data.url) throw new Error("Stripe non ha restituito il collegamento di pagamento");
      window.location.assign(data.url);
    } catch (error) {
      toast(error.message);
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  }

  async function openPromotion(button) {
    if (!requireAccount("billing")) return;
    const listingId = button.dataset.id || "";
    const title = button.dataset.title || "Annuncio";
    $("#promotionListingId").value = listingId;
    $("#promotionListingTitle").textContent = `Annuncio: ${title}`;
    const container = $("#promotionOptions");
    container.innerHTML = "<p>Caricamento…</p>";
    $("#promotionDialog").showModal();
    try {
      await loadPlans();
      const promotions = plans.filter(plan => plan.kind === "promotion");
      container.innerHTML = promotions.map(plan => `<button class="promotion-choice" data-promotion-checkout="${esc(plan.code)}" type="button" ${plan.available ? "" : "disabled"}>
        <strong>${esc(plan.title)}</strong><span>${formatAmount(plan.amount, plan.currency)}</span>
      </button>`).join("") || "<p>Nessuna promozione configurata.</p>";
    } catch (error) {
      container.innerHTML = `<p>${esc(error.message)}</p>`;
    }
  }

  async function openPortal() {
    if (!requireAccount("billing")) return;
    const button = $("#manageBillingBtn");
    if (button) button.disabled = true;
    try {
      const data = await api("/api/billing/portal", { method: "POST" });
      window.location.assign(data.url);
    } catch (error) {
      toast(error.message);
      if (button) button.disabled = false;
    }
  }

  function handleReturnParameters() {
    const url = new URL(location.href);
    const payment = url.searchParams.get("payment");
    const billing = url.searchParams.get("billing");
    if (payment === "success") {
      toast("Pagamento ricevuto. Stripe sta attivando il servizio");
      setTimeout(loadBillingStatus, 1200);
      setTimeout(() => { loadBillingStatus(); window.dispatchEvent(new Event("booksale:refresh-cloud")); }, 4500);
    } else if (payment === "cancel") {
      toast("Pagamento annullato: non è stato attivato alcun servizio");
    } else if (billing === "portal-return") {
      toast("Dati di fatturazione aggiornati");
      setTimeout(loadBillingStatus, 800);
    }
    if (payment || billing || url.searchParams.has("session_id")) {
      url.searchParams.delete("payment");
      url.searchParams.delete("billing");
      url.searchParams.delete("session_id");
      history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function bindEvents() {
    $("#openPlansBtn")?.addEventListener("click", openPricing);
    $("#billingChoosePlanBtn")?.addEventListener("click", openPricing);
    $("#manageBillingBtn")?.addEventListener("click", openPortal);
    document.addEventListener("click", event => {
      const open = event.target.closest("[data-billing-open]");
      if (open) { openPricing(); return; }
      const plan = event.target.closest("[data-service-checkout]");
      if (plan) { startCheckout(plan.dataset.serviceCheckout); return; }
      const promote = event.target.closest('[data-billing-action="promote"]');
      if (promote) { openPromotion(promote); return; }
      const promotion = event.target.closest("[data-promotion-checkout]");
      if (promotion) {
        startCheckout(promotion.dataset.promotionCheckout, $("#promotionListingId").value);
        return;
      }
      const guide = event.target.closest("[data-pricing-promotion]");
      if (guide) {
        $("#pricingDialog")?.close();
        document.querySelector('[data-view="profile"]')?.click();
        toast("Scegli Evidenzia accanto a un tuo annuncio approvato");
      }
    });
  }

  async function init() {
    bindEvents();
    handleReturnParameters();
    await loadBillingStatus();
  }

  init();
})();

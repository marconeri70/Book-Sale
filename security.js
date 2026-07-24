(() => {
  "use strict";

  const CONFIG = window.BOOKSALE_CONFIG || {};
  const API_BASE_URL = String(CONFIG.API_BASE_URL || "").replace(/\/+$/, "");
  const SITE_KEY = String(CONFIG.TURNSTILE_SITE_KEY || "").trim();
  const LEGAL_EMAIL = String(CONFIG.LEGAL_CONTACT_EMAIL || "").trim();
  const SESSION_KEY = "booksale_session_v1";
  const PROFILE_KEY = "booksale_profile_v1";
  const widgets = new Map();
  let currentUser = null;

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  function configuredSiteKey() {
    return SITE_KEY && !/INSERISCI|YOUR-|ESEMPIO/i.test(SITE_KEY);
  }

  function toast(message) {
    const el = $("#toast");
    if (!el) return alert(message);
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
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

  function saveUserProfile(user) {
    let local = {};
    try { local = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}"); } catch {}
    localStorage.setItem(PROFILE_KEY, JSON.stringify({
      ...local,
      name: user.name || local.name || "Utente",
      location: user.location || local.location || "",
      email: user.email || "",
      phone: user.phone || ""
    }));
  }

  async function loadCurrentUser() {
    const token = localStorage.getItem(SESSION_KEY);
    if (!token) {
      currentUser = null;
      renderAccount();
      return;
    }
    try {
      const data = await api("/api/auth/me");
      currentUser = data.user;
      saveUserProfile(currentUser);
    } catch {
      localStorage.removeItem(SESSION_KEY);
      currentUser = null;
    }
    renderAccount();
  }

  function renderAccount() {
    const accountBtn = $("#accountBtn");
    const loginBtn = $("#profileLoginBtn");
    const logoutBtn = $("#logoutBtn");
    const adminBtn = $("#adminOpenBtn");
    const title = $("#accountPanelTitle");
    const text = $("#accountPanelText");

    if (currentUser) {
      if (accountBtn) accountBtn.textContent = currentUser.name?.split(/\s+/)[0] || "Profilo";
      if (loginBtn) loginBtn.classList.add("hidden");
      if (logoutBtn) logoutBtn.classList.remove("hidden");
      if (title) title.textContent = currentUser.name;
      if (text) {
        const planLabel = currentUser.planCode === "pro" ? "Piano Professionale" : currentUser.planCode === "plus" ? "Piano Plus" : "Piano gratuito";
        text.textContent = `${currentUser.email}${currentUser.role === "admin" ? " · Amministratore" : " · Account verificato"} · ${planLabel}`;
      }
      if (adminBtn) adminBtn.classList.toggle("hidden", currentUser.role !== "admin");
      if ($("#profileName")) $("#profileName").textContent = currentUser.name || "Utente";
      if ($("#profileLocation")) $("#profileLocation").textContent = currentUser.location || "Località non impostata";
      if ($("#headerAvatar")) $("#headerAvatar").textContent = (currentUser.name || "U").split(/\s+/).slice(0,2).map(x => x[0]).join("").toUpperCase();
    } else {
      if (accountBtn) accountBtn.textContent = "Accedi";
      if (loginBtn) loginBtn.classList.remove("hidden");
      if (logoutBtn) logoutBtn.classList.add("hidden");
      if (adminBtn) adminBtn.classList.add("hidden");
      if (title) title.textContent = "Accedi o registrati";
      if (text) text.textContent = "Per pubblicare annunci e contattare i venditori è necessario un account.";
    }
  }

  function setAuthMode(mode) {
    const login = mode === "login";
    $("#loginForm")?.classList.toggle("hidden", !login);
    $("#registerForm")?.classList.toggle("hidden", login);
    $("#loginTabBtn")?.classList.toggle("active", login);
    $("#registerTabBtn")?.classList.toggle("active", !login);
    setTimeout(() => renderTurnstile(login ? "loginTurnstile" : "registerTurnstile", login ? "loginTurnstileToken" : "registerTurnstileToken", login ? "login" : "register"), 50);
  }

  function openAuth(mode = "login") {
    setAuthMode(mode);
    const dialog = $("#authDialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  function waitForTurnstile(timeout = 8000) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const check = () => {
        if (window.turnstile?.render) return resolve(window.turnstile);
        if (Date.now() - started > timeout) return reject(new Error("Turnstile non disponibile"));
        setTimeout(check, 100);
      };
      check();
    });
  }

  async function renderTurnstile(containerId, inputId, action) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    if (!container || !input) return;
    input.value = "";

    if (!configuredSiteKey()) {
      container.innerHTML = '<p class="turnstile-warning">Inserisci la Site Key Turnstile nel file config.js.</p>';
      return;
    }

    try {
      const turnstile = await waitForTurnstile();
      const existing = widgets.get(containerId);
      if (existing !== undefined) {
        turnstile.reset(existing);
        return;
      }
      container.innerHTML = "";
      const widgetId = turnstile.render(container, {
        sitekey: SITE_KEY,
        theme: "auto",
        size: "flexible",
        action,
        callback: token => { input.value = token; },
        "expired-callback": () => { input.value = ""; },
        "error-callback": () => { input.value = ""; }
      });
      widgets.set(containerId, widgetId);
    } catch {
      container.innerHTML = '<p class="turnstile-warning">Impossibile caricare la verifica antispam. Ricarica la pagina.</p>';
    }
  }

  function resetWidget(containerId, inputId) {
    const input = document.getElementById(inputId);
    if (input) input.value = "";
    const id = widgets.get(containerId);
    if (id !== undefined && window.turnstile?.reset) window.turnstile.reset(id);
  }

  async function submitLogin(event) {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      const turnstileToken = $("#loginTurnstileToken").value;
      if (!turnstileToken) throw new Error("Completa la verifica antispam");
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: $("#loginEmail").value.trim(),
          password: $("#loginPassword").value,
          turnstileToken
        })
      });
      localStorage.setItem(SESSION_KEY, data.token);
      saveUserProfile(data.user);
      toast("Accesso effettuato");
      location.reload();
    } catch (error) {
      toast(error.message);
      resetWidget("loginTurnstile", "loginTurnstileToken");
    } finally {
      button.disabled = false;
    }
  }

  async function submitRegister(event) {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      const turnstileToken = $("#registerTurnstileToken").value;
      if (!turnstileToken) throw new Error("Completa la verifica antispam");
      const data = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: $("#registerName").value.trim(),
          location: $("#registerLocation").value.trim(),
          email: $("#registerEmail").value.trim(),
          phone: $("#registerPhone").value.trim(),
          password: $("#registerPassword").value,
          termsAccepted: $("#registerTerms").checked,
          turnstileToken
        })
      });
      localStorage.setItem(SESSION_KEY, data.token);
      saveUserProfile(data.user);
      toast("Account creato");
      location.reload();
    } catch (error) {
      toast(error.message);
      resetWidget("registerTurnstile", "registerTurnstileToken");
    } finally {
      button.disabled = false;
    }
  }

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); } catch {}
    localStorage.removeItem(SESSION_KEY);
    location.reload();
  }

  function openReport(button) {
    $("#reportListingId").value = button.dataset.id || "";
    $("#reportListingTitle").textContent = `Annuncio: ${button.dataset.title || ""}`;
    $("#reportEmail").value = currentUser?.email || "";
    $("#reportForm").reset();
    $("#reportListingId").value = button.dataset.id || "";
    $("#reportListingTitle").textContent = `Annuncio: ${button.dataset.title || ""}`;
    $("#reportEmail").value = currentUser?.email || "";
    $("#reportDialog").showModal();
    setTimeout(() => renderTurnstile("reportTurnstile", "reportTurnstileToken", "report"), 50);
  }

  async function submitReport(event) {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      const turnstileToken = $("#reportTurnstileToken").value;
      if (!turnstileToken) throw new Error("Completa la verifica antispam");
      const id = $("#reportListingId").value;
      await api(`/api/listings/${encodeURIComponent(id)}/report`, {
        method: "POST",
        body: JSON.stringify({
          reason: $("#reportReason").value,
          details: $("#reportDetails").value.trim(),
          reporterEmail: $("#reportEmail").value.trim(),
          goodFaith: $("#reportGoodFaith").checked,
          turnstileToken
        })
      });
      $("#reportDialog").close();
      $("#detailsDialog")?.close();
      toast("Segnalazione ricevuta. Sarà esaminata dalla moderazione");
    } catch (error) {
      toast(error.message);
      resetWidget("reportTurnstile", "reportTurnstileToken");
    } finally {
      button.disabled = false;
    }
  }

  function esc(value = "") {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  async function loadAdminQueue() {
    const pendingEl = $("#pendingListingsAdmin");
    const reportsEl = $("#reportsAdmin");
    const paymentsEl = $("#paymentsAdmin");
    pendingEl.innerHTML = "<p>Caricamento…</p>";
    reportsEl.innerHTML = "<p>Caricamento…</p>";
    if (paymentsEl) paymentsEl.innerHTML = "<p>Caricamento…</p>";
    try {
      const data = await api("/api/admin/queue");
      pendingEl.innerHTML = data.pending?.length ? data.pending.map(item => `
        <article class="admin-item">
          <strong>${esc(item.title)}</strong><small>${esc(item.author)} · ${esc(item.seller_name)} · ${esc(item.location)}</small>
          <div class="admin-actions"><button class="primary-btn compact" data-admin-action="approve" data-id="${item.id}">Approva</button><button class="danger-btn compact" data-admin-action="reject" data-id="${item.id}">Rifiuta</button></div>
        </article>`).join("") : "<p>Nessun annuncio in attesa.</p>";
      reportsEl.innerHTML = data.reports?.length ? data.reports.map(item => `
        <article class="admin-item">
          <strong>${esc(item.reason)}</strong><small>${esc(item.listing_title || "Annuncio rimosso")} · ${esc(item.reporter_email)}</small><p>${esc(item.details)}</p>
          <div class="admin-actions"><button class="secondary-btn compact" data-admin-action="dismiss-report" data-id="${item.id}">Archivia</button><button class="danger-btn compact" data-admin-action="hide-report" data-id="${item.id}">Rimuovi annuncio</button></div>
        </article>`).join("") : "<p>Nessuna segnalazione aperta.</p>";
      if (paymentsEl) {
        paymentsEl.innerHTML = data.billing?.length ? data.billing.map(item => `
          <article class="admin-item">
            <strong>${esc(item.service_code)}</strong>
            <small>${esc(item.name || item.email || "Utente")} · ${esc(item.status)} · ${formatAdminAmount(item.amount_total, item.currency)}</small>
            <p>${esc(item.listing_title || "Servizio BookSale")}</p>
          </article>`).join("") : "<p>Nessun pagamento registrato.</p>";
      }
    } catch (error) {
      pendingEl.innerHTML = `<p>${esc(error.message)}</p>`;
      reportsEl.innerHTML = "";
      if (paymentsEl) paymentsEl.innerHTML = "";
    }
  }

  function formatAdminAmount(amount, currency = "eur") {
    if (amount === null || amount === undefined) return "Importo in attesa";
    try { return new Intl.NumberFormat("it-IT", { style: "currency", currency: String(currency).toUpperCase() }).format(Number(amount) / 100); }
    catch { return `${Number(amount) / 100} ${currency}`; }
  }

  async function adminAction(button) {
    const action = button.dataset.adminAction;
    const id = button.dataset.id;
    button.disabled = true;
    try {
      if (action === "approve" || action === "reject") {
        const decision = action === "approve" ? "approved" : "rejected";
        const note = decision === "rejected" ? (prompt("Motivo del rifiuto:") || "Non conforme alle regole di BookSale") : "";
        await api(`/api/admin/listings/${encodeURIComponent(id)}/moderation`, { method: "PATCH", body: JSON.stringify({ decision, note }) });
      } else {
        const hideListing = action === "hide-report";
        const adminNote = hideListing ? (prompt("Motivo della rimozione:") || "Rimosso dopo verifica della segnalazione") : "Segnalazione archiviata";
        await api(`/api/admin/reports/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: hideListing ? "actioned" : "dismissed", hideListing, adminNote })
        });
      }
      toast("Moderazione aggiornata");
      await loadAdminQueue();
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  }

  function openLegal(type) {
    const dialog = document.getElementById(type === "privacy" ? "privacyDialog" : "termsDialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  function configureLegalEmail() {
    const valid = LEGAL_EMAIL && !/INSERISCI|YOUR-|ESEMPIO/i.test(LEGAL_EMAIL);
    $$(".legal-email").forEach(link => {
      link.textContent = valid ? LEGAL_EMAIL : "EMAIL DA CONFIGURARE";
      link.href = valid ? `mailto:${LEGAL_EMAIL}` : "#";
      if (!valid) link.addEventListener("click", event => { event.preventDefault(); toast("Inserisci LEGAL_CONTACT_EMAIL nel file config.js"); });
    });
  }

  function bindEvents() {
    document.addEventListener("click", event => {
      if (!currentUser && event.target.closest("#editProfileBtn")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openAuth("login");
      }
    }, true);

    window.addEventListener("booksale:auth-required", event => {
      const reason = event.detail?.reason;
      const message = reason === "contact" ? "Accedi per vedere il contatto del venditore"
        : reason === "billing" ? "Accedi per acquistare servizi BookSale"
        : "Accedi per pubblicare un annuncio";
      toast(message);
      openAuth(reason === "sell" ? "register" : "login");
    });
    window.addEventListener("booksale:turnstile-reset", () => resetWidget("listingTurnstile", "listingTurnstileToken"));

    $("#accountBtn")?.addEventListener("click", () => currentUser ? document.querySelector('[data-view="profile"]')?.click() : openAuth("login"));
    $("#profileLoginBtn")?.addEventListener("click", () => openAuth("login"));
    $("#logoutBtn")?.addEventListener("click", logout);
    $("#loginTabBtn")?.addEventListener("click", () => setAuthMode("login"));
    $("#registerTabBtn")?.addEventListener("click", () => setAuthMode("register"));
    $("#loginForm")?.addEventListener("submit", submitLogin);
    $("#registerForm")?.addEventListener("submit", submitRegister);
    $("#reportForm")?.addEventListener("submit", submitReport);

    document.addEventListener("click", event => {
      const legal = event.target.closest("[data-legal]");
      if (legal) { openLegal(legal.dataset.legal); return; }
      const report = event.target.closest('[data-security-action="report"]');
      if (report) { openReport(report); return; }
      const admin = event.target.closest("[data-admin-action]");
      if (admin) { adminAction(admin); }
    });

    $("#adminOpenBtn")?.addEventListener("click", async () => {
      $("#adminDialog").showModal();
      await loadAdminQueue();
    });
    $("#refreshAdminBtn")?.addEventListener("click", loadAdminQueue);

    const sellDialog = $("#sellDialog");
    if (sellDialog) {
      new MutationObserver(() => {
        if (sellDialog.open) setTimeout(() => renderTurnstile("listingTurnstile", "listingTurnstileToken", "listing"), 50);
      }).observe(sellDialog, { attributes: true, attributeFilter: ["open"] });
    }
  }

  async function init() {
    configureLegalEmail();
    bindEvents();
    await loadCurrentUser();
  }

  init();
})();

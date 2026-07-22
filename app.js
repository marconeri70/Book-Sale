(() => {
  "use strict";

  const STORAGE = {
    listings: "booksale_listings_v2",
    favorites: "booksale_favorites_v1",
    profile: "booksale_profile_v1",
    ownerToken: "booksale_owner_token_v1"
  };

  const categories = [
    ["Narrativa", "📘"], ["Gialli e thriller", "🕵️"], ["Fantasy", "🐉"],
    ["Romanzi rosa", "🌹"], ["Saggistica", "💡"], ["Storia", "🏛️"],
    ["Scuola", "🎒"], ["Università", "🎓"], ["Bambini", "🧸"],
    ["Fumetti e manga", "💥"], ["Biografie", "👤"], ["Altro", "📚"]
  ];

  const demoListings = [
    {
      id: "demo-1", owner: false, title: "Il nome della rosa", author: "Umberto Eco",
      isbn: "9788845292613", category: "Narrativa", condition: "Ottimo",
      type: "Vendita", price: 7.5, description: "Copertina flessibile, pagine pulite. Consegna a mano in zona oppure spedizione.",
      location: "Cassino", delivery: "A mano o spedizione", cover: "https://covers.openlibrary.org/b/isbn/9788845292613-L.jpg",
      seller: "Lucia", sellerEmail: "lucia@example.com", sellerPhone: "", exchange: true,
      createdAt: "2026-07-21T17:00:00.000Z", status: "available", lat: 41.490, lng: 13.830
    },
    {
      id: "demo-2", owner: false, title: "Harry Potter e la pietra filosofale", author: "J. K. Rowling",
      isbn: "9788831003384", category: "Fantasy", condition: "Buono",
      type: "Vendita", price: 5, description: "Libro letto ma tenuto bene. Piccoli segni sulla copertina.",
      location: "Piedimonte San Germano", delivery: "Consegna a mano", cover: "https://covers.openlibrary.org/b/isbn/9788831003384-L.jpg",
      seller: "Andrea", sellerEmail: "", sellerPhone: "", exchange: false,
      createdAt: "2026-07-20T15:30:00.000Z", status: "available", lat: 41.497, lng: 13.750
    },
    {
      id: "demo-3", owner: false, title: "Chimica organica", author: "John McMurry",
      isbn: "9788879599986", category: "Università", condition: "Vissuto",
      type: "Vendita", price: 18, description: "Alcuni capitoli sottolineati a matita, completo e perfettamente utilizzabile.",
      location: "Frosinone", delivery: "Spedizione", cover: "https://covers.openlibrary.org/b/isbn/9788879599986-L.jpg",
      seller: "Sara", sellerEmail: "", sellerPhone: "", exchange: true,
      createdAt: "2026-07-18T09:00:00.000Z", status: "available", lat: 41.640, lng: 13.350
    },
    {
      id: "demo-4", owner: false, title: "Dylan Dog: L'alba dei morti viventi", author: "Tiziano Sclavi",
      isbn: "", category: "Fumetti e manga", condition: "Ottimo",
      type: "Scambio", price: 0, description: "Cerco altri numeri storici di Dylan Dog o Martin Mystère.",
      location: "Formia", delivery: "A mano o spedizione", cover: "",
      seller: "Paolo", sellerEmail: "", sellerPhone: "", exchange: true,
      createdAt: "2026-07-17T10:15:00.000Z", status: "available", lat: 41.256, lng: 13.608
    },
    {
      id: "demo-5", owner: false, title: "Geronimo Stilton: Viaggio nel tempo", author: "Geronimo Stilton",
      isbn: "9788856616217", category: "Bambini", condition: "Come nuovo",
      type: "Regalo", price: 0, description: "Regalo a chi può riutilizzarlo. Ritiro a mano.",
      location: "Sora", delivery: "Consegna a mano", cover: "https://covers.openlibrary.org/b/isbn/9788856616217-L.jpg",
      seller: "Marta", sellerEmail: "", sellerPhone: "", exchange: false,
      createdAt: "2026-07-16T13:00:00.000Z", status: "available", lat: 41.718, lng: 13.614
    },
    {
      id: "demo-6", owner: true, title: "1984", author: "George Orwell",
      isbn: "9788804668237", category: "Narrativa", condition: "Ottimo",
      type: "Vendita", price: 6, description: "Edizione Oscar Mondadori. Nessuna sottolineatura.",
      location: "Cassino", delivery: "Consegna a mano", cover: "https://covers.openlibrary.org/b/isbn/9788804668237-L.jpg",
      seller: "Marco", sellerEmail: "", sellerPhone: "", exchange: false,
      createdAt: "2026-07-15T18:00:00.000Z", status: "available", lat: 41.490, lng: 13.830
    }
  ];

  const defaultProfile = {
    name: "Marco",
    location: "Cassino",
    email: "",
    phone: "",
    lat: null,
    lng: null
  };

  const API_BASE_URL = String(window.BOOKSALE_CONFIG?.API_BASE_URL || "").replace(/\/+$/, "");
  const CLOUD_ENABLED = Boolean(API_BASE_URL) && !/INSERISCI|YOUR-|ESEMPIO/i.test(API_BASE_URL);

  let listings = load(STORAGE.listings, CLOUD_ENABLED ? [] : demoListings);
  let favorites = load(STORAGE.favorites, []);
  let profile = load(STORAGE.profile, defaultProfile);
  let ownerToken = getOrCreateOwnerToken();
  let deferredInstallPrompt = null;
  let scannerStream = null;
  let scanTimer = null;
  let uploadedCoverBlob = null;
  let uploadedCoverPreviewUrl = "";
  let coverRemoved = false;
  let nearMeEnabled = false;
  let syncInProgress = false;

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  function load(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : structuredCloneSafe(fallback);
    } catch {
      return structuredCloneSafe(fallback);
    }
  }

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getOrCreateOwnerToken() {
    const saved = localStorage.getItem(STORAGE.ownerToken);
    if (saved && saved.length >= 32) return saved;
    const token = crypto.randomUUID
      ? `${crypto.randomUUID()}-${crypto.randomUUID()}`
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(STORAGE.ownerToken, token);
    return token;
  }

  function setCloudStatus(state, text) {
    const status = $("#cloudStatus");
    if (!status) return;
    status.className = `cloud-status ${state}`;
    const label = status.querySelector("span:last-child");
    if (label) label.textContent = text;
  }

  async function apiFetch(path, options = {}) {
    if (!CLOUD_ENABLED) throw new Error("Cloudflare non configurato");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    const headers = new Headers(options.headers || {});
    headers.set("X-Owner-Token", ownerToken);
    if (options.body && !(options.body instanceof Blob) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    try {
      const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, signal: controller.signal });
      const type = response.headers.get("Content-Type") || "";
      const data = type.includes("application/json") ? await response.json() : null;
      if (!response.ok) throw new Error(data?.error || `Errore ${response.status}`);
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Il server non risponde");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function loadRemoteListings(showMessage = false) {
    if (!CLOUD_ENABLED || syncInProgress) return;
    syncInProgress = true;
    setCloudStatus("connecting", "Sincronizzazione…");
    try {
      const data = await apiFetch("/api/listings");
      listings = Array.isArray(data?.listings) ? data.listings : [];
      saveAll();
      renderAll();
      setCloudStatus("online", "Cloud online");
      if (showMessage) showToast("Annunci aggiornati dal cloud");
    } catch (error) {
      setCloudStatus("offline", "Cloud non raggiungibile");
      if (!listings.length) listings = structuredCloneSafe(demoListings);
      renderAll();
      if (showMessage) showToast(error.message || "Sincronizzazione non riuscita");
    } finally {
      syncInProgress = false;
    }
  }

  async function uploadImage(blob) {
    const data = await apiFetch("/api/images", {
      method: "POST",
      headers: { "Content-Type": blob.type || "image/jpeg" },
      body: blob
    });
    return { url: data.url, key: data.key };
  }

  function saveAll() {
    localStorage.setItem(STORAGE.listings, JSON.stringify(listings));
    localStorage.setItem(STORAGE.favorites, JSON.stringify(favorites));
    localStorage.setItem(STORAGE.profile, JSON.stringify(profile));
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function initials(name = "Utente") {
    return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || "").join("") || "U";
  }

  function formatPrice(listing) {
    if (listing.type === "Regalo") return "Gratis";
    if (listing.type === "Scambio") return "Scambio";
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(listing.price || 0));
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
    } catch {
      return "";
    }
  }

  function normalizeIsbn(value) {
    return String(value || "").replace(/[^0-9Xx]/g, "").toUpperCase();
  }

  function distanceKm(aLat, aLng, bLat, bLng) {
    if ([aLat, aLng, bLat, bLng].some(v => v === null || v === undefined || Number.isNaN(Number(v)))) return null;
    const rad = deg => deg * Math.PI / 180;
    const R = 6371;
    const dLat = rad(Number(bLat) - Number(aLat));
    const dLng = rad(Number(bLng) - Number(aLng));
    const x = Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(Number(aLat))) * Math.cos(rad(Number(bLat))) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function showView(name) {
    $$(".view").forEach(view => view.classList.toggle("active", view.id === `${name}View`));
    $$(".nav-item[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === name));
    if (name === "explore") renderExplore();
    if (name === "favorites") renderFavorites();
    if (name === "profile") renderProfile();
    window.scrollTo({ top: 0, behavior: "smooth" });
    $("#mainContent")?.focus({ preventScroll: true });
  }

  function categoryOptions(selected = "") {
    return categories.map(([name]) =>
      `<option value="${escapeHtml(name)}" ${name === selected ? "selected" : ""}>${escapeHtml(name)}</option>`
    ).join("");
  }

  function getDistance(listing) {
    return distanceKm(profile.lat, profile.lng, listing.lat, listing.lng);
  }

  function bookCard(listing) {
    const isFavorite = favorites.includes(listing.id);
    const distance = getDistance(listing);
    const cover = listing.cover
      ? `<img src="${escapeHtml(listing.cover)}" alt="Copertina di ${escapeHtml(listing.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=&quot;cover-fallback&quot;><span>${escapeHtml(listing.title)}</span></div>'">`
      : `<div class="cover-fallback"><span>${escapeHtml(listing.title)}</span></div>`;

    return `
      <article class="book-card ${listing.status === "sold" ? "sold" : ""}">
        <div class="book-card-cover">
          ${cover}
          <span class="card-badge">${listing.status === "sold" ? "Venduto" : escapeHtml(listing.type)}</span>
          ${distance !== null ? `<span class="card-distance">${distance < 1 ? "meno di 1 km" : `${Math.round(distance)} km`}</span>` : ""}
        </div>
        <button class="favorite-btn ${isFavorite ? "active" : ""}" type="button"
          data-action="favorite" data-id="${listing.id}" aria-label="${isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}">
          ${isFavorite ? "♥" : "♡"}
        </button>
        <div class="book-card-body">
          <h3>${escapeHtml(listing.title)}</h3>
          <p class="author">${escapeHtml(listing.author)}</p>
          <div class="card-meta">
            <span class="meta-pill">${escapeHtml(listing.condition)}</span>
            <span class="meta-pill">${escapeHtml(listing.category)}</span>
          </div>
          <div class="card-footer">
            <span class="location">⌖ ${escapeHtml(listing.location)}</span>
            <span class="price">${formatPrice(listing)}</span>
          </div>
        </div>
        <button class="book-card-click" type="button" data-action="details" data-id="${listing.id}" aria-label="Apri ${escapeHtml(listing.title)}"></button>
      </article>`;
  }

  function emptyState() {
    return $("#emptyTemplate").content.firstElementChild.outerHTML;
  }

  function renderHome() {
    const available = listings.filter(item => item.status !== "sold");
    const latest = [...available].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
    $("#latestGrid").innerHTML = latest.length ? latest.map(bookCard).join("") : emptyState();

    $("#categoryRail").innerHTML = categories.slice(0, 8).map(([name, icon]) => {
      const count = available.filter(item => item.category === name).length;
      return `<button class="category-card" type="button" data-category="${escapeHtml(name)}">
        <span class="category-icon" aria-hidden="true">${icon}</span>
        <span><strong>${escapeHtml(name)}</strong><small>${count} ${count === 1 ? "libro" : "libri"}</small></span>
      </button>`;
    }).join("");

    const cities = new Set(available.map(item => item.location.trim().toLowerCase()).filter(Boolean)).size;
    const savings = available.reduce((sum, item) => sum + (item.type === "Vendita" ? Math.max(0, 12 - Number(item.price || 0)) : 12), 0);
    $("#statBooks").textContent = available.length;
    $("#statCities").textContent = cities;
    $("#statSavings").textContent = `${Math.round(savings)} €`;
  }

  function filteredListings() {
    const query = $("#exploreSearchInput").value.trim().toLowerCase();
    const category = $("#categoryFilter").value;
    const condition = $("#conditionFilter").value;
    const maxPrice = Number($("#priceFilter").value || Infinity);
    const sort = $("#sortFilter").value;

    let results = listings.filter(item => {
      if (item.status === "sold") return false;
      const haystack = `${item.title} ${item.author} ${item.isbn} ${item.location}`.toLowerCase();
      const effectivePrice = item.type === "Vendita" ? Number(item.price || 0) : 0;
      return (!query || haystack.includes(query)) &&
        (!category || item.category === category) &&
        (!condition || item.condition === condition) &&
        effectivePrice <= maxPrice;
    });

    if (nearMeEnabled && profile.lat !== null && profile.lng !== null) {
      results = results.filter(item => {
        const distance = getDistance(item);
        return distance !== null && distance <= 50;
      });
    }

    const sorters = {
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      priceAsc: (a, b) => Number(a.price || 0) - Number(b.price || 0),
      priceDesc: (a, b) => Number(b.price || 0) - Number(a.price || 0),
      title: (a, b) => a.title.localeCompare(b.title, "it")
    };
    return results.sort(sorters[sort] || sorters.newest);
  }

  function renderExplore() {
    const results = filteredListings();
    $("#resultsCount").textContent = `${results.length} ${results.length === 1 ? "annuncio" : "annunci"}`;
    $("#exploreGrid").innerHTML = results.length ? results.map(bookCard).join("") : emptyState();
    $("#nearMeBtn").textContent = nearMeEnabled ? "✓ Entro 50 km" : "⌖ Vicino a me";
  }

  function renderFavorites() {
    const results = listings.filter(item => favorites.includes(item.id));
    $("#favoritesGrid").innerHTML = results.length ? results.map(bookCard).join("") : emptyState();
  }

  function renderProfile() {
    const mine = listings.filter(item => item.owner);
    const sold = mine.filter(item => item.status === "sold").length;
    $("#profileName").textContent = profile.name;
    $("#profileLocation").textContent = profile.location || "Località non impostata";
    $("#headerAvatar").textContent = initials(profile.name);
    $("#profileAvatar").textContent = initials(profile.name);
    $("#myListingsCount").textContent = mine.length;
    $("#soldListingsCount").textContent = sold;
    $("#favoriteCount").textContent = favorites.length;

    $("#myListings").innerHTML = mine.length ? mine
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(item => `
        <article class="manage-item">
          <div class="manage-cover">
            ${item.cover ? `<img src="${escapeHtml(item.cover)}" alt="">` : ""}
          </div>
          <div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${formatPrice(item)} · ${item.status === "sold" ? "Venduto" : "Disponibile"} · ${formatDate(item.createdAt)}</p>
          </div>
          <div class="manage-actions">
            <button class="secondary-btn compact" data-action="edit" data-id="${item.id}" type="button">Modifica</button>
            <button class="secondary-btn compact" data-action="toggle-sold" data-id="${item.id}" type="button">${item.status === "sold" ? "Rimetti in vendita" : "Segna venduto"}</button>
            <button class="danger-btn compact" data-action="delete" data-id="${item.id}" type="button">Elimina</button>
          </div>
        </article>`).join("") : emptyState();
  }

  function renderAll() {
    renderHome();
    renderExplore();
    renderFavorites();
    renderProfile();
  }

  function toggleFavorite(id) {
    favorites = favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id];
    saveAll();
    renderAll();
    showToast(favorites.includes(id) ? "Aggiunto ai preferiti" : "Rimosso dai preferiti");
  }

  function openDetails(id) {
    const item = listings.find(listing => listing.id === id);
    if (!item) return;
    const distance = getDistance(item);
    const cover = item.cover
      ? `<img src="${escapeHtml(item.cover)}" alt="Copertina di ${escapeHtml(item.title)}">`
      : `<div class="cover-fallback"><span>${escapeHtml(item.title)}</span></div>`;
    const sellerName = item.owner ? profile.name : item.seller;
    const sellerEmail = item.owner ? profile.email : item.sellerEmail;
    const sellerPhone = item.owner ? profile.phone : item.sellerPhone;

    $("#detailsContent").innerHTML = `
      <div class="details-layout">
        <div class="details-cover">${cover}</div>
        <div class="details-copy">
          <button class="close-btn" data-close-dialog="detailsDialog" type="button" aria-label="Chiudi">×</button>
          <span class="eyebrow">${escapeHtml(item.category)} · ${escapeHtml(item.condition)}</span>
          <h2>${escapeHtml(item.title)}</h2>
          <p class="details-author">${escapeHtml(item.author)}</p>
          <div class="card-meta">
            <span class="meta-pill">${escapeHtml(item.type)}</span>
            <span class="meta-pill">${escapeHtml(item.delivery)}</span>
            ${item.exchange ? `<span class="meta-pill">Valuta scambi</span>` : ""}
            ${item.isbn ? `<span class="meta-pill">ISBN ${escapeHtml(item.isbn)}</span>` : ""}
          </div>
          <div class="details-price">${formatPrice(item)}</div>
          <p class="details-description">${escapeHtml(item.description || "Nessuna descrizione aggiuntiva.")}</p>
          <div class="seller-box">
            <div class="seller-avatar">${initials(sellerName)}</div>
            <div>
              <strong>${escapeHtml(sellerName)}</strong>
              <small>⌖ ${escapeHtml(item.location)}${distance !== null ? ` · circa ${Math.max(1, Math.round(distance))} km` : ""}</small>
            </div>
          </div>
          <div class="contact-actions">
            <button class="primary-btn" type="button" data-action="contact" data-kind="message" data-id="${item.id}">Scrivi al venditore</button>
            <button class="secondary-btn" type="button" data-action="contact" data-kind="share" data-id="${item.id}">Condividi</button>
          </div>
          <p class="field-note" style="margin-top:14px">Pubblicato il ${formatDate(item.createdAt)}. Non inviare denaro prima di aver verificato il libro e il venditore.</p>
          <span hidden data-email="${escapeHtml(sellerEmail || "")}" data-phone="${escapeHtml(sellerPhone || "")}"></span>
        </div>
      </div>`;
    $("#detailsDialog").showModal();
  }

  async function handleContact(id, kind) {
    const item = listings.find(listing => listing.id === id);
    if (!item) return;
    const text = `Ciao, sono interessato al libro "${item.title}" pubblicato su BookSale.`;

    if (kind === "share") {
      if (navigator.share) {
        navigator.share({ title: item.title, text: `${item.title} di ${item.author} - ${formatPrice(item)} su BookSale` }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(`${item.title} di ${item.author} - ${formatPrice(item)}`);
        showToast("Dati dell’annuncio copiati");
      }
      return;
    }

    let sellerEmail = item.owner ? profile.email : item.sellerEmail;
    let sellerPhone = item.owner ? profile.phone : item.sellerPhone;

    if (CLOUD_ENABLED && !item.owner) {
      try {
        const data = await apiFetch(`/api/listings/${encodeURIComponent(id)}/contact`);
        sellerEmail = data.contact?.email || "";
        sellerPhone = data.contact?.phone || "";
      } catch (error) {
        showToast(error.message || "Contatto non disponibile");
        return;
      }
    }

    if (sellerPhone) {
      const number = sellerPhone.replace(/\D/g, "");
      window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } else if (sellerEmail) {
      window.location.href = `mailto:${encodeURIComponent(sellerEmail)}?subject=${encodeURIComponent(`BookSale: ${item.title}`)}&body=${encodeURIComponent(text)}`;
    } else {
      showToast("Il venditore non ha ancora inserito un contatto");
    }
  }

  function resetListingForm() {
    $("#listingForm").reset();
    $("#listingId").value = "";
    $("#listingDialogTitle").textContent = "Vendi un libro";
    $("#categoryInput").innerHTML = categoryOptions("Narrativa");
    $("#conditionInput").value = "Ottimo";
    $("#listingTypeInput").value = "Vendita";
    $("#priceInput").value = "5";
    $("#locationInput").value = profile.location || "";
    $("#isbnMessage").textContent = "L’ISBN si trova vicino al codice a barre sul retro del libro.";
    uploadedCoverBlob = null;
    if (uploadedCoverPreviewUrl) URL.revokeObjectURL(uploadedCoverPreviewUrl);
    uploadedCoverPreviewUrl = "";
    coverRemoved = false;
    updateCoverPreview("");
  }

  function openSell(id = "") {
    resetListingForm();
    if (id) {
      const item = listings.find(listing => listing.id === id && listing.owner);
      if (!item) return;
      $("#listingDialogTitle").textContent = "Modifica annuncio";
      $("#listingId").value = item.id;
      $("#isbnInput").value = item.isbn || "";
      $("#titleInput").value = item.title;
      $("#authorInput").value = item.author;
      $("#categoryInput").innerHTML = categoryOptions(item.category);
      $("#conditionInput").value = item.condition;
      $("#listingTypeInput").value = item.type;
      $("#priceInput").value = item.price;
      $("#descriptionInput").value = item.description || "";
      $("#locationInput").value = item.location;
      $("#deliveryInput").value = item.delivery;
      $("#coverUrlInput").value = item.cover || "";
      $("#exchangeInput").checked = Boolean(item.exchange);
      uploadedCoverBlob = null;
      coverRemoved = false;
      updateCoverPreview(item.cover);
    }
    $("#sellDialog").showModal();
  }

  function updateCoverPreview(source) {
    const preview = $("#coverPreview");
    if (source) {
      preview.innerHTML = `<img src="${escapeHtml(source)}" alt="Anteprima copertina">`;
    } else {
      preview.innerHTML = `<span aria-hidden="true">📚</span><small>Nessuna copertina</small>`;
    }
  }

  async function lookupIsbn() {
    const isbn = normalizeIsbn($("#isbnInput").value);
    if (![10, 13].includes(isbn.length)) {
      $("#isbnMessage").textContent = "Inserisci un ISBN valido di 10 o 13 caratteri.";
      return;
    }

    const button = $("#lookupIsbnBtn");
    button.disabled = true;
    button.textContent = "Ricerca…";
    $("#isbnMessage").textContent = "Ricerca del libro in corso…";

    try {
      const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&jscmd=data&format=json`);
      if (!response.ok) throw new Error("Risposta non valida");
      const data = await response.json();
      const book = data[`ISBN:${isbn}`];
      if (!book) {
        $("#isbnMessage").textContent = "Libro non trovato. Puoi compilare i dati manualmente.";
        return;
      }
      $("#isbnInput").value = isbn;
      $("#titleInput").value = book.title || "";
      $("#authorInput").value = book.authors?.map(author => author.name).join(", ") || "";
      const subjects = (book.subjects || []).map(subject => subject.name.toLowerCase());
      const guessed = guessCategory(subjects);
      $("#categoryInput").innerHTML = categoryOptions(guessed);
      const cover = book.cover?.large || book.cover?.medium || `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
      $("#coverUrlInput").value = cover;
      uploadedCoverBlob = null;
      coverRemoved = false;
      updateCoverPreview(cover);
      $("#isbnMessage").textContent = "Dati trovati. Controllali prima di pubblicare.";
    } catch (error) {
      $("#isbnMessage").textContent = "Impossibile collegarsi al catalogo. Controlla la connessione o compila manualmente.";
    } finally {
      button.disabled = false;
      button.textContent = "Compila dati";
    }
  }

  function guessCategory(subjects) {
    const text = subjects.join(" ");
    const rules = [
      ["Fumetti e manga", /comic|manga|fumett/],
      ["Bambini", /children|juvenile|bambin/],
      ["Fantasy", /fantasy|magic|wizard/],
      ["Gialli e thriller", /mystery|thriller|detective|crime/],
      ["Storia", /history|historical|storia/],
      ["Biografie", /biograph|memoir/],
      ["Scuola", /textbook|school|education/],
      ["Università", /university|college|academic/],
      ["Saggistica", /essay|science|philosophy|psychology|politics/]
    ];
    return rules.find(([, regex]) => regex.test(text))?.[0] || "Narrativa";
  }

  async function resizeImage(file) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });

    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Conversione non riuscita")), "image/jpeg", .84);
    });
  }

  async function submitListing(event) {
    event.preventDefault();
    const submitButton = event.submitter || $("#listingForm .primary-btn[type=submit]");
    const originalLabel = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = CLOUD_ENABLED ? "Pubblicazione…" : "Salvataggio…";

    try {
      const id = $("#listingId").value;
      const type = $("#listingTypeInput").value;
      const price = type === "Vendita" ? Math.max(0, Number($("#priceInput").value || 0)) : 0;
      const existing = listings.find(item => item.id === id);
      let cover = coverRemoved ? "" : ($("#coverUrlInput").value.trim() || existing?.cover || "");
      let imageKey = coverRemoved ? "" : (existing?.imageKey || "");

      if (CLOUD_ENABLED && uploadedCoverBlob) {
        submitButton.textContent = "Caricamento foto…";
        const uploaded = await uploadImage(uploadedCoverBlob);
        cover = uploaded.url;
        imageKey = uploaded.key;
      } else if (!CLOUD_ENABLED && uploadedCoverBlob) {
        cover = await blobToDataUrl(uploadedCoverBlob);
      }

      const listing = {
        id: id || `book-${Date.now()}`,
        owner: true,
        title: $("#titleInput").value.trim(),
        author: $("#authorInput").value.trim(),
        isbn: normalizeIsbn($("#isbnInput").value),
        category: $("#categoryInput").value,
        condition: $("#conditionInput").value,
        type, price,
        description: $("#descriptionInput").value.trim(),
        location: $("#locationInput").value.trim(),
        delivery: $("#deliveryInput").value,
        cover, imageKey,
        seller: profile.name,
        sellerEmail: profile.email,
        sellerPhone: profile.phone,
        exchange: $("#exchangeInput").checked,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: existing?.status || "available",
        lat: profile.lat, lng: profile.lng
      };

      if (CLOUD_ENABLED) {
        submitButton.textContent = id ? "Aggiornamento…" : "Pubblicazione…";
        await apiFetch(id ? `/api/listings/${encodeURIComponent(id)}` : "/api/listings", {
          method: id ? "PUT" : "POST",
          body: JSON.stringify(listing)
        });
        await loadRemoteListings(false);
      } else {
        listings = id ? listings.map(item => item.id === id ? listing : item) : [listing, ...listings];
        saveAll();
        renderAll();
      }

      $("#sellDialog").close();
      showView("profile");
      showToast(id ? "Annuncio aggiornato" : "Annuncio pubblicato");
    } catch (error) {
      showToast(error.message || "Impossibile salvare l’annuncio");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function deleteListing(id) {
    const item = listings.find(listing => listing.id === id && listing.owner);
    if (!item || !confirm(`Eliminare l’annuncio “${item.title}”?`)) return;
    try {
      if (CLOUD_ENABLED) {
        await apiFetch(`/api/listings/${encodeURIComponent(id)}`, { method: "DELETE" });
        await loadRemoteListings(false);
      } else {
        listings = listings.filter(listing => listing.id !== id);
        favorites = favorites.filter(favoriteId => favoriteId !== id);
        saveAll();
        renderAll();
      }
      showToast("Annuncio eliminato");
    } catch (error) {
      showToast(error.message || "Eliminazione non riuscita");
    }
  }

  async function toggleSold(id) {
    const item = listings.find(listing => listing.id === id && listing.owner);
    if (!item) return;
    const status = item.status === "sold" ? "available" : "sold";
    try {
      if (CLOUD_ENABLED) {
        await apiFetch(`/api/listings/${encodeURIComponent(id)}/status`, {
          method: "PATCH", body: JSON.stringify({ status })
        });
        await loadRemoteListings(false);
      } else {
        listings = listings.map(current => current.id === id ? { ...current, status, updatedAt: new Date().toISOString() } : current);
        saveAll();
        renderAll();
      }
      showToast("Stato dell’annuncio aggiornato");
    } catch (error) {
      showToast(error.message || "Aggiornamento non riuscito");
    }
  }

  function openProfileEditor() {
    $("#profileNameInput").value = profile.name || "";
    $("#profileLocationInput").value = profile.location || "";
    $("#profileEmailInput").value = profile.email || "";
    $("#profilePhoneInput").value = profile.phone || "";
    $("#profileGeoMessage").textContent = profile.lat !== null ? "Posizione salvata sul dispositivo." : "";
    $("#profileDialog").showModal();
  }

  async function submitProfile(event) {
    event.preventDefault();
    const nextProfile = {
      ...profile,
      name: $("#profileNameInput").value.trim(),
      location: $("#profileLocationInput").value.trim(),
      email: $("#profileEmailInput").value.trim(),
      phone: $("#profilePhoneInput").value.trim()
    };

    try {
      profile = nextProfile;
      if (CLOUD_ENABLED) {
        await apiFetch("/api/my-listings/profile", {
          method: "PATCH",
          body: JSON.stringify({ seller: profile.name, sellerEmail: profile.email, sellerPhone: profile.phone })
        });
        await loadRemoteListings(false);
      } else {
        listings = listings.map(item => item.owner ? {
          ...item, seller: profile.name, sellerEmail: profile.email, sellerPhone: profile.phone
        } : item);
      }
      saveAll();
      $("#profileDialog").close();
      renderAll();
      showToast("Profilo aggiornato");
    } catch (error) {
      saveAll();
      renderAll();
      showToast(`Profilo salvato localmente: ${error.message}`);
    }
  }

  function getCurrentLocation(forNearMe = false) {
    if (!navigator.geolocation) {
      showToast("Geolocalizzazione non supportata");
      return;
    }
    const message = $("#profileGeoMessage");
    if (message) message.textContent = "Rilevamento posizione…";
    navigator.geolocation.getCurrentPosition(position => {
      profile.lat = position.coords.latitude;
      profile.lng = position.coords.longitude;
      saveAll();
      if (message) message.textContent = "Posizione salvata. La località testuale resta modificabile.";
      if (forNearMe) {
        nearMeEnabled = true;
        renderExplore();
        showToast("Mostro gli annunci entro 50 km");
      } else {
        showToast("Posizione salvata");
      }
    }, () => {
      if (message) message.textContent = "Permesso non concesso o posizione non disponibile.";
      showToast("Non è stato possibile ottenere la posizione");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  }

  async function startScanner() {
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
      showToast("Scanner non disponibile su questo dispositivo. Inserisci l’ISBN manualmente.");
      return;
    }

    try {
      const formats = await BarcodeDetector.getSupportedFormats();
      const usableFormats = ["ean_13", "ean_8", "upc_a", "upc_e"].filter(format => formats.includes(format));
      if (!usableFormats.length) throw new Error("Formato non supportato");

      scannerStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      const video = $("#scannerVideo");
      video.srcObject = scannerStream;
      await video.play();
      $("#scannerDialog").showModal();

      const detector = new BarcodeDetector({ formats: usableFormats });
      const detect = async () => {
        if (!scannerStream || video.readyState < 2) return;
        try {
          const codes = await detector.detect(video);
          const raw = normalizeIsbn(codes[0]?.rawValue || "");
          if ([10, 13].includes(raw.length)) {
            $("#isbnInput").value = raw;
            stopScanner();
            await lookupIsbn();
            return;
          }
        } catch {}
        scanTimer = setTimeout(detect, 350);
      };
      detect();
    } catch {
      stopScanner();
      showToast("Impossibile avviare la fotocamera");
    }
  }

  function stopScanner() {
    clearTimeout(scanTimer);
    scanTimer = null;
    scannerStream?.getTracks().forEach(track => track.stop());
    scannerStream = null;
    $("#scannerVideo").srcObject = null;
    if ($("#scannerDialog").open) $("#scannerDialog").close();
  }

  function exportBackup() {
    const payload = {
      app: "BookSale",
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      listings,
      favorites,
      ownerToken
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `booksale-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file) {
    try {
      const payload = JSON.parse(await file.text());
      if (payload.app !== "BookSale" || !Array.isArray(payload.favorites)) throw new Error("Formato non valido");
      favorites = payload.favorites;
      profile = { ...defaultProfile, ...(payload.profile || {}) };
      if (payload.ownerToken && String(payload.ownerToken).length >= 32) {
        ownerToken = String(payload.ownerToken);
        localStorage.setItem(STORAGE.ownerToken, ownerToken);
      }
      if (!CLOUD_ENABLED && Array.isArray(payload.listings)) listings = payload.listings;
      saveAll();
      if (CLOUD_ENABLED) await loadRemoteListings(false);
      renderAll();
      showToast("Backup importato. Chiave proprietario ripristinata.");
    } catch {
      showToast("File di backup non valido");
    }
  }

  async function resetDemo() {
    const message = CLOUD_ENABLED
      ? "Azzera preferiti e profilo locale? Gli annunci nel cloud e la chiave proprietario non saranno cancellati."
      : "Ripristinare i dati dimostrativi? Gli annunci locali saranno cancellati.";
    if (!confirm(message)) return;
    favorites = [];
    profile = structuredCloneSafe(defaultProfile);
    if (!CLOUD_ENABLED) listings = structuredCloneSafe(demoListings);
    saveAll();
    if (CLOUD_ENABLED) await loadRemoteListings(false);
    renderAll();
    showToast(CLOUD_ENABLED ? "Dati locali azzerati" : "Dati dimostrativi ripristinati");
  }

  function registerEvents() {
    document.addEventListener("click", event => {
      const viewButton = event.target.closest("[data-view]");
      if (viewButton) {
        showView(viewButton.dataset.view);
        return;
      }

      const openSellButton = event.target.closest('[data-action="open-sell"]');
      if (openSellButton) {
        openSell();
        return;
      }

      const categoryButton = event.target.closest("[data-category]");
      if (categoryButton) {
        $("#categoryFilter").value = categoryButton.dataset.category;
        $("#exploreSearchInput").value = "";
        showView("explore");
        return;
      }

      const actionButton = event.target.closest("[data-action][data-id]");
      if (actionButton) {
        const { action, id, kind } = actionButton.dataset;
        if (action === "favorite") toggleFavorite(id);
        if (action === "details") openDetails(id);
        if (action === "edit") openSell(id);
        if (action === "delete") deleteListing(id);
        if (action === "toggle-sold") toggleSold(id);
        if (action === "contact") handleContact(id, kind);
        return;
      }

      const closeButton = event.target.closest("[data-close-dialog]");
      if (closeButton) {
        document.getElementById(closeButton.dataset.closeDialog)?.close();
      }
    });

    $("#heroSearchForm").addEventListener("submit", event => {
      event.preventDefault();
      $("#exploreSearchInput").value = $("#heroSearchInput").value;
      showView("explore");
    });

    $("#exploreSearchForm").addEventListener("submit", event => {
      event.preventDefault();
      renderExplore();
    });

    $("#exploreSearchInput").addEventListener("input", renderExplore);
    ["categoryFilter", "conditionFilter", "priceFilter", "sortFilter"].forEach(id => {
      $(`#${id}`).addEventListener("change", renderExplore);
    });

    $("#resetFiltersBtn").addEventListener("click", () => {
      $("#exploreSearchInput").value = "";
      $("#categoryFilter").value = "";
      $("#conditionFilter").value = "";
      $("#priceFilter").value = "";
      $("#sortFilter").value = "newest";
      nearMeEnabled = false;
      renderExplore();
    });

    $("#nearMeBtn").addEventListener("click", () => {
      if (nearMeEnabled) {
        nearMeEnabled = false;
        renderExplore();
      } else if (profile.lat !== null && profile.lng !== null) {
        nearMeEnabled = true;
        renderExplore();
      } else {
        getCurrentLocation(true);
      }
    });

    $("#listingForm").addEventListener("submit", submitListing);
    $("#profileForm").addEventListener("submit", submitProfile);
    $("#editProfileBtn").addEventListener("click", openProfileEditor);
    $("#useLocationBtn").addEventListener("click", () => getCurrentLocation(false));
    $("#lookupIsbnBtn").addEventListener("click", lookupIsbn);
    $("#scanIsbnBtn").addEventListener("click", startScanner);
    $("#closeScannerBtn").addEventListener("click", stopScanner);

    $("#coverUrlInput").addEventListener("input", event => {
      if (!uploadedCoverBlob) {
        coverRemoved = !event.target.value.trim();
        updateCoverPreview(event.target.value.trim());
      }
    });
    $("#coverFileInput").addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        uploadedCoverBlob = await resizeImage(file);
        coverRemoved = false;
        if (uploadedCoverPreviewUrl) URL.revokeObjectURL(uploadedCoverPreviewUrl);
        uploadedCoverPreviewUrl = URL.createObjectURL(uploadedCoverBlob);
        $("#coverUrlInput").value = "";
        updateCoverPreview(uploadedCoverPreviewUrl);
      } catch {
        showToast("Impossibile leggere la foto");
      }
    });
    $("#removeCoverBtn").addEventListener("click", () => {
      uploadedCoverBlob = null;
      coverRemoved = true;
      if (uploadedCoverPreviewUrl) URL.revokeObjectURL(uploadedCoverPreviewUrl);
      uploadedCoverPreviewUrl = "";
      $("#coverUrlInput").value = "";
      $("#coverFileInput").value = "";
      updateCoverPreview("");
    });

    $("#listingTypeInput").addEventListener("change", event => {
      const disabled = event.target.value !== "Vendita";
      $("#priceInput").disabled = disabled;
      if (disabled) $("#priceInput").value = "0";
      else if (Number($("#priceInput").value) === 0) $("#priceInput").value = "5";
    });

    $("#exportBtn").addEventListener("click", exportBackup);
    $("#importInput").addEventListener("change", event => {
      const file = event.target.files?.[0];
      if (file) importBackup(file);
      event.target.value = "";
    });
    $("#resetAppBtn").addEventListener("click", resetDemo);
    $("#refreshCloudBtn")?.addEventListener("click", () => loadRemoteListings(true));

    ["sellDialog", "detailsDialog", "profileDialog"].forEach(id => {
      const dialog = $(`#${id}`);
      dialog.addEventListener("click", event => {
        const rect = dialog.getBoundingClientRect();
        const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
        if (outside) dialog.close();
      });
    });
    $("#scannerDialog").addEventListener("close", stopScanner);

    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      deferredInstallPrompt = event;
      $("#installBtn").classList.remove("hidden");
    });
    $("#installBtn").addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      $("#installBtn").classList.add("hidden");
    });
    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      $("#installBtn").classList.add("hidden");
      showToast("BookSale installata");
    });
  }

  async function init() {
    $("#categoryInput").innerHTML = categoryOptions("Narrativa");
    $("#categoryFilter").insertAdjacentHTML("beforeend", categoryOptions());
    registerEvents();
    renderAll();

    if (CLOUD_ENABLED) {
      $("#resetAppBtn").textContent = "Azzera dati locali";
      setCloudStatus("connecting", "Connessione…");
      await loadRemoteListings(false);
    } else {
      setCloudStatus("offline", "Cloud da configurare");
    }

    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
    }
  }

  init();
})();

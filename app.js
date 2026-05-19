/* ───────────────────────────────────────────────────────────
   Vinilo Mío — app.js
   state · render · steps · uploads · mailto · PDF
   ─────────────────────────────────────────────────────────── */

(() => {
  "use strict";

  /* ─── pricing (single source of truth) ──────────────── */
  const PRICE = {
    size:   { "7": 299, "12": 499 },
    qr:     50,
    own:    150,
    sleeve: { none: 0, basic: 80, designed: 180 },
    sleeveBack: 80,
    framed: 220,
    shipping: { standard: 120, express: 220 },
  };

  const SLEEVE_LABEL = { none: "Sin funda", basic: "Funda básica", designed: "Funda con diseño" };
  const SHIPPING_LABEL = { standard: "Estándar (5–7 días)", express: "Express (2–3 días)" };

  /* ─── state ─────────────────────────────────────────── */
  const state = {
    step: 1,
    size: "12",
    labelPhotoDataUrl: null,
    labelText: "",
    qrEnabled: false, qrLink: "",
    ownSongsEnabled: false,
    sleeve: "basic",
    sleeveFrontDataUrl: null,
    sleeveBackEnabled: false, sleeveBackDataUrl: null,
    sleeveText: "",
    framed: false,
    shipping: "standard",
    customer: { name: "", email: "", phone: "", address: "", notes: "" },
  };

  const STEP_NAMES = ["", "Tamaño del disco", "Etiqueta y disco", "La funda", "Presentación y envío", "Tus datos"];
  const TOTAL_STEPS = 5;

  /* ─── tiny helpers ──────────────────────────────────── */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const fmt = (n) => n.toLocaleString("es-MX");
  const today = () => {
    const d = new Date();
    const m = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][d.getMonth()];
    return `${d.getDate()} ${m} ${d.getFullYear()}`;
  };
  const slugify = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "anonimo";
  const set = (path, v) => {
    const parts = path.split(".");
    let o = state;
    while (parts.length > 1) o = o[parts.shift()];
    o[parts[0]] = v;
  };

  /* ─── compute totals + line items ───────────────────── */
  function lineItems() {
    const items = [];
    items.push({ label: `Disco ${state.size}"`, sub: state.size === "12" ? "LP completo" : "Formato pequeño", amount: PRICE.size[state.size] });
    if (state.qrEnabled)  items.push({ label: "QR de canción favorita", sub: state.qrLink || "—", amount: PRICE.qr });
    if (state.ownSongsEnabled) items.push({ label: "Canciones propias", sub: "Archivos enviados después", amount: PRICE.own });
    if (state.sleeve !== "none") {
      const sub = state.sleeve === "designed" && state.sleeveText ? `“${state.sleeveText}”` : "";
      items.push({ label: SLEEVE_LABEL[state.sleeve], sub, amount: PRICE.sleeve[state.sleeve] });
    }
    if (state.sleeveBackEnabled && state.sleeve === "designed")
      items.push({ label: "Diseño en parte trasera", sub: "", amount: PRICE.sleeveBack });
    if (state.framed)
      items.push({ label: "Marco de madera negro", sub: "Listo para colgar", amount: PRICE.framed });
    items.push({ label: `Envío ${SHIPPING_LABEL[state.shipping]}`, sub: "", amount: PRICE.shipping[state.shipping] });
    return items;
  }
  function total() { return lineItems().reduce((a, x) => a + x.amount, 0); }

  /* ─── grooves (drawn once, reused on both vinyls) ───── */
  function paintGrooves() {
    $$("[data-grooves]").forEach((g) => {
      if (g.childElementCount) return;
      const frag = document.createDocumentFragment();
      const ns = "http://www.w3.org/2000/svg";
      for (let i = 0; i < 42; i++) {
        const r = 68 + i * 2.9;
        if (r > 188) break;
        const c = document.createElementNS(ns, "circle");
        c.setAttribute("r", r.toFixed(2));
        c.setAttribute("fill", "none");
        c.setAttribute("stroke", `rgba(255,255,255,${(i % 5 === 0 ? 0.10 : 0.045 + (i % 3) * 0.012).toFixed(3)})`);
        c.setAttribute("stroke-width", "0.5");
        frag.appendChild(c);
      }
      g.appendChild(frag);
    });
  }

  /* ─── reveal on scroll ──────────────────────────────── */
  function initReveal() {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.dataset.inview = "true"; }),
      { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
    );
    $$("[data-reveal]").forEach((el) => io.observe(el));
  }

  /* ─── hero CTA on scroll ────────────────────────────── */
  function hideCTA() {
    const cta = $("[data-scroll-cta]");
    if (cta) { cta.classList.remove("is-visible"); cta.classList.add("is-done"); }
  }

  function initScrollCTA() {
    const cta = $("[data-scroll-cta]");
    if (!cta) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking || cta.classList.contains("is-done")) return;
      ticking = true;
      requestAnimationFrame(() => {
        const ratio = window.scrollY / window.innerHeight;
        cta.classList.toggle("is-visible", ratio >= 0.55);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    cta.addEventListener("click", hideCTA, { once: true });
  }

  /* ─── steps ─────────────────────────────────────────── */
  function showStep(n) {
    const next = Math.max(1, Math.min(TOTAL_STEPS, n));
    const prev = state.step;
    if (next === prev) return;
    const dirForward = next > prev;
    const prevEl = $(`.step[data-step="${prev}"]`);
    const nextEl = $(`.step[data-step="${next}"]`);
    if (dirForward) hideCTA();
    if (prevEl) {
      prevEl.classList.remove("is-active");
      if (dirForward) prevEl.classList.add("is-leaving-left");
      requestAnimationFrame(() => prevEl.classList.remove("is-leaving-left"));
    }
    if (nextEl) nextEl.classList.add("is-active");
    state.step = next;
    render();
    // scroll into view on mobile (preview is above; bring step into view)
    if (window.matchMedia("(max-width: 960px)").matches) {
      $(".config__left")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function initStepNav() {
    $("[data-nav='back']").addEventListener("click", () => showStep(state.step - 1));
    $("[data-nav='next']").addEventListener("click", () => {
      if (state.step === TOTAL_STEPS) {
        submitOrder();
        return;
      }
      showStep(state.step + 1);
    });
  }

  /* ─── pick handlers (toggle cards / pills) ──────────── */
  function initPickers() {
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-pick]");
      if (!t) return;
      const key = t.dataset.pick;
      let value = t.dataset.value;
      // booleans
      if (value === "true")  value = true;
      if (value === "false") value = false;

      // Pills toggle (click-again deactivates). Cards are direct-set (radio behavior).
      const isPill = t.classList.contains("toggle-pill");
      if (isPill && typeof value === "boolean") {
        const wasPressed = t.getAttribute("aria-pressed") === "true";
        set(key, !wasPressed);
      } else {
        set(key, value);
      }
      // mutual exclusion: funda con diseño ↔ enmarcado (never both, never neither)
      if (key === "framed" && value === true) {
        state.sleeve = "none";
      } else if (key === "sleeve" && value !== "none") {
        state.framed = false;
      }
      render();
    });
  }

  /* ─── two-way bind inputs ───────────────────────────── */
  function initBinds() {
    $$("[data-bind]").forEach((el) => {
      el.addEventListener("input", () => {
        set(el.dataset.bind, el.value);
        renderReceipt();           // only receipt + preview need updating
        renderPreview();
      });
    });
  }

  /* ─── uploads ───────────────────────────────────────── */
  function initUploads() {
    $$("[data-dropzone]").forEach((zone) => {
      const key = zone.dataset.dropzone;
      const input = zone.querySelector("[data-upload]");
      const innerLabel = zone.querySelector(".dropzone__inner");
      innerLabel.addEventListener("click", () => input.click());
      input.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file, key, zone);
      });
      ["dragenter", "dragover"].forEach((ev) =>
        zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("is-drag"); }));
      ["dragleave", "drop"].forEach((ev) =>
        zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("is-drag"); }));
      zone.addEventListener("drop", (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (file) handleFile(file, key, zone);
      });
    });
    $$("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.remove;
        setUpload(key, null);
      });
    });
  }

  function handleFile(file, key, zone) {
    if (!/^image\/(jpe?g|png)$/i.test(file.type)) { alert("Por favor subí una imagen JPG o PNG."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("La imagen pesa más de 5MB. Probá con una más liviana."); return; }
    const reader = new FileReader();
    reader.onload = () => setUpload(key, reader.result);
    reader.readAsDataURL(file);
  }

  function setUpload(key, dataUrl) {
    const map = { label: "labelPhotoDataUrl", sleeveFront: "sleeveFrontDataUrl", sleeveBack: "sleeveBackDataUrl" };
    state[map[key]] = dataUrl;
    // toggle preview/inner visibility
    const zone = $(`[data-dropzone="${key}"]`);
    const inner = zone.querySelector(".dropzone__inner");
    const prev  = zone.querySelector(`[data-preview="${key}"]`);
    const img   = zone.querySelector(`[data-preview-img="${key}"]`);
    if (dataUrl) {
      inner.hidden = true;
      prev.hidden = false;
      img.src = dataUrl;
    } else {
      inner.hidden = false;
      prev.hidden = true;
      img.removeAttribute("src");
      const input = zone.querySelector("[data-upload]");
      if (input) input.value = "";
    }
    render();
  }

  /* ─── render: orchestration ─────────────────────────── */
  function render() {
    renderProgress();
    renderToggles();
    renderConditionalAreas();
    renderPreview();
    renderReceipt();
    renderNavLabel();
  }

  function renderProgress() {
    $("[data-progress-label]").textContent = `Paso ${state.step} de ${TOTAL_STEPS}`;
    $("[data-progress-name]").textContent = STEP_NAMES[state.step];
    $("[data-progress-fill]").style.transform = `scaleX(${state.step / TOTAL_STEPS})`;
  }

  function renderToggles() {
    // toggle cards / pills aria-pressed
    $$("[data-pick]").forEach((el) => {
      const key = el.dataset.pick;
      const val = el.dataset.value;
      const current = key.split(".").reduce((o, k) => o?.[k], state);
      let pressed = false;
      if (val === "true")  pressed = current === true;
      else if (val === "false") pressed = current === false;
      else pressed = current === val;
      el.setAttribute("aria-pressed", pressed ? "true" : "false");
    });
  }

  function renderConditionalAreas() {
    // toggle extras visibility
    $$("[data-extras]").forEach((el) => {
      const key = el.dataset.extras;
      el.hidden = !state[key];
    });
    // sleeve extras
    const sleeveExtras = $("[data-sleeve-extras]");
    if (sleeveExtras) sleeveExtras.hidden = state.sleeve !== "designed";
  }

  function renderNavLabel() {
    const back = $("[data-nav='back']");
    const next = $("[data-nav='next']");
    back.toggleAttribute("disabled", state.step === 1);
    if (state.step === TOTAL_STEPS) {
      next.innerHTML = "Confirmar pedido →";
    } else {
      next.innerHTML = "Siguiente →";
    }
  }

  /* ─── preview render ────────────────────────────────── */
  function renderPreview() {
    const stage = $("#previewStage");
    stage.dataset.size = state.size;

    // label radius: 7" record has a proportionally larger label than 12"
    const LABEL_R = state.size === "7" ? 82 : 60;
    const scale = LABEL_R / 60;

    // meta line
    const metaParts = [`${state.size}"`];
    if (state.framed) metaParts.push("enmarcado");
    else metaParts.push(SLEEVE_LABEL[state.sleeve].toLowerCase());
    $("[data-preview-meta]").textContent = metaParts.join(" · ");

    // update clip path and label bg radius
    const clipCircle = document.querySelector("#labelClipPreview circle");
    if (clipCircle) clipCircle.setAttribute("r", LABEL_R);

    const labelBg   = $("[data-label-bg]");
    const markTop   = $("[data-label-mark-top]");
    const markBot   = $("[data-label-mark-bottom]");
    const labelGrp  = $("[data-label-group]");
    const customTxt = $("[data-label-text]");

    labelBg.setAttribute("r", LABEL_R);

    // scale wordmark positions and font size
    markTop.setAttribute("y", (-12 * scale).toFixed(1));
    markBot.setAttribute("y", (32 * scale).toFixed(1));
    const wSize = Math.round(32 * scale);
    markTop.style.fontSize = `${wSize}px`;
    markBot.style.fontSize = `${wSize}px`;

    // custom text — always inside the label circle
    customTxt.setAttribute("y", (LABEL_R - 10).toFixed(0));

    // QR hint — inside the label at bottom centre
    $("[data-qr-hint]").setAttribute("transform", `translate(0, ${(LABEL_R - 20).toFixed(0)})`);

    // remove existing image
    const existing = labelGrp.querySelector("image");
    if (existing) existing.remove();

    if (state.labelPhotoDataUrl) {
      labelBg.setAttribute("opacity", "0");
      markTop.setAttribute("opacity", "0");
      markBot.setAttribute("opacity", "0");
      const ns = "http://www.w3.org/2000/svg";
      const img = document.createElementNS(ns, "image");
      img.setAttribute("href", state.labelPhotoDataUrl);
      img.setAttribute("x", -LABEL_R);
      img.setAttribute("y", -LABEL_R);
      img.setAttribute("width", LABEL_R * 2);
      img.setAttribute("height", LABEL_R * 2);
      img.setAttribute("clip-path", "url(#labelClipPreview)");
      img.setAttribute("preserveAspectRatio", "xMidYMid slice");
      labelGrp.appendChild(img);
    } else {
      labelBg.setAttribute("opacity", "1");
      markTop.setAttribute("opacity", "1");
      markBot.setAttribute("opacity", "1");
    }

    // custom text (only when no photo)
    customTxt.textContent = state.labelText ? state.labelText.toUpperCase() : "";
    customTxt.setAttribute("opacity", state.labelPhotoDataUrl ? "0" : (state.labelText ? "0.9" : "0"));

    // QR hint opacity
    $("[data-qr-hint]").setAttribute("opacity", state.qrEnabled ? "0.85" : "0");

    // frame overlay
    $("[data-frame-overlay]").setAttribute("opacity", state.framed ? "1" : "0");

    // sleeve mock — scale with disc size
    const sleeveMock = $("[data-sleeve-mock]");
    const sleeveImg  = $("[data-sleeve-img]");
    const sleeveTxt  = $("[data-sleeve-mock-text]");
    sleeveMock.style.width = state.size === "12" ? "70%" : "55%";
    if (state.sleeve === "designed" && state.sleeveFrontDataUrl) {
      sleeveMock.hidden = false;
      sleeveImg.src = state.sleeveFrontDataUrl;
      sleeveTxt.textContent = state.sleeveText || "";
    } else {
      sleeveMock.hidden = true;
    }
  }

  /* ─── receipt render w/ animated total ──────────────── */
  let lastTotal = 0;
  function renderReceipt() {
    $("[data-receipt-date]").textContent = today();
    const items = lineItems();
    const dl = $("[data-receipt-items]");
    dl.innerHTML = "";
    items.forEach((it) => {
      const row = document.createElement("div");
      row.className = "row";
      const dt = document.createElement("dt");
      dt.textContent = it.label;
      const dd = document.createElement("dd");
      dd.textContent = `$${fmt(it.amount)}`;
      row.appendChild(dt);
      row.appendChild(dd);
      dl.appendChild(row);
      if (it.sub) {
        const sub = document.createElement("div");
        sub.className = "row__sub";
        sub.textContent = it.sub;
        dl.appendChild(sub);
      }
    });
    tickTotal(lastTotal, total());
    lastTotal = total();
  }

  function tickTotal(from, to) {
    const el = $("[data-total]");
    if (from === to) { el.textContent = fmt(to); return; }
    const start = performance.now();
    const dur = 380;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + (to - from) * eased);
      el.textContent = fmt(v);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ─── order submission (mailto + telegram + PDF) ────── */
  function submitOrder() {
    const form = $("#customerForm");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    // sync customer state (in case input event missed something)
    state.customer = {
      name:    $("#cName").value.trim(),
      email:   $("#cEmail").value.trim(),
      phone:   $("#cPhone").value.trim(),
      address: $("#cAddress").value.trim(),
      notes:   $("#cNotes").value.trim(),
    };

    const summary = buildPlainSummary();
    const subject = `Nuevo pedido — ${state.customer.name}`;
    const url = `mailto:hg.matias.a@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary)}`;
    // open in same tab; user's mail client takes over
    window.location.href = url;

    showTelegram();
  }

  function buildPlainSummary() {
    const items = lineItems();
    const colW = 32;
    const line = (a, b) => {
      const aa = String(a).slice(0, colW).padEnd(colW, " ");
      return `  ${aa}  $${fmt(b)}`;
    };
    const lines = [];
    lines.push("Pedido — Vinilo Mío");
    lines.push(`Fecha: ${today()}`);
    lines.push("─".repeat(48));
    lines.push("Cliente");
    lines.push(`  Nombre:    ${state.customer.name}`);
    lines.push(`  Email:     ${state.customer.email}`);
    lines.push(`  Teléfono:  ${state.customer.phone}`);
    lines.push(`  Dirección: ${state.customer.address.replace(/\n/g, " · ")}`);
    if (state.customer.notes) lines.push(`  Notas:     ${state.customer.notes.replace(/\n/g, " · ")}`);
    lines.push("─".repeat(48));
    lines.push("Pedido");
    items.forEach((it) => {
      lines.push(line(it.label, it.amount));
      if (it.sub) lines.push(`    ↳ ${it.sub}`);
    });
    if (state.labelText) lines.push(`    ↳ Texto en etiqueta: "${state.labelText}"`);
    lines.push("─".repeat(48));
    lines.push(`  TOTAL:${" ".repeat(colW - 6)}  $${fmt(total())} MXN`);
    lines.push("");
    const imgsCount = [state.labelPhotoDataUrl, state.sleeveFrontDataUrl, state.sleeveBackDataUrl].filter(Boolean).length;
    if (imgsCount > 0) {
      lines.push(`Imágenes adjuntas (${imgsCount}): se enviarán por separado.`);
      lines.push("El cliente las adjuntará desde su cliente de correo o las pasará por WhatsApp.");
    }
    lines.push("");
    lines.push("— Vinilo Mío · CDMX");
    return lines.join("\n");
  }

  function showTelegram() {
    const tg = $("[data-telegram]");
    // populate uploaded images so the brand owner can forward/attach them
    const container = $("[data-telegram-imgs]");
    if (container) {
      const uploads = [
        { key: "labelPhotoDataUrl",   label: "Foto etiqueta" },
        { key: "sleeveFrontDataUrl",  label: "Portada delantera" },
        { key: "sleeveBackDataUrl",   label: "Portada trasera" },
      ].filter((u) => state[u.key]);
      if (uploads.length) {
        container.hidden = false;
        container.innerHTML = `<p class="tg-imgs__note">Adjuntá estas imágenes al correo que se acaba de abrir:</p>
          <div class="tg-imgs__grid">${uploads.map((u) =>
            `<figure class="tg-imgs__item"><img src="${state[u.key]}" alt="${u.label}" /><figcaption>${u.label}</figcaption></figure>`
          ).join("")}</div>`;
      }
    }
    tg.hidden = false;
    tg.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ─── PDF generation ────────────────────────────────── */
  async function downloadPDF() {
    if (!window.jspdf) { alert("La librería PDF aún no cargó. Probá de nuevo en unos segundos."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const PAGE_W = doc.internal.pageSize.getWidth();
    const PAGE_H = doc.internal.pageSize.getHeight();

    // colors
    const INK = [10, 10, 10];
    const CREAM = [245, 236, 215];
    const CREAM_SOFT = [255, 243, 176];
    const GOLD = [201, 168, 76];
    const DIM = [148, 142, 124];

    // background
    doc.setFillColor(...INK);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");

    // perforated edge (top + bottom)
    doc.setFillColor(...CREAM);
    for (let x = 12; x < PAGE_W - 12; x += 14) {
      doc.circle(x, 6, 1.6, "F");
      doc.circle(x, PAGE_H - 6, 1.6, "F");
    }

    // header
    doc.setTextColor(...CREAM_SOFT);
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.text("✦ Vinilo Mío ✦", PAGE_W / 2, 56, { align: "center" });

    doc.setTextColor(...CREAM);
    doc.setFont("times", "bold");
    doc.setFontSize(34);
    doc.text("ORDEN DE PEDIDO", PAGE_W / 2, 92, { align: "center" });

    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DIM);
    doc.text(`Fecha · ${today()}   ·   No. ${Date.now().toString().slice(-6)}`, PAGE_W / 2, 110, { align: "center" });

    // gold rule
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1);
    doc.line(60, 128, PAGE_W - 60, 128);

    // customer block
    let y = 158;
    doc.setTextColor(...GOLD);
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.text("Cliente", 60, y);
    y += 18;
    doc.setTextColor(...CREAM);
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    const c = state.customer;
    const custLines = [
      ["Nombre",    c.name],
      ["Email",     c.email],
      ["Teléfono",  c.phone],
      ["Dirección", c.address.replace(/\n/g, " · ")],
    ];
    if (c.notes) custLines.push(["Notas", c.notes.replace(/\n/g, " · ")]);
    custLines.forEach(([k, v]) => {
      doc.setTextColor(...DIM);
      doc.text(k.padEnd(10, " "), 60, y);
      doc.setTextColor(...CREAM);
      const wrapped = doc.splitTextToSize(v || "—", 280);
      doc.text(wrapped, 130, y);
      y += 12 * wrapped.length + 2;
    });

    // dotted divider
    y += 8;
    drawDottedLine(doc, 60, y, PAGE_W - 60, GOLD);
    y += 16;

    // order header
    doc.setTextColor(...GOLD);
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.text("Pedido", 60, y);
    y += 18;

    // line items
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    lineItems().forEach((it) => {
      doc.setTextColor(...CREAM);
      const label = it.label;
      const wrappedLabel = doc.splitTextToSize(label, 340);
      doc.text(wrappedLabel, 60, y);
      doc.setTextColor(...CREAM_SOFT);
      doc.text(`$${fmt(it.amount)}`, PAGE_W - 60, y, { align: "right" });
      y += 12 * wrappedLabel.length;
      if (it.sub) {
        doc.setTextColor(...DIM);
        doc.setFontSize(8.5);
        const sub = doc.splitTextToSize("↳ " + it.sub, 340);
        doc.text(sub, 70, y);
        y += 10 * sub.length;
        doc.setFontSize(10);
      }
      // dotted between items
      drawDottedLine(doc, 60, y + 2, PAGE_W - 60, [70, 65, 56]);
      y += 12;
    });

    // label text addendum
    if (state.labelText) {
      doc.setTextColor(...DIM);
      doc.setFontSize(9);
      doc.text(`Texto en la etiqueta: "${state.labelText}"`, 60, y);
      y += 16;
    }

    // total
    y += 6;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1.2);
    doc.line(60, y, PAGE_W - 60, y);
    y += 22;
    doc.setTextColor(...CREAM);
    doc.setFont("times", "bold");
    doc.setFontSize(18);
    doc.text("TOTAL", 60, y);
    doc.setTextColor(...CREAM_SOFT);
    doc.text(`$${fmt(total())} MXN`, PAGE_W - 60, y, { align: "right" });
    y += 30;

    // vinyl snapshot
    try {
      const svgEl = $(".vinyl--preview");
      if (svgEl && window.html2canvas) {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "position:fixed;left:-9999px;top:0;width:360px;background:#0A0A0A;padding:10px;";
        const clone = svgEl.cloneNode(true);
        clone.removeAttribute("style");
        clone.setAttribute("width", "340");
        clone.setAttribute("height", "340");
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);
        const canvas = await window.html2canvas(wrapper, { backgroundColor: "#0A0A0A", scale: 2, logging: false });
        document.body.removeChild(wrapper);
        const dataUrl = canvas.toDataURL("image/png");
        const imgW = 140;
        const imgH = 140;
        const remaining = PAGE_H - y - 100;
        if (remaining < imgH) { doc.addPage(); y = 60; doc.setFillColor(...INK); doc.rect(0,0,PAGE_W,PAGE_H,"F"); }
        doc.addImage(dataUrl, "PNG", (PAGE_W - imgW) / 2, y, imgW, imgH);
        y += imgH + 14;
      }
    } catch (err) { console.warn("Vinyl snapshot skipped:", err); }

    // footer
    const footY = PAGE_H - 50;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(80, footY - 16, PAGE_W - 80, footY - 16);
    doc.setTextColor(...GOLD);
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.text("Hecho con amor · CDMX · vinilomio.mx", PAGE_W / 2, footY, { align: "center" });
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...DIM);
    doc.text("★ ★ ★", PAGE_W / 2, footY + 14, { align: "center" });

    const fname = `vinilomio-pedido-${slugify(state.customer.name)}-${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(fname);
  }

  function drawDottedLine(doc, x1, y, x2, color) {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.4);
    const step = 3;
    for (let x = x1; x < x2; x += step) doc.line(x, y, Math.min(x + 1.4, x2), y);
  }

  /* ─── action bindings (telegram buttons) ────────────── */
  function initActions() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("[data-action]");
      if (!a) return;
      if (a.dataset.action === "pdf") downloadPDF();
      if (a.dataset.action === "another") {
        // reset to step 1 (keep customer data — they might reorder)
        $("[data-telegram]").hidden = true;
        showStep(1);
        window.scrollTo({ top: $("#configurador").offsetTop - 20, behavior: "smooth" });
      }
    });
  }

  /* ─── boot ──────────────────────────────────────────── */
  function init() {
    paintGrooves();
    initReveal();
    initScrollCTA();
    initStepNav();
    initPickers();
    initBinds();
    initUploads();
    initActions();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

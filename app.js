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
    previewView: "disc-front",
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

  /* ─── play / pause vinyl ───────────────────────────── */
  let playing = true;
  function initPlayBtn() {
    const btn = $("[data-play-btn]");
    if (!btn) return;
    btn.addEventListener("click", () => {
      playing = !playing;
      updatePlayState();
    });
  }
  function updatePlayState() {
    const btn  = $("[data-play-btn]");
    const arm  = $(".tonearm-arm");
    const isDisc = state.previewView.startsWith("disc");
    if (btn) btn.textContent = playing ? "❚❚" : "▶";
    $$(".vinyl--preview").forEach((v) => {
      v.style.animationPlayState = playing ? "running" : "paused";
    });
    if (arm) {
      arm.classList.toggle("is-resting", !playing || !isDisc);
    }
  }

  /* ─── preview view switcher ────────────────────────── */
  function initViewTabs() {
    $$("[data-pvw-btn]").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.pvwBtn));
    });
  }

  function syncViewTabs() {
    $$("[data-pvw-btn]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.pvwBtn === state.previewView);
    });
    const stage = $("#previewStage");
    if (stage) stage.dataset.pvw = state.previewView;
    updatePlayState();
  }

  function switchView(newView) {
    const old = state.previewView;
    if (old === newView) return;

    const oldEl = $(`[data-pvw-layer="${old}"]`);
    const newEl = $(`[data-pvw-layer="${newView}"]`);
    if (!oldEl || !newEl) return;

    const oldIsDisc = old.startsWith("disc");
    const newIsDisc = newView.startsWith("disc");
    const FLIP_DUR  = 180;
    const SLIDE_DUR = 290;

    // Helper: clean animation classes
    const cleanAnim = (el) => {
      ["pvw-anim-flip-out","pvw-anim-flip-in",
       "pvw-anim-exit-r","pvw-anim-enter-l",
       "pvw-anim-exit-l","pvw-anim-enter-r"].forEach((c) => el.classList.remove(c));
    };

    if (oldIsDisc === newIsDisc) {
      // ── Flip (disc↔disc-back or sleeve↔sleeve-back) ──
      cleanAnim(oldEl); cleanAnim(newEl);
      oldEl.classList.add("pvw-anim-flip-out");
      setTimeout(() => {
        oldEl.hidden = true;
        oldEl.classList.remove("pvw-anim-flip-out");
        newEl.hidden = false;
        newEl.classList.add("pvw-anim-flip-in");
        newEl.addEventListener("animationend", () => cleanAnim(newEl), { once: true });
        state.previewView = newView;
        syncViewTabs();
      }, FLIP_DUR);
    } else {
      // ── Slide (disc ↔ sleeve) ──
      const goingToSleeve = !newIsDisc;
      cleanAnim(oldEl); cleanAnim(newEl);
      // Update state immediately so tonearm/tabs react right away
      state.previewView = newView;
      syncViewTabs();
      newEl.hidden = false;
      oldEl.classList.add(goingToSleeve ? "pvw-anim-exit-l" : "pvw-anim-exit-r");
      newEl.classList.add(goingToSleeve ? "pvw-anim-enter-r" : "pvw-anim-enter-l");
      const done = () => {
        oldEl.hidden = true;
        cleanAnim(oldEl); cleanAnim(newEl);
      };
      newEl.addEventListener("animationend", done, { once: true });
    }

  }

  /* ─── mobile preview flash ─────────────────────────── */
  let _flashTimer = null;
  function flashPreview() {
    if (!window.matchMedia("(max-width: 960px)").matches) return;
    const stage = $(".preview-stage");
    const left  = $(".config__left");
    if (!stage || !left) return;
    clearTimeout(_flashTimer);
    stage.scrollIntoView({ behavior: "smooth", block: "start" });
    _flashTimer = setTimeout(() => {
      left.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 1100);
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
    // static hero CTA also dismisses the floating one
    const heroCta = $("#heroCta");
    if (heroCta) heroCta.addEventListener("click", hideCTA, { once: true });
    // auto-dismiss once the configurator section enters the viewport
    const configEl = $("#configurador");
    if (configEl) {
      new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) hideCTA();
      }, { threshold: 0.05 }).observe(configEl);
    }
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
      // mutual exclusion: funda ↔ enmarcado (never both, never neither)
      if (key === "framed" && value === true) {
        state.sleeve = "none";
      } else if (key === "framed" && value === false && state.sleeve === "none") {
        state.sleeve = "basic";          // restore default sleeve when removing frame
      } else if (key === "sleeve" && value !== "none") {
        state.framed = false;
      }
      render();
      // on mobile, briefly scroll up to show the preview update then return
      if (!isPill) flashPreview();
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
    const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    if (isTouch) {
      // simplify dropzone text for touch devices — no drag instructions
      $$(".dropzone__title").forEach((el) => { el.textContent = "Toca para elegir imagen"; });
      $$(".dropzone__sub").forEach((el) => { el.innerHTML = "JPG o PNG · máx 5MB"; });
    }

    $$("[data-dropzone]").forEach((zone) => {
      const key = zone.dataset.dropzone;
      const input = zone.querySelector("[data-upload]");
      const innerLabel = zone.querySelector(".dropzone__inner");
      innerLabel.addEventListener("click", () => input.click());
      input.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file, key, zone);
      });
      if (!isTouch) {
        ["dragenter", "dragover"].forEach((ev) =>
          zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("is-drag"); }));
        ["dragleave", "drop"].forEach((ev) =>
          zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("is-drag"); }));
        zone.addEventListener("drop", (e) => {
          const file = e.dataTransfer?.files?.[0];
          if (file) handleFile(file, key, zone);
        });
      }
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
      flashPreview();
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
      img.style.clipPath = "circle(50%)";
      img.setAttribute("preserveAspectRatio", "xMidYMid slice");
      labelGrp.appendChild(img);
    } else {
      labelBg.setAttribute("opacity", "1");
      markTop.setAttribute("opacity", "1");
      markBot.setAttribute("opacity", "1");
    }

    // custom text — always inside the label circle; cream fill when over a photo
    customTxt.textContent = state.labelText ? state.labelText.toUpperCase() : "";
    customTxt.setAttribute("opacity", state.labelText ? "0.92" : "0");
    customTxt.setAttribute("fill", state.labelPhotoDataUrl ? "#F5ECD7" : "#0A0A0A");

    // QR hint opacity
    $("[data-qr-hint]").setAttribute("opacity", state.qrEnabled ? "0.85" : "0");

    // frame overlay
    $("[data-frame-overlay]").setAttribute("opacity", state.framed ? "1" : "0");

    // disc-back label radius
    const labelBgB = $("[data-label-bg-b]");
    if (labelBgB) labelBgB.setAttribute("r", LABEL_R);

    // tonearm angle via CSS custom property on stage
    const stageEl = $("#previewStage");
    if (stageEl) {
      const playAngle = state.size === "7" ? "-60deg" : "-72deg";
      stageEl.style.setProperty("--arm-angle", playAngle);
    }

    // sleeve mock (peeking behind disc in disc-front view)
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

    // ── sleeve view layers ──────────────────────────────
    const hasFront = !!(state.sleeve === "designed" && state.sleeveFrontDataUrl);
    const hasBack  = !!(state.sleeve === "designed" && state.sleeveBackEnabled && state.sleeveBackDataUrl);

    // front
    const pvwFrontImg = $("[data-pvw-sleeve-img-front]");
    const pvwFrontPh  = $("[data-pvw-sleeve-front-ph]");
    if (pvwFrontImg) {
      pvwFrontImg.src = hasFront ? state.sleeveFrontDataUrl : "";
      pvwFrontImg.style.display = hasFront ? "block" : "none";
    }
    if (pvwFrontPh) pvwFrontPh.style.display = hasFront ? "none" : "flex";

    // back
    const pvwBackImg = $("[data-pvw-sleeve-img-back]");
    const pvwBackPh  = $("[data-pvw-sleeve-back-ph]");
    if (pvwBackImg) {
      pvwBackImg.src = hasBack ? state.sleeveBackDataUrl : "";
      pvwBackImg.style.display = hasBack ? "block" : "none";
    }
    if (pvwBackPh) pvwBackPh.style.display = hasBack ? "none" : "flex";
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
        container.innerHTML = `<p class="tg-imgs__note">Descargá cada imagen y adjuntala al correo que se acaba de abrir:</p>
          <div class="tg-imgs__grid">${uploads.map((u) =>
            `<figure class="tg-imgs__item">
               <img src="${state[u.key]}" alt="${u.label}" />
               <figcaption>${u.label}</figcaption>
               <a class="tg-imgs__dl" href="${state[u.key]}" download="vinilomio-${u.key}.jpg">↓ Descargar</a>
             </figure>`
          ).join("")}</div>`;
      }
    }
    tg.hidden = false;
    tg.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ─── PDF generation (Y2K Chrome Dream) ────────────── */
  async function downloadPDF() {
    if (!window.jspdf) { alert("La librería PDF aún no cargó. Probá de nuevo en unos segundos."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    // Y2K Chrome Dream palette
    const INK    = [10,  10,  10 ];
    const INK2   = [20,  20,  20 ];
    const YELLOW = [244, 237, 140];
    const CREAM  = [245, 240, 225];
    const DIM    = [120, 116, 100];
    const RULE   = [38,  36,  28 ];

    // helpers
    const setY = (color) => doc.setTextColor(...color);
    const setD = (color) => doc.setDrawColor(...color);
    const setF = (color) => doc.setFillColor(...color);

    // ── Full-page black background ────────────────────────
    setF(INK); doc.rect(0, 0, W, H, "F");

    // ── Yellow header band ────────────────────────────────
    const BAND = 68;
    setF(YELLOW); doc.rect(0, 0, W, BAND, "F");

    // VM logo circle
    setF(INK); doc.circle(42, BAND / 2, 22, "F");
    setD(YELLOW); doc.setLineWidth(2); doc.circle(42, BAND / 2, 22, "S");
    setY(YELLOW);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("VM", 42, BAND / 2 + 5, { align: "center" });

    // "vinilomio" wordmark
    setY(INK);
    doc.setFont("helvetica", "bold"); doc.setFontSize(26);
    doc.text("vinilomio", 76, BAND / 2 + 9);

    // Right: doc type + date + order number
    doc.setFont("courier", "bold"); doc.setFontSize(7.5);
    doc.text("ORDEN DE PEDIDO", W - 36, BAND / 2 - 6, { align: "right" });
    doc.setFont("courier", "normal"); doc.setFontSize(7);
    doc.text(`${today()}  ·  #${Date.now().toString().slice(-6)}`, W - 36, BAND / 2 + 6, { align: "right" });

    // Band bottom border
    setD(INK); doc.setLineWidth(2); doc.line(0, BAND, W, BAND);

    // Yellow dot row just below band
    const dotRowY = BAND + 10;
    setF(YELLOW);
    for (let x = 24; x < W - 20; x += 16) doc.circle(x, dotRowY, 1.3, "F");

    // ── Customer section ──────────────────────────────────
    let y = BAND + 32;

    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    setY(YELLOW);
    doc.text("01  ·  CLIENTE", 36, y);
    y += 5;
    setD(YELLOW); doc.setLineWidth(0.5); doc.line(36, y, 220, y);
    y += 14;

    const c = state.customer;
    const custLines = [
      ["Nombre",    c.name    || "—"],
      ["Email",     c.email   || "—"],
      ["Teléfono",  c.phone   || "—"],
      ["Dirección", c.address.replace(/\n/g, " · ") || "—"],
    ];
    if (c.notes) custLines.push(["Notas", c.notes.replace(/\n/g, " · ")]);

    doc.setFont("courier", "normal"); doc.setFontSize(9.5);
    custLines.forEach(([k, v]) => {
      setY(DIM);   doc.text(k.padEnd(10), 36, y);
      setY(CREAM); const wrapped = doc.splitTextToSize(v, 310);
      doc.text(wrapped, 130, y);
      y += 13 * wrapped.length + 1;
    });

    // ── Divider ───────────────────────────────────────────
    y += 10;
    drawDottedLine(doc, 36, y, W - 36, YELLOW); y += 20;

    // ── Order section ─────────────────────────────────────
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    setY(YELLOW);
    doc.text("02  ·  PEDIDO", 36, y);
    y += 5;
    setD(YELLOW); doc.setLineWidth(0.5); doc.line(36, y, 200, y);
    y += 14;

    doc.setFont("courier", "normal"); doc.setFontSize(9.5);
    lineItems().forEach((it) => {
      setY(CREAM);
      const lbl = doc.splitTextToSize(it.label, 350);
      doc.text(lbl, 36, y);
      setY(YELLOW);
      doc.text(`$${fmt(it.amount)}`, W - 36, y, { align: "right" });
      y += 13 * lbl.length;
      if (it.sub) {
        setY(DIM); doc.setFontSize(8);
        const sub = doc.splitTextToSize("↳ " + it.sub, 350);
        doc.text(sub, 46, y);
        y += 10 * sub.length;
        doc.setFontSize(9.5);
      }
      drawDottedLine(doc, 36, y + 2, W - 36, RULE); y += 12;
    });

    if (state.labelText) {
      setY(DIM); doc.setFontSize(8.5);
      doc.text(`Texto en etiqueta: "${state.labelText}"`, 36, y);
      y += 14;
    }

    // ── Total ─────────────────────────────────────────────
    y += 6;
    setD(YELLOW); doc.setLineWidth(1.5); doc.line(36, y, W - 36, y);
    y += 20;
    setY(CREAM); doc.setFont("helvetica", "bold"); doc.setFontSize(22);
    doc.text("TOTAL", 36, y);
    setY(YELLOW); doc.setFontSize(28);
    doc.text(`$${fmt(total())} MXN`, W - 36, y, { align: "right" });
    y += 32;

    // ── Vinyl snapshot ────────────────────────────────────
    try {
      const svgEl = $(".vinyl--preview");
      if (svgEl && window.html2canvas) {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "position:fixed;left:-9999px;top:0;width:320px;background:#0A0A0A;padding:8px;border-radius:50%;overflow:hidden;";
        const clone = svgEl.cloneNode(true);
        clone.removeAttribute("style");
        clone.setAttribute("width",  "304");
        clone.setAttribute("height", "304");
        // pause animation so we get a clean snapshot
        clone.style.animation = "none";
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);
        const canvas = await window.html2canvas(wrapper, { backgroundColor: "#0A0A0A", scale: 2, logging: false });
        document.body.removeChild(wrapper);
        const dataUrl = canvas.toDataURL("image/png");
        const imgW = 130; const imgH = 130;
        if (H - y - 80 < imgH) { doc.addPage(); y = 60; setF(INK); doc.rect(0,0,W,H,"F"); }
        const imgX = (W - imgW) / 2;
        // yellow glow ring behind vinyl
        setF([50, 47, 20]); doc.circle(imgX + imgW / 2, y + imgH / 2, imgW / 2 + 8, "F");
        doc.addImage(dataUrl, "PNG", imgX, y, imgW, imgH);
        // ✦ flankers
        setY(YELLOW); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
        doc.text("✦", imgX - 22, y + imgH / 2 + 6);
        doc.text("✦", imgX + imgW + 8, y + imgH / 2 + 6);
        y += imgH + 12;
      }
    } catch (err) { console.warn("Vinyl snapshot skipped:", err); }

    // ── Yellow footer band ────────────────────────────────
    const FOOT_H  = 42;
    const footTop = H - FOOT_H;
    // dot row above footer
    setF(YELLOW);
    for (let x = 24; x < W - 20; x += 16) doc.circle(x, footTop - 8, 1.3, "F");
    // band
    setF(YELLOW); doc.rect(0, footTop, W, FOOT_H, "F");
    setD(INK); doc.setLineWidth(2); doc.line(0, footTop, W, footTop);
    setY(INK); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("Hecho con amor  ·  CDMX  ·  vinilomio.mx", W / 2, footTop + 26, { align: "center" });

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

  /* ─── scroll transition (hero → about) ─────────────── */
  /*
   * CSS sticky approach — zero GSAP pin, zero fixed panels, zero scroll snaps.
   *
   * Layout contract (set in CSS):
   *   .hero-wrapper  { height: 200svh }               — scroll travel budget
   *   .hero          { position: sticky; top: 0; height: 100svh }  — sticks in place
   *   .about         { margin-top: -100svh; z-index: 2; background: var(--ink) }
   *                                                    — slides over the hero naturally
   *
   * As the user scrolls 0 → 100svh the hero stays stuck while GSAP animates
   * the vinyl and chrome.  At 100svh the wrapper ends, the hero unsticks, and
   * #about — whose top was already at 100svh in the document — is now at the
   * viewport top. One continuous scroll, no teleport, no duplicate.
   */
  function initScrollAnimation() {
    if (!window.gsap || !window.ScrollTrigger) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const heroWrapper = document.querySelector(".hero-wrapper");
    const hero        = document.getElementById("hero");
    const vinylWrap   = hero.querySelector(".hero__vinyl-wrap");
    const vinylSvg    = vinylWrap.querySelector(".vinyl--hero"); // vmSpin CSS anim
    const vinylGlow   = vinylWrap.querySelector(".vinyl-glow");  // vmFloat CSS anim
    const heroCopy    = hero.querySelector(".hero__copy");
    const ctaRow      = hero.querySelector(".hero__cta-row");
    const stickers    = hero.querySelectorAll(".sticker");
    const hint        = hero.querySelector(".hero__hint");
    const marquee     = hero.querySelector(".marquee-strip");
    const brand       = hero.querySelector(".hero__brand");

    if (!vinylWrap) return;

    // Snapshot vinyl's natural center offset before any GSAP transform.
    const { left, top, width, height } = vinylWrap.getBoundingClientRect();
    const dx = window.innerWidth  / 2 - (left + width  / 2);
    const dy = window.innerHeight / 2 - (top  + height / 2);

    // Own compositor layer from the start — no promotion cost mid-animation.
    gsap.set(vinylWrap, { transformOrigin: "50% 50%", force3D: true });

    // Pause competing CSS transforms during GSAP's parent transform.
    // vmSpin & vmFloat run on children inside vinylWrap — if they animate
    // simultaneously with GSAP's scale/translate the compositor must
    // re-composite every frame. Pausing them collapses that cost to zero.
    const pauseVinylCSS = () => {
      if (vinylSvg)  {
        vinylSvg.style.animationPlayState = "paused";
        vinylSvg.style.filter = "drop-shadow(0 6px 20px rgba(0,0,0,.5))";
      }
      if (vinylGlow) vinylGlow.style.animationPlayState = "paused";
    };
    const resumeVinylCSS = () => {
      if (vinylSvg)  { vinylSvg.style.animationPlayState = ""; vinylSvg.style.filter = ""; }
      if (vinylGlow) vinylGlow.style.animationPlayState = "";
    };

    let soundPlayed = false;

    const tl = gsap.timeline({
      scrollTrigger: {
        // Trigger on the wrapper so the scrub range = wrapper height − viewport height
        // = 200svh − 100svh = 100svh. Progress 0 → 1 maps cleanly to that scroll range.
        trigger: heroWrapper || hero,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.25,            // physical-spring inertia feel
        invalidateOnRefresh: true,
        onEnter()     {
          document.body.classList.add("scroll-anim-active");
          pauseVinylCSS();
          if (!soundPlayed) { playNeedleDrop(); soundPlayed = true; }
        },
        onLeave()     { document.body.classList.remove("scroll-anim-active"); resumeVinylCSS(); },
        onLeaveBack() { document.body.classList.remove("scroll-anim-active"); resumeVinylCSS(); },
        onEnterBack() { document.body.classList.add("scroll-anim-active"); pauseVinylCSS(); },
      },
    });

    // ── Phase 1 (0→15%): hero chrome exits ──
    tl.to([heroCopy, ctaRow, hint], { opacity: 0, y: -14, duration: 0.15, stagger: 0.02, ease: "power1.in" }, 0);
    tl.to(stickers,                 { opacity: 0, scale: 0.85, duration: 0.12, stagger: 0.02, ease: "power1.in" }, 0);
    tl.to([marquee, brand],         { opacity: 0, duration: 0.10 }, 0);

    // ── Phase 2 (5→80%): vinyl blooms to viewport center ──
    tl.to(vinylWrap, { x: dx, y: dy, scale: 3.5, ease: "power2.inOut", duration: 0.75, force3D: true }, 0.05);

    // ── Phase 3 (70→95%): vinyl fades as about sweeps in from below ──
    // The about section is already sliding up naturally via CSS scroll at this point.
    tl.to(vinylWrap, { opacity: 0, duration: 0.25, ease: "power1.in" }, 0.70);
  }

  /* ─── needle-drop sound (Web Audio) ────────────────────── */
  function playNeedleDrop() {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const sr   = ctx.sampleRate;
      const buf  = ctx.createBuffer(1, Math.floor(sr * 0.14), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.8) * 0.40;
      }
      const src  = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      setTimeout(() => ctx.close(), 600);
    } catch (_) { /* AudioContext not available */ }
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
    initPlayBtn();
    initViewTabs();
    initScrollAnimation();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

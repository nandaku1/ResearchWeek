(() => {
  'use strict';

  // Hardcoded admin gate — NOT real authentication. Anyone who views this
  // file's source can read these values. See README "Admin access" section.
  const ADMIN_USERNAME = 'admin1234';
  const ADMIN_PASSWORD = 'SJt=/8k8ac3[';

  // Short label shown on each card's compact theme pill and the filter chips —
  // an abbreviation of the real pillar name below, not a colour reference.
  const THEME_SHORT = {
    gold: 'Strategy',
    plum: 'Inclusion',
    teal: 'Integrity',
    lightblue: 'Collaboration',
    coral: 'Recognition',
  };
  // Full pillar names — shown in the admin form's Theme dropdown, the "Theme"
  // key under the filter bar, and as each pill's tooltip/accessible name.
  const THEME_LABELS = {
    gold: 'Strategy',
    plum: 'Sustaining a Supportive and Inclusive Environment',
    teal: 'Ensuring the Integrity of our Research',
    lightblue: 'Enabling Research Opportunities through Collaboration and Innovation',
    coral: 'Recognising and Developing our Research Community',
  };
  const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday'];
  const SLOT_ORDER = ['Session One', 'Session Two', 'Lunchtime Session', 'Session Three', 'Session Four'];
  const DRAFT_KEY = 'rcw-admin-draft-v1';
  const SESSION_KEY = 'rcw-admin';

  let events = [];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const cardGrid = $('#card-grid');
  const emptyState = $('#empty-state');
  const resultsCount = $('#results-count');
  const cardTemplate = $('#card-template');

  const searchInput = $('#search-input');
  const daySelect = $('#day-select');
  const themeChecks = () => $$('.theme-filter input[type=checkbox]');

  const adminBar = $('#admin-bar');
  const loginDialog = $('#login-dialog');
  const loginForm = $('#login-form');
  const loginError = $('#login-error');
  const eventDialog = $('#event-dialog');
  const eventForm = $('#event-form');
  const libcalInput = $('#event-libcal');
  const toastRegion = $('#toast-region');

  // ---------------------------------------------------------------- //
  // Data load
  // ---------------------------------------------------------------- //

  async function loadEvents() {
    // Prefer the live events.json — on a real web host this always reflects
    // the latest published data. fetch() of a local file fails under
    // file:// (browsers block it), so fall back to the inline snapshot
    // baked into index.html for that case.
    try {
      const res = await fetch('events.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load events.json');
      return await res.json();
    } catch (err) {
      const inline = document.getElementById('events-data');
      if (!inline) throw err;
      return JSON.parse(inline.textContent);
    }
  }

  function sortEvents(list) {
    return [...list].sort((a, b) => {
      const d = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
      if (d !== 0) return d;
      return SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot);
    });
  }

  // ---------------------------------------------------------------- //
  // Rendering
  // ---------------------------------------------------------------- //

  function dayLabelShort(day) {
    return day ? day.charAt(0).toUpperCase() + day.slice(1) : '';
  }

  function setMetaRow(node, key, value) {
    const row = $(`.event-card__meta-row--${key}`, node);
    if (!value) {
      row.hidden = true;
      return;
    }
    row.hidden = false;
    $('.event-card__meta-value', row).textContent = value;
  }

  function renderCards() {
    cardGrid.innerHTML = '';
    const sorted = sortEvents(events);

    sorted.forEach((ev, i) => {
      const node = cardTemplate.content.firstElementChild.cloneNode(true);
      node.dataset.id = ev.id;
      node.style.setProperty('--i', i);

      $('.event-card__day', node).textContent = dayLabelShort(ev.day);
      $('.event-card__time-value', node).textContent = ev.time;
      $('.event-card__title', node).textContent = ev.title;

      setMetaRow(node, 'chair', ev.chair);
      setMetaRow(node, 'speakers', ev.speakers);
      setMetaRow(node, 'location', ev.location);

      const link = $('a.btn-register', node);
      const disabledBtn = $('button.btn-register', node);
      if (ev.libcalUrl) {
        link.href = ev.libcalUrl;
        link.textContent = 'Register';
        link.setAttribute('aria-label', `Register for ${ev.title} (opens in new tab)`);
        link.hidden = false;
        disabledBtn.hidden = true;
      } else {
        link.hidden = true;
        link.removeAttribute('href');
        disabledBtn.hidden = false;
        disabledBtn.textContent = 'Registration opening soon';
      }

      const themeContainer = $('.event-card__theme', node);
      themeContainer.innerHTML = '';
      (ev.themes || []).forEach((themeKey) => {
        const fullName = THEME_LABELS[themeKey] || themeKey;
        const pill = document.createElement('span');
        pill.className = 'theme-pill';
        pill.dataset.theme = themeKey;
        pill.textContent = THEME_SHORT[themeKey] || themeKey;
        pill.title = fullName;
        pill.setAttribute('aria-label', `Theme: ${fullName}`);
        themeContainer.appendChild(pill);
      });

      $('[data-action="edit"]', node).addEventListener('click', () => openEventDialog(ev.id));
      $('[data-action="delete"]', node).addEventListener('click', () => deleteEvent(ev.id));

      cardGrid.appendChild(node);
    });

    applyFilters();
  }

  // ---------------------------------------------------------------- //
  // Filtering
  // ---------------------------------------------------------------- //

  function currentFilters() {
    return {
      search: searchInput.value.trim().toLowerCase(),
      day: daySelect.value,
      themes: themeChecks().filter((c) => c.checked).map((c) => c.value),
    };
  }

  function matchesFilter(ev, f) {
    if (f.day && ev.day !== f.day) return false;
    if (!(ev.themes || []).some((t) => f.themes.includes(t))) return false;
    if (f.search) {
      const haystack = [ev.title, ev.chair, ev.speakers, ev.location].join(' ').toLowerCase();
      if (!haystack.includes(f.search)) return false;
    }
    return true;
  }

  function applyFilters() {
    const f = currentFilters();
    let visibleCount = 0;

    $$('.event-card', cardGrid).forEach((node) => {
      const ev = events.find((e) => e.id === node.dataset.id);
      const shouldShow = Boolean(ev && matchesFilter(ev, f));

      if (shouldShow) {
        visibleCount += 1;
        if (!node.classList.contains('is-filtered-out')) return;
        node.classList.remove('is-filtered-out');
        node.classList.add('is-filter-fading');
        requestAnimationFrame(() => requestAnimationFrame(() => node.classList.remove('is-filter-fading')));
      } else {
        if (node.classList.contains('is-filtered-out')) return;
        node.classList.add('is-filter-fading');
        window.setTimeout(() => {
          node.classList.add('is-filtered-out');
          node.classList.remove('is-filter-fading');
        }, 220);
      }
    });

    resultsCount.textContent = `Showing ${visibleCount} of ${events.length} sessions`;
    emptyState.hidden = visibleCount !== 0;
  }

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  searchInput.addEventListener('input', debounce(applyFilters, 200));
  daySelect.addEventListener('change', applyFilters);
  themeChecks().forEach((c) => c.addEventListener('change', applyFilters));

  $('#clear-filters').addEventListener('click', () => {
    searchInput.value = '';
    daySelect.value = '';
    themeChecks().forEach((c) => { c.checked = true; });
    applyFilters();
    searchInput.focus();
  });

  // ---------------------------------------------------------------- //
  // Admin auth
  // ---------------------------------------------------------------- //

  function setAdminMode(on) {
    document.body.classList.toggle('is-admin', on);
    adminBar.hidden = !on;
    if (on) sessionStorage.setItem(SESSION_KEY, '1');
    else sessionStorage.removeItem(SESSION_KEY);
  }

  function openLoginDialog() {
    loginError.textContent = '';
    loginForm.reset();
    loginDialog.showModal();
    $('#login-username').focus();
  }

  $('#admin-toggle').addEventListener('click', openLoginDialog);
  $('#admin-toggle-footer').addEventListener('click', openLoginDialog);

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = $('#login-username').value;
    const p = $('#login-password').value;
    if (u === ADMIN_USERNAME && p === ADMIN_PASSWORD) {
      setAdminMode(true);
      loginDialog.close();
      renderCards();
      maybeOfferDraftRestore();
    } else {
      loginError.textContent = 'Incorrect username or password.';
      $('#login-password').value = '';
      $('#login-password').focus();
    }
  });

  $('#logout-btn').addEventListener('click', () => {
    setAdminMode(false);
    renderCards();
  });

  $$('[data-close-dialog]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  });

  // ---------------------------------------------------------------- //
  // CRUD
  // ---------------------------------------------------------------- //

  function openEventDialog(id) {
    const ev = id ? events.find((e) => e.id === id) : null;
    $('#event-dialog-title').textContent = ev ? 'Edit event' : 'Add event';
    $('#event-id').value = ev ? ev.id : '';
    $('#event-day').value = ev ? ev.dayLabel : '';
    $('#event-slot').value = ev ? ev.slot : '';
    $('#event-time').value = ev ? ev.time : '';
    $('#event-title').value = ev ? ev.title : '';
    const selectedThemes = ev ? ev.themes || [] : [];
    $$('input[name="event-theme-checkbox"]').forEach((box) => {
      box.checked = selectedThemes.includes(box.value);
    });
    $('#event-theme-error').textContent = '';
    $('#event-chair').value = ev ? ev.chair : '';
    $('#event-speakers').value = ev ? ev.speakers : '';
    $('#event-location').value = ev ? ev.location : '';
    libcalInput.value = ev ? ev.libcalUrl || '' : '';
    libcalInput.setAttribute('aria-invalid', 'false');
    eventDialog.showModal();
    $('#event-day').focus();
  }

  $('#add-event-btn').addEventListener('click', () => openEventDialog(null));

  function dayKeyFromLabel(label) {
    const lower = label.toLowerCase();
    for (const key of DAY_ORDER) {
      if (lower.startsWith(key)) return key;
    }
    return (label.trim().split(/\s+/)[0] || label).toLowerCase();
  }

  function slugify(dayLabel, slot) {
    const base = `${dayLabel}-${slot}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '');
    let candidate = base || 'event';
    let n = 1;
    while (events.some((e) => e.id === candidate)) {
      n += 1;
      candidate = `${base}-${n}`;
    }
    return candidate;
  }

  function isValidLibcalUrl(url) {
    return !url || /^https:\/\//i.test(url);
  }

  eventForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!eventForm.reportValidity()) return;

    const selectedThemes = $$('input[name="event-theme-checkbox"]')
      .filter((box) => box.checked)
      .map((box) => box.value);
    if (selectedThemes.length === 0) {
      $('#event-theme-error').textContent = 'Select at least one theme.';
      $$('input[name="event-theme-checkbox"]')[0].focus();
      return;
    }
    $('#event-theme-error').textContent = '';

    const libcalUrl = libcalInput.value.trim();
    if (!isValidLibcalUrl(libcalUrl)) {
      libcalInput.setAttribute('aria-invalid', 'true');
      $('#libcal-helper').textContent = 'LibCal links must start with https://';
      $('#libcal-helper').classList.add('field__error');
      libcalInput.focus();
      return;
    }

    const id = $('#event-id').value;
    const dayLabel = $('#event-day').value.trim();
    const record = {
      id: id || slugify(dayLabel, $('#event-slot').value),
      day: dayKeyFromLabel(dayLabel),
      dayLabel,
      slot: $('#event-slot').value.trim(),
      time: $('#event-time').value.trim(),
      title: $('#event-title').value.trim(),
      themes: selectedThemes,
      chair: $('#event-chair').value.trim(),
      speakers: $('#event-speakers').value.trim(),
      location: $('#event-location').value.trim(),
      libcalUrl: libcalUrl || null,
    };

    if (id) {
      const idx = events.findIndex((ev) => ev.id === id);
      events[idx] = record;
    } else {
      events.push(record);
    }

    saveDraft();
    eventDialog.close();
    renderCards();
    showToast(id ? 'Event updated.' : 'Event added.');
  });

  function deleteEvent(id) {
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) return;
    const [removed] = events.splice(idx, 1);
    saveDraft();
    renderCards();
    showToast(`Deleted "${removed.title}".`, {
      actionLabel: 'Undo',
      onAction: () => {
        events.splice(idx, 0, removed);
        saveDraft();
        renderCards();
      },
    });
  }

  // ---------------------------------------------------------------- //
  // Draft persistence (localStorage backup while editing)
  // ---------------------------------------------------------------- //

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(events));
    } catch (err) {
      // Storage unavailable (private browsing, quota exceeded) — edits
      // still work for this tab, just without a refresh-safety net.
    }
  }

  function readDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function maybeOfferDraftRestore() {
    const draft = readDraft();
    if (!draft) return;
    const draftSame = JSON.stringify(sortEvents(draft)) === JSON.stringify(sortEvents(events));
    if (draftSame) return;
    showToast('Unsaved edits found from a previous session.', {
      actionLabel: 'Restore',
      onAction: () => {
        events = draft;
        renderCards();
      },
    });
  }

  // ---------------------------------------------------------------- //
  // Export
  // ---------------------------------------------------------------- //

  $('#download-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(sortEvents(events), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'events.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('events.json downloaded — replace it on your web host to publish these changes.');
  });

  // ---------------------------------------------------------------- //
  // Toasts
  // ---------------------------------------------------------------- //

  function showToast(message, opts = {}) {
    const toast = document.createElement('div');
    toast.className = 'toast' + (opts.error ? ' toast--error' : '');
    toast.setAttribute('role', opts.error ? 'alert' : 'status');

    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    let dismiss;
    if (opts.onAction) {
      const btn = document.createElement('button');
      btn.className = 'toast__undo';
      btn.type = 'button';
      btn.textContent = opts.actionLabel || 'Undo';
      btn.addEventListener('click', () => {
        opts.onAction();
        dismiss();
      });
      toast.appendChild(btn);
    }

    toastRegion.appendChild(toast);
    const dismissDelay = opts.onAction ? 8000 : 4500;
    const timer = setTimeout(() => dismiss(), dismissDelay);
    dismiss = () => {
      clearTimeout(timer);
      toast.classList.add('is-leaving');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };
  }

  // ---------------------------------------------------------------- //
  // Init
  // ---------------------------------------------------------------- //

  async function init() {
    try {
      events = sortEvents(await loadEvents());
    } catch (err) {
      const p = document.createElement('p');
      p.textContent = "Could not load the programme data. Both events.json and the inline fallback failed — check that events.json is valid JSON and that the #events-data script tag in index.html hasn't been removed or corrupted (see README).";
      p.style.padding = '2rem';
      cardGrid.replaceWith(p);
      return;
    }
    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      setAdminMode(true);
    }
    renderCards();
    // Mark the results count as a live region only *after* the initial
    // render — setting aria-live in the static HTML meant the very first
    // "Showing 20 of 20 sessions" text-set on page load was itself
    // announced as a live-region update, jumping ahead of the screen
    // reader's normal top-to-bottom reading of the intro text. Only actual
    // filter-triggered changes after this point should interrupt like that.
    resultsCount.setAttribute('aria-live', 'polite');
  }

  init();
})();

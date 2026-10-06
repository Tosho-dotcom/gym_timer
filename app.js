(() => {
  'use strict';

  const STORAGE_KEY = 'gymtimer.v1';
  const FIXED_PRESETS = [90, 120, 180];
  const WARNING_SECONDS = 5;
  const END_HOLD_MS = 1200;
  const WHEEL_ITEM_H = 52;
  const MAX_MINUTES = 20;
  const SECOND_STEP = 5;
  const RING_LENGTH = 2 * Math.PI * 54;

  const $ = (id) => document.getElementById(id);
  const el = {
    workout: document.querySelector('.workout'),
    workoutTime: $('workoutTime'),
    btnStart: $('btnStart'),
    btnPause: $('btnPause'),
    btnEnd: $('btnEnd'),
    endHint: $('endHint'),
    rest: $('rest'),
    restSelect: $('restSelect'),
    restRun: $('restRun'),
    presetGrid: $('presetGrid'),
    btnCustom: $('btnCustom'),
    restTime: $('restTime'),
    ringProgress: $('ringProgress'),
    btnPlus: $('btnPlus'),
    btnSkip: $('btnSkip'),
    sheet: $('sheet'),
    wheelMin: $('wheelMin'),
    wheelSec: $('wheelSec'),
    btnSheetStart: $('btnSheetStart'),
    btnSheetSave: $('btnSheetSave'),
    btnSheetRemove: $('btnSheetRemove'),
    summary: $('summary'),
    summaryTime: $('summaryTime'),
  };

  // ---------- Stanje ----------
  const defaults = () => ({
    workout: { status: 'idle', startTs: 0, acc: 0 }, // idle | running | paused
    rest: null,                                      // { endAt, total } (ms)
    custom: null,                                    // sekunde ili null
  });

  let state = load();

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.workout) return Object.assign(defaults(), saved);
    } catch (e) { /* localStorage nedostupan ili neispravan */ }
    return defaults();
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignoriraj */ }
  }

  // ---------- Pomoćne funkcije ----------
  const pad = (n) => String(n).padStart(2, '0');

  function fmtLong(ms) {
    const s = Math.floor(ms / 1000);
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }

  function fmtShort(totalSec) {
    return `${Math.floor(totalSec / 60)}:${pad(totalSec % 60)}`;
  }

  function fmtPreset(totalSec) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return s ? `${m}:${pad(s)}` : `${m}:00`;
  }

  function workoutElapsed(now = Date.now()) {
    const w = state.workout;
    return w.acc + (w.status === 'running' ? now - w.startTs : 0);
  }

  // ---------- Wake Lock (ekran ostaje upaljen) ----------
  let wakeLock = null;

  function wantsAwake() {
    return state.workout.status === 'running' || state.rest !== null;
  }

  async function syncWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      if (wantsAwake() && document.visibilityState === 'visible') {
        if (!wakeLock) {
          wakeLock = await navigator.wakeLock.request('screen');
          wakeLock.addEventListener('release', () => { wakeLock = null; });
        }
      } else if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (e) { wakeLock = null; }
  }

  document.addEventListener('visibilitychange', () => { tick(); syncWakeLock(); });

  // ---------- Trening ----------
  function startWorkout() {
    state.workout = { status: 'running', startTs: Date.now(), acc: 0 };
    commit();
  }

  function togglePause() {
    const w = state.workout;
    if (w.status === 'running') {
      state.workout = { status: 'paused', startTs: 0, acc: workoutElapsed() };
    } else if (w.status === 'paused') {
      state.workout = { status: 'running', startTs: Date.now(), acc: w.acc };
    }
    commit();
  }

  function endWorkout() {
    const total = workoutElapsed();
    state.workout = { status: 'idle', startTs: 0, acc: 0 };
    state.rest = null;
    commit();
    el.summaryTime.textContent = fmtLong(total);
    el.summary.hidden = false;
  }

  // Dugi pritisak za kraj treninga
  let holdTimer = null;

  function holdStart(e) {
    e.preventDefault();
    el.btnEnd.classList.add('is-pressing');
    el.endHint.hidden = false;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      holdCancel();
      endWorkout();
    }, END_HOLD_MS);
  }

  function holdCancel() {
    clearTimeout(holdTimer);
    holdTimer = null;
    el.btnEnd.classList.remove('is-pressing');
    el.endHint.hidden = true;
  }

  // ---------- Pauza ----------
  function startRest(seconds) {
    if (!seconds || seconds < 1) return;
    const total = seconds * 1000;
    state.rest = { endAt: Date.now() + total, total };
    commit();
  }

  function stopRest() {
    state.rest = null;
    commit();
  }

  function addRestTime(seconds) {
    if (!state.rest) return;
    state.rest.endAt += seconds * 1000;
    state.rest.total += seconds * 1000;
    commit();
  }

  // ---------- Prikaz ----------
  function renderPresets() {
    el.presetGrid.textContent = '';

    FIXED_PRESETS.forEach((sec) => {
      el.presetGrid.appendChild(presetButton(sec));
    });

    if (state.custom) {
      const wrap = presetButton(state.custom);
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'preset-edit';
      edit.setAttribute('aria-label', 'Uredi spremljeno vrijeme');
      edit.textContent = '✎';
      edit.addEventListener('click', (e) => {
        e.stopPropagation();
        openSheet(state.custom, true);
      });
      wrap.appendChild(edit);
      el.presetGrid.appendChild(wrap);
    } else {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'preset preset-add';
      add.textContent = '+ Dodaj';
      add.addEventListener('click', () => openSheet(120, true));
      el.presetGrid.appendChild(add);
    }
  }

  function presetButton(sec) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.innerHTML = `${fmtPreset(sec)}<small>min</small>`;
    b.addEventListener('click', () => startRest(sec));
    return b;
  }

  function renderControls() {
    const w = state.workout;
    el.btnStart.hidden = w.status !== 'idle';
    el.btnPause.hidden = w.status === 'idle';
    el.btnEnd.hidden = w.status === 'idle';
    el.btnPause.textContent = w.status === 'paused' ? 'Nastavi' : 'Pauza';
    el.workout.classList.toggle('is-paused', w.status === 'paused');

    const running = state.rest !== null;
    el.rest.classList.toggle('is-running', running);
    el.restSelect.toggleAttribute('inert', running);
    el.restRun.toggleAttribute('inert', !running);
    el.restRun.setAttribute('aria-hidden', String(!running));
    if (!running) el.rest.classList.remove('is-warning');
  }

  function tick() {
    const now = Date.now();
    el.workoutTime.textContent = fmtLong(workoutElapsed(now));

    if (state.rest) {
      const left = state.rest.endAt - now;
      if (left <= 0) {
        stopRest();
        return;
      }
      const sec = Math.ceil(left / 1000);
      el.restTime.textContent = fmtShort(sec);
      el.ringProgress.style.strokeDashoffset = String(RING_LENGTH * (1 - left / state.rest.total));
      el.rest.classList.toggle('is-warning', sec <= WARNING_SECONDS);
    }
  }

  function commit() {
    save();
    renderControls();
    tick();
    syncWakeLock();
  }

  // ---------- Kotačići ----------
  function buildWheel(wheel, values, format) {
    wheel.textContent = '';
    const padTop = document.createElement('div');
    padTop.className = 'wheel-pad';
    wheel.appendChild(padTop);
    values.forEach((v) => {
      const item = document.createElement('div');
      item.className = 'wheel-item';
      item.dataset.value = String(v);
      item.textContent = format(v);
      wheel.appendChild(item);
    });
    const padBottom = padTop.cloneNode();
    wheel.appendChild(padBottom);

    let raf = 0;
    wheel.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => markActive(wheel));
    });
  }

  function wheelIndex(wheel) {
    return Math.round(wheel.scrollTop / WHEEL_ITEM_H);
  }

  function wheelValue(wheel) {
    const items = wheel.querySelectorAll('.wheel-item');
    const idx = Math.min(items.length - 1, Math.max(0, wheelIndex(wheel)));
    return Number(items[idx].dataset.value);
  }

  function markActive(wheel) {
    const items = wheel.querySelectorAll('.wheel-item');
    const idx = wheelIndex(wheel);
    items.forEach((it, i) => it.classList.toggle('is-active', i === idx));
  }

  function setWheel(wheel, value) {
    const items = [...wheel.querySelectorAll('.wheel-item')];
    let idx = items.findIndex((it) => Number(it.dataset.value) === value);
    if (idx < 0) idx = 0;
    wheel.scrollTop = idx * WHEEL_ITEM_H;
    markActive(wheel);
  }

  function sheetSeconds() {
    return wheelValue(el.wheelMin) * 60 + wheelValue(el.wheelSec);
  }

  let editingSaved = false;

  function openSheet(seconds, isEditing = false) {
    editingSaved = isEditing;
    el.btnSheetRemove.hidden = !(isEditing && state.custom);
    el.sheet.hidden = false;
    setWheel(el.wheelMin, Math.floor(seconds / 60));
    setWheel(el.wheelSec, seconds % 60);
  }

  function closeSheet() {
    el.sheet.hidden = true;
  }

  // ---------- Događaji ----------
  el.btnStart.addEventListener('click', startWorkout);
  el.btnPause.addEventListener('click', togglePause);

  el.btnEnd.addEventListener('pointerdown', holdStart);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => el.btnEnd.addEventListener(t, holdCancel));
  el.btnEnd.addEventListener('contextmenu', (e) => e.preventDefault());

  el.btnCustom.addEventListener('click', () => openSheet(state.custom || 120, false));
  el.btnPlus.addEventListener('click', () => addRestTime(15));
  el.btnSkip.addEventListener('click', stopRest);

  el.btnSheetStart.addEventListener('click', () => {
    const sec = sheetSeconds();
    if (sec < 1) return;
    closeSheet();
    startRest(sec);
  });

  el.btnSheetSave.addEventListener('click', () => {
    const sec = sheetSeconds();
    if (sec < 1) return;
    state.custom = sec;
    save();
    renderPresets();
    closeSheet();
  });

  el.btnSheetRemove.addEventListener('click', () => {
    state.custom = null;
    save();
    renderPresets();
    closeSheet();
  });

  el.sheet.querySelectorAll('[data-close]').forEach((n) => n.addEventListener('click', closeSheet));

  el.summary.addEventListener('click', () => { el.summary.hidden = true; });

  // ---------- Pokretanje ----------
  const minutes = Array.from({ length: MAX_MINUTES + 1 }, (_, i) => i);
  const seconds = Array.from({ length: 60 / SECOND_STEP }, (_, i) => i * SECOND_STEP);
  el.sheet.hidden = false; // kotačići se grade dok su vidljivi radi ispravnog scrolla
  buildWheel(el.wheelMin, minutes, String);
  buildWheel(el.wheelSec, seconds, pad);
  el.sheet.hidden = true;

  el.ringProgress.style.strokeDasharray = String(RING_LENGTH);
  renderPresets();
  renderControls();
  tick();
  syncWakeLock();
  setInterval(tick, 200);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* aplikacija radi i bez SW-a */ });
    });
  }
})();

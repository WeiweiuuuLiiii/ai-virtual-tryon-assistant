/* ── State ──────────────────────────────────────────────────── */
const state = {
  // Model
  model: null,
  modelPhotoFile: null,
  modelPhotoUrl: null,
  // Style profile (inside My Model's Style DNA section)
  profile: null,
  uploadedStylePhotos: [],
  // Studio
  studioItems: { top: null, bottom: null, dress: null, outerwear: null, shoes: null, bag: null },
  // Scene check
  sceneCheckScene: null,
  sceneCheckVibe: null,
  sceneWeather: null,
  // Buy check
  buyPhoto: null,
};

const API = '';

/* ── Boot ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupModelTab();
  setupStudio();
  setupSceneCheck();
  setupBuyCheck();
  await Promise.all([loadModel(), loadProfile()]);
});

/* ── Score Normalization ─────────────────────────────────────── */
function normalizeScore(v) {
  if (v == null) return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return null;
  return n > 10 ? Math.round(n / 10) : Math.round(n);
}
function fmtScore(v) {
  const n = normalizeScore(v);
  return n != null ? `${n}/10` : '—';
}

/* ── Tabs ───────────────────────────────────────────────────── */
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.remove('active');
        c.classList.add('hidden');
      });
      btn.classList.add('active');
      const section = document.getElementById(`tab-${btn.dataset.tab}`);
      section.classList.remove('hidden');
      section.classList.add('active');
    });
  });
}

/* ── Model: Load ────────────────────────────────────────────── */
async function loadModel() {
  try {
    const resp = await fetch(`${API}/api/model`);
    const data = await resp.json();
    if (data.exists) {
      state.model = data.model;
      renderModelCard(data.model, data.has_photo);
    }
  } catch (_) {}
}

async function loadProfile() {
  try {
    const resp = await fetch(`${API}/api/profile`);
    const data = await resp.json();
    if (data.exists) {
      state.profile = data.profile;
      renderStyleDNA(data.profile);
    }
  } catch (_) {}
}

/* ── Model Tab: Setup ───────────────────────────────────────── */
function setupModelTab() {
  const dropZone  = document.getElementById('model-drop-zone');
  const fileInput = document.getElementById('model-file-input');
  const browseBtn = document.getElementById('model-browse-btn');
  const analyzeBtn = document.getElementById('model-analyze-btn');
  const updateBtn  = document.getElementById('update-model-btn');
  const styleDNABtn = document.getElementById('style-dna-toggle-btn');

  browseBtn?.addEventListener('click', () => fileInput.click());
  dropZone?.addEventListener('click', e => {
    if (e.target !== browseBtn) fileInput.click();
  });
  dropZone?.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) setModelPhoto(file);
  });
  fileInput?.addEventListener('change', () => {
    if (fileInput.files[0]) setModelPhoto(fileInput.files[0]);
    fileInput.value = '';
  });

  analyzeBtn?.addEventListener('click', runModelAnalysis);
  updateBtn?.addEventListener('click', () => {
    document.getElementById('model-display').classList.add('hidden');
    document.getElementById('model-empty').classList.remove('hidden');
    state.modelPhotoFile = null;
    document.getElementById('model-preview-wrap').classList.add('hidden');
    document.getElementById('model-upload-prompt').classList.remove('hidden');
    document.getElementById('model-measurements-form').classList.add('hidden');
    analyzeBtn.disabled = true;
  });

  styleDNABtn?.addEventListener('click', () => {
    const details = document.getElementById('style-dna-details');
    details.open = !details.open;
  });

  // Style DNA photo upload
  setupStyleDNAUpload();
}

function setModelPhoto(file) {
  if (state.modelPhotoUrl) URL.revokeObjectURL(state.modelPhotoUrl);
  state.modelPhotoFile = file;
  state.modelPhotoUrl = URL.createObjectURL(file);

  document.getElementById('model-preview-img').src = state.modelPhotoUrl;
  document.getElementById('model-preview-wrap').classList.remove('hidden');
  document.getElementById('model-upload-prompt').classList.add('hidden');
  document.getElementById('model-measurements-form').classList.remove('hidden');
  document.getElementById('model-analyze-btn').disabled = false;
}

async function runModelAnalysis() {
  if (!state.modelPhotoFile) return;

  const btn = document.getElementById('model-analyze-btn');
  const loadingEl = document.getElementById('model-loading');
  btn.disabled = true;
  loadingEl.classList.remove('hidden');
  document.getElementById('model-measurements-form').classList.add('hidden');

  try {
    const form = new FormData();
    form.append('photo', state.modelPhotoFile);

    const measurements = collectMeasurements();
    if (Object.keys(measurements).length > 0) {
      form.append('measurements', JSON.stringify(measurements));
    }

    const resp = await fetch(`${API}/api/model`, { method: 'POST', body: form });
    if (!resp.ok) await apiError(resp);

    const modelData = await resp.json();
    state.model = modelData;
    renderModelCard(modelData, true);
    showToast('Model built — every outfit check is now calibrated to your frame.');
  } catch (err) {
    showToast('Analysis failed: ' + err.message, true);
    document.getElementById('model-measurements-form').classList.remove('hidden');
  } finally {
    btn.disabled = false;
    loadingEl.classList.add('hidden');
  }
}

function collectMeasurements() {
  const m = {};
  const height = document.getElementById('meas-height')?.value;
  const chest  = document.getElementById('meas-chest')?.value;
  const waist  = document.getElementById('meas-waist')?.value;
  const hips   = document.getElementById('meas-hips')?.value;
  if (height) m.height_cm = parseInt(height);
  if (chest)  m.chest_cm  = parseInt(chest);
  if (waist)  m.waist_cm  = parseInt(waist);
  if (hips)   m.hips_cm   = parseInt(hips);
  return m;
}

function renderModelCard(model, hasPhoto) {
  document.getElementById('model-empty').classList.add('hidden');
  document.getElementById('model-display').classList.remove('hidden');

  // Updated label
  if (model.updated_at) {
    const d = new Date(model.updated_at);
    document.getElementById('model-updated-label').textContent =
      `Updated ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  }

  // Model photo
  if (hasPhoto) {
    document.getElementById('model-card-img').src = `/api/model/photo?t=${Date.now()}`;
  }

  // Shape badge
  const shape = model.body_shape || '';
  document.getElementById('model-shape-badge').textContent =
    shape.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  document.getElementById('model-shape-desc').textContent = model.shape_description || '';
  document.getElementById('model-key-proportions').textContent = model.key_proportions || '';

  // Best silhouettes
  renderTags('model-best-silhouettes', model.best_silhouettes || [], true);
  renderTags('model-avoid-silhouettes', model.avoid_silhouettes || [], false, 'danger');

  // Style tips list
  const tipsList = document.getElementById('model-tips-list');
  tipsList.innerHTML = '';
  (model.style_tips || []).forEach(tip => {
    const li = document.createElement('li');
    li.textContent = tip;
    tipsList.appendChild(li);
  });

  // Measurements
  const measurements = model.measurements;
  const measSection = document.getElementById('model-measurements-display');
  const measChips = document.getElementById('model-meas-chips');
  if (measurements && Object.keys(measurements).length > 0) {
    measChips.innerHTML = '';
    const labels = { height_cm: 'Height', chest_cm: 'Chest', waist_cm: 'Waist', hips_cm: 'Hips' };
    Object.entries(measurements).forEach(([key, val]) => {
      const chip = document.createElement('span');
      chip.className = 'meas-chip';
      chip.innerHTML = `<strong>${labels[key] || key}</strong> ${val} cm`;
      measChips.appendChild(chip);
    });
    measSection.classList.remove('hidden');
  }

  // Update studio model preview
  updateStudioModelPreview(hasPhoto, shape);
}

function updateStudioModelPreview(hasPhoto, shape) {
  const placeholder = document.getElementById('studio-model-placeholder');
  const img = document.getElementById('studio-model-img');
  const shapeEl = document.getElementById('studio-model-shape');

  if (hasPhoto) {
    img.src = `/api/model/photo?t=${Date.now()}`;
    img.classList.remove('hidden');
    placeholder?.classList.add('hidden');
  }
  if (shape && shapeEl) {
    shapeEl.innerHTML = `<span class="model-shape-badge">${shape.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>`;
    shapeEl.classList.remove('hidden');
  }
}

/* ── Style DNA (inside My Model) ────────────────────────────── */
function setupStyleDNAUpload() {
  const dropZone   = document.getElementById('style-photos-drop-zone');
  const fileInput  = document.getElementById('style-file-input');
  const browseBtn  = document.getElementById('style-browse-btn');
  const previewGrid = document.getElementById('style-preview-grid');
  const actionsEl  = document.getElementById('style-actions');
  const countLabel = document.getElementById('style-count-label');
  const analyzeBtn = document.getElementById('style-analyze-btn');
  const refreshBtn = document.getElementById('refresh-style-btn');

  browseBtn?.addEventListener('click', () => fileInput?.click());
  dropZone?.addEventListener('click', e => {
    if (e.target !== browseBtn) fileInput?.click();
  });
  dropZone?.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone?.addEventListener('dragleave', () => dropZone?.classList.remove('drag-over'));
  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone?.classList.remove('drag-over');
    addStyleFiles(Array.from(e.dataTransfer.files));
  });
  fileInput?.addEventListener('change', () => {
    addStyleFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });
  analyzeBtn?.addEventListener('click', runStyleAnalysis);
  refreshBtn?.addEventListener('click', () => {
    document.getElementById('style-dna-display').classList.add('hidden');
    document.getElementById('style-dna-empty').classList.remove('hidden');
    state.uploadedStylePhotos = [];
    if (previewGrid) { previewGrid.innerHTML = ''; previewGrid.classList.add('hidden'); }
    if (actionsEl) actionsEl.classList.add('hidden');
  });

  function addStyleFiles(files) {
    files = files.filter(f => f.type.startsWith('image/')).slice(0, 50 - state.uploadedStylePhotos.length);
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      state.uploadedStylePhotos.push({ file, url });
      const item = document.createElement('div');
      item.className = 'preview-item';
      item.innerHTML = `<img src="${url}" alt="" /><button class="preview-remove" title="Remove">✕</button>`;
      item.querySelector('.preview-remove').addEventListener('click', e => {
        e.stopPropagation();
        const idx = [...previewGrid.children].indexOf(item);
        URL.revokeObjectURL(state.uploadedStylePhotos[idx].url);
        state.uploadedStylePhotos.splice(idx, 1);
        item.remove();
        updateStyleCount();
      });
      previewGrid?.appendChild(item);
    });
    updateStyleCount();
  }

  function updateStyleCount() {
    const n = state.uploadedStylePhotos.length;
    if (n === 0) {
      previewGrid?.classList.add('hidden');
      actionsEl?.classList.add('hidden');
    } else {
      previewGrid?.classList.remove('hidden');
      actionsEl?.classList.remove('hidden');
      if (countLabel) countLabel.textContent = `${n} photo${n !== 1 ? 's' : ''} selected`;
    }
  }
}

async function runStyleAnalysis() {
  if (state.uploadedStylePhotos.length === 0) return;

  const btn = document.getElementById('style-analyze-btn');
  const loadingEl = document.getElementById('style-loading');
  btn.disabled = true;
  loadingEl.classList.remove('hidden');

  try {
    const form = new FormData();
    state.uploadedStylePhotos.forEach(({ file }) => form.append('photos', file));

    const resp = await fetch(`${API}/api/analyze-style`, { method: 'POST', body: form });
    if (!resp.ok) await apiError(resp);

    const profile = await resp.json();
    state.profile = profile;
    renderStyleDNA(profile);
    showToast('Style DNA built — your aesthetic is now on record.');
  } catch (err) {
    showToast('Analysis failed: ' + err.message, true);
  } finally {
    btn.disabled = false;
    loadingEl.classList.add('hidden');
  }
}

function renderStyleDNA(p) {
  document.getElementById('style-dna-empty').classList.add('hidden');
  document.getElementById('style-dna-display').classList.remove('hidden');

  renderTags('dominant-style-tags', p.dominant_styles || [], true);
  renderTags('secondary-style-tags', p.secondary_styles || []);
  renderTags('color-family-tags', p.color_families || (p.color_palette || {}).color_families || []);
  renderTags('vibe-tags', p.overall_vibe_keywords || []);

  const summary = p.overall_summary || '';
  const firstSentence = summary.split(/\.\s/)[0];
  document.getElementById('dna-summary-line').textContent = firstSentence ? firstSentence + '.' : '';

  const palette = p.color_palette || {};
  const swatchEl = document.getElementById('color-swatches');
  swatchEl.innerHTML = '';
  (palette.specific_colors || []).slice(0, 8).forEach(color => {
    const s = document.createElement('div');
    s.className = 'swatch';
    s.dataset.color = color;
    s.style.background = colorNameToHex(color);
    s.title = color;
    swatchEl.appendChild(s);
  });
}

/* ── Try-On Studio ──────────────────────────────────────────── */
function setupStudio() {
  document.querySelectorAll('.item-slot').forEach(slot => {
    const slotName = slot.dataset.slot;
    const fileInput = slot.querySelector('.slot-file-input');
    const removeBtn = slot.querySelector('.slot-remove');

    slot.addEventListener('click', e => {
      if (e.target === removeBtn) return;
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) setSlotPhoto(slot, slotName, fileInput.files[0]);
      fileInput.value = '';
    });

    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      clearSlot(slot, slotName);
    });
  });

  document.getElementById('try-on-btn')?.addEventListener('click', runTryOn);
}

function setSlotPhoto(slot, slotName, file) {
  if (state.studioItems[slotName]?.url) URL.revokeObjectURL(state.studioItems[slotName].url);
  const url = URL.createObjectURL(file);
  state.studioItems[slotName] = { file, url };

  const placeholder = slot.querySelector('.slot-placeholder');
  const preview = slot.querySelector('.slot-preview');
  const img = slot.querySelector('.slot-img');

  img.src = url;
  placeholder.classList.add('hidden');
  preview.classList.remove('hidden');
  slot.classList.add('has-photo');

  updateTryOnBtn();
}

function clearSlot(slot, slotName) {
  if (state.studioItems[slotName]?.url) URL.revokeObjectURL(state.studioItems[slotName].url);
  state.studioItems[slotName] = null;

  slot.querySelector('.slot-placeholder').classList.remove('hidden');
  slot.querySelector('.slot-preview').classList.add('hidden');
  slot.classList.remove('has-photo');
  updateTryOnBtn();
}

function updateTryOnBtn() {
  const hasAny = Object.values(state.studioItems).some(v => v != null);
  document.getElementById('try-on-btn').disabled = !hasAny;
}

async function runTryOn() {
  const btn = document.getElementById('try-on-btn');
  const loadingEl = document.getElementById('studio-loading');
  btn.disabled = true;
  loadingEl.classList.remove('hidden');
  document.getElementById('studio-result').classList.add('hidden');
  document.getElementById('studio-empty-state').classList.add('hidden');

  try {
    const form = new FormData();
    Object.entries(state.studioItems).forEach(([slot, item]) => {
      if (item) form.append(slot, item.file);
    });

    const resp = await fetch(`${API}/api/try-on-studio`, { method: 'POST', body: form });
    if (!resp.ok) await apiError(resp);
    const result = await resp.json();
    renderTryOnResult(result);
  } catch (err) {
    showToast('Analysis failed: ' + err.message, true);
    document.getElementById('studio-empty-state').classList.remove('hidden');
  } finally {
    btn.disabled = false;
    loadingEl.classList.add('hidden');
    updateTryOnBtn();
  }
}

function renderTryOnResult(r) {
  const verdict = (r.verdict || 'adjust').toLowerCase();
  const badge = document.getElementById('tryon-verdict-badge');
  badge.className = `tryon-verdict-badge verdict-${verdict}`;
  badge.textContent = verdict === 'works' ? 'Works' : verdict === 'clash' ? 'Clash' : 'Adjust';

  document.getElementById('tryon-vibe').textContent = r.overall_vibe || '';

  const score = normalizeScore(r.combination_score);
  document.getElementById('tryon-combo-score').textContent = score != null ? `${score}/10` : '—';

  const colorClass = harmonyClass(r.color_harmony);
  const fitClass   = harmonyClass(r.fit_harmony);
  const colorEl = document.getElementById('tryon-color-harmony');
  const fitEl   = document.getElementById('tryon-fit-harmony');
  colorEl.textContent = r.color_harmony || '—';
  colorEl.className = `score-num ${colorClass}`;
  fitEl.textContent = r.fit_harmony || '—';
  fitEl.className = `score-num ${fitClass}`;

  const notesList = document.getElementById('tryon-notes');
  notesList.innerHTML = '';
  (r.try_on_notes || []).slice(0, 4).forEach(note => {
    const li = document.createElement('li');
    li.textContent = note;
    notesList.appendChild(li);
  });

  const tweaksCard = document.getElementById('tryon-tweaks-card');
  const tweaksList = document.getElementById('tryon-tweaks');
  tweaksList.innerHTML = '';
  const tweaks = r.suggested_tweaks || [];
  tweaks.forEach(tweak => {
    const li = document.createElement('li');
    li.textContent = tweak;
    tweaksList.appendChild(li);
  });
  tweaksCard.classList.toggle('hidden', tweaks.length === 0);

  document.getElementById('studio-result').classList.remove('hidden');
}

function harmonyClass(val) {
  if (!val) return '';
  const v = val.toLowerCase();
  if (v.includes('great')) return 'harmony-great';
  if (v.includes('clashes') || v.includes('clash')) return 'harmony-clash';
  return 'harmony-good';
}

/* ── Scene Check ─────────────────────────────────────────────── */
function setupSceneCheck() {
  document.querySelectorAll('#scene-check-cards .scene-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('#scene-check-cards .scene-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.sceneCheckScene = card.dataset.value;
    });
  });

  document.querySelectorAll('#scene-vibe-chips .vibe-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const wasActive = chip.classList.contains('active');
      document.querySelectorAll('#scene-vibe-chips .vibe-chip').forEach(c => c.classList.remove('active'));
      if (!wasActive) {
        chip.classList.add('active');
        state.sceneCheckVibe = chip.dataset.value;
      } else {
        state.sceneCheckVibe = null;
      }
    });
  });

  const locationInput = document.getElementById('scene-location-input');
  locationInput?.addEventListener('blur', async () => {
    const loc = locationInput.value.trim();
    if (loc) await fetchSceneWeather(loc);
  });
  locationInput?.addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const loc = locationInput.value.trim();
      if (loc) await fetchSceneWeather(loc);
    }
  });

  document.getElementById('scene-check-btn')?.addEventListener('click', runSceneCheck);
}

async function fetchSceneWeather(location) {
  try {
    const resp = await fetch(`${API}/api/weather?location=${encodeURIComponent(location)}`);
    const w = await resp.json();
    state.sceneWeather = w;
    showSceneWeatherCard(w);
  } catch (_) {}
}

function showSceneWeatherCard(w) {
  const card = document.getElementById('scene-weather-card');
  card.classList.remove('hidden');
  const iconEl = document.getElementById('scene-weather-icon');
  iconEl.src = w.icon ? `https://openweathermap.org/img/wn/${w.icon}@2x.png` : '';
  document.getElementById('scene-weather-temp').textContent = `${w.temp}°C`;
  document.getElementById('scene-weather-desc').textContent = w.description || '';
  document.getElementById('scene-weather-feels').textContent = `Feels like ${w.feels_like}°C`;
  document.getElementById('scene-weather-wind').textContent = `Wind ${w.wind_speed} km/h`;
  document.getElementById('scene-weather-rain').textContent = `Rain ${w.rain_chance}%`;
  const mockBadge = document.getElementById('scene-weather-mock-badge');
  if (w.is_mock) mockBadge.classList.remove('hidden');
  else mockBadge.classList.add('hidden');
}

async function runSceneCheck() {
  const outfitDesc = document.getElementById('scene-outfit-desc')?.value.trim();
  if (!outfitDesc) { showToast('Describe what you\'re wearing first', true); return; }
  if (!state.sceneCheckScene) { showToast('Pick a scene first', true); return; }

  const btn = document.getElementById('scene-check-btn');
  const loadingEl = document.getElementById('scene-loading');
  btn.disabled = true;
  loadingEl.classList.remove('hidden');
  document.getElementById('scene-result').classList.add('hidden');
  document.getElementById('scene-empty-state').classList.add('hidden');

  try {
    const location = document.getElementById('scene-location-input')?.value.trim() || 'New York';
    const body = {
      outfit_description: outfitDesc,
      scene: state.sceneCheckScene,
      vibe: state.sceneCheckVibe,
      location,
    };
    const resp = await fetch(`${API}/api/scene-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) await apiError(resp);
    const result = await resp.json();
    renderSceneResult(result);
  } catch (err) {
    showToast('Check failed: ' + err.message, true);
    document.getElementById('scene-empty-state').classList.remove('hidden');
  } finally {
    btn.disabled = false;
    loadingEl.classList.add('hidden');
  }
}

function renderSceneResult(r) {
  // Context badges
  document.getElementById('scene-scene-badge').textContent =
    (state.sceneCheckScene || '').replace(/\b\w/g, c => c.toUpperCase());
  const w = r.weather;
  const weatherBadge = document.getElementById('scene-weather-badge');
  weatherBadge.textContent = w ? `${w.temp}°C · ${w.description}` : '';

  // Verdict badge
  const verdict = (r.scene_verdict || 'adjust').toLowerCase();
  const verdictBadge = document.getElementById('scene-verdict-badge');
  let verdictClass = 'scene-adjust';
  let verdictText = 'Adjust';
  if (verdict.includes('great')) { verdictClass = 'scene-great'; verdictText = 'Great Fit'; }
  else if (verdict.includes('not')) { verdictClass = 'scene-not-ideal'; verdictText = 'Not Ideal'; }
  verdictBadge.className = `scene-verdict-badge ${verdictClass}`;
  verdictBadge.textContent = verdictText;

  // Scores
  document.getElementById('scene-scene-score').textContent   = fmtScore(r.scene_fit_score);
  document.getElementById('scene-weather-score').textContent = fmtScore(r.weather_fit_score);
  document.getElementById('scene-style-score').textContent   = fmtScore(r.style_fit_score);

  // Short reasons
  const reasonsList = document.getElementById('scene-short-reasons');
  reasonsList.innerHTML = '';
  (r.short_reasons || []).slice(0, 3).forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    reasonsList.appendChild(li);
  });

  // Suggested swaps
  const swapsCard = document.getElementById('scene-swaps-card');
  const swapsEl = document.getElementById('scene-swaps');
  swapsEl.innerHTML = '';
  const swaps = r.suggested_swaps || [];
  if (swaps.length > 0) {
    swaps.forEach(swap => {
      const div = document.createElement('div');
      div.className = 'swap-item';
      if (typeof swap === 'string') {
        div.textContent = swap;
      } else {
        div.innerHTML = `<span class="swap-from">${swap.item || swap.from || ''}</span>
          <span class="swap-arrow">→</span>
          <span class="swap-to">${swap.swap || swap.to || ''}</span>`;
      }
      swapsEl.appendChild(div);
    });
    swapsCard.classList.remove('hidden');
  } else {
    swapsCard.classList.add('hidden');
  }

  // Overall notes
  const notesCard = document.getElementById('scene-notes-card');
  const notesEl = document.getElementById('scene-overall-notes');
  if (r.overall_notes) {
    notesEl.textContent = r.overall_notes;
    notesCard.classList.remove('hidden');
  } else {
    notesCard.classList.add('hidden');
  }

  document.getElementById('scene-result').classList.remove('hidden');
}

/* ── Buy Check ───────────────────────────────────────────────── */
function setupBuyCheck() {
  const dropZone  = document.getElementById('buy-drop-zone');
  const fileInput = document.getElementById('buy-file-input');
  const browseBtn = document.getElementById('buy-browse-btn');
  const analyzeBtn = document.getElementById('buy-analyze-btn');

  browseBtn?.addEventListener('click', () => fileInput.click());
  dropZone?.addEventListener('click', e => { if (e.target !== browseBtn) fileInput.click(); });

  dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) setItemPhoto(file);
  });

  fileInput?.addEventListener('change', () => {
    if (fileInput.files[0]) setItemPhoto(fileInput.files[0]);
    fileInput.value = '';
  });

  analyzeBtn?.addEventListener('click', runBuyCheck);
}

function setItemPhoto(file) {
  if (state.buyPhoto?.url) URL.revokeObjectURL(state.buyPhoto.url);
  const url = URL.createObjectURL(file);
  state.buyPhoto = { file, url };

  document.getElementById('buy-preview-img').src = url;
  document.getElementById('buy-preview-container').classList.remove('hidden');
  document.getElementById('buy-upload-prompt').classList.add('hidden');
  document.getElementById('buy-analyze-btn').disabled = false;
}

async function runBuyCheck() {
  if (!state.buyPhoto) return;

  const btn = document.getElementById('buy-analyze-btn');
  const loadingEl = document.getElementById('buy-loading');
  btn.disabled = true;
  loadingEl.classList.remove('hidden');
  document.getElementById('buy-result').classList.add('hidden');
  document.getElementById('buy-empty-state').classList.add('hidden');

  try {
    const form = new FormData();
    form.append('photo', state.buyPhoto.file);

    const resp = await fetch(`${API}/api/buy-check`, { method: 'POST', body: form });
    if (!resp.ok) await apiError(resp);
    const result = await resp.json();
    renderBuyResult(result);
  } catch (err) {
    showToast('Analysis failed: ' + err.message, true);
    document.getElementById('buy-empty-state').classList.remove('hidden');
  } finally {
    btn.disabled = false;
    loadingEl.classList.add('hidden');
  }
}

function renderBuyResult(r) {
  if (state.buyPhoto?.url) {
    document.getElementById('buy-result-img').src = state.buyPhoto.url;
    document.getElementById('buy-result-img-wrap').classList.remove('hidden');
  }

  document.getElementById('buy-main-reasoning').textContent = r.main_reasoning || '';

  const badge = document.getElementById('buy-verdict-badge');
  badge.className = `verdict-badge verdict-${r.verdict}`;
  badge.textContent = r.verdict.toUpperCase();
  document.getElementById('buy-verdict-headline').textContent = r.verdict_headline || '';

  const score = normalizeScore(r.fits_style_score) || 0;
  document.getElementById('buy-style-bar').style.width = `${score * 10}%`;
  document.getElementById('buy-style-score').textContent = `${score}/10`;

  renderTags('buy-best-scenes', r.best_scenes?.length ? r.best_scenes : (r.occasions || []));

  const avoidWrap = document.getElementById('buy-avoid-scenes-wrap');
  if (r.avoid_scenes?.length) {
    renderTags('buy-avoid-scenes', r.avoid_scenes, false, 'danger');
    avoidWrap.classList.remove('hidden');
  } else {
    avoidWrap.classList.add('hidden');
  }

  const shortList = document.getElementById('buy-short-reasons');
  shortList.innerHTML = '';
  const reasons = r.short_reasons?.length ? r.short_reasons : [r.main_reasoning].filter(Boolean);
  reasons.slice(0, 3).forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    shortList.appendChild(li);
  });

  const httCard = document.getElementById('buy-htt-card');
  const htt = r.head_to_toe_styling;
  if (htt) {
    const httGrid = document.getElementById('buy-htt-grid');
    httGrid.innerHTML = '';
    [
      { type: 'Top', val: htt.top }, { type: 'Bottom', val: htt.bottom },
      { type: 'Shoes', val: htt.shoes }, { type: 'Outerwear', val: htt.outerwear },
    ].forEach(({ type, val }) => {
      if (!val) return;
      const card = document.createElement('div');
      card.className = 'outfit-item-card';
      card.innerHTML = `<p class="outfit-item-type">${type}</p><p class="outfit-item-desc">${val}</p>`;
      httGrid.appendChild(card);
    });
    if (htt.accessories?.length) {
      const card = document.createElement('div');
      card.className = 'outfit-item-card';
      card.innerHTML = `<p class="outfit-item-type">Accessories</p><p class="outfit-item-desc">${htt.accessories.join(', ')}</p>`;
      httGrid.appendChild(card);
    }
    httCard.classList.toggle('hidden', httGrid.children.length === 0);
  } else {
    httCard.classList.add('hidden');
  }

  const wearBadge = document.getElementById('buy-wear-likelihood');
  wearBadge.textContent = r.wear_likelihood || '—';
  wearBadge.style.background = r.wear_likelihood === 'often' ? 'var(--success-bg)' :
                                r.wear_likelihood === 'rarely' ? 'var(--danger-bg)' : 'var(--warning-bg)';
  wearBadge.style.color = r.wear_likelihood === 'often' ? 'var(--success)' :
                           r.wear_likelihood === 'rarely' ? 'var(--danger)' : 'var(--warning)';

  document.getElementById('buy-repetitiveness').textContent = r.repetitiveness || '—';

  const concernsCard = document.getElementById('buy-concerns-card');
  const firstConcern = r.concerns?.[0] || null;
  if (firstConcern) {
    document.getElementById('buy-concern-text').textContent = firstConcern;
    concernsCard.classList.remove('hidden');
  } else {
    concernsCard.classList.add('hidden');
  }

  document.getElementById('buy-result').classList.remove('hidden');
}

/* ── Helpers ─────────────────────────────────────────────────── */

async function apiError(resp) {
  try {
    const data = await resp.json();
    throw new Error(data.message || `Server error ${resp.status}`);
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error(`Server error ${resp.status}`);
    throw e;
  }
}

function renderTags(containerId, items, accent = false, variant = null) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  (items || []).forEach(item => {
    const span = document.createElement('span');
    span.className = 'tag' + (accent ? ' accent' : '') + (variant ? ` tag-${variant}` : '');
    span.textContent = item;
    el.appendChild(span);
  });
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

let toastTimer;
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3500);
}

function colorNameToHex(name) {
  const n = name.toLowerCase().replace(/\s+/g, '');
  const map = {
    black: '#1A1A1A', white: '#F9F9F7', cream: '#F5F0E8', ivory: '#FFFFF0',
    beige: '#D4B896', camel: '#C19A6B', tan: '#D2B48C', khaki: '#C3B091',
    brown: '#795548', chocolate: '#3E1F00', navy: '#1B2A4A', navyblue: '#1B2A4A',
    blue: '#3B72B0', lightblue: '#ADD8E6', skyblue: '#87CEEB', cobalt: '#0047AB',
    denim: '#1560BD', indigo: '#4B0082', gray: '#9E9E9E', grey: '#9E9E9E',
    charcoal: '#374151', lightgray: '#D1D5DB', lightgrey: '#D1D5DB', silver: '#C0C0C0',
    offwhite: '#F8F6F0', red: '#E53E3E', burgundy: '#800020', wine: '#722F37',
    rust: '#B7410E', terracotta: '#E27D60', blush: '#F4A7B9', pink: '#F9A8D4',
    hotpink: '#FF69B4', mauve: '#C5A3A3', rose: '#FFB7C5', green: '#48BB78',
    forestgreen: '#228B22', sage: '#8FAF8F', olive: '#808000', mint: '#98D8C8',
    emerald: '#50C878', yellow: '#F6E05E', mustard: '#E1A820', gold: '#D4AF37',
    orange: '#ED8936', peach: '#FFDAB9', coral: '#FF7F6B', purple: '#805AD5',
    lavender: '#C4B5FD', lilac: '#C8A2C8', plum: '#8E4585', teal: '#319795',
    turquoise: '#40E0D0', cyan: '#00BCD4',
  };
  return map[n] || map[n.replace(/[^a-z]/g, '')] || '#C9A96E';
}

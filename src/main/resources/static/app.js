/* ── State ──────────────────────────────────────────────────── */
const state = {
  // Model
  model: null,
  modelPhotoFile: null,
  modelPhotoUrl: null,
  // Style profile (inside My Model's Style DNA section)
  profile: null,
  uploadedStylePhotos: [],
  // Studio — clothing asset library
  clothingAssets: [],       // [{ id, file, rawImageUrl, cleanAssetUrl, extractionStatus, detectedType, itemName, garmentDescription, garmentLayerReady, containsModel, cleanupNeeded, userTypeOverride, type }]
  slotAssignments: { top: null, bottom: null, dress: null, outerwear: null, shoes: null, bag: null, glasses: null, earrings: null, hair_accessory: null, scarf: null, necklace: null, bracelet: null, belt: null, hat: null, watch: null, tights: null, socks: null },
  draggedAssetId: null,
  outfitMode: 'top_bottom',         // 'top_bottom' | 'dress'
  hairAccessoryPlacement: 'auto',   // 'auto' | 'top_of_head' | 'left_side' | 'right_side' | 'back_bun' | 'forehead_headband'
  modelRevision: 0,                 // incremented whenever My Model photo or body_shape changes; included in tryOnCache key
  generationRequestId: 0,           // incremented each time generation starts; used for stale result protection
  activeAbortController: null,      // AbortController for the current in-flight generation fetch
  completeLookSuggestions: [],      // [{slot, name, reason}] returned by suggest-items
  completeLookLoading: false,
  completeLookError: null,          // non-null when suggestion fetch failed
  completeLookImageUrl: null,       // imageUrl that triggered the current suggestions (avoids refetch)
  addToLookInFlight: false,         // true while any single OR batch Add to Look request is running
  addToLookRequestId: 0,            // incremented per edit; stale-result guard (single + batch share this)
  addToLookActiveIdx: null,         // index of suggestion currently being added (null during batch)
  activeAddAbortController: null,   // AbortController for the current single or batch Add to Look fetch
  batchEditActive: false,           // true specifically during a batch edit (subset of addToLookInFlight)
  batchProgress: 0,                 // 0-100 for batch progress bar animation
  completeLookSelected: new Set(),  // Set of `${slot}::${name}` keys for batch selection
  completeLookHistory: [],          // slot::name keys recently shown; FIFO cap 30 (~10 refreshes)
  tryOnCache: new Map(),            // generation cache key → {status, mode, imageUrl, videoUrl}
  addToLookCache: new Map(),        // add-to-look cache key → result imageUrl (single + batch)
  // Studio — legacy (kept for API compatibility)
  studioItems: { top: null, bottom: null, dress: null, outerwear: null, shoes: null, bag: null, glasses: null, earrings: null, hair_accessory: null },
  studioScene:  null,
  studioVibe:   null,
  studioWeather: null,
  studioStep:   'build',
  // Try-On Preview (Issue #5)
  tryOnPreview: { status: 'idle', mode: null, imageUrl: null, videoUrl: null, message: null },
  // Provider capability matrix (Issue #7)
  tryOnProviders: null,
  selectedProviderId: null,
  // Scene check
  sceneCheckScene: null,
  sceneCheckVibe: null,
  sceneWeather: null,
  // Buy check
  buyPhoto: null,
  // Skin Tone Profile (Issue 23)
  skinTone: { depth: null, undertone: null, source: 'none' },
  // Color Fit Analysis (Issue 23)
  colorFitAnalysis: null,
  colorFitLoading: false,
  colorFitImageUrl: null,
  // Fit Preview (Issue 24)
  fitPreview: {
    size_up:   { imageUrl: null, loading: false, requestId: 0 },
    size_down: { imageUrl: null, loading: false, requestId: 0 },
  },
  fitPreviewBaseImageUrl: null,
  fitPreviewLastAdjustment: null,        // 'size_up' | 'size_down' | null
  fitPreviewController: { size_up: null, size_down: null },
  fitPreviewCache: new Map(),
  // Saved Looks (Issue 25)
  savedLooks: [],
  looksCompareSelected: new Set(),
  // Generation Plan (Issue 26)
  planItems: [],
  planFitShift: 'none',
  planScene: 'original',
  planStatus: 'idle',
  planResult: null,
  planCache: new Map(),
  planRequestId: 0,
  activePlanAbortController: null,
  // Full Outfit Reference (Issue 22)
  outfitRefFile: null,
  outfitRefUrl:  null,
  outfitRefAnalysis: null,  // [{slot, description}, ...] or null
  outfitRefAnalysisLoading: false,
};

const API = '';

/* ── Demo Guard ─────────────────────────────────────────────── */
const DEMO_CODE_KEY = 'stylesignal_demo_code';

function getDemoCode() {
  return localStorage.getItem(DEMO_CODE_KEY) || '';
}

function setDemoCode(code) {
  if (code) {
    localStorage.setItem(DEMO_CODE_KEY, code);
  } else {
    localStorage.removeItem(DEMO_CODE_KEY);
  }
}

function handleDemoLocked(message) {
  showToast(message || 'Enter a demo code to use this feature.', true);
  const panel = document.getElementById('demo-gate-panel');
  if (panel && panel.classList.contains('hidden')) {
    panel.classList.remove('hidden');
    document.getElementById('demo-code-input')?.focus();
  }
}

function setupDemoGate() {
  const toggleBtn  = document.getElementById('demo-gate-toggle');
  const panel      = document.getElementById('demo-gate-panel');
  const input      = document.getElementById('demo-code-input');
  const applyBtn   = document.getElementById('demo-code-apply');
  const clearBtn   = document.getElementById('demo-code-clear');
  const statusEl   = document.getElementById('demo-gate-status');
  const labelEl    = document.getElementById('demo-gate-label');

  if (!toggleBtn || !panel) return;

  // Restore persisted code on load
  const saved = getDemoCode();
  if (saved) {
    if (input) input.value = saved;
    if (labelEl) labelEl.textContent = 'Code ✓';
    toggleBtn.classList.add('demo-gate-active');
  }

  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) input?.focus();
  });

  // Close panel on click outside
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) {
      panel.classList.add('hidden');
    }
  });

  function applyCode() {
    const code = input?.value.trim() || '';
    setDemoCode(code);
    if (code) {
      if (statusEl) { statusEl.textContent = 'Code saved.'; statusEl.className = 'demo-gate-status ok'; }
      if (labelEl) labelEl.textContent = 'Code ✓';
      toggleBtn.classList.add('demo-gate-active');
    } else {
      if (statusEl) { statusEl.textContent = 'Code cleared.'; statusEl.className = 'demo-gate-status'; }
      if (labelEl) labelEl.textContent = 'Demo';
      toggleBtn.classList.remove('demo-gate-active');
    }
    setTimeout(() => panel.classList.add('hidden'), 800);
  }

  applyBtn?.addEventListener('click', applyCode);
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyCode(); });

  clearBtn?.addEventListener('click', () => {
    if (input) input.value = '';
    setDemoCode('');
    if (statusEl) { statusEl.textContent = 'Code cleared.'; statusEl.className = 'demo-gate-status'; }
    if (labelEl) labelEl.textContent = 'Demo';
    toggleBtn.classList.remove('demo-gate-active');
  });
}

/* ── Boot ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupLanding();
  setupDemoGate();
  setupModelTab();
  setupSkinTonePicker();
  setupFitPreview();
  setupStudio();
  setupOutfitRef();
  setupSceneCheck();
  setupBuyCheck();
  setupLooks();
  setupPlanSection();
  loadSavedLooks();
  await Promise.all([loadModel(), loadProfile(), loadTryOnProviders()]);
});

/* ── Mannequin SVG Generator ─────────────────────────────────── */
function generateMannequinSVG(bodyShape) {
  const cx = 60;

  // Body shape parameters: shoulder, bust, waist, hip half-widths from center
  const configs = {
    hourglass:         { sw: 24, bw: 22, ww: 13, hw: 24 },
    pear:              { sw: 18, bw: 19, ww: 16, hw: 27 },
    inverted_triangle: { sw: 28, bw: 25, ww: 18, hw: 19 },
    rectangle:         { sw: 20, bw: 19, ww: 18, hw: 20 },
    apple:             { sw: 21, bw: 24, ww: 23, hw: 22 },
  };
  const key = (bodyShape || 'rectangle').toLowerCase().replace(/[\s-]+/g, '_');
  const { sw, bw, ww, hw } = configs[key] || configs.rectangle;

  // Y landmarks (in viewBox units, 0 0 120 290)
  const headY = 22, headRX = 12, headRY = 15;
  const nY1 = 37, nY2 = 48;
  const shY = 55, buY = 92, waY = 128, hiY = 158, crY = 176, anY = 270;
  const midY = (crY + anY) / 2;

  // Smooth body outline using cubic bezier
  const body = [
    `M ${cx-sw} ${shY}`,
    `C ${cx-sw} ${shY+14} ${cx-bw} ${buY-8} ${cx-bw} ${buY}`,
    `C ${cx-bw} ${buY+18} ${cx-ww} ${waY-10} ${cx-ww} ${waY}`,
    `C ${cx-ww} ${waY+14} ${cx-hw} ${hiY-8} ${cx-hw} ${hiY}`,
    `L ${cx-hw} ${crY} L ${cx+hw} ${crY}`,
    `C ${cx+hw} ${hiY} ${cx+ww} ${waY+14} ${cx+ww} ${waY}`,
    `C ${cx+ww} ${waY-10} ${cx+bw} ${buY+18} ${cx+bw} ${buY}`,
    `C ${cx+bw} ${buY-8} ${cx+sw} ${shY+14} ${cx+sw} ${shY} Z`
  ].join(' ');

  // Neck
  const neck = `M ${cx-5} ${nY1} L ${cx-4} ${nY2} L ${cx+4} ${nY2} L ${cx+5} ${nY1} Z`;

  // Arms — angle outward, taper toward elbow
  const hang = Math.max(7, 15 - sw * 0.25);
  const armLen = 74, armW = 8;
  const lArm = `M ${cx-sw} ${shY} Q ${cx-sw-hang} ${shY+30} ${cx-sw-hang+1} ${shY+armLen} L ${cx-sw-hang+1+armW} ${shY+armLen} Q ${cx-sw-1} ${shY+24} ${cx-sw+2} ${shY} Z`;
  const rArm = `M ${cx+sw} ${shY} Q ${cx+sw+hang} ${shY+30} ${cx+sw+hang-1} ${shY+armLen} L ${cx+sw+hang-1-armW} ${shY+armLen} Q ${cx+sw+1} ${shY+24} ${cx+sw-2} ${shY} Z`;

  // Legs — taper from hip width to fixed ankle width
  const lgap = 3, lW = 9;
  const llCtr = cx - (hw + lgap) / 2;
  const rlCtr = cx + (hw + lgap) / 2;
  const lLeg = `M ${cx-hw} ${crY} Q ${cx-hw} ${midY} ${llCtr-lW} ${anY} L ${llCtr+lW} ${anY} Q ${cx-lgap} ${midY} ${cx-lgap} ${crY} Z`;
  const rLeg = `M ${cx+lgap} ${crY} Q ${cx+lgap} ${midY} ${rlCtr-lW} ${anY} L ${rlCtr+lW} ${anY} Q ${cx+hw} ${midY} ${cx+hw} ${crY} Z`;

  const gid = `mg_${key}`;
  return `<svg viewBox="0 0 120 285" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stop-color="#B0A291"/>
        <stop offset="35%"  stop-color="#C5B7A6"/>
        <stop offset="65%"  stop-color="#C5B7A6"/>
        <stop offset="100%" stop-color="#AC9D8C"/>
      </linearGradient>
    </defs>
    <path d="${lArm}"  fill="#BCAF9F" stroke="#9A8A77" stroke-width="0.55"/>
    <path d="${rArm}"  fill="#BCAF9F" stroke="#9A8A77" stroke-width="0.55"/>
    <path d="${body}"  fill="url(#${gid})" stroke="#9A8A77" stroke-width="0.55"/>
    <path d="${lLeg}"  fill="url(#${gid})" stroke="#9A8A77" stroke-width="0.55"/>
    <path d="${rLeg}"  fill="url(#${gid})" stroke="#9A8A77" stroke-width="0.55"/>
    <path d="${neck}"  fill="url(#${gid})" stroke="#9A8A77" stroke-width="0.55"/>
    <ellipse cx="${cx}" cy="${headY}" rx="${headRX}" ry="${headRY}" fill="url(#${gid})" stroke="#9A8A77" stroke-width="0.55"/>
  </svg>`;
}

/* ── Fit Model Mannequin Renderer ────────────────────────────── */
function renderFitModelMannequin(bodyShape, _measurements) {
  const el = document.getElementById('fit-mannequin-svg');
  if (!el) return;
  el.innerHTML = generateMannequinSVG(bodyShape);
}

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

/* ── Landing ─────────────────────────────────────────────────── */
function setupLanding() {
  const enterBtn = document.getElementById('landing-enter-btn');
  const outfitBtn = document.getElementById('landing-outfit-btn');

  if (enterBtn) {
    enterBtn.addEventListener('click', () => {
      document.querySelector('[data-tab="studio"]')?.click();
    });
  }

  if (outfitBtn) {
    outfitBtn.addEventListener('click', () => {
      document.querySelector('[data-tab="studio"]')?.click();
      setTimeout(() => document.getElementById('btn-add-outfit-ref')?.click(), 150);
    });
  }
}

/* ── Model: Load ────────────────────────────────────────────── */
async function loadModel() {
  try {
    const resp = await fetch(`${API}/api/model`);
    const data = await resp.json();
    if (data.exists) {
      state.model = data.model;
      renderModelCard(data.model, data.has_photo);
    } else {
      // Show no-model state in studio
      syncStudioModelColumn(null, false);
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
    state.skinTone        = { depth: null, undertone: null, source: 'none' };
    state.colorFitAnalysis = null;
    state.colorFitLoading  = false;
    state.colorFitImageUrl = null;
    document.getElementById('model-preview-wrap').classList.add('hidden');
    document.getElementById('model-upload-prompt').classList.remove('hidden');
    document.getElementById('model-measurements-form').classList.add('hidden');
    analyzeBtn.disabled = true;
  });

  styleDNABtn?.addEventListener('click', () => {
    const details = document.getElementById('style-dna-details');
    details.open = !details.open;
  });

  document.getElementById('save-measurements-btn')?.addEventListener('click', saveMeasurements);

  // Style DNA photo upload
  setupStyleDNAUpload();
}

function setModelPhoto(file) {
  if (state.modelPhotoUrl) URL.revokeObjectURL(state.modelPhotoUrl);
  state.modelPhotoFile = file;
  state.modelPhotoUrl = URL.createObjectURL(file);
  state.modelRevision++;     // new photo → cache keys change
  state.tryOnCache = new Map();

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
    state.modelRevision++;     // body_shape / model data updated → invalidate generation cache
    state.tryOnCache = new Map();
    state.skinTone        = { depth: null, undertone: null, source: 'none' };
    state.colorFitAnalysis = null;
    state.colorFitLoading  = false;
    state.colorFitImageUrl = null;
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
  const fields = [
    ['meas-height',   'height_cm',   parseInt],
    ['meas-weight',   'weight_kg',   parseInt],
    ['meas-chest',    'chest_cm',    parseInt],
    ['meas-waist',    'waist_cm',    parseInt],
    ['meas-hips',     'hips_cm',     parseInt],
    ['meas-shoulder', 'shoulder_cm', parseInt],
  ];
  fields.forEach(([id, key, parse]) => {
    const val = document.getElementById(id)?.value;
    if (val) m[key] = parse(val);
  });
  return m;
}

async function saveMeasurements() {
  const btn = document.getElementById('save-measurements-btn');
  const loading = document.getElementById('meas-save-loading');
  const success = document.getElementById('meas-save-success');
  btn.disabled = true;
  loading.classList.remove('hidden');
  success.classList.add('hidden');

  const fields = [
    ['edit-meas-height',   'height_cm',   parseInt],
    ['edit-meas-weight',   'weight_kg',   parseInt],
    ['edit-meas-chest',    'chest_cm',    parseInt],
    ['edit-meas-waist',    'waist_cm',    parseInt],
    ['edit-meas-hips',     'hips_cm',     parseInt],
    ['edit-meas-shoulder', 'shoulder_cm', parseInt],
  ];
  const m = {};
  fields.forEach(([id, key, parse]) => {
    const val = document.getElementById(id)?.value;
    if (val) m[key] = parse(val);
  });

  try {
    const resp = await fetch(`${API}/api/model/measurements`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(m),
    });
    if (!resp.ok) await apiError(resp);
    const updated = await resp.json();
    state.model = updated;
    // Refresh measurement chips in Full Analysis
    const measSection = document.getElementById('model-measurements-display');
    const measChips   = document.getElementById('model-meas-chips');
    if (measChips && Object.keys(m).length > 0) {
      measChips.innerHTML = '';
      const labels = { height_cm: 'Height', weight_kg: 'Weight', chest_cm: 'Bust', waist_cm: 'Waist', hips_cm: 'Hips', shoulder_cm: 'Shoulder' };
      Object.entries(m).forEach(([key, val]) => {
        const chip = document.createElement('span');
        chip.className = 'meas-chip';
        const unit = key === 'weight_kg' ? 'kg' : 'cm';
        chip.innerHTML = `<strong>${labels[key] || key}</strong> ${val} ${unit}`;
        measChips.appendChild(chip);
      });
      measSection?.classList.remove('hidden');
    }
    success.classList.remove('hidden');
    setTimeout(() => success.classList.add('hidden'), 2500);
  } catch (err) {
    showToast('Could not save measurements: ' + err.message, true);
  } finally {
    btn.disabled = false;
    loading.classList.add('hidden');
  }
}

function populateMeasurementEditFields(measurements) {
  if (!measurements) return;
  const map = {
    height_cm:   'edit-meas-height',
    weight_kg:   'edit-meas-weight',
    chest_cm:    'edit-meas-chest',
    waist_cm:    'edit-meas-waist',
    hips_cm:     'edit-meas-hips',
    shoulder_cm: 'edit-meas-shoulder',
  };
  Object.entries(map).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el && measurements[key] != null) el.value = measurements[key];
  });
}

function renderModelCard(model, hasPhoto) {
  document.getElementById('model-empty').classList.add('hidden');
  document.getElementById('model-display').classList.remove('hidden');

  if (model.updated_at) {
    const d = new Date(model.updated_at);
    document.getElementById('model-updated-label').textContent =
      `Updated ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  }

  // Reference photo (left panel)
  if (hasPhoto) {
    document.getElementById('model-card-img').src = `/api/model/photo?t=${Date.now()}`;
  }

  // Render SVG mannequin into the right panel
  const bodyShape = model.body_shape || 'rectangle';
  renderFitModelMannequin(bodyShape, model.measurements);

  // Shape badge
  const shape = bodyShape.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  document.getElementById('model-shape-badge').textContent = shape;

  // Proportion chips
  const propChips = document.getElementById('fit-proportion-chips');
  if (propChips) {
    propChips.innerHTML = '';
    (model.proportion_tags || []).forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'fit-proportion-chip';
      chip.textContent = tag;
      propChips.appendChild(chip);
    });
  }

  // Fit notes
  const notesList = document.getElementById('fit-notes-list');
  const notesSection = document.getElementById('fit-notes-section');
  if (notesList) {
    notesList.innerHTML = '';
    (model.fit_notes || []).forEach(note => {
      const li = document.createElement('li');
      li.textContent = note;
      notesList.appendChild(li);
    });
    notesSection?.classList.toggle('hidden', (model.fit_notes || []).length === 0);
  }

  // Key proportions summary line
  const kpEl = document.getElementById('model-key-proportions');
  if (kpEl) kpEl.textContent = model.key_proportions || '';

  // --- Collapsible detail section ---
  document.getElementById('model-shape-desc').textContent = model.shape_description || '';
  renderTags('model-best-silhouettes', model.best_silhouettes || [], true);
  renderTags('model-avoid-silhouettes', model.avoid_silhouettes || [], false, 'danger');

  const tipsList = document.getElementById('model-tips-list');
  if (tipsList) {
    tipsList.innerHTML = '';
    (model.style_tips || []).forEach(tip => {
      const li = document.createElement('li');
      li.textContent = tip;
      tipsList.appendChild(li);
    });
  }

  // Measurements chips (in Full Analysis collapsible)
  const measurements = model.measurements;
  const measSection = document.getElementById('model-measurements-display');
  const measChips = document.getElementById('model-meas-chips');
  if (measurements && Object.keys(measurements).length > 0 && measChips) {
    measChips.innerHTML = '';
    const labels = { height_cm: 'Height', weight_kg: 'Weight', chest_cm: 'Bust', waist_cm: 'Waist', hips_cm: 'Hips', shoulder_cm: 'Shoulder' };
    Object.entries(measurements).forEach(([key, val]) => {
      const chip = document.createElement('span');
      chip.className = 'meas-chip';
      const unit = key === 'weight_kg' ? 'kg' : 'cm';
      chip.innerHTML = `<strong>${labels[key] || key}</strong> ${val} ${unit}`;
      measChips.appendChild(chip);
    });
    measSection?.classList.remove('hidden');
  }

  // Pre-populate the edit panel fields
  populateMeasurementEditFields(measurements);

  syncStudioModelColumn(model, hasPhoto);

  // Auto-detect skin tone when model photo changes
  if (hasPhoto) {
    triggerSkinToneDetection();
  }
}

function syncStudioModelColumn(_model, _hasPhoto) {
  // Update the studio mannequin to match the body shape from the loaded model
  renderStudioMannequin();
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
/* ── Clothing Asset Library (Issue #2) ───────────────────────── */

const ASSET_TYPES = [
  { key: 'top',            label: 'Top',       emoji: '👕' },
  { key: 'bottom',         label: 'Bottom',    emoji: '👖' },
  { key: 'dress',          label: 'Dress',     emoji: '👗' },
  { key: 'outerwear',      label: 'Layer',     emoji: '🧥' },
  { key: 'shoes',          label: 'Shoes',     emoji: '👟' },
  { key: 'bag',            label: 'Bag',       emoji: '👜' },
  { key: 'glasses',        label: 'Glasses',   emoji: '👓' },
  { key: 'earrings',       label: 'Earrings',  emoji: '✨' },
  { key: 'hair_accessory', label: 'Hair Acc.', emoji: '🎀' },
  { key: 'scarf',          label: 'Scarf',     emoji: '🧣' },
  { key: 'necklace',       label: 'Necklace',  emoji: '📿' },
  { key: 'bracelet',       label: 'Bracelet',  emoji: '💍' },
  { key: 'belt',           label: 'Belt',      emoji: '👔' },
  { key: 'hat',            label: 'Hat',       emoji: '🎩' },
  { key: 'watch',          label: 'Watch',     emoji: '⌚' },
  { key: 'tights',         label: 'Tights',    emoji: '🦵' },
  { key: 'socks',          label: 'Socks',     emoji: '🧦' },
];
// Slots wired to the mannequin stage drop zones (all always in DOM):
const ALL_STAGE_SLOTS   = ['top', 'bottom', 'dress', 'shoes'];
// Accessory slots rendered in the compact row below the stage:
const ACCESSORY_SLOTS   = ['bag', 'glasses', 'earrings', 'hair_accessory', 'scarf', 'necklace', 'bracelet', 'belt', 'hat', 'watch', 'tights', 'socks'];
// Legacy alias kept for callers that still reference it:
const EXTRA_DZ_SLOTS    = ACCESSORY_SLOTS;

// Mode-aware helpers — call at runtime, not as constants, so they read current state.
function getActiveMainSlots() {
  return state.outfitMode === 'dress' ? ['dress', 'shoes'] : ['top', 'bottom', 'shoes'];
}
function getActiveSendSlots() {
  return [...getActiveMainSlots(), 'outerwear', ...ACCESSORY_SLOTS];
}
let _assetIdCounter  = 0;

function _guessType(file) {
  const n = file.name.toLowerCase();
  if (/shoe|boot|sneaker|heel|loafer|sandal/.test(n))   return 'shoes';
  if (/pant|jean|skirt|short|trouser|bottom/.test(n))   return 'bottom';
  if (/dress|gown|romper/.test(n))                      return 'dress';
  if (/jacket|coat|outer|blazer|cardigan/.test(n))      return 'outerwear';
  if (/bag|purse|clutch|tote|handbag/.test(n))          return 'bag';
  if (/glass|sunglass|spectacle|eyewear/.test(n))       return 'glasses';
  if (/earring|stud|hoop|dangle/.test(n))               return 'earrings';
  if (/hair|headband|clip|barrette|scrunchie|bow/.test(n)) return 'hair_accessory';
  if (/scarf|wrap|shawl/.test(n))                       return 'scarf';
  if (/necklace|pendant|choker/.test(n))                return 'necklace';
  if (/bracelet|bangle|cuff/.test(n))                   return 'bracelet';
  if (/belt|waistband/.test(n))                         return 'belt';
  if (/hat|cap|beanie|fedora|beret/.test(n))            return 'hat';
  if (/watch|timepiece/.test(n))                        return 'watch';
  if (/tight|stocking|pantyhose|legging/.test(n))       return 'tights';
  if (/sock|ankle/.test(n))                             return 'socks';
  return 'top';
}

function addClothingAsset(file) {
  const id  = `asset_${++_assetIdCounter}`;
  const rawImageUrl = URL.createObjectURL(file);
  state.clothingAssets.push({
    id,
    file,
    rawImageUrl,
    cleanAssetUrl:       null,
    extractionStatus:    'analyzing',
    detectedType:        null,
    itemName:            null,
    garmentDescription:  null,
    garmentLayerReady:   false,
    containsModel:       false,
    cleanupNeeded:       false,
    userTypeOverride:    false,
    ambiguous:           false,
    possibleTypes:       [],
    confidence:          0,
    type: _guessType(file),
  });
  renderAssetLibrary();
  updateStudioPieceCount();
  analyzeGarmentAsset(id, file);
}

function removeClothingAsset(id) {
  const asset = state.clothingAssets.find(a => a.id === id);
  if (!asset) return;
  const wasHairAccessory = state.slotAssignments.hair_accessory === id;
  Object.keys(state.slotAssignments).forEach(s => {
    if (state.slotAssignments[s] === id) state.slotAssignments[s] = null;
  });
  if (wasHairAccessory) state.hairAccessoryPlacement = 'auto';
  URL.revokeObjectURL(asset.rawImageUrl);
  state.clothingAssets = state.clothingAssets.filter(a => a.id !== id);
  renderAssetLibrary();
  updateDropZones();
  updateStudioExtras();
  updateStudioPieceCount();
  updateGenerateButton();
}

function cycleAssetType(id) {
  const asset = state.clothingAssets.find(a => a.id === id);
  if (!asset) return;
  const idx  = ASSET_TYPES.findIndex(t => t.key === asset.type);
  asset.type = ASSET_TYPES[(idx + 1) % ASSET_TYPES.length].key;
  asset.userTypeOverride = true;
  renderAssetLibrary();
}

function _extractionStatusInfo(status) {
  switch (status) {
    case 'analyzing':  return { label: 'Analyzing…' };
    case 'mock':       return { label: 'Mock Extracted' };
    case 'processed':  return { label: 'Clean Asset Ready' };
    case 'failed':     return { label: 'Needs Cleanup' };
    default:           return { label: 'Pending' };
  }
}

function renderAssetLibrary() {
  const lib  = document.getElementById('studio-asset-library');
  const hint = document.getElementById('studio-asset-hint');
  if (!lib) return;
  if (state.clothingAssets.length === 0) {
    lib.innerHTML = '';
    hint?.classList.remove('hidden');
    return;
  }
  hint?.classList.add('hidden');
  // Skip re-render while a card drag is in progress — destroying the source element orphans the drag.
  if (state.draggedAssetId) return;
  lib.innerHTML = '';
  state.clothingAssets.forEach(asset => {
    const t    = ASSET_TYPES.find(x => x.key === asset.type) || ASSET_TYPES[0];
    const card = document.createElement('div');
    const needsItemChoice = asset.ambiguous && !asset.userTypeOverride && asset.possibleTypes.length > 1;
    card.className   = 'asset-card';
    card.draggable   = !needsItemChoice;
    card.dataset.assetId = asset.id;
    const assigned = Object.values(state.slotAssignments).includes(asset.id);
    if (assigned) card.classList.add('asset-assigned');

    const statusInfo  = _extractionStatusInfo(asset.extractionStatus);
    const nameDisplay = asset.itemName || asset.file.name.replace(/\.[^.]+$/, '');
    const modelBadge  = asset.containsModel
      ? `<span class="asset-model-warning">has model</span>` : '';

    const ambiguousPicker = needsItemChoice
      ? `<div class="asset-ambiguous-picker">
          <p class="asset-ambiguous-label">Which item do you want to use?</p>
          <div class="asset-ambiguous-btns">${asset.possibleTypes.map(k => {
            const at = ASSET_TYPES.find(x => x.key === k) || { emoji: '?', label: k };
            return `<button class="btn-ambiguous-choice" data-choice="${k}" draggable="false">${at.emoji} ${at.label}</button>`;
          }).join('')}</div>
        </div>` : '';

    card.innerHTML = `
      <button class="asset-delete-btn" title="Remove item" draggable="false">×</button>
      <img class="asset-thumb" src="${asset.rawImageUrl}" alt="${t.label}" draggable="false" />
      <div class="asset-card-info">
        <p class="asset-item-name" title="${nameDisplay}">${nameDisplay}</p>
        <div class="asset-info-row">
          <span class="asset-status-chip asset-status-${asset.extractionStatus}">${statusInfo.label}</span>
          ${modelBadge}
        </div>
        ${ambiguousPicker}
      </div>
      <div class="asset-card-footer">
        <button class="asset-type-btn" title="Click to change type" draggable="false">${t.emoji} ${t.label}</button>
      </div>`;
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', asset.id);
      e.dataTransfer.effectAllowed = 'copy';
      card.classList.add('dragging');
      state.draggedAssetId = asset.id;
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      state.draggedAssetId = null;
      renderAssetLibrary();
      updateDropZones();
      updateStudioExtras();
    });
    card.querySelector('.asset-delete-btn').addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      removeClothingAsset(asset.id);
    });
    card.querySelector('.asset-type-btn').addEventListener('click', e => {
      e.stopPropagation();
      cycleAssetType(asset.id);
    });
    card.querySelectorAll('.btn-ambiguous-choice').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        resolveAmbiguousType(asset.id, btn.dataset.choice);
      });
    });
    lib.appendChild(card);
  });
}

function resolveAmbiguousType(assetId, chosenType) {
  const asset = state.clothingAssets.find(a => a.id === assetId);
  if (!asset) return;
  asset.type             = chosenType;
  asset.userTypeOverride = true;
  asset.ambiguous        = false;
  renderAssetLibrary();
}

function assignAssetToSlot(assetId, slotKey) {
  const asset = state.clothingAssets.find(a => a.id === assetId);
  if (!asset) return;
  if (asset.ambiguous && !asset.userTypeOverride && asset.possibleTypes.length > 1) {
    showToast('Choose which item to use from this image before assigning it.', true);
    return;
  }
  Object.keys(state.slotAssignments).forEach(s => {
    if (state.slotAssignments[s] === assetId) state.slotAssignments[s] = null;
  });
  state.slotAssignments[slotKey] = assetId;
  updateDropZones();
  updateStudioExtras();
  updateStudioPieceCount();
  renderAssetLibrary();
  const _equipEl = document.getElementById(`dz-${slotKey}`) ?? document.getElementById(`studio-extra-slot-${slotKey}`);
  if (_equipEl) { _equipEl.classList.remove('slot-equipped'); void _equipEl.offsetWidth; _equipEl.classList.add('slot-equipped'); }
  updateCheckButton();
  updateGenerateButton();
}

function unassignSlot(slotKey) {
  state.slotAssignments[slotKey] = null;
  updateDropZones();
  updateStudioExtras();
  updateStudioPieceCount();
  renderAssetLibrary();
  updateCheckButton();
  updateGenerateButton();
}

function _applyZoneAsset(slot) {
  const zone      = document.getElementById(`dz-${slot}`);
  const thumb     = document.getElementById(`dz-${slot}-thumb`);
  const clearBtn  = document.getElementById(`dz-${slot}-clear`);
  const badge     = document.getElementById(`dz-${slot}-badge`);
  const slotLabel = document.getElementById(`dz-${slot}-slotlabel`);
  const dzLabel   = zone?.querySelector('.dz-label');
  if (!zone) return;
  const assetId = state.slotAssignments[slot];
  if (assetId) {
    const asset = state.clothingAssets.find(a => a.id === assetId);
    if (asset) {
      const displayUrl = asset.cleanAssetUrl || asset.rawImageUrl;
      if (thumb) { thumb.src = displayUrl; thumb.classList.remove('hidden'); }
      clearBtn?.classList.remove('hidden');
      if (badge) {
        badge.classList.remove('hidden');
        if (asset.cleanAssetUrl) {
          badge.textContent = asset.extractionStatus === 'failed' ? 'Fallback Preview'
            : (asset.containsModel || asset.cleanupNeeded) ? 'Needs Cleanup' : 'Mock Clean';
        } else {
          badge.textContent = 'Raw';
        }
      }
      slotLabel?.classList.remove('hidden');
      dzLabel?.classList.add('hidden');
      zone.classList.add('has-item');
      return;
    }
  }
  if (thumb) { thumb.src = ''; thumb.classList.add('hidden'); }
  clearBtn?.classList.add('hidden');
  badge?.classList.add('hidden');
  slotLabel?.classList.add('hidden');
  dzLabel?.classList.remove('hidden');
  zone.classList.remove('has-item');
}

function updateDropZones() {
  const isDressMode = state.outfitMode === 'dress';

  // Show/hide mode-specific stage slots
  document.getElementById('dz-top')?.classList.toggle('hidden', isDressMode);
  document.getElementById('dz-bottom')?.classList.toggle('hidden', isDressMode);
  document.getElementById('dz-dress')?.classList.toggle('hidden', !isDressMode);

  // Update content for all stage slots + outerwear
  ALL_STAGE_SLOTS.forEach(slot => _applyZoneAsset(slot));
  _applyZoneAsset('outerwear');
}

function updateStudioExtras() {
  const wrap = document.getElementById('studio-extras');
  if (!wrap) return;
  // Skip re-render while a drag is active — destroying accessory slot elements drops the drag.
  if (state.draggedAssetId) return;
  wrap.innerHTML = '';

  // Accessories row — compact slots for bag, glasses, earrings, hair_accessory
  const row = document.createElement('div');
  row.className = 'studio-extra-row';
  ACCESSORY_SLOTS.forEach(slot => {
    const t       = ASSET_TYPES.find(x => x.key === slot) || ASSET_TYPES[0];
    const assetId = state.slotAssignments[slot];
    const asset   = assetId ? state.clothingAssets.find(a => a.id === assetId) : null;
    const slotEl  = document.createElement('div');
    slotEl.className    = 'studio-extra-slot';
    slotEl.dataset.slot = slot;
    if (asset) {
      slotEl.classList.add('has-item');
      slotEl.innerHTML = `
        <img src="${asset.rawImageUrl}" alt="${t.label}" />
        <span class="studio-extra-label">${t.emoji} ${t.label}</span>
        <button class="dz-clear studio-extra-clear" title="Remove">✕</button>`;
      slotEl.querySelector('.studio-extra-clear').addEventListener('click', e => {
        e.stopPropagation();
        unassignSlot(slot);
      });
    } else {
      slotEl.innerHTML = `<span class="studio-extra-empty">${t.emoji}<br><small>${t.label}</small></span>`;
    }
    slotEl.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; slotEl.classList.add('drag-over'); });
    slotEl.addEventListener('dragleave', e => { if (!slotEl.contains(e.relatedTarget)) slotEl.classList.remove('drag-over'); });
    slotEl.addEventListener('drop', e => { e.preventDefault(); slotEl.classList.remove('drag-over'); const id = e.dataTransfer.getData('text/plain'); if (id) assignAssetToSlot(id, slot); });
    row.appendChild(slotEl);
  });
  wrap.appendChild(row);

  // Hair accessory placement picker — only shown when hair_accessory is assigned
  if (state.slotAssignments.hair_accessory) {
    renderHairPlacement(wrap);
  }
}

function renderHairPlacement(container) {
  const PLACEMENTS = [
    { value: 'auto',              label: 'Auto' },
    { value: 'top_of_head',       label: 'Top of Head' },
    { value: 'left_side',         label: 'Left Side' },
    { value: 'right_side',        label: 'Right Side' },
    { value: 'back_bun',          label: 'Back / Bun' },
    { value: 'forehead_headband', label: 'Forehead / Headband' },
  ];
  const el = document.createElement('div');
  el.className = 'hair-placement-row';
  el.innerHTML = `<span class="hair-placement-label">🎀 Hair accessory placement</span>
    <select class="hair-placement-select" id="hair-placement-select">
      ${PLACEMENTS.map(p => `<option value="${p.value}"${p.value === state.hairAccessoryPlacement ? ' selected' : ''}>${p.label}</option>`).join('')}
    </select>`;
  el.querySelector('#hair-placement-select').addEventListener('change', e => {
    state.hairAccessoryPlacement = e.target.value;
  });
  container.appendChild(el);
}

function updateStudioPieceCount() {
  const active = getActiveSendSlots();
  const count  = Object.entries(state.slotAssignments).filter(([s, id]) => !!id && active.includes(s)).length;
  const el     = document.getElementById('studio-piece-count');
  if (!el) return;
  if (count > 0) {
    el.textContent = `${count} piece${count !== 1 ? 's' : ''}`;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function updateCheckButton() {
  const btn      = document.getElementById('studio-check-btn');
  if (!btn) return;
  const hasItems = Object.values(state.slotAssignments).some(Boolean);
  const hasScene = !!state.studioScene;
  btn.disabled   = !(hasItems && hasScene);
}

function setupDragDrop() {
  // Wire all stage slots + outerwear — done once at startup; mode visibility is CSS/class-based.
  [...ALL_STAGE_SLOTS, 'outerwear'].forEach(slot => {
    const zone     = document.getElementById(`dz-${slot}`);
    const clearBtn = document.getElementById(`dz-${slot}-clear`);
    if (!zone) return;
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      if (id) assignAssetToSlot(id, slot);
    });
    clearBtn?.addEventListener('click', e => {
      e.stopPropagation();
      unassignSlot(slot);
    });
  });
}

function renderStudioMannequin() {
  const el = document.getElementById('studio-mannequin-svg');
  if (!el) return;
  el.innerHTML = generateMannequinSVG(state.model?.body_shape || 'rectangle');
}

/* ── Try-On Provider Capability (Issue #7) ───────────────────── */

async function loadTryOnProviders() {
  try {
    const resp = await fetch(`${API}/api/try-on/providers`);
    state.tryOnProviders = await resp.json();
    if (!state.selectedProviderId && state.tryOnProviders?.active_provider) {
      state.selectedProviderId = state.tryOnProviders.active_provider;
    }
    renderProviderCapability();
  } catch (_) {}
}

function getSelectedProviderCapability() {
  if (!state.tryOnProviders?.providers) return null;
  const id = state.selectedProviderId;
  if (!id) return state.tryOnProviders.providers[0] || null;
  return state.tryOnProviders.providers.find(p => p.id === id) || null;
}

function renderProviderCapability() {
  const el = document.getElementById('provider-capability-section');
  if (!el || !state.tryOnProviders) return;

  const { providers } = state.tryOnProviders;
  const configured = (providers || []).filter(p => p.status === 'active' || p.status === 'not_configured');
  const planned    = (providers || []).filter(p => p.status === 'planned');

  const statusBadge = {
    active:         '<span class="prov-badge prov-active">Active</span>',
    not_configured: '<span class="prov-badge prov-unconfigured">Token Missing</span>',
    planned:        '<span class="prov-badge prov-planned">Planned</span>',
  };
  const WAVESPEED_ID  = 'wavespeed_ai_virtual_outfit_tryon';
  const GPT_IMAGE_ID  = 'gpt_image_static_tryon';

  // Provider selector — shown when more than one real provider exists
  const selectorHtml = configured.length > 1 ? `
    <p class="prov-select-label">Generate with:</p>
    <div class="prov-selector">
      ${configured.map(p => `
        <button class="prov-select-btn${state.selectedProviderId === p.id ? ' prov-select-active' : ''}"
          data-pid="${p.id}">
          ${p.name}
          ${p.id === WAVESPEED_ID ? '<span class="prov-badge prov-recommended">Full Outfit</span>' : ''}
          ${p.id === GPT_IMAGE_ID  ? '<span class="prov-badge prov-hifi">High Fidelity</span>'   : ''}
          ${statusBadge[p.status] || ''}
        </button>`).join('')}
    </div>` : '';

  // Details for the currently selected or only available provider
  const displayId = state.selectedProviderId || (configured[0] && configured[0].id);
  const displayed  = (providers || []).find(p => p.id === displayId);

  const detailsHtml = displayed ? `
    <div class="prov-active-row">
      <span class="prov-active-name">${displayed.name}</span>
      ${configured.length <= 1 ? (statusBadge[displayed.status] || '') : ''}
      <span class="prov-garment-limit">Max ${displayed.max_garments} garment${displayed.max_garments !== 1 ? 's' : ''}</span>
    </div>
    <ul class="prov-limitations">
      ${(displayed.limitations || []).map(l => `<li>${l}</li>`).join('')}
    </ul>` : `
    <div class="prov-active-row">
      <span class="prov-active-name">No provider configured</span>
      <span class="prov-badge prov-unconfigured">Token Missing</span>
    </div>
    <ul class="prov-limitations"><li>Add REPLICATE_API_TOKEN or FASHN_API_KEY to .env and restart</li></ul>`;

  const plannedHtml = planned.length ? `
    <p class="prov-others-label">Future providers</p>
    <div class="prov-others">
      ${planned.map(p => `<span class="prov-chip prov-chip-planned" title="${p.description}">${p.name}</span>`).join('')}
    </div>` : '';

  el.innerHTML = `
    <div class="provider-capability-box">
      <p class="prov-heading">Try-On Provider</p>
      ${selectorHtml}
      ${detailsHtml}
      ${plannedHtml}
    </div>`;

  // Wire selector buttons after render
  el.querySelectorAll('.prov-select-btn[data-pid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = (providers || []).find(p => p.id === btn.dataset.pid);
      if (p && p.status === 'active') {
        state.selectedProviderId = p.id;
        renderProviderCapability();
      }
    });
  });
}

/* ── Try-On Preview Flow (Issue #5) ──────────────────────────── */

function updateGenerateButton() {
  const btn = document.getElementById('studio-generate-btn');
  if (!btn) return;
  const active   = getActiveSendSlots();
  const hasItems = Object.entries(state.slotAssignments).some(([s, id]) => !!id && active.includes(s));
  btn.disabled = !hasItems;
}

function buildGenerationCacheKey() {
  const activeSendSlots = getActiveSendSlots();
  const slotParts = Object.entries(state.slotAssignments)
    .filter(([slot, id]) => !!id && activeSendSlots.includes(slot))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slot, id]) => `${slot}:${id}`)
    .join('|');
  return [
    state.selectedProviderId || '',
    state.outfitMode,
    slotParts,
    state.hairAccessoryPlacement || 'auto',
    state.modelRevision,                          // My Model photo identity
    state.model?.body_shape || '',                // body_shape sent to backend
  ].join('\x00');
}

const FALLBACK_POOL = [
  { slot:'bag',            name:'Small Black Shoulder Bag',     reason:'Versatile everyday essential' },
  { slot:'earrings',       name:'Gold Hoop Earrings',           reason:'Adds warmth and polish' },
  { slot:'glasses',        name:'Thin Black Glasses',           reason:'Defines the face effortlessly' },
  { slot:'hair_accessory', name:'Silk Bow Hair Clip',           reason:'Elevates any hairstyle' },
  { slot:'scarf',          name:'Cream Silk Scarf',             reason:'Luxurious soft finishing touch' },
  { slot:'necklace',       name:'Gold Pendant Necklace',        reason:'Delicate statement at the neckline' },
  { slot:'shoes',          name:'Black Loafers',                reason:'Grounded and versatile' },
  { slot:'outerwear',      name:'Light Trench Coat',            reason:'Classic layering piece' },
  { slot:'bracelet',       name:'Gold Bangle Bracelet',         reason:'Warm accent that catches light' },
  { slot:'belt',           name:'Black Leather Belt',           reason:'Defines the waist and anchors the look' },
  { slot:'hat',            name:'Black Wide Brim Hat',          reason:'Dramatic and sun-protective' },
  { slot:'watch',          name:'Gold Watch',                   reason:'Refined punctuation on the wrist' },
  { slot:'bag',            name:'Tan Leather Tote Bag',         reason:'Adds warmth and practicality' },
  { slot:'earrings',       name:'Pearl Drop Earrings',          reason:'Timeless feminine elegance' },
  { slot:'glasses',        name:'Brown Tortoise Round Glasses', reason:'Warm intellectual charm' },
  { slot:'hair_accessory', name:'Pearl Headband',               reason:'Polished and put-together' },
  { slot:'scarf',          name:'Black Wool Scarf',             reason:'Cozy and effortlessly chic' },
  { slot:'necklace',       name:'Pearl Strand Necklace',        reason:'Classic elegance, always in style' },
  { slot:'shoes',          name:'White Sneakers',               reason:'Fresh and effortlessly casual' },
  { slot:'outerwear',      name:'Camel Blazer',                 reason:'Sharp structure and warmth' },
  { slot:'tights',         name:'Black Sheer Tights',           reason:'Polishes legs and extends the season' },
  { slot:'socks',          name:'White Ankle Socks',            reason:'Fresh casual detail' },
  { slot:'bag',            name:'White Crossbody Bag',          reason:'Fresh and hands-free ease' },
  { slot:'earrings',       name:'Silver Stud Earrings',         reason:'Clean and versatile accent' },
  { slot:'glasses',        name:'Gold Rimless Glasses',         reason:'Subtle sophisticated detail' },
  { slot:'hair_accessory', name:'Black Velvet Scrunchie',       reason:'Effortless retro texture' },
  { slot:'scarf',          name:'Navy Stripe Scarf',            reason:'Graphic accent with warmth' },
  { slot:'necklace',       name:'Silver Chain Necklace',        reason:'Minimalist shine and versatility' },
  { slot:'shoes',          name:'Nude Block Heel Pumps',        reason:'Leg-lengthening elegance' },
  { slot:'outerwear',      name:'Navy Denim Jacket',            reason:'Casual cool contrast' },
  { slot:'bracelet',       name:'Silver Chain Bracelet',        reason:'Cool minimalist wrist detail' },
  { slot:'belt',           name:'Tan Woven Belt',               reason:'Relaxed texture with structure' },
  { slot:'hat',            name:'Cream Fedora Hat',             reason:'Effortless boho sophistication' },
  { slot:'watch',          name:'Silver Minimalist Watch',      reason:'Clean precision and elegance' },
  { slot:'tights',         name:'Nude Tights',                  reason:'Seamless skin-tone coverage' },
  { slot:'socks',          name:'Black Crew Socks',             reason:'Understated everyday finish' },
  { slot:'hat',            name:'Navy Knit Beanie',             reason:'Casual warmth and texture' },
];

function _addSuggestionHistory(suggestions) {
  for (const s of suggestions) {
    const key = `${s.slot}::${s.name}`;
    const idx = state.completeLookHistory.indexOf(key);
    if (idx !== -1) state.completeLookHistory.splice(idx, 1);
    state.completeLookHistory.push(key);
    if (state.completeLookHistory.length > 30) state.completeLookHistory.shift();
  }
}

function buildClientFallbackSuggestions() {
  const assigned   = new Set(
    Object.entries(state.slotAssignments).filter(([, id]) => !!id).map(([slot]) => slot)
  );
  const historySet = new Set(state.completeLookHistory);
  const available  = FALLBACK_POOL.filter(c => !assigned.has(c.slot));
  const fresh      = available.filter(c => !historySet.has(`${c.slot}::${c.name}`));
  return (fresh.length >= 3 ? fresh : available).slice(0, 3);
}

function renderTryOnPreview() {
  const ALL = ['idle', 'generating', 'provider-required', 'ready', 'failed'];
  ALL.forEach(s => document.getElementById(`tryon-state-${s}`)?.classList.add('hidden'));

  const status  = state.tryOnPreview.status || 'idle';
  const stateId = status.replace('_', '-');
  const stateEl = document.getElementById(`tryon-state-${stateId}`);
  stateEl?.classList.remove('hidden');

  const badge = document.getElementById('tryon-status-badge');
  if (badge) {
    const labels = {
      idle:              { text: 'Idle',              cls: 'tryon-status-idle' },
      generating:        { text: 'Generating…',       cls: 'tryon-status-generating' },
      ready:             {
        text: state.tryOnPreview.videoUrl ? 'Stable Outfit Preview' : 'Preview Ready',
        cls:  'tryon-status-ready'
      },
      failed:            { text: 'Failed',            cls: 'tryon-status-failed' },
      provider_required: { text: 'Provider Required', cls: 'tryon-status-provider' },
    };
    const info = labels[status] || labels.idle;
    badge.textContent = info.text;
    badge.className   = `tryon-status-badge ${info.cls}`;
  }
  document.getElementById('studio-stage')?.classList.toggle('stage-generating', status === 'generating');

  if (status === 'provider_required' && stateEl) {
    stateEl.innerHTML = `
      <div class="tryon-provider-box">
        <p class="tryon-provider-title">Try-On Provider Required</p>
        <p class="tryon-provider-msg">${state.tryOnPreview.message || 'No try-on provider is currently configured.'}</p>
        <p class="tryon-provider-connect">Add provider credentials to your .env to enable generation:</p>
        <ul class="tryon-provider-list">
          <li>FASHN_API_KEY — FASHN v1.6, single-garment image try-on</li>
          <li>WAVESPEED_API_KEY — WaveSpeed, full-outfit video try-on (recommended)</li>
          <li>REPLICATE_API_TOKEN — IDM-VTON via Replicate, single-garment</li>
        </ul>
      </div>`;
  } else if (status === 'failed' && stateEl && state.tryOnPreview.message) {
    stateEl.innerHTML = `<p class="tryon-state-error">${state.tryOnPreview.message}</p>`;
  } else if (status === 'ready') {
    const img           = document.getElementById('tryon-preview-img');
    const video         = document.getElementById('tryon-preview-video');
    const canvas        = document.getElementById('tryon-preview-canvas');
    const readyBdg      = document.getElementById('tryon-preview-ready-badge');
    const videoNote     = document.getElementById('tryon-video-note');
    const fullMotionRow = document.getElementById('tryon-full-motion-row');
    const stableActions = document.getElementById('tryon-stable-actions');
    const imageActions  = document.getElementById('tryon-image-actions');
    if (state.tryOnPreview.videoUrl) {
      // WaveSpeed video path: show canvas still-frame, keep video fully hidden.
      document.getElementById('complete-the-look')?.classList.add('hidden');
      document.getElementById('color-fit-section')?.classList.add('hidden');
      document.getElementById('fit-preview-section')?.classList.add('hidden');
      if (img)         img.classList.add('hidden');
      if (video)       { video.removeAttribute('controls'); video.classList.add('hidden'); }
      if (imageActions) imageActions.classList.add('hidden');
      if (videoNote)   videoNote.classList.remove('hidden');
      if (fullMotionRow) fullMotionRow.classList.remove('hidden');
      if (readyBdg)    readyBdg.textContent = 'Stable Outfit Preview';
      if (video && canvas) {
        if (video.dataset.loadedSrc !== state.tryOnPreview.videoUrl) {
          // New source: seek to first frame (0.01s avoids browser seek-to-0 edge cases),
          // draw to canvas, then keep video hidden.
          video.dataset.loadedSrc = state.tryOnPreview.videoUrl;
          canvas.classList.add('hidden');
          if (stableActions) stableActions.classList.add('hidden');
          video.src = state.tryOnPreview.videoUrl;
          video.muted = true;
          const onMeta = () => {
            video.currentTime = 0.01;
            video.removeEventListener('loadedmetadata', onMeta);
          };
          const onSeeked = () => {
            canvas.width  = video.videoWidth  || 480;
            canvas.height = video.videoHeight || 640;
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.classList.remove('hidden');
            if (stableActions) stableActions.classList.remove('hidden');
            video.pause();
            video.removeEventListener('seeked', onSeeked);
          };
          video.addEventListener('loadedmetadata', onMeta);
          video.addEventListener('seeked', onSeeked);
          video.load();
        } else {
          // Same source already loaded — canvas already has the frame, just show it.
          canvas.classList.remove('hidden');
          if (stableActions) stableActions.classList.remove('hidden');
        }
      }
    } else if (state.tryOnPreview.imageUrl) {
      // GPT Image / FASHN / IDM-VTON image path.
      if (img)   { img.src = state.tryOnPreview.imageUrl; img.classList.remove('hidden'); }
      if (video) {
        video.removeAttribute('controls');
        video.classList.add('hidden');
        delete video.dataset.loadedSrc;
      }
      if (canvas)        canvas.classList.add('hidden');
      if (stableActions) stableActions.classList.add('hidden');
      if (imageActions)  imageActions.classList.remove('hidden');
      if (videoNote)     videoNote.classList.add('hidden');
      if (fullMotionRow) fullMotionRow.classList.add('hidden');
      if (readyBdg)      readyBdg.textContent = 'Preview Ready';

      // Complete the Look — fetch suggestions once per unique preview image.
      if (state.tryOnPreview.imageUrl !== state.completeLookImageUrl) {
        state.completeLookSuggestions = [];
        state.completeLookImageUrl    = state.tryOnPreview.imageUrl;
        renderCompleteTheLook();
        fetchCompleteTheLookSuggestions();
      } else {
        renderCompleteTheLook();
      }

      // Color Fit — fetch analysis once per unique preview image.
      fetchColorFitIfNeeded(state.tryOnPreview.imageUrl);

      // Fit Preview — abort, invalidate, and clear when base image changes (Finding 4).
      if (state.tryOnPreview.imageUrl !== state.fitPreviewBaseImageUrl) {
        state.fitPreviewController.size_up?.abort();
        state.fitPreviewController.size_down?.abort();
        state.fitPreviewController.size_up      = null;
        state.fitPreviewController.size_down    = null;
        state.fitPreview.size_up.requestId     += 1;
        state.fitPreview.size_down.requestId   += 1;
        state.fitPreview.size_up.loading        = false;
        state.fitPreview.size_down.loading      = false;
        state.fitPreviewBaseImageUrl            = state.tryOnPreview.imageUrl;
        state.fitPreview.size_up.imageUrl       = null;
        state.fitPreview.size_down.imageUrl     = null;
        state.fitPreviewLastAdjustment          = null;
        state.fitPreviewCache.clear();

        // Generation Plan — abort in-flight request and reset all plan state when base changes.
        state.activePlanAbortController?.abort();
        state.activePlanAbortController = null;
        state.planRequestId            += 1;
        state.planItems                 = [];
        state.planFitShift              = 'none';
        state.planScene                 = 'original';
        state.planStatus                = 'idle';
        state.planResult                = null;
        state.planCache.clear();
      }
    }
  }
  // Fit Preview section is now outside the right panel — always sync its visibility.
  renderFitPreviewSection();
  // Plan section visibility tracks try-on preview state.
  renderPlanSection();
}

let _generatingProgressTimer = null;

async function runTryOnGenerate() {
  // Only send slots that are active in the current mode
  const activeSendSlots = getActiveSendSlots();
  const filledSlots = Object.entries(state.slotAssignments)
    .filter(([slot, id]) => !!id && activeSendSlots.includes(slot));
  if (filledSlots.length === 0) return;

  // Dress mode: dress must be assigned before generating
  if (state.outfitMode === 'dress' && !state.slotAssignments.dress) {
    state.tryOnPreview.status  = 'failed';
    state.tryOnPreview.message = 'Add a dress before generating a Dress look.';
    renderTryOnPreview();
    updateGenerateButton();
    return;
  }

  // Derive rules from selected provider's capability metadata
  const provCap        = getSelectedProviderCapability();
  const maxGarments    = provCap?.max_garments    ?? 1;
  const unsupportedSls = provCap?.unsupported_slots ?? [];
  const isMultiGarment = maxGarments > 1;
  const isVideo        = provCap?.output_type === 'video';

  // Unsupported slot check — generalized for all providers (Fix 4)
  const unsupportedFilled = filledSlots.filter(([s]) => unsupportedSls.includes(s));
  if (unsupportedFilled.length > 0) {
    const slotStr   = unsupportedFilled.map(([s]) => s).join(', ');
    const provName  = provCap?.name || 'This provider';
    const isWaveSpeed = provCap?.id === 'wavespeed_ai_virtual_outfit_tryon';
    const accessorySlots = ['bag', 'glasses', 'earrings', 'hair_accessory'];
    const hasAccessory = unsupportedFilled.some(([s]) => accessorySlots.includes(s));
    const hint = (isWaveSpeed && hasAccessory)
      ? ' WaveSpeed is not reliable for small accessories yet. Use GPT Image Static Try-On for bags, glasses, earrings, or hair accessories.'
      : '';
    state.tryOnPreview.status  = 'failed';
    state.tryOnPreview.message = `${provName} does not support: ${slotStr}. Remove this item before generating.${hint}`;
    renderTryOnPreview();
    updateGenerateButton();
    return;
  }

  // Single-garment constraint — derived from max_garments capability field (Fix 2)
  if (filledSlots.length > 1 && !isMultiGarment) {
    const provName = provCap?.name || 'This provider';
    state.tryOnPreview.status  = 'failed';
    state.tryOnPreview.message = `${provName} supports one garment at a time. Remove extra garments before generating.`;
    renderTryOnPreview();
    updateGenerateButton();
    return;
  }

  if (filledSlots.length > maxGarments) {
    const provName = provCap?.name || 'This provider';
    state.tryOnPreview.status  = 'failed';
    state.tryOnPreview.message = `${provName} supports up to ${maxGarments} items. Remove extra items before generating.`;
    renderTryOnPreview();
    updateGenerateButton();
    return;
  }

  // Req 8: serve from in-memory cache on exact repeated setups.
  const genCacheKey = buildGenerationCacheKey();
  if (state.tryOnCache.has(genCacheKey)) {
    const cached = state.tryOnCache.get(genCacheKey);
    state.tryOnPreview.status   = cached.status;
    state.tryOnPreview.mode     = cached.mode;
    state.tryOnPreview.imageUrl = cached.imageUrl;
    state.tryOnPreview.videoUrl = cached.videoUrl;
    state.tryOnPreview.message  = null;
    renderTryOnPreview();
    updateGenerateButton();
    return;
  }

  // Abort any previous in-flight generation and stamp this one with a unique id.
  if (state.activeAbortController) state.activeAbortController.abort();
  state.generationRequestId++;
  state.completeLookHistory = []; // new preview → fresh suggestion history
  const myId       = state.generationRequestId;
  const controller = new AbortController();
  state.activeAbortController = controller;

  state.tryOnPreview.status   = 'generating';
  state.tryOnPreview.imageUrl = null;
  state.tryOnPreview.videoUrl = null;
  state.tryOnPreview.message  = null;
  renderTryOnPreview();

  startGenerationProgress(myId, isVideo);

  const btn = document.getElementById('studio-generate-btn');
  if (btn) btn.disabled = true;

  try {
    const form = new FormData();
    if (state.selectedProviderId)  form.append('provider_id',  state.selectedProviderId);
    if (state.model?.body_shape)   form.append('body_shape',   state.model.body_shape);
    form.append('outfit_mode', state.outfitMode);
    if (state.slotAssignments.hair_accessory && state.hairAccessoryPlacement) {
      form.append('hair_accessory_placement', state.hairAccessoryPlacement);
    }

    if (isMultiGarment) {
      // Multi-garment: send per-slot files; unsupported slots already rejected above.
      filledSlots.forEach(([slot, assetId]) => {
        const asset = state.clothingAssets.find(a => a.id === assetId);
        if (asset) form.append(`garm_img_${slot}`, asset.file);
      });
    } else {
      const [slot, assetId] = filledSlots[0];
      const asset = state.clothingAssets.find(a => a.id === assetId);
      if (!asset) throw new Error('Asset not found for slot ' + slot);
      form.append('garm_img',       asset.file);
      form.append('slot',           slot);
      form.append('garment_des',    asset.itemName || asset.garmentDescription || '');
      form.append('contains_model', asset.containsModel ? 'true' : 'false');
    }

    const resp = await fetch(`${API}/api/try-on/generate`, { method: 'POST', body: form, signal: controller.signal, headers: { 'X-Demo-Code': getDemoCode() } });
    if (myId !== state.generationRequestId) return;
    const result = await resp.json();
    if (myId !== state.generationRequestId) return;

    if (result.status === 'demo_locked') {
      handleDemoLocked(result.message);
      state.tryOnPreview.status  = 'failed';
      state.tryOnPreview.message = result.message || 'Demo code required.';
      return; // finally runs: stopGenerationProgress + renderTryOnPreview + updateGenerateButton
    }
    if (!resp.ok) {
      state.tryOnPreview.status  = 'failed';
      state.tryOnPreview.message = result.message || result.error || 'Generation failed.';
    } else {
      state.tryOnPreview.status   = result.status            || 'provider_required';
      state.tryOnPreview.mode     = result.mode              || 'provider_stub';
      state.tryOnPreview.imageUrl = result.preview_image_url || null;
      state.tryOnPreview.videoUrl = result.preview_video_url || null;
      state.tryOnPreview.message  = result.message           || null;
      // Req 8: cache successful results to avoid repeat API calls.
      if (state.tryOnPreview.status === 'ready'
          && (state.tryOnPreview.imageUrl || state.tryOnPreview.videoUrl)) {
        state.tryOnCache.set(genCacheKey, {
          status:   state.tryOnPreview.status,
          mode:     state.tryOnPreview.mode,
          imageUrl: state.tryOnPreview.imageUrl,
          videoUrl: state.tryOnPreview.videoUrl,
        });
      }
    }
  } catch (err) {
    // AbortError = user cancelled; stale id = superseded by a newer generation — both are silent.
    if (err.name === 'AbortError' || myId !== state.generationRequestId) return;
    state.tryOnPreview.status  = 'failed';
    state.tryOnPreview.message = err.message;
  } finally {
    const succeeded = myId === state.generationRequestId && state.tryOnPreview.status === 'ready';
    if (succeeded) {
      await finishGenerationProgress(); // paint 100% before switching panel
    } else {
      stopGenerationProgress(false);
    }
    if (myId === state.generationRequestId) {
      state.activeAbortController = null;
      renderTryOnPreview();
      updateGenerateButton();
    }
  }
}

function startGenerationProgress(myId, isVideo) {
  const fill  = document.getElementById('gen-progress-fill');
  const pct   = document.getElementById('gen-progress-pct');
  const msgEl = document.getElementById('tryon-generating-msg');
  const subEl = document.getElementById('tryon-generating-sub');

  const stages = [
    { at:  0, text: 'Preparing your model and outfit…' },
    { at: 15, text: 'Sending outfit references…' },
    { at: 35, text: isVideo ? 'Generating full outfit preview…' : 'Generating high-quality preview…' },
    { at: 75, text: 'Preserving face, outfit, and styling details…' },
    { at: 95, text: 'Finalizing preview…' },
  ];
  const initSub = isVideo
    ? 'This may take 1–5 minutes. AI-generated — may adjust pose or background. Keep this page open.'
    : 'This may take 1–3 minutes. Keep this page open.';

  if (fill) { fill.style.transition = 'none'; fill.style.width = '0%'; }
  if (pct)  pct.textContent = '0%';
  if (msgEl) msgEl.textContent = stages[0].text;
  if (subEl) subEl.textContent = initSub;

  const startMs = Date.now();
  let escalated = false;

  if (_generatingProgressTimer) clearInterval(_generatingProgressTimer);
  _generatingProgressTimer = setInterval(() => {
    if (myId !== state.generationRequestId) {
      clearInterval(_generatingProgressTimer);
      _generatingProgressTimer = null;
      return;
    }
    const elapsed = (Date.now() - startMs) / 1000;
    const p = Math.min(95, Math.round(95 * (1 - Math.exp(-elapsed / 60))));
    if (fill) { fill.style.transition = 'width .6s ease-out'; fill.style.width = p + '%'; }
    if (pct)  pct.textContent = p + '%';

    if (elapsed >= 120 && !escalated) {
      escalated = true;
      if (msgEl) msgEl.textContent = 'Still working on the high-quality preview…';
      if (subEl) subEl.textContent = 'Large image edits can take a few minutes.';
    } else if (!escalated) {
      const stage = [...stages].reverse().find(s => p >= s.at);
      if (stage && msgEl) msgEl.textContent = stage.text;
    }
  }, 800);
}

function stopGenerationProgress(success) {
  if (_generatingProgressTimer) {
    clearInterval(_generatingProgressTimer);
    _generatingProgressTimer = null;
  }
  const fill = document.getElementById('gen-progress-fill');
  const pct  = document.getElementById('gen-progress-pct');
  if (success) {
    if (fill) { fill.style.transition = 'width .3s ease-out'; fill.style.width = '100%'; }
    if (pct)  pct.textContent = '100%';
  } else {
    if (fill) { fill.style.transition = 'none'; fill.style.width = '0%'; }
    if (pct)  pct.textContent = '0%';
  }
}

async function finishGenerationProgress() {
  stopGenerationProgress(true);
  await new Promise(requestAnimationFrame);
  await new Promise(resolve => setTimeout(resolve, 200));
}

function cancelGeneration() {
  if (state.activeAbortController) {
    state.activeAbortController.abort();
    state.activeAbortController = null;
  }
  if (state.activeAddAbortController) {
    state.activeAddAbortController.abort();
    state.activeAddAbortController = null;
  }
  stopGenerationProgress(false);
  state.generationRequestId++;
  state.addToLookRequestId++;
  state.addToLookInFlight       = false;
  state.addToLookActiveIdx      = null;
  state.batchEditActive         = false;
  state.batchProgress           = 0;
  state.completeLookSelected    = new Set();
  state.completeLookHistory     = [];
  state.tryOnPreview.status     = 'idle';
  state.tryOnPreview.imageUrl   = null;
  state.tryOnPreview.videoUrl   = null;
  state.tryOnPreview.message    = null;
  state.completeLookSuggestions = [];
  state.completeLookLoading     = false;
  state.completeLookError       = null;
  state.completeLookImageUrl    = null;
  state.colorFitAnalysis        = null;
  state.colorFitLoading         = false;
  state.colorFitImageUrl        = null;
  renderTryOnPreview();
  updateGenerateButton();
}

function cancelAddToLook() {
  if (state.activeAddAbortController) {
    state.activeAddAbortController.abort();
    state.activeAddAbortController = null;
  }
  state.addToLookRequestId++;
  state.addToLookInFlight  = false;
  state.addToLookActiveIdx = null;
  renderCompleteTheLook();
}

function cancelBatchAddToLook() {
  if (state.activeAddAbortController) {
    state.activeAddAbortController.abort();
    state.activeAddAbortController = null;
  }
  state.addToLookRequestId++;
  state.addToLookInFlight = false;
  state.batchEditActive   = false;
  state.batchProgress     = 0;
  renderCompleteTheLook();
}

/* ── Skin Tone Picker (Issue 23) ─────────────────────────────────────────── */

const SKIN_DEPTHS = [
  { key: 'fair',         label: 'Fair',       color: '#f5dcca' },
  { key: 'light',        label: 'Light',      color: '#e8c4a0' },
  { key: 'light_medium', label: 'Light Med.', color: '#d4a078' },
  { key: 'medium',       label: 'Medium',     color: '#c08060' },
  { key: 'tan',          label: 'Tan',        color: '#9b6444' },
  { key: 'deep',         label: 'Deep',       color: '#7a4428' },
  { key: 'rich',         label: 'Rich',       color: '#4a2215' },
];

const UNDERTONES = [
  { key: 'cool',      label: 'Cool',     desc: 'pink/rosy cast' },
  { key: 'neutral',   label: 'Neutral',  desc: 'balanced mix' },
  { key: 'warm',      label: 'Warm',     desc: 'golden/peachy' },
  { key: 'olive',     label: 'Olive',    desc: 'yellow-green cast' },
  { key: 'not_sure',  label: 'Not sure', desc: 'adjust later' },
];

const _VALID_SKIN_DEPTHS   = new Set(SKIN_DEPTHS.map(d => d.key));
const _VALID_UNDERTONES    = new Set(UNDERTONES.map(u => u.key));
const _VALID_VERDICTS      = new Set(['Great fit', 'Good match', 'Works with adjustments', 'Challenging palette']);
const _MAX_COLOR_LABEL_LEN = 30;
const _MAX_REASON_LEN      = 120;

function setupSkinTonePicker() {
  const swatchesEl  = document.getElementById('skin-tone-swatches');
  const undertoneEl = document.getElementById('undertone-btns');
  const refreshBtn  = document.getElementById('refresh-color-fit-btn');

  if (swatchesEl) {
    SKIN_DEPTHS.forEach(d => {
      const btn = document.createElement('button');
      btn.className = 'swatch-tile';
      btn.dataset.depth = d.key;
      btn.title = d.label;
      btn.style.background = d.color;
      btn.setAttribute('aria-label', d.label);
      btn.addEventListener('click', () => setSkinDepth(d.key, 'manual'));
      swatchesEl.appendChild(btn);
    });
  }

  if (undertoneEl) {
    UNDERTONES.forEach(u => {
      const btn   = document.createElement('button');
      btn.className = 'undertone-btn';
      btn.dataset.undertone = u.key;
      const lbl   = document.createElement('span');
      lbl.className = 'undertone-btn-label';
      lbl.textContent = u.label;
      const desc  = document.createElement('span');
      desc.className = 'undertone-btn-desc';
      desc.textContent = u.desc;
      btn.appendChild(lbl);
      btn.appendChild(desc);
      btn.addEventListener('click', () => setSkinUndertone(u.key, 'manual'));
      undertoneEl.appendChild(btn);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      state.colorFitImageUrl = null;
      fetchColorFitIfNeeded(state.tryOnPreview.imageUrl);
    });
  }
}

function setSkinDepth(depth, source) {
  state.skinTone.depth  = depth;
  if (source === 'manual') state.skinTone.source = 'manual';
  renderSkinTonePicker();
  state.colorFitImageUrl = null; // invalidate cache so next preview re-runs analysis
}

function setSkinUndertone(undertone, source) {
  state.skinTone.undertone = undertone;
  if (source === 'manual') state.skinTone.source = 'manual';
  renderSkinTonePicker();
  state.colorFitImageUrl = null;
}

function renderSkinTonePicker() {
  document.querySelectorAll('.swatch-tile').forEach(btn => {
    btn.classList.toggle('swatch-active', btn.dataset.depth === state.skinTone.depth);
  });
  document.querySelectorAll('.undertone-btn').forEach(btn => {
    btn.classList.toggle('undertone-active', btn.dataset.undertone === state.skinTone.undertone);
  });
  const srcEl = document.getElementById('skin-tone-source-label');
  if (srcEl) {
    if (state.skinTone.source === 'auto') {
      srcEl.textContent = 'Auto-detected from your photo. Adjust if it does not look right.';
      srcEl.style.display = 'block';
    } else if (state.skinTone.source === 'manual') {
      srcEl.textContent = 'Manually set.';
      srcEl.style.display = 'block';
    } else {
      srcEl.style.display = 'none';
    }
  }
}

async function triggerSkinToneDetection() {
  const detecting = document.getElementById('skin-tone-detecting');
  if (detecting) detecting.classList.remove('hidden');
  try {
    const resp = await fetch(`${API}/api/model/detect-skin-tone`, { method: 'POST' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (_VALID_SKIN_DEPTHS.has(data.skin_depth))  state.skinTone.depth     = data.skin_depth;
    if (_VALID_UNDERTONES.has(data.undertone))     state.skinTone.undertone = data.undertone;
    state.skinTone.source  = 'auto';
    state.colorFitImageUrl = null; // invalidate so next preview re-runs with new tone
  } catch (_) {
    // Silent fallback — picker stays at current values
  } finally {
    if (detecting) detecting.classList.add('hidden');
  }
  renderSkinTonePicker();
}

/* ── Color Fit Analysis (Issue 23) ──────────────────────────────────────── */

function _validateColorFitData(data) {
  if (!data || typeof data !== 'object') return null;
  const score = (typeof data.color_fit_score === 'number')
    ? Math.max(0, Math.min(10, Math.round(data.color_fit_score))) : 0;
  const verdict      = _VALID_VERDICTS.has(data.verdict) ? data.verdict : '';
  const reasons      = Array.isArray(data.reasons)
    ? data.reasons.filter(r => typeof r === 'string').map(r => r.trim().slice(0, _MAX_REASON_LEN))
    : [];
  const lightingNote = (typeof data.lighting_note === 'string')
    ? data.lighting_note.trim().slice(0, 200) : '';
  const betterColors = Array.isArray(data.better_colors)
    ? data.better_colors.filter(c => typeof c === 'string').map(c => c.trim().slice(0, _MAX_COLOR_LABEL_LEN))
    : [];
  const cautionColors = Array.isArray(data.caution_colors)
    ? data.caution_colors.filter(c => typeof c === 'string').map(c => c.trim().slice(0, _MAX_COLOR_LABEL_LEN))
    : [];
  return { score, verdict, reasons, lightingNote, betterColors, cautionColors };
}

async function fetchColorFitIfNeeded(imageUrl) {
  if (!imageUrl) return;
  // Skip if same image already analysed (cache hit)
  if (imageUrl === state.colorFitImageUrl && (state.colorFitAnalysis || state.colorFitLoading)) {
    renderColorFitCard();
    return;
  }
  state.colorFitImageUrl = imageUrl;
  state.colorFitAnalysis = null;
  state.colorFitLoading  = true;
  renderColorFitCard();

  try {
    const previewBlob = await previewImageToBlob(imageUrl);
    const form = new FormData();
    form.append('preview_image', previewBlob, 'preview.jpg');
    form.append('skin_depth',    state.skinTone.depth    || 'medium');
    form.append('undertone',     state.skinTone.undertone || 'neutral');
    const resp = await fetch(`${API}/api/try-on/color-fit`, { method: 'POST', body: form });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    state.colorFitAnalysis = _validateColorFitData(data);
  } catch (_) {
    state.colorFitAnalysis = null;
  }
  state.colorFitLoading = false;
  renderColorFitCard();
}

function renderColorFitCard() {
  const section    = document.getElementById('color-fit-section');
  const contentEl  = document.getElementById('color-fit-content');
  const refreshBtn = document.getElementById('refresh-color-fit-btn');
  if (!section || !contentEl) return;

  if (state.tryOnPreview.status !== 'ready' || !state.tryOnPreview.imageUrl) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  contentEl.textContent = '';

  if (state.colorFitLoading) {
    const wrap = document.createElement('div');
    wrap.className = 'color-fit-loading';
    const spinner = document.createElement('div');
    spinner.className = 'spinner sm';
    const msg = document.createElement('span');
    msg.textContent = 'Analysing colour fit…';
    wrap.appendChild(spinner);
    wrap.appendChild(msg);
    contentEl.appendChild(wrap);
    if (refreshBtn) refreshBtn.classList.add('hidden');
    return;
  }

  if (refreshBtn) refreshBtn.classList.remove('hidden');

  const d = state.colorFitAnalysis;
  if (!d || (!d.verdict && d.score === 0 && d.reasons.length === 0)) {
    const err = document.createElement('p');
    err.className = 'color-fit-error';
    err.textContent = 'Colour fit analysis is unavailable. Set up the Claude API key to enable it.';
    contentEl.appendChild(err);
    return;
  }

  // Score + verdict
  if (d.score > 0 || d.verdict) {
    const row = document.createElement('div');
    row.className = 'color-fit-score-row';
    if (d.score > 0) {
      const scoreEl = document.createElement('span');
      scoreEl.className = 'color-fit-score';
      scoreEl.textContent = d.score + '/10';
      row.appendChild(scoreEl);
    }
    if (d.verdict) {
      const verdictEl = document.createElement('span');
      verdictEl.className = 'color-fit-verdict color-fit-verdict--' +
        d.verdict.toLowerCase().replace(/[\s/]+/g, '-');
      verdictEl.textContent = d.verdict;
      row.appendChild(verdictEl);
    }
    contentEl.appendChild(row);
  }

  // Reasons
  if (d.reasons.length > 0) {
    const ul = document.createElement('ul');
    ul.className = 'color-fit-reasons';
    d.reasons.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r;
      ul.appendChild(li);
    });
    contentEl.appendChild(ul);
  }

  // Better colors
  if (d.betterColors.length > 0) {
    const lbl = document.createElement('p');
    lbl.className = 'color-fit-chip-label';
    lbl.textContent = 'Colours that complement:';
    contentEl.appendChild(lbl);
    const chips = document.createElement('div');
    chips.className = 'color-fit-chips';
    d.betterColors.forEach(c => {
      const chip = document.createElement('span');
      chip.className = 'color-chip color-chip--better';
      chip.textContent = c;
      chips.appendChild(chip);
    });
    contentEl.appendChild(chips);
  }

  // Caution colors
  if (d.cautionColors.length > 0) {
    const lbl = document.createElement('p');
    lbl.className = 'color-fit-chip-label';
    lbl.textContent = 'Colours to limit:';
    contentEl.appendChild(lbl);
    const chips = document.createElement('div');
    chips.className = 'color-fit-chips';
    d.cautionColors.forEach(c => {
      const chip = document.createElement('span');
      chip.className = 'color-chip color-chip--caution';
      chip.textContent = c;
      chips.appendChild(chip);
    });
    contentEl.appendChild(chips);
  }

  // Lighting note
  if (d.lightingNote) {
    const note = document.createElement('p');
    note.className = 'color-fit-lighting-note';
    note.textContent = d.lightingNote;
    contentEl.appendChild(note);
  }
}

/* ── Size Fit Preview (Issue 24) ─────────────────────────────────────────── */

function setupFitPreview() {
  document.getElementById('fit-size-up-btn')?.addEventListener('click',   () => triggerFitPreview('size_up'));
  document.getElementById('fit-size-down-btn')?.addEventListener('click', () => triggerFitPreview('size_down'));
  document.getElementById('fit-preview-cancel-btn')?.addEventListener('click', cancelFitPreview);
  document.getElementById('fit-preview-reset-btn')?.addEventListener('click',  resetFitPreview);
}

async function triggerFitPreview(fitAdjustment) {
  const baseUrl = state.tryOnPreview.imageUrl;
  if (!baseUrl || state.tryOnPreview.videoUrl) return;

  const height = (document.getElementById('fit-height-input')?.value  || '').trim();
  const size   = (document.getElementById('fit-size-input')?.value    || '').trim();
  const pref   =  document.getElementById('fit-pref-select')?.value   || 'not_sure';

  // Cache hit: same base image + same inputs already generated for this adjustment.
  const cacheKey = `${fitAdjustment}::${height}::${size}::${pref}`;
  if (state.fitPreviewCache.has(cacheKey)) {
    state.fitPreview[fitAdjustment].imageUrl = state.fitPreviewCache.get(cacheKey);
    state.fitPreviewLastAdjustment = fitAdjustment;
    renderFitPreviewSection();
    return;
  }

  // Cancel any in-flight request for this adjustment.
  state.fitPreviewController[fitAdjustment]?.abort();
  const controller = new AbortController();
  state.fitPreviewController[fitAdjustment] = controller;

  state.fitPreview[fitAdjustment].loading    = true;
  state.fitPreview[fitAdjustment].requestId += 1;
  const myId = state.fitPreview[fitAdjustment].requestId;

  startFitPreviewProgress(fitAdjustment);

  let previewBlob;
  try {
    previewBlob = await previewImageToBlob(baseUrl);
  } catch (err) {
    // Preserve the safe user-facing message from previewImageToBlob (Finding 5).
    state.fitPreview[fitAdjustment].loading = false;
    finishFitPreviewProgress();
    renderFitPreviewSection();
    showToast(err?.message ||
      'Could not use this preview for fit editing. Try generating with GPT Image Static Try-On.', true);
    return;
  }

  const form = new FormData();
  form.append('preview_image', previewBlob, 'preview.jpg');
  form.append('fit_adjustment', fitAdjustment);
  if (height) form.append('height', height);
  if (size)   form.append('size',   size);
  if (pref)   form.append('fit_preference', pref);

  let timedOut = false;
  // 3-minute slow message — update progress text but keep waiting.
  const slowTimer = setTimeout(() => {
    if (state.fitPreview[fitAdjustment].requestId !== myId) return;
    const msg = document.getElementById('fit-preview-progress-msg');
    if (msg) msg.textContent =
      'Still generating fit preview… high-quality edits can take extra time.';
  }, 180_000);
  // 5-minute hard timeout — abort and show a graceful error.
  const hardTimer = setTimeout(() => {
    if (state.fitPreview[fitAdjustment].requestId !== myId) return;
    timedOut = true;
    controller.abort();
  }, 300_000);

  try {
    const resp = await fetch(`${API}/api/try-on/fit-preview`,
      { method: 'POST', body: form, signal: controller.signal, headers: { 'X-Demo-Code': getDemoCode() } });
    if (!resp.ok) await apiError(resp);
    const data = await resp.json();
    if (data.status === 'demo_locked') { handleDemoLocked(data.message); return; }

    // Stale guard: cancelled, superseded, or base image changed (Finding 3 & 4).
    if (state.fitPreview[fitAdjustment].requestId !== myId) return;
    if (state.fitPreviewBaseImageUrl !== baseUrl) return;

    if (data.preview_image_url) {
      state.fitPreview[fitAdjustment].imageUrl = data.preview_image_url;
      state.fitPreviewLastAdjustment = fitAdjustment;
      state.fitPreviewCache.set(cacheKey, data.preview_image_url);
    } else {
      showToast(data.message || 'Fit preview could not be generated.', true);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      // Timeout abort: show graceful message. User-cancel: requestId was incremented, so
      // the timedOut check below is false — silently return.
      if (timedOut && state.fitPreview[fitAdjustment].requestId === myId) {
        showToast('Could not generate fit preview in time. Please try again.', true);
      }
      return;
    }
    if (state.fitPreview[fitAdjustment].requestId !== myId) return;
    showToast('Fit preview failed. Please try again.', true);
  } finally {
    clearTimeout(slowTimer);
    clearTimeout(hardTimer);
    if (state.fitPreview[fitAdjustment].requestId === myId) {
      state.fitPreview[fitAdjustment].loading = false;
      finishFitPreviewProgress();
      renderFitPreviewSection();
    }
  }
}

function cancelFitPreview() {
  // Abort and increment requestId so any late-arriving results are discarded (Finding 3).
  state.fitPreviewController.size_up?.abort();
  state.fitPreviewController.size_down?.abort();
  state.fitPreviewController.size_up      = null;
  state.fitPreviewController.size_down    = null;
  state.fitPreview.size_up.requestId     += 1;
  state.fitPreview.size_down.requestId   += 1;
  state.fitPreview.size_up.loading        = false;
  state.fitPreview.size_down.loading      = false;
  finishFitPreviewProgress();
  renderFitPreviewSection();
}

function resetFitPreview() {
  // Abort and invalidate in-flight requests (Finding 2 & 3).
  state.fitPreviewController.size_up?.abort();
  state.fitPreviewController.size_down?.abort();
  state.fitPreviewController.size_up      = null;
  state.fitPreviewController.size_down    = null;
  state.fitPreview.size_up.requestId     += 1;
  state.fitPreview.size_down.requestId   += 1;
  state.fitPreview.size_up.loading        = false;
  state.fitPreview.size_down.loading      = false;
  // Clear results — base preview image is unchanged.
  state.fitPreview.size_up.imageUrl       = null;
  state.fitPreview.size_down.imageUrl     = null;
  state.fitPreviewLastAdjustment          = null;
  state.fitPreviewCache.clear();
  finishFitPreviewProgress();
  renderFitPreviewSection();
}

let _fitPreviewProgressTimer = null;

function startFitPreviewProgress(fitAdjustment) {
  const fill  = document.getElementById('fit-preview-progress-fill');
  const msg   = document.getElementById('fit-preview-progress-msg');
  const prog  = document.getElementById('fit-preview-progress');
  const upBtn = document.getElementById('fit-size-up-btn');
  const dnBtn = document.getElementById('fit-size-down-btn');

  if (prog)  prog.classList.remove('hidden');
  if (upBtn) upBtn.disabled = true;
  if (dnBtn) dnBtn.disabled = true;
  if (msg)   msg.textContent = fitAdjustment === 'size_up'
    ? 'Generating size up preview…'
    : 'Generating size down preview…';

  let pct = 0;
  if (fill) fill.style.width = '0%';
  clearInterval(_fitPreviewProgressTimer);
  _fitPreviewProgressTimer = setInterval(() => {
    pct = Math.min(pct + (pct < 30 ? 4 : pct < 70 ? 2 : 0.5), 92);
    if (fill) fill.style.width = pct + '%';
  }, 2000);
}

function finishFitPreviewProgress() {
  clearInterval(_fitPreviewProgressTimer);
  const fill  = document.getElementById('fit-preview-progress-fill');
  const prog  = document.getElementById('fit-preview-progress');
  const upBtn = document.getElementById('fit-size-up-btn');
  const dnBtn = document.getElementById('fit-size-down-btn');
  if (fill) fill.style.width = '100%';
  setTimeout(() => {
    if (prog)  prog.classList.add('hidden');
    if (fill)  fill.style.width = '0%';
    if (upBtn) upBtn.disabled = false;
    if (dnBtn) dnBtn.disabled = false;
  }, 400);
}

function renderFitPreviewSection() {
  const section     = document.getElementById('fit-preview-section');
  const comparison  = document.getElementById('fit-preview-comparison');
  const origImg     = document.getElementById('fit-preview-original-img');
  const resultImg   = document.getElementById('fit-preview-result-img');
  const resultLabel = document.getElementById('fit-preview-result-label');

  if (!section) return;

  const hasStaticImage = !!state.tryOnPreview.imageUrl && !state.tryOnPreview.videoUrl;
  if (!hasStaticImage) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  // Show side-by-side comparison if a result exists.
  const adj       = state.fitPreviewLastAdjustment;
  const resultUrl = adj ? state.fitPreview[adj].imageUrl : null;
  if (resultUrl && origImg && resultImg && comparison) {
    comparison.classList.remove('hidden');
    origImg.src   = state.tryOnPreview.imageUrl;
    resultImg.src = resultUrl;
    if (resultLabel) {
      resultLabel.textContent = adj === 'size_up'
        ? 'One Size Up (Looser)'
        : 'One Size Down (More Fitted)';
    }
  } else if (comparison) {
    comparison.classList.add('hidden');
  }
}

/* ── Full Outfit Reference (Issue 22) ────────────────────────────────────── */

function setupOutfitRef() {
  const btn   = document.getElementById('btn-add-outfit-ref');
  const input = document.getElementById('outfit-ref-input');
  const rmBtn = document.getElementById('outfit-ref-remove');
  const tryBtn = document.getElementById('btn-try-whole-outfit');

  if (btn && input) {
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (file) handleOutfitRefUpload(file);
      input.value = '';
    });
  }
  if (rmBtn) rmBtn.addEventListener('click', clearOutfitRef);
  if (tryBtn) tryBtn.addEventListener('click', runTryWholeOutfit);
}

function handleOutfitRefUpload(file) {
  if (state.outfitRefUrl) URL.revokeObjectURL(state.outfitRefUrl);
  state.outfitRefFile     = file;
  state.outfitRefUrl      = URL.createObjectURL(file);
  state.outfitRefAnalysis = null;
  state.outfitRefAnalysisLoading = true;
  renderOutfitRefCard();
  fetchOutfitRefAnalysis(file);
}

function clearOutfitRef() {
  if (state.outfitRefUrl) URL.revokeObjectURL(state.outfitRefUrl);
  state.outfitRefFile     = null;
  state.outfitRefUrl      = null;
  state.outfitRefAnalysis = null;
  state.outfitRefAnalysisLoading = false;
  renderOutfitRefCard();
}

function renderOutfitRefCard() {
  const hint    = document.getElementById('full-outfit-ref-hint');
  const card    = document.getElementById('outfit-ref-card');
  const preview = document.getElementById('outfit-ref-preview');
  const analysis = document.getElementById('outfit-ref-analysis');

  if (!card) return;

  if (!state.outfitRefFile) {
    card.classList.add('hidden');
    if (hint) hint.classList.remove('hidden');
    return;
  }

  card.classList.remove('hidden');
  if (hint) hint.classList.add('hidden');

  if (preview && state.outfitRefUrl) preview.src = state.outfitRefUrl;

  if (analysis) {
    analysis.textContent = '';
    if (state.outfitRefAnalysisLoading) {
      const el = document.createElement('span');
      el.className = 'outfit-ref-analysis-loading';
      el.textContent = 'Analyzing outfit…';
      analysis.appendChild(el);
    } else if (!state.outfitRefAnalysis || state.outfitRefAnalysis.length === 0) {
      const el = document.createElement('span');
      el.className = 'outfit-ref-analysis-error';
      el.textContent = 'Could not detect every item, but you can still try this full look.';
      analysis.appendChild(el);
    } else {
      state.outfitRefAnalysis.forEach(p => {
        const chip = document.createElement('span');
        chip.className = 'outfit-ref-chip';
        chip.textContent = _slotEmoji(p.slot) + ' ' + p.description;
        analysis.appendChild(chip);
      });
    }
  }
}

function _slotEmoji(slot) {
  const t = (window.ASSET_TYPES || ASSET_TYPES).find(x => x.key === slot);
  return t ? t.emoji : '👗';
}

const _ALLOWED_OUTFIT_SLOTS = new Set([
  'top', 'bottom', 'outerwear', 'dress', 'shoes',
  'bag', 'glasses', 'earrings', 'hair_accessory',
  'scarf', 'necklace', 'bracelet', 'belt', 'hat', 'watch', 'tights', 'socks',
]);
const _MAX_DESCRIPTION_LENGTH = 80;

function _validateOutfitPieces(raw) {
  if (!Array.isArray(raw)) return [];
  const valid = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    if (!_ALLOWED_OUTFIT_SLOTS.has(p.slot)) continue;
    if (typeof p.description !== 'string') continue;
    const desc = p.description.trim().slice(0, _MAX_DESCRIPTION_LENGTH);
    if (!desc) continue;
    valid.push({ slot: p.slot, description: desc });
  }
  return valid;
}

async function fetchOutfitRefAnalysis(file) {
  try {
    const form = new FormData();
    form.append('outfit_img', file);
    const resp = await fetch(`${API}/api/try-on/analyze-outfit`, { method: 'POST', body: form });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    state.outfitRefAnalysis = _validateOutfitPieces(data.detected_pieces);
  } catch (err) {
    state.outfitRefAnalysis = [];
  }
  state.outfitRefAnalysisLoading = false;
  renderOutfitRefCard();
}

async function runTryWholeOutfit() {
  if (!state.outfitRefFile) return;

  // Abort any running generation and stamp this one.
  if (state.activeAbortController) state.activeAbortController.abort();
  state.generationRequestId++;
  state.completeLookHistory = [];
  const myId       = state.generationRequestId;
  const controller = new AbortController();
  state.activeAbortController = controller;

  state.tryOnPreview.status   = 'generating';
  state.tryOnPreview.imageUrl = null;
  state.tryOnPreview.videoUrl = null;
  state.tryOnPreview.message  = null;
  renderTryOnPreview();
  updateGenerateButton();

  // Update progress message to reflect whole-outfit operation.
  const msgEl = document.getElementById('tryon-generating-msg');
  const subEl = document.getElementById('tryon-generating-sub');
  if (msgEl) msgEl.textContent = 'Applying the full outfit to your model…';
  if (subEl) subEl.textContent = 'This may take 1–3 minutes. Keep this page open.';

  startGenerationProgress(myId, false);

  try {
    const form = new FormData();
    form.append('outfit_ref', state.outfitRefFile);
    const resp = await fetch(`${API}/api/try-on/full-outfit`, {
      method: 'POST',
      body:   form,
      signal: controller.signal,
      headers: { 'X-Demo-Code': getDemoCode() },
    });
    if (myId !== state.generationRequestId) return;

    const result = await resp.json();
    if (myId !== state.generationRequestId) return;

    if (result.status === 'demo_locked') {
      handleDemoLocked(result.message);
      stopGenerationProgress(false);
      state.tryOnPreview.status  = 'failed';
      state.tryOnPreview.message = result.message || 'Demo code required.';
      state.activeAbortController = null;
      renderTryOnPreview();
      updateGenerateButton();
      return;
    }

    await finishGenerationProgress();
    if (myId !== state.generationRequestId) return;

    if (result.status === 'ready') {
      state.tryOnPreview.status   = 'ready';
      state.tryOnPreview.mode     = result.mode || 'gpt_image_tryon';
      state.tryOnPreview.imageUrl = result.preview_image_url;
      state.tryOnPreview.videoUrl = null;
      state.tryOnPreview.message  = null;
    } else if (result.status === 'provider_required') {
      state.tryOnPreview.status  = 'provider_required';
      state.tryOnPreview.message = result.message || 'GPT Image provider not configured.';
    } else {
      state.tryOnPreview.status  = 'failed';
      state.tryOnPreview.message = result.message || result.error || 'Generation failed.';
    }
  } catch (err) {
    if (myId !== state.generationRequestId) return;
    if (err.name === 'AbortError') return;
    stopGenerationProgress(false);
    state.tryOnPreview.status  = 'failed';
    state.tryOnPreview.message = err.message || 'Generation failed.';
  }

  state.activeAbortController = null;
  renderTryOnPreview();
  updateGenerateButton();
}

function toggleSuggestionSelection(idx) {
  if (state.addToLookInFlight) return; // no changes while edit in progress
  const s = state.completeLookSuggestions[idx];
  if (!s) return;
  const key = `${s.slot}::${s.name}`;
  if (state.completeLookSelected.has(key)) {
    state.completeLookSelected.delete(key);
  } else {
    state.completeLookSelected.add(key);
  }
  renderCompleteTheLook();
}

/* ── Complete the Look (Issue #18) — SVG product thumbnails ─────── */

// Detect primary colour from item name keywords
function _ctl_color(name) {
  const n = (name || '').toLowerCase();
  const has = (...ws) => ws.some(w => n.includes(w));
  if (has('black','ebony','onyx'))                    return {bg:'#e8e5e0',main:'#2c2c2c',light:'#484848',dark:'#1a1a1a'};
  if (has('tan','camel','khaki','sand','nude'))        return {bg:'#f7f0e3',main:'#c8a97a',light:'#dfc09a',dark:'#a07848'};
  if (has('cream','ivory','ecru'))                     return {bg:'#f8f5ec',main:'#ddd3b5',light:'#f0e8d0',dark:'#b8aa80'};
  if (has('gold','golden'))                            return {bg:'#faf5e0',main:'#d4af37',light:'#e8c84a',dark:'#b8960c'};
  if (has('silver','grey','gray','platinum'))          return {bg:'#f0f0f5',main:'#9a9aa8',light:'#b4b4c0',dark:'#6a6a78'};
  if (has('brown','cognac','chocolate','chestnut'))    return {bg:'#f5ede4',main:'#8b5e3c',light:'#a87050',dark:'#6b4020'};
  if (has('navy','cobalt','indigo','blue','denim'))    return {bg:'#e8edf5',main:'#1e3a5f',light:'#2d5a8f',dark:'#0d2040'};
  if (has('burgundy','wine','maroon','red','cherry'))  return {bg:'#f5e8e8',main:'#8b1a2a',light:'#c03030',dark:'#5b0a12'};
  if (has('blush','pink','rose','mauve'))              return {bg:'#fdf0f3',main:'#d4879a',light:'#e8a0b4',dark:'#a8607a'};
  if (has('green','sage','olive','forest','emerald'))  return {bg:'#ecf2ec',main:'#4a7050',light:'#608060',dark:'#2a4830'};
  if (has('white','snow'))                             return {bg:'#f8f8f8',main:'#e0ddd8',light:'#f0eee8',dark:'#b0aca4'};
  if (has('pearl'))                                    return {bg:'#faf8f5',main:'#e8e0d8',light:'#f8f4f0',dark:'#c8bdb0'};
  if (has('rust','terracotta','burnt','orange'))       return {bg:'#f8ede6',main:'#c0582a',light:'#d87040',dark:'#8b3810'};
  return {bg:'#f5f0ec',main:'#8c7c6c',light:'#a89888',dark:'#6c5c4c'};
}

function _ctl_bg(c) {
  return `<rect width="120" height="150" fill="${c.bg}" rx="6"/>`;
}

function _ctl_svgBag(c) {
  return `${_ctl_bg(c)}
    <path d="M36,52 C36,34 84,34 84,52" stroke="${c.dark}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <rect x="18" y="52" width="84" height="74" rx="8" fill="${c.main}"/>
    <rect x="18" y="52" width="84" height="22" rx="8" fill="${c.light}" opacity="0.4"/>
    <rect x="44" y="86" width="32" height="10" rx="4" fill="${c.dark}" opacity="0.6"/>
    <circle cx="60" cy="91" r="3" fill="${c.light}" opacity="0.7"/>`;
}

function _ctl_svgGlasses(c, name) {
  const bg = _ctl_bg(c);
  if (/round|circle|oval/i.test(name || '')) {
    return `${bg}
      <circle cx="34" cy="80" r="20" fill="${c.bg}" stroke="${c.main}" stroke-width="6"/>
      <circle cx="86" cy="80" r="20" fill="${c.bg}" stroke="${c.main}" stroke-width="6"/>
      <path d="M54,80 Q60,74 66,80" stroke="${c.main}" stroke-width="5" fill="none"/>
      <line x1="14" y1="74" x2="4" y2="70" stroke="${c.main}" stroke-width="5" stroke-linecap="round"/>
      <line x1="106" y1="74" x2="116" y2="70" stroke="${c.main}" stroke-width="5" stroke-linecap="round"/>`;
  }
  return `${bg}
    <rect x="5" y="64" width="50" height="32" rx="7" fill="${c.bg}" stroke="${c.main}" stroke-width="6"/>
    <rect x="65" y="64" width="50" height="32" rx="7" fill="${c.bg}" stroke="${c.main}" stroke-width="6"/>
    <line x1="55" y1="80" x2="65" y2="80" stroke="${c.main}" stroke-width="5"/>
    <line x1="5" y1="77" x2="0" y2="72" stroke="${c.main}" stroke-width="5" stroke-linecap="round"/>
    <line x1="115" y1="77" x2="120" y2="72" stroke="${c.main}" stroke-width="5" stroke-linecap="round"/>`;
}

function _ctl_svgEarrings(c, name) {
  const n = name || '';
  const bg = _ctl_bg(c);
  if (/hoop|ring/i.test(n)) {
    return `${bg}
      <circle cx="30" cy="90" r="25" fill="none" stroke="${c.main}" stroke-width="7"/>
      <circle cx="90" cy="90" r="25" fill="none" stroke="${c.main}" stroke-width="7"/>
      <circle cx="30" cy="58" r="5" fill="${c.main}"/>
      <circle cx="90" cy="58" r="5" fill="${c.main}"/>`;
  }
  if (/pearl|stud|ball/i.test(n)) {
    return `${bg}
      <line x1="34" y1="44" x2="34" y2="62" stroke="${c.dark}" stroke-width="3"/>
      <circle cx="34" cy="80" r="18" fill="${c.main}"/>
      <circle cx="28" cy="74" r="5" fill="white" opacity="0.4"/>
      <line x1="86" y1="44" x2="86" y2="62" stroke="${c.dark}" stroke-width="3"/>
      <circle cx="86" cy="80" r="18" fill="${c.main}"/>
      <circle cx="80" cy="74" r="5" fill="white" opacity="0.4"/>`;
  }
  return `${bg}
    <line x1="34" y1="38" x2="34" y2="58" stroke="${c.main}" stroke-width="3"/>
    <ellipse cx="34" cy="86" rx="12" ry="20" fill="${c.main}"/>
    <ellipse cx="28" cy="78" rx="4" ry="6" fill="white" opacity="0.3"/>
    <line x1="86" y1="38" x2="86" y2="58" stroke="${c.main}" stroke-width="3"/>
    <ellipse cx="86" cy="86" rx="12" ry="20" fill="${c.main}"/>
    <ellipse cx="80" cy="78" rx="4" ry="6" fill="white" opacity="0.3"/>`;
}

function _ctl_svgHairAccessory(c, name) {
  const n = name || '';
  const bg = _ctl_bg(c);
  if (/bow|ribbon|scrunchie/i.test(n)) {
    return `${bg}
      <path d="M60,78 L18,50 L32,78 L18,106 Z" fill="${c.main}"/>
      <path d="M60,78 L102,50 L88,78 L102,106 Z" fill="${c.main}"/>
      <path d="M60,78 L25,56 L36,78 L25,100 Z" fill="${c.light}" opacity="0.4"/>
      <path d="M60,78 L95,56 L84,78 L95,100 Z" fill="${c.light}" opacity="0.4"/>
      <ellipse cx="60" cy="78" rx="11" ry="15" fill="${c.dark}"/>
      <ellipse cx="57" cy="73" rx="4" ry="5" fill="${c.light}" opacity="0.4"/>`;
  }
  if (/headband|band/i.test(n)) {
    return `${bg}
      <path d="M12,118 Q60,22 108,118" stroke="${c.main}" stroke-width="14" fill="none" stroke-linecap="round"/>
      <path d="M18,112 Q60,30 102,112" stroke="${c.light}" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.5"/>`;
  }
  if (/hat|cap|beanie|beret/i.test(n)) {
    return `${bg}
      <ellipse cx="60" cy="70" rx="46" ry="34" fill="${c.main}"/>
      <ellipse cx="60" cy="96" rx="52" ry="9" fill="${c.dark}" opacity="0.7"/>
      <ellipse cx="48" cy="58" rx="16" ry="10" fill="${c.light}" opacity="0.35"/>`;
  }
  return `${bg}
    <rect x="28" y="50" width="64" height="46" rx="14" fill="${c.main}"/>
    <path d="M36,50 L40,28 M50,50 L54,26 M64,50 L68,26 M78,50 L82,28 M88,50 L92,30" stroke="${c.dark}" stroke-width="5" stroke-linecap="round" fill="none"/>
    <path d="M36,96 L40,118 M50,96 L54,120 M64,96 L68,120 M78,96 L82,118 M88,96 L92,116" stroke="${c.dark}" stroke-width="5" stroke-linecap="round" fill="none"/>
    <line x1="28" y1="73" x2="92" y2="73" stroke="${c.light}" stroke-width="3" opacity="0.5"/>`;
}

function _ctl_svgShoes(c, name) {
  const n = name || '';
  const bg = _ctl_bg(c);
  if (/heel|pump|stiletto|wedge/i.test(n)) {
    return `${bg}
      <path d="M10,98 Q14,68 38,58 Q72,50 100,60 Q110,67 108,82 L102,98 Z" fill="${c.main}"/>
      <path d="M10,98 Q13,76 32,66" stroke="${c.light}" stroke-width="3" fill="none" opacity="0.6"/>
      <path d="M98,98 L98,112 L110,112 L110,80 Z" fill="${c.dark}"/>
      <ellipse cx="54" cy="100" rx="46" ry="5" fill="${c.dark}" opacity="0.7"/>`;
  }
  if (/sneaker|trainer|runner|sport/i.test(n)) {
    return `${bg}
      <path d="M8,96 Q12,66 32,56 Q68,46 96,56 Q114,64 112,82 L106,96 Z" fill="${c.main}"/>
      <path d="M36,56 Q44,48 52,56" fill="${c.light}" stroke="${c.dark}" stroke-width="1.5"/>
      <line x1="38" y1="62" x2="78" y2="62" stroke="white" stroke-width="2" opacity="0.6"/>
      <line x1="38" y1="70" x2="78" y2="70" stroke="white" stroke-width="2" opacity="0.6"/>
      <path d="M18,82 Q50,66 82,74" stroke="${c.light}" stroke-width="5" fill="none" opacity="0.4"/>
      <rect x="6" y="94" width="108" height="10" rx="4" fill="${c.dark}" opacity="0.75"/>`;
  }
  return `${bg}
    <path d="M10,92 Q14,64 36,54 Q70,46 96,58 Q110,66 108,82 L102,92 Z" fill="${c.main}"/>
    <path d="M30,56 Q26,64 24,76" stroke="${c.dark}" stroke-width="3" fill="none" opacity="0.6"/>
    <path d="M52,60 Q60,52 68,60" stroke="${c.dark}" stroke-width="4" fill="none"/>
    <ellipse cx="56" cy="94" rx="48" ry="5" fill="${c.dark}" opacity="0.7"/>`;
}

function _ctl_svgOuterwear(c, name) {
  const bg = _ctl_bg(c);
  if (/blazer|jacket|suit/i.test(name || '')) {
    return `${bg}
      <path d="M22,28 L18,130 L56,130 L60,80 L64,130 L102,130 L98,28 L80,14 L60,32 L40,14 Z" fill="${c.main}"/>
      <path d="M60,32 L40,14 L22,28 L26,72 Z" fill="${c.dark}" opacity="0.4"/>
      <path d="M60,32 L80,14 L98,28 L94,72 Z" fill="${c.dark}" opacity="0.4"/>
      <circle cx="60" cy="95" r="5" fill="${c.light}" opacity="0.8"/>
      <circle cx="60" cy="112" r="5" fill="${c.light}" opacity="0.8"/>`;
  }
  return `${bg}
    <path d="M22,26 L16,130 L54,130 L60,80 L66,130 L104,130 L98,26 L78,12 L60,30 L42,12 Z" fill="${c.main}"/>
    <path d="M60,30 L42,12 L22,26 L26,72 Z" fill="${c.dark}" opacity="0.35"/>
    <path d="M60,30 L78,12 L98,26 L94,72 Z" fill="${c.dark}" opacity="0.35"/>
    <rect x="18" y="82" width="84" height="7" rx="3" fill="${c.dark}" opacity="0.5"/>
    <rect x="50" y="80" width="20" height="11" rx="3" fill="${c.light}" opacity="0.7"/>`;
}

function _ctl_svgTop(c) {
  return `${_ctl_bg(c)}
    <path d="M32,30 L16,48 L28,60 L38,50 L38,128 L82,128 L82,50 L92,60 L104,48 L88,30 L72,22 L60,30 L48,22 Z" fill="${c.main}"/>
    <path d="M48,30 L60,46 L72,30" stroke="${c.dark}" stroke-width="2.5" fill="none"/>
    <path d="M42,50 L42,128 L46,128 L46,50 Z" fill="${c.light}" opacity="0.3"/>`;
}

function _ctl_svgBottom(c, name) {
  const bg = _ctl_bg(c);
  if (/skirt|midi|maxi/i.test(name || '')) {
    return `${bg}
      <path d="M36,32 L22,130 L98,130 L84,32 Z" fill="${c.main}"/>
      <rect x="33" y="28" width="54" height="10" rx="4" fill="${c.dark}" opacity="0.7"/>
      <path d="M50,42 L42,130" stroke="${c.light}" stroke-width="2" opacity="0.4"/>`;
  }
  return `${bg}
    <path d="M24,30 L18,130 L52,130 L60,90 L68,130 L102,130 L96,30 Z" fill="${c.main}"/>
    <rect x="21" y="26" width="78" height="10" rx="4" fill="${c.dark}" opacity="0.7"/>
    <line x1="42" y1="42" x2="36" y2="130" stroke="${c.light}" stroke-width="1.5" opacity="0.4"/>
    <line x1="78" y1="42" x2="84" y2="130" stroke="${c.light}" stroke-width="1.5" opacity="0.4"/>`;
}

function _ctl_svgDress(c) {
  return `${_ctl_bg(c)}
    <path d="M40,18 L36,68 L16,130 L104,130 L84,68 L80,18 Z" fill="${c.main}"/>
    <path d="M40,20 Q60,36 80,20" stroke="${c.dark}" stroke-width="2.5" fill="none"/>
    <line x1="36" y1="68" x2="84" y2="68" stroke="${c.dark}" stroke-width="1.5" opacity="0.5"/>
    <path d="M48,22 L44,68 L32,130 L36,130 L48,68 L52,22 Z" fill="${c.light}" opacity="0.3"/>`;
}

function _ctl_svgScarf(c) {
  return `${_ctl_bg(c)}
    <path d="M18,44 Q60,18 102,44 L98,62 Q60,38 22,62 Z" fill="${c.main}"/>
    <path d="M22,62 Q60,38 98,62 L94,80 Q60,56 26,80 Z" fill="${c.light}" opacity="0.75"/>
    <path d="M26,80 Q60,56 94,80 L90,98 Q60,74 30,98 Z" fill="${c.main}" opacity="0.85"/>
    <path d="M30,98 L20,148" stroke="${c.dark}" stroke-width="20" stroke-linecap="round" fill="none"/>
    <path d="M90,98 L100,148" stroke="${c.main}" stroke-width="16" stroke-linecap="round" fill="none"/>
    <path d="M22,132 L28,148" stroke="${c.light}" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.5"/>`;
}

function _ctl_svgNecklace(c, name) {
  const bg = _ctl_bg(c);
  if (/pearl|bead/i.test(name || '')) {
    return `${bg}
      <circle cx="20" cy="52" r="7" fill="${c.main}"/><circle cx="32" cy="66" r="7" fill="${c.main}"/>
      <circle cx="46" cy="78" r="7" fill="${c.main}"/><circle cx="60" cy="82" r="7" fill="${c.main}"/>
      <circle cx="74" cy="78" r="7" fill="${c.main}"/><circle cx="88" cy="66" r="7" fill="${c.main}"/>
      <circle cx="100" cy="52" r="7" fill="${c.main}"/>
      <circle cx="22" cy="48" r="2" fill="white" opacity="0.5"/><circle cx="62" cy="78" r="2" fill="white" opacity="0.5"/>
      <path d="M20,52 Q16,38 22,28 Q30,18 40,26" fill="none" stroke="${c.main}" stroke-width="3" stroke-linecap="round"/>
      <path d="M100,52 Q104,38 98,28 Q90,18 80,26" fill="none" stroke="${c.main}" stroke-width="3" stroke-linecap="round"/>`;
  }
  return `${bg}
    <path d="M22,48 Q60,112 98,48" fill="none" stroke="${c.main}" stroke-width="4" stroke-linecap="round"/>
    <path d="M22,48 Q14,36 20,26 Q28,16 38,24" fill="none" stroke="${c.main}" stroke-width="3" stroke-linecap="round"/>
    <path d="M98,48 Q106,36 100,26 Q92,16 82,24" fill="none" stroke="${c.main}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="60" cy="116" rx="10" ry="14" fill="${c.main}"/>
    <ellipse cx="57" cy="112" rx="3" ry="4" fill="white" opacity="0.35"/>`;
}

function _ctl_svgBracelet(c, name) {
  const bg = _ctl_bg(c);
  if (/bead|pearl|charm/i.test(name || '')) {
    return `${bg}
      <ellipse cx="60" cy="80" rx="42" ry="21" fill="none" stroke="${c.main}" stroke-width="3"/>
      <circle cx="18" cy="80" r="9" fill="${c.main}"/><circle cx="31" cy="60" r="9" fill="${c.light}"/>
      <circle cx="51" cy="56" r="9" fill="${c.main}"/><circle cx="69" cy="56" r="9" fill="${c.light}"/>
      <circle cx="89" cy="60" r="9" fill="${c.main}"/><circle cx="102" cy="80" r="9" fill="${c.light}"/>
      <circle cx="20" cy="76" r="3" fill="white" opacity="0.4"/>`;
  }
  return `${bg}
    <ellipse cx="60" cy="80" rx="44" ry="22" fill="none" stroke="${c.main}" stroke-width="16"/>
    <ellipse cx="60" cy="80" rx="44" ry="22" fill="none" stroke="${c.light}" stroke-width="4" opacity="0.45"/>
    <rect x="50" y="61" width="20" height="14" rx="3" fill="${c.dark}"/>
    <rect x="52" y="63" width="16" height="10" rx="2" fill="${c.light}" opacity="0.6"/>`;
}

function _ctl_svgBelt(c) {
  return `${_ctl_bg(c)}
    <rect x="6" y="62" width="108" height="26" rx="5" fill="${c.main}"/>
    <rect x="6" y="62" width="108" height="9" rx="5" fill="${c.light}" opacity="0.35"/>
    <rect x="44" y="58" width="32" height="34" rx="5" fill="${c.dark}" opacity="0.9"/>
    <rect x="46" y="60" width="28" height="30" rx="4" fill="${c.main}"/>
    <circle cx="60" cy="75" r="8" fill="${c.dark}" opacity="0.85"/>
    <circle cx="60" cy="75" r="4.5" fill="${c.light}" opacity="0.55"/>
    <circle cx="12" cy="75" r="4" fill="${c.dark}" opacity="0.45"/>
    <circle cx="22" cy="75" r="4" fill="${c.dark}" opacity="0.45"/>
    <circle cx="32" cy="75" r="4" fill="${c.dark}" opacity="0.45"/>`;
}

function _ctl_svgHat(c, name) {
  const n = name || '';
  const bg = _ctl_bg(c);
  if (/beanie|knit|wool/i.test(n)) {
    return `${bg}
      <path d="M20,102 Q22,44 60,36 Q98,44 100,102 Z" fill="${c.main}"/>
      <rect x="18" y="98" width="84" height="18" rx="9" fill="${c.dark}" opacity="0.8"/>
      <path d="M30,82 Q60,74 90,82" stroke="${c.light}" stroke-width="5" fill="none" opacity="0.5"/>
      <path d="M26,97 Q60,88 94,97" stroke="${c.light}" stroke-width="4" fill="none" opacity="0.4"/>
      <circle cx="60" cy="38" r="11" fill="${c.dark}" opacity="0.7"/>`;
  }
  if (/fedora|wide|brim/i.test(n)) {
    return `${bg}
      <ellipse cx="60" cy="90" rx="56" ry="13" fill="${c.dark}" opacity="0.85"/>
      <path d="M24,90 Q28,46 60,38 Q92,46 96,90 Z" fill="${c.main}"/>
      <ellipse cx="60" cy="90" rx="36" ry="9" fill="${c.main}"/>
      <path d="M30,70 Q60,62 90,70" stroke="${c.light}" stroke-width="4" fill="none" opacity="0.45"/>`;
  }
  return `${bg}
    <ellipse cx="60" cy="96" rx="52" ry="11" fill="${c.dark}" opacity="0.8"/>
    <path d="M26,96 Q28,50 60,42 Q92,50 94,96 Z" fill="${c.main}"/>
    <ellipse cx="60" cy="96" rx="34" ry="9" fill="${c.main}"/>
    <path d="M32,76 Q60,68 88,76" stroke="${c.light}" stroke-width="4" fill="none" opacity="0.4"/>`;
}

function _ctl_svgWatch(c) {
  return `${_ctl_bg(c)}
    <rect x="44" y="20" width="8" height="36" rx="4" fill="${c.dark}" opacity="0.8"/>
    <rect x="68" y="20" width="8" height="36" rx="4" fill="${c.dark}" opacity="0.8"/>
    <rect x="44" y="94" width="8" height="36" rx="4" fill="${c.dark}" opacity="0.8"/>
    <rect x="68" y="94" width="8" height="36" rx="4" fill="${c.dark}" opacity="0.8"/>
    <rect x="18" y="52" width="84" height="46" rx="14" fill="${c.dark}"/>
    <rect x="20" y="54" width="80" height="42" rx="12" fill="${c.main}"/>
    <circle cx="60" cy="75" r="17" fill="${c.bg}" stroke="${c.dark}" stroke-width="2.5"/>
    <line x1="60" y1="75" x2="60" y2="62" stroke="${c.dark}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="60" y1="75" x2="70" y2="79" stroke="${c.dark}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="60" cy="75" r="2.5" fill="${c.dark}"/>`;
}

function _ctl_svgTights(c) {
  return `${_ctl_bg(c)}
    <path d="M36,18 L28,148" stroke="${c.main}" stroke-width="30" stroke-linecap="round" fill="none"/>
    <path d="M84,18 L92,148" stroke="${c.main}" stroke-width="30" stroke-linecap="round" fill="none"/>
    <path d="M36,18 L84,18 L80,60 L60,65 L40,60 Z" fill="${c.main}"/>
    <path d="M40,28 L34,148" stroke="${c.light}" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.35"/>
    <path d="M80,28 L86,148" stroke="${c.light}" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.35"/>`;
}

function _ctl_svgSocks(c, name) {
  const bg = _ctl_bg(c);
  if (/ankle|low/i.test(name || '')) {
    return `${bg}
      <path d="M34,74 Q32,102 26,120 Q28,142 50,142 Q72,132 74,120 L70,98 Q78,82 78,74 Z" fill="${c.main}"/>
      <rect x="31" y="64" width="50" height="14" rx="5" fill="${c.dark}" opacity="0.7"/>
      <path d="M38,82 Q40,112 34,130" stroke="${c.light}" stroke-width="4" fill="none" opacity="0.4"/>`;
  }
  return `${bg}
    <path d="M34,24 Q32,82 26,120 Q28,142 50,142 Q72,132 74,120 L70,92 Q78,74 78,24 Z" fill="${c.main}"/>
    <rect x="31" y="14" width="50" height="14" rx="5" fill="${c.dark}" opacity="0.65"/>
    <path d="M34,50 L78,50" stroke="${c.light}" stroke-width="5" fill="none" opacity="0.4"/>
    <path d="M38,62 Q40,102 34,130" stroke="${c.light}" stroke-width="4" fill="none" opacity="0.35"/>`;
}

// Returns an SVG data URI thumbnail for a suggestion card
function generateSuggestionThumbnail(slot, name) {
  const c = _ctl_color(name);
  let inner = '';
  switch (slot) {
    case 'bag':            inner = _ctl_svgBag(c);                 break;
    case 'glasses':        inner = _ctl_svgGlasses(c, name);       break;
    case 'earrings':       inner = _ctl_svgEarrings(c, name);      break;
    case 'hair_accessory': inner = _ctl_svgHairAccessory(c, name); break;
    case 'shoes':          inner = _ctl_svgShoes(c, name);         break;
    case 'outerwear':      inner = _ctl_svgOuterwear(c, name);     break;
    case 'top':            inner = _ctl_svgTop(c);                 break;
    case 'bottom':         inner = _ctl_svgBottom(c, name);        break;
    case 'dress':          inner = _ctl_svgDress(c);               break;
    case 'scarf':          inner = _ctl_svgScarf(c);               break;
    case 'necklace':       inner = _ctl_svgNecklace(c, name);      break;
    case 'bracelet':       inner = _ctl_svgBracelet(c, name);      break;
    case 'belt':           inner = _ctl_svgBelt(c);                break;
    case 'hat':            inner = _ctl_svgHat(c, name);           break;
    case 'watch':          inner = _ctl_svgWatch(c);               break;
    case 'tights':         inner = _ctl_svgTights(c);              break;
    case 'socks':          inner = _ctl_svgSocks(c, name);         break;
    default:
      inner = `${_ctl_bg(c)}<path d="M60,20 L96,60 L60,130 L24,60 Z" fill="${c.main}"/>`;
  }
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150">${inner}</svg>`);
}

// Render SVG data URI to a PNG Blob (for wardrobe asset and reference image upload)
function svgDataUriToBlob(svgDataUri, w, h) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = w || 240;
      canvas.height = h || 300;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(blob), 'image/png');
    };
    img.src = svgDataUri;
  });
}

function renderCompleteTheLook() {
  const section        = document.getElementById('complete-the-look');
  const cardsEl        = document.getElementById('complete-look-cards');
  const refreshBtn     = document.getElementById('refresh-suggestions-btn');
  const statusBar      = document.getElementById('add-to-look-status');
  const batchProgressEl = document.getElementById('batch-progress-bar');
  const batchActionBar = document.getElementById('batch-action-bar');
  if (!section || !cardsEl) return;

  if (state.tryOnPreview.status !== 'ready' || !state.tryOnPreview.imageUrl) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  // Single-item status bar — visible only during single edit (not batch)
  if (statusBar) statusBar.classList.toggle('hidden', !state.addToLookInFlight || state.batchEditActive);

  // Batch progress bar — visible only during batch edit
  if (batchProgressEl) batchProgressEl.classList.toggle('hidden', !state.batchEditActive);

  // Effective count = keys that still match a visible suggestion (guards against stale keys after replacement)
  const effectiveSelCount = state.completeLookSuggestions.filter(s =>
    state.completeLookSelected.has(`${s.slot}::${s.name}`)
  ).length;

  // Refresh button — visible when there are cards, nothing is in-flight, and no selection active
  if (refreshBtn) {
    refreshBtn.classList.toggle('hidden',
      state.completeLookSuggestions.length === 0
      || state.addToLookInFlight
      || effectiveSelCount > 0);
  }

  // Batch action bar — visible when ≥1 card selected and no edit running
  if (batchActionBar) {
    batchActionBar.classList.toggle('hidden', effectiveSelCount === 0 || state.addToLookInFlight);
    const countEl        = document.getElementById('batch-selected-count');
    const applyBtn       = document.getElementById('apply-selected-btn');
    const stagePlanBtn   = document.getElementById('stage-selected-plan-btn');
    if (countEl)      countEl.textContent = effectiveSelCount === 1 ? '1 selected' : `${effectiveSelCount} selected`;
    if (applyBtn)     applyBtn.disabled   = effectiveSelCount === 0;
    if (stagePlanBtn) stagePlanBtn.disabled = effectiveSelCount === 0;
  }

  if (state.completeLookLoading) {
    cardsEl.innerHTML = '<p class="complete-look-loading">Finding complementary items…</p>';
    return;
  }
  if (state.completeLookError) {
    cardsEl.innerHTML = `<p class="complete-look-error">${state.completeLookError}</p>`;
    return;
  }
  if (state.completeLookSuggestions.length === 0) {
    cardsEl.innerHTML = '';
    return;
  }

  const inFlight = state.addToLookInFlight;
  cardsEl.innerHTML = state.completeLookSuggestions.map((s, i) => {
    const thumb      = generateSuggestionThumbnail(s.slot, s.name);
    const slotLbl    = (s.slot || '').replace(/_/g, ' ');
    const selKey     = `${s.slot}::${s.name}`;
    const isSelected = state.completeLookSelected.has(selKey);
    const isActive   = inFlight && state.addToLookActiveIdx === i;
    const isWaiting  = inFlight && !state.batchEditActive && state.addToLookActiveIdx !== i;
    const addTxt     = isActive ? 'Adding…' : (isWaiting ? 'Wait for current edit' : '+ Add Now');
    const planKey    = `${s.slot}::${s.name}`;
    const inPlan     = state.planItems.some(p => p.slot === s.slot && p.name === s.name);
    return `
      <div class="complete-look-card${isSelected ? ' ctl-selected' : ''}">
        <button class="ctl-card-check${isSelected ? ' ctl-checked' : ''}"
                data-index="${i}" ${inFlight ? 'disabled' : ''}
                title="${isSelected ? 'Deselect' : 'Select for batch add'}">&#10003;</button>
        <div class="complete-look-card-thumb">
          <img src="${thumb}" alt="${slotLbl}" draggable="false" />
        </div>
        <div class="complete-look-card-info">
          <span class="complete-look-card-slot">${slotLbl}</span>
          <span class="complete-look-card-name">${s.name || ''}</span>
          <span class="complete-look-card-reason">${s.reason || ''}</span>
        </div>
        <div class="complete-look-card-actions">
          <button class="btn-add-to-look" data-index="${i}" ${inFlight ? 'disabled' : ''}>${addTxt}</button>
          <button class="btn-add-to-plan${inPlan ? ' btn-in-plan' : ''}" data-index="${i}" title="${inPlan ? 'Already in plan' : 'Stage for high-quality plan'}">${inPlan ? '&#10003; In Plan' : '+ Plan'}</button>
          <button class="btn-add-to-wardrobe" data-index="${i}" ${inFlight ? 'disabled' : ''}>+ Wardrobe</button>
        </div>
      </div>`;
  }).join('');

  cardsEl.querySelectorAll('.ctl-card-check').forEach(btn => {
    btn.addEventListener('click', () => toggleSuggestionSelection(parseInt(btn.dataset.index, 10)));
  });
  cardsEl.querySelectorAll('.btn-add-to-look').forEach(btn => {
    btn.addEventListener('click', () => addSuggestionToLook(parseInt(btn.dataset.index, 10)));
  });
  cardsEl.querySelectorAll('.btn-add-to-plan').forEach(btn => {
    btn.addEventListener('click', () => addToPlan(parseInt(btn.dataset.index, 10)));
  });
  cardsEl.querySelectorAll('.btn-add-to-wardrobe').forEach(btn => {
    btn.addEventListener('click', () => addSuggestionToWardrobe(parseInt(btn.dataset.index, 10), btn));
  });
}

async function fetchCompleteTheLookSuggestions() {
  // Always show curated fallbacks immediately so cards are never empty.
  const fallbacks = buildClientFallbackSuggestions();
  _addSuggestionHistory(fallbacks);
  state.completeLookSuggestions = fallbacks;
  state.completeLookLoading     = false;
  state.completeLookError       = null;
  state.completeLookSelected    = new Set();
  renderCompleteTheLook();

  // Claude-personalized suggestions require at least one assigned slot.
  const assignedSlots = Object.entries(state.slotAssignments)
    .filter(([, id]) => !!id)
    .map(([slot]) => slot)
    .join(',');
  if (!assignedSlots) return;

  // Fetch Claude-personalized suggestions in the background.
  try {
    const form = new FormData();
    form.append('assigned_slots', assignedSlots);
    if (state.completeLookHistory.length > 0) {
      form.append('recent_history', state.completeLookHistory.join(','));
    }
    const resp   = await fetch(`${API}/api/try-on/suggest-items`, { method: 'POST', body: form });
    if (!resp.ok) return; // keep fallback silently
    const result = await resp.json();
    const server  = result.suggestions || [];
    if (server.length > 0) {
      // Filter recently shown items; if ALL server results are stale, keep the fresh fallback visible
      const historySet = new Set(state.completeLookHistory);
      const fresh = server.filter(s => !historySet.has(`${s.slot}::${s.name}`));
      if (fresh.length > 0) {
        _addSuggestionHistory(fresh);
        state.completeLookSelected.clear();
        state.completeLookSuggestions = fresh;
        state.completeLookError       = null;
        renderCompleteTheLook();
      }
      // If all server results are stale, keep the fresh local fallback already visible.
    }
    // If empty, keep the local fallback — no error shown.
  } catch (_) {
    // Network or parse error — keep fallback silently, no toast.
  }
}

async function addSuggestionToLook(idx) {
  if (state.addToLookInFlight) return; // Req 3: prevent concurrent edits
  const suggestion = state.completeLookSuggestions[idx];
  if (!suggestion || !state.tryOnPreview.imageUrl) return;

  // Req 9: serve from cache if this exact edit was already done on this preview.
  const cacheKey = `${state.tryOnPreview.imageUrl}||${suggestion.slot}||${suggestion.name}`;
  if (state.addToLookCache.has(cacheKey)) {
    const cachedUrl = state.addToLookCache.get(cacheKey);
    state.tryOnPreview.imageUrl = cachedUrl;
    state.completeLookImageUrl  = cachedUrl;
    renderTryOnPreview();
    return;
  }

  // Req 3/4/5: mark in-flight, stamp request id, create abort controller.
  state.addToLookInFlight        = true;
  state.addToLookRequestId++;
  state.addToLookActiveIdx       = idx;
  const myAddId                  = state.addToLookRequestId;
  const controller               = new AbortController();
  state.activeAddAbortController = controller;
  renderCompleteTheLook();

  // Req 10: status bar copy
  const msgEl = document.getElementById('add-to-look-msg');
  const subEl = document.getElementById('add-to-look-sub');
  if (msgEl) msgEl.textContent = 'Adding this item to your look…';
  if (subEl) subEl.textContent = 'High-quality edits may take 1–3 minutes. Keep this page open.';

  // Escalate message after 90 s.
  const slowTimer = setTimeout(() => {
    if (state.addToLookInFlight && myAddId === state.addToLookRequestId) {
      if (msgEl) msgEl.textContent = 'Still adding the item…';
      if (subEl) subEl.textContent = 'Keeping your existing look stable can take extra time.';
    }
  }, 90000);

  try {
    const previewBlob   = await previewImageToBlob(state.tryOnPreview.imageUrl);
    const thumbUri      = generateSuggestionThumbnail(suggestion.slot, suggestion.name);
    const referenceBlob = await svgDataUriToBlob(thumbUri, 240, 300);

    const form = new FormData();
    form.append('preview_image',    previewBlob,   'preview.png');
    form.append('reference_image',  referenceBlob, 'reference.png');
    form.append('slot',             suggestion.slot);
    form.append('item_description', suggestion.name);

    const resp = await fetch(`${API}/api/try-on/add-item`,
      { method: 'POST', body: form, signal: controller.signal, headers: { 'X-Demo-Code': getDemoCode() } });
    if (myAddId !== state.addToLookRequestId) return; // Req 4: stale result guard

    const result = await resp.json();
    if (myAddId !== state.addToLookRequestId) return; // Req 4: stale result guard

    if (result.status === 'demo_locked') { handleDemoLocked(result.message); return; }
    if (resp.ok && result.preview_image_url) {
      state.addToLookCache.set(cacheKey, result.preview_image_url); // Req 9: store
      state.tryOnPreview.imageUrl = result.preview_image_url;
      state.completeLookImageUrl  = result.preview_image_url;
      renderTryOnPreview();
      // Req 6: do NOT auto-refresh suggestions — keep existing cards.
    } else {
      showToast(result.message || 'Could not add this item to the look. Please try again.', true);
    }
  } catch (err) {
    // Req 5: AbortError = user cancelled; stale = superseded — both silent.
    if (err.name === 'AbortError' || myAddId !== state.addToLookRequestId) return;
    const msg = (err.message || '').includes('GPT Image Static Try-On')
      ? err.message
      : 'Could not add this item to the look. Please try again.';
    showToast(msg, true);
  } finally {
    clearTimeout(slowTimer);
    if (myAddId === state.addToLookRequestId) {
      state.addToLookInFlight        = false;
      state.addToLookActiveIdx       = null;
      state.activeAddAbortController = null;
      renderCompleteTheLook();
    }
  }
}

async function applySelectedToLook() {
  if (state.addToLookInFlight) return;
  if (state.completeLookSelected.size === 0 || !state.tryOnPreview.imageUrl) return;

  const selectedItems = state.completeLookSuggestions.filter(s =>
    state.completeLookSelected.has(`${s.slot}::${s.name}`)
  );
  if (selectedItems.length === 0) return;

  // Batch cache key — sorted by slot+name so order doesn't matter
  const cacheKey = state.tryOnPreview.imageUrl + '||batch||'
    + selectedItems.map(s => `${s.slot}:${s.name}`).join(',');
  if (state.addToLookCache.has(cacheKey)) {
    const cachedUrl = state.addToLookCache.get(cacheKey);
    state.tryOnPreview.imageUrl    = cachedUrl;
    state.completeLookImageUrl     = cachedUrl;
    state.completeLookSelected     = new Set();
    renderTryOnPreview();
    return;
  }

  // Mark in-flight (shared gate with single-item add)
  state.addToLookInFlight        = true;
  state.addToLookRequestId++;
  state.addToLookActiveIdx       = null; // batch mode
  state.batchEditActive          = true;
  state.batchProgress            = 0;
  const myAddId                  = state.addToLookRequestId;
  const controller               = new AbortController();
  state.activeAddAbortController = controller;
  renderCompleteTheLook();

  const msgEl  = document.getElementById('batch-progress-msg');
  const subEl  = document.getElementById('batch-progress-sub');
  const fillEl = document.getElementById('batch-progress-fill');
  if (msgEl)  msgEl.textContent  = 'Preparing batch edit…';
  if (subEl)  subEl.textContent  = 'High-quality edits may take 1–3 minutes. Keep this page open.';
  if (fillEl) fillEl.style.width = '0%';

  // Decelerating fake-progress animation
  const startTime = Date.now();
  let pct = 0;
  let progressInterval = null;
  progressInterval = setInterval(() => {
    if (!state.batchEditActive || myAddId !== state.addToLookRequestId) {
      clearInterval(progressInterval);
      return;
    }
    pct = Math.min(90, pct + Math.max(0.15, (90 - pct) * 0.018));
    state.batchProgress = pct;
    if (fillEl) fillEl.style.width = pct + '%';
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > 90) {
      if (msgEl) msgEl.textContent = 'Still applying…';
      if (subEl) subEl.textContent = 'Large batch edits can take extra time. Please keep this page open.';
    } else if (elapsed > 20) {
      if (msgEl) msgEl.textContent = 'Finalizing the result…';
    } else if (elapsed > 5) {
      if (msgEl) msgEl.textContent = 'Applying selected items…';
    }
  }, 1000);

  try {
    const previewBlob = await previewImageToBlob(state.tryOnPreview.imageUrl);
    const form = new FormData();
    form.append('preview_image', previewBlob, 'preview.png');
    for (const item of selectedItems) {
      form.append('slots',             item.slot);
      form.append('item_descriptions', item.name);
      const thumbUri = generateSuggestionThumbnail(item.slot, item.name);
      const refBlob  = await svgDataUriToBlob(thumbUri, 240, 300);
      form.append('reference_images',  refBlob, item.slot + '-ref.png');
    }

    const resp = await fetch(`${API}/api/try-on/add-items`,
      { method: 'POST', body: form, signal: controller.signal, headers: { 'X-Demo-Code': getDemoCode() } });
    if (myAddId !== state.addToLookRequestId) return; // stale

    const result = await resp.json();
    if (myAddId !== state.addToLookRequestId) return; // stale

    if (result.status === 'demo_locked') { handleDemoLocked(result.message); return; }
    if (resp.ok && result.preview_image_url) {
      state.addToLookCache.set(cacheKey, result.preview_image_url);
      state.tryOnPreview.imageUrl = result.preview_image_url;
      state.completeLookImageUrl  = result.preview_image_url;
      state.completeLookSelected  = new Set(); // clear selection after success
      if (fillEl) fillEl.style.width = '100%';
      renderTryOnPreview();
      // No auto-refresh of suggestions (Issue 19 Req 6)
    } else {
      showToast(result.message || 'Could not apply batch edit. Please try again.', true);
    }
  } catch (err) {
    if (err.name === 'AbortError' || myAddId !== state.addToLookRequestId) return; // silent cancel/stale
    const msg = (err.message || '').includes('GPT Image Static Try-On')
      ? err.message
      : 'Could not apply batch edit. Please try again.';
    showToast(msg, true);
  } finally {
    clearInterval(progressInterval);
    if (myAddId === state.addToLookRequestId) {
      state.addToLookInFlight        = false;
      state.addToLookActiveIdx       = null;
      state.activeAddAbortController = null;
      state.batchEditActive          = false;
      state.batchProgress            = 0;
      renderCompleteTheLook();
    }
  }
}

async function addSuggestionToWardrobe(idx, btn) {
  const suggestion = state.completeLookSuggestions[idx];
  if (!suggestion) return;

  const originalText = btn.textContent;
  btn.disabled    = true;
  btn.textContent = '✓ Added';

  const thumbUri = generateSuggestionThumbnail(suggestion.slot, suggestion.name);
  const blob     = await svgDataUriToBlob(thumbUri, 240, 300);
  const fileName = (suggestion.slot || 'item') + '-suggestion.png';
  const file     = new File([blob], fileName, { type: 'image/png' });
  const id       = `asset_${++_assetIdCounter}`;

  state.clothingAssets.push({
    id,
    file,
    rawImageUrl:        URL.createObjectURL(file),
    cleanAssetUrl:      null,
    extractionStatus:   'mock',
    detectedType:       suggestion.slot,
    itemName:           suggestion.name || '',
    garmentDescription: suggestion.reason || '',
    garmentLayerReady:  false,
    containsModel:      false,
    cleanupNeeded:      false,
    userTypeOverride:   true,
    ambiguous:          false,
    possibleTypes:      [suggestion.slot],
    confidence:         1.0,
    type:               suggestion.slot,
  });
  renderAssetLibrary();
  updateDropZones();
  updateStudioExtras();
  updateStudioPieceCount();
  updateGenerateButton();

  setTimeout(() => {
    btn.disabled    = false;
    btn.textContent = originalText;
  }, 2000);
}

function dataUrlToBlob(dataUrl) {
  return new Promise(resolve => {
    const [header, b64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const bytes = atob(b64);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    resolve(new Blob([arr], { type: mime }));
  });
}

// Converts any preview imageUrl to a Blob — handles both data: URIs and hosted http/https URLs.
async function previewImageToBlob(imageUrl) {
  if (!imageUrl) throw new Error('No preview image available.');
  if (imageUrl.startsWith('data:')) {
    return dataUrlToBlob(imageUrl);
  }
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    try {
      const resp = await fetch(imageUrl, { mode: 'cors' });
      if (!resp.ok) throw new Error('fetch failed');
      return resp.blob();
    } catch (_) {
      throw new Error(
        'Could not use this preview for editing. Try generating with GPT Image Static Try-On.');
    }
  }
  throw new Error(
    'Could not use this preview for editing. Try generating with GPT Image Static Try-On.');
}

/* ── Garment Clean Asset Pipeline (Issue #4) ─────────────────── */

function generateMockCleanAsset(rawImageUrl, type) {
  // Type-aware crop regions [xStart, yStart, xEnd, yEnd] as fractions of image dimensions.
  // Isolates the relevant garment area — for model photos, removes face / off-body regions.
  const CROP_REGIONS = {
    top:            [0.08, 0.08, 0.92, 0.62],  // upper torso only
    bottom:         [0.08, 0.35, 0.92, 0.95],  // waist-to-ankle
    shoes:          [0.08, 0.52, 0.92, 1.00],  // feet area
    dress:          [0.05, 0.05, 0.95, 0.90],  // tall garment, neck-to-hem
    outerwear:      [0.05, 0.05, 0.95, 0.88],  // same as dress
    bag:            [0.12, 0.12, 0.88, 0.88],  // center square for accessories
    glasses:        [0.15, 0.15, 0.85, 0.85],  // center square for small accessories
    earrings:       [0.15, 0.15, 0.85, 0.85],  // center square for small accessories
    hair_accessory: [0.10, 0.10, 0.90, 0.90],  // slightly wider for hair pieces
  };
  const [x0, y0, x1, y1] = CROP_REGIONS[type] || CROP_REGIONS.top;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const srcX = Math.round(img.naturalWidth  * x0);
      const srcY = Math.round(img.naturalHeight * y0);
      const srcW = Math.round(img.naturalWidth  * (x1 - x0));
      const srcH = Math.round(img.naturalHeight * (y1 - y0));

      const OUT = 480;
      const canvas = document.createElement('canvas');
      canvas.width  = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext('2d');
      // Neutral product-cutout background
      ctx.fillStyle = '#F4F1EC';
      ctx.fillRect(0, 0, OUT, OUT);
      // Scale the cropped region to fit with 6% padding
      const pad   = OUT * 0.06;
      const avail = OUT - pad * 2;
      const scale = Math.min(avail / srcW, avail / srcH);
      const drawW = srcW * scale;
      const drawH = srcH * scale;
      ctx.drawImage(img, srcX, srcY, srcW, srcH,
        (OUT - drawW) / 2, (OUT - drawH) / 2, drawW, drawH);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(rawImageUrl);
    img.src = rawImageUrl;
  });
}

async function analyzeGarmentAsset(id, file) {
  try {
    const form = new FormData();
    form.append('photo', file);
    const resp = await fetch(`${API}/api/garment/analyze`, { method: 'POST', body: form });
    const meta = resp.ok ? await resp.json() : {};

    const asset = state.clothingAssets.find(a => a.id === id);
    if (!asset) return;

    // Apply Claude-detected metadata
    const possibleTypes = Array.isArray(meta.possible_types)
      ? meta.possible_types.filter(t => ASSET_TYPES.find(x => x.key === t))
      : [];
    const isAmbiguous = !!meta.ambiguous && possibleTypes.length > 1;
    asset.possibleTypes = possibleTypes;
    asset.confidence    = meta.confidence ?? 0;
    asset.ambiguous     = isAmbiguous;
    if (meta.detected_type && ASSET_TYPES.find(t => t.key === meta.detected_type)) {
      asset.detectedType = meta.detected_type;
      // Only auto-assign type if the user hasn't overridden AND the detection is unambiguous
      if (!asset.userTypeOverride && !isAmbiguous) asset.type = meta.detected_type;
    }
    asset.itemName           = meta.item_name           || null;
    asset.garmentDescription = meta.garment_description || null;
    asset.containsModel      = !!meta.contains_model;
    asset.cleanupNeeded      = !!meta.cleanup_needed;

    // Type-aware canvas crop — use detected type for the most accurate crop region
    const cropType = asset.detectedType || asset.type;
    asset.cleanAssetUrl     = await generateMockCleanAsset(asset.rawImageUrl, cropType);
    asset.extractionStatus  = resp.ok ? 'mock' : 'failed';
    asset.garmentLayerReady = true;
  } catch (_) {
    const asset = state.clothingAssets.find(a => a.id === id);
    if (asset) {
      asset.extractionStatus  = 'failed';
      asset.cleanAssetUrl     = await generateMockCleanAsset(asset.rawImageUrl, asset.type);
      asset.garmentLayerReady = true;
    }
  } finally {
    renderAssetLibrary();
    updateDropZones();
    updateStudioExtras();
  }
}

function switchOutfitMode(mode) {
  if (mode === state.outfitMode) return;
  state.outfitMode = mode;
  // Clear conflicting slot assignments when switching mode
  if (mode === 'dress') {
    state.slotAssignments.top    = null;
    state.slotAssignments.bottom = null;
  } else {
    state.slotAssignments.dress  = null;
  }
  // Update mode button styles
  document.getElementById('mode-btn-top-bottom')?.classList.toggle('mode-active', mode === 'top_bottom');
  document.getElementById('mode-btn-dress')?.classList.toggle('mode-active', mode === 'dress');
  updateDropZones();
  updateStudioExtras();
  renderAssetLibrary();
  updateStudioPieceCount();
  updateGenerateButton();
}

function setupStudio() {
  // Mode switch buttons
  document.querySelectorAll('#outfit-mode-switch .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => switchOutfitMode(btn.dataset.mode));
  });

  // Scene pills
  document.querySelectorAll('#studio-scene-pills .studio-scene-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const wasActive = pill.classList.contains('active');
      document.querySelectorAll('#studio-scene-pills .studio-scene-pill').forEach(p => p.classList.remove('active'));
      if (!wasActive) {
        pill.classList.add('active');
        state.studioScene = pill.dataset.value;
      } else {
        state.studioScene = null;
      }
      updateCheckButton();
    });
  });

  // Vibe pills
  document.querySelectorAll('#studio-vibe-pills .studio-vibe-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const wasActive = pill.classList.contains('active');
      document.querySelectorAll('#studio-vibe-pills .studio-vibe-pill').forEach(p => p.classList.remove('active'));
      state.studioVibe = wasActive ? null : pill.dataset.value;
      if (!wasActive) pill.classList.add('active');
    });
  });

  // Location input → weather
  const locInput = document.getElementById('studio-location');
  const fetchWeather = async () => {
    const loc = locInput.value.trim();
    if (!loc) return;
    try {
      const resp = await fetch(`${API}/api/weather?location=${encodeURIComponent(loc)}`);
      const w = await resp.json();
      state.studioWeather = w;
      const miniText = document.getElementById('studio-weather-mini-text');
      miniText.textContent = `${w.temp}°C · ${w.description}${w.is_mock ? ' (demo)' : ''}`;
      document.getElementById('studio-weather-mini').classList.remove('hidden');
    } catch (_) {}
  };
  locInput?.addEventListener('blur', fetchWeather);
  locInput?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fetchWeather(); } });

  // Asset upload: button + file input
  const addItemBtn   = document.getElementById('studio-add-item-btn');
  const assetInput   = document.getElementById('studio-asset-input');
  addItemBtn?.addEventListener('click', () => assetInput?.click());
  assetInput?.addEventListener('change', () => {
    Array.from(assetInput.files).forEach(f => addClothingAsset(f));
    assetInput.value = '';
  });

  // Allow dragging image files from OS onto the wardrobe panel
  const wardrobePanel = document.querySelector('.studio-wardrobe-panel');
  wardrobePanel?.addEventListener('dragover', e => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      wardrobePanel.classList.add('drag-over');
    }
  });
  wardrobePanel?.addEventListener('dragleave', () => wardrobePanel.classList.remove('drag-over'));
  wardrobePanel?.addEventListener('drop', e => {
    e.preventDefault();
    wardrobePanel.classList.remove('drag-over');
    Array.from(e.dataTransfer.files)
      .filter(f => f.type.startsWith('image/'))
      .forEach(f => addClothingAsset(f));
  });

  // Check This Look button
  document.getElementById('studio-check-btn')?.addEventListener('click', runSceneAnalysis);

  // Wire generate try-on button and cancel button
  document.getElementById('studio-generate-btn')?.addEventListener('click', runTryOnGenerate);
  document.getElementById('cancel-generation-btn')?.addEventListener('click', cancelGeneration);
  document.getElementById('cancel-edit-btn')?.addEventListener('click', cancelAddToLook);
  document.getElementById('cancel-batch-btn')?.addEventListener('click', cancelBatchAddToLook);
  document.getElementById('apply-selected-btn')?.addEventListener('click', applySelectedToLook);
  document.getElementById('stage-selected-plan-btn')?.addEventListener('click', addSelectedToPlan);
  document.getElementById('clear-selection-btn')?.addEventListener('click', () => {
    state.completeLookSelected = new Set();
    renderCompleteTheLook();
  });
  document.getElementById('refresh-suggestions-btn')?.addEventListener('click', () => {
    state.completeLookSuggestions = [];
    state.completeLookLoading     = false;
    state.completeLookError       = null;
    fetchCompleteTheLookSuggestions();
  });

  // Hero CTA buttons
  document.getElementById('hero-build-btn')?.addEventListener('click', () => {
    document.getElementById('studio-add-item-btn')?.focus();
    document.querySelector('.studio-wardrobe-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('hero-model-btn')?.addEventListener('click', switchToModelTab);

  // Lightbox helpers
  const openLightbox = () => {
    const canvas          = document.getElementById('tryon-preview-canvas');
    const lightbox        = document.getElementById('tryon-lightbox');
    const lightboxImg     = document.getElementById('tryon-lightbox-img');
    const lightboxVideo   = document.getElementById('tryon-lightbox-video');
    const lightboxCaption = document.getElementById('tryon-lightbox-caption');
    if (!lightbox) return;

    // Canvas path (WaveSpeed stable preview): canvas is visible with a captured frame.
    if (canvas && !canvas.classList.contains('hidden') && canvas.width > 0) {
      // canvas.toDataURL() throws SecurityError when the video is cross-origin without CORS.
      // Fall back to showing the raw video URL in a <video> element.
      try {
        const dataUrl = canvas.toDataURL('image/png');
        if (lightboxImg)   { lightboxImg.src = dataUrl; lightboxImg.classList.remove('hidden'); }
        if (lightboxVideo) { lightboxVideo.pause(); lightboxVideo.removeAttribute('src'); lightboxVideo.classList.add('hidden'); }
        if (lightboxCaption) lightboxCaption.textContent = 'Stable Outfit Preview — First Frame';
      } catch (_) {
        if (lightboxImg) lightboxImg.classList.add('hidden');
        if (lightboxVideo && state.tryOnPreview.videoUrl) {
          lightboxVideo.src         = state.tryOnPreview.videoUrl;
          lightboxVideo.currentTime = 0.01;
          lightboxVideo.classList.remove('hidden');
        }
        if (lightboxCaption) lightboxCaption.textContent = 'Stable Outfit Preview — video (still export unavailable)';
      }
      lightbox.classList.remove('hidden');
      document.body.classList.add('lightbox-open');
      return;
    }

    // Image path (GPT Image / FASHN / IDM-VTON): use the image URL directly.
    if (state.tryOnPreview.imageUrl) {
      if (lightboxImg)   { lightboxImg.src = state.tryOnPreview.imageUrl; lightboxImg.classList.remove('hidden'); }
      if (lightboxVideo) { lightboxVideo.pause(); lightboxVideo.removeAttribute('src'); lightboxVideo.classList.add('hidden'); }
      if (lightboxCaption) lightboxCaption.textContent = 'Try-On Preview';
      lightbox.classList.remove('hidden');
      document.body.classList.add('lightbox-open');
    }
  };
  const closeLightbox = () => {
    const lightboxVideo = document.getElementById('tryon-lightbox-video');
    if (lightboxVideo) { lightboxVideo.pause(); lightboxVideo.removeAttribute('src'); }
    document.getElementById('tryon-lightbox')?.classList.add('hidden');
    document.body.classList.remove('lightbox-open');
  };

  // Canvas (WaveSpeed) or its button opens the lightbox.
  document.getElementById('tryon-preview-canvas')?.addEventListener('click', openLightbox);
  document.getElementById('tryon-view-larger-btn')?.addEventListener('click', openLightbox);

  // Image result (GPT Image / FASHN / IDM-VTON): clicking image or button opens lightbox.
  document.getElementById('tryon-preview-img')?.addEventListener('click', openLightbox);
  document.getElementById('tryon-img-view-larger-btn')?.addEventListener('click', openLightbox);

  // Close on ✕ button, backdrop click, or Escape key.
  document.getElementById('tryon-lightbox-close')?.addEventListener('click', closeLightbox);
  document.getElementById('tryon-lightbox-backdrop')?.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

  // View Full Motion Preview: swap canvas still for the actual video player.
  document.getElementById('tryon-full-motion-btn')?.addEventListener('click', () => {
    const video         = document.getElementById('tryon-preview-video');
    const canvas        = document.getElementById('tryon-preview-canvas');
    const stableActions = document.getElementById('tryon-stable-actions');
    const row           = document.getElementById('tryon-full-motion-row');
    if (!video) return;
    if (canvas)        canvas.classList.add('hidden');
    if (stableActions) stableActions.classList.add('hidden');
    video.setAttribute('controls', '');
    video.classList.remove('hidden');
    video.currentTime = 0;
    video.play().catch(() => {});
    if (row) row.classList.add('hidden');
  });

  // Wire drag-and-drop on mannequin drop zones
  setupDragDrop();

  // Render mannequin (body shape from model if available)
  renderStudioMannequin();

  // Initial render of all studio state — accessories row must appear on first load.
  updateDropZones();
  updateStudioExtras();
  updateCheckButton();
  updateGenerateButton();
  renderTryOnPreview();
}

function switchToModelTab() {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => { c.classList.remove('active'); c.classList.add('hidden'); });
  const modelBtn = document.querySelector('[data-tab="model"]');
  modelBtn?.classList.add('active');
  const modelSection = document.getElementById('tab-model');
  modelSection?.classList.remove('hidden');
  modelSection?.classList.add('active');
}

function setSlotPhoto(slot, slotName, file) {
  if (state.studioItems[slotName]?.url) URL.revokeObjectURL(state.studioItems[slotName].url);
  const url = URL.createObjectURL(file);
  state.studioItems[slotName] = { file, url };
  slot.querySelector('.slot-placeholder').classList.add('hidden');
  slot.querySelector('.slot-preview').classList.remove('hidden');
  slot.querySelector('.slot-img').src = url;
  slot.classList.add('has-photo');
  if (state.studioStep !== 'build') updatePreviewComposition();
  updateStudioCTA();
}

function clearSlot(slot, slotName) {
  if (state.studioItems[slotName]?.url) URL.revokeObjectURL(state.studioItems[slotName].url);
  state.studioItems[slotName] = null;
  slot.querySelector('.slot-placeholder').classList.remove('hidden');
  slot.querySelector('.slot-preview').classList.add('hidden');
  slot.classList.remove('has-photo');
  if (state.studioStep !== 'build') updatePreviewComposition();
  updateStudioCTA();
}

function resetStudioPreview() {
  state.studioStep = 'build';
  document.getElementById('preview-canvas').classList.add('hidden');
  document.getElementById('preview-empty').classList.remove('hidden');
  document.getElementById('studio-analysis').classList.add('hidden');
  document.getElementById('studio-check-btn').classList.add('hidden');
  updateStudioCTA();
}

function updateStudioCTA() {
  const primaryBtn  = document.getElementById('studio-primary-btn');
  const checkBtn    = document.getElementById('studio-check-btn');
  const hint        = document.getElementById('studio-hint');
  const itemCount   = Object.values(state.studioItems).filter(v => v != null).length;

  // Primary button is always "Preview This Look"
  primaryBtn.textContent = 'Preview This Look';

  if (state.studioStep === 'build') {
    checkBtn.classList.add('hidden');
    if (itemCount === 0) {
      primaryBtn.disabled = true;
      hint.textContent = 'Upload at least one clothing item to start';
    } else if (itemCount === 1) {
      primaryBtn.disabled = false;
      hint.textContent = 'Add more pieces or preview this item on your model';
    } else {
      primaryBtn.disabled = false;
      hint.textContent = '';
    }
  } else if (state.studioStep === 'preview') {
    primaryBtn.disabled = false;
    checkBtn.classList.remove('hidden');
    if (!state.studioScene) {
      checkBtn.disabled = true;
      hint.textContent = 'Pick a scene to enable AI Check';
    } else {
      checkBtn.disabled = false;
      hint.textContent = `Scene: ${state.studioScene}`;
    }
  } else if (state.studioStep === 'checked') {
    primaryBtn.disabled = false;
    checkBtn.classList.remove('hidden');
    checkBtn.disabled = !state.studioScene;
    hint.textContent = '';
  }
}

function handleStudioPrimary() {
  // Primary button always (re)previews the look
  previewLook();
}

function previewLook() {
  document.getElementById('preview-empty').classList.add('hidden');
  document.getElementById('preview-canvas').classList.remove('hidden');

  const previewModelImg = document.getElementById('preview-model-img');
  const previewNoModel  = document.getElementById('preview-no-model');
  if (state.model) {
    previewModelImg.src = `/api/model/photo?t=${Date.now()}`;
    previewModelImg.classList.remove('hidden');
    previewNoModel.classList.add('hidden');
  } else {
    previewModelImg.classList.add('hidden');
    previewNoModel.classList.remove('hidden');
  }

  updatePreviewComposition();
  state.studioStep = 'preview';
  updateStudioCTA();
}

function updatePreviewComposition() {
  const leftCol  = document.getElementById('tryon-left-col');
  const rightCol = document.getElementById('tryon-right-col');
  if (!leftCol || !rightCol) return;

  const slotLabels = { top: 'Top', bottom: 'Bottom', dress: 'Dress', outerwear: 'Layer', shoes: 'Shoes', bag: 'Bag' };
  const slotIcons  = { top: '👕', bottom: '👖', dress: '👗', outerwear: '🧥', shoes: '👟', bag: '👜' };

  // Upper-body items go left; lower-body go right
  const leftSlots  = ['outerwear', 'top', 'dress'];
  const rightSlots = ['bottom', 'shoes', 'bag'];

  function buildCol(col, slots) {
    col.innerHTML = '';
    slots.forEach(slot => {
      const item = state.studioItems[slot];
      const card = document.createElement('div');
      if (item) {
        card.className = 'tryon-item-card has-item';
        card.innerHTML = `<img class="tryon-item-img" src="${item.url}" alt="${slot}" />
          <span class="tryon-item-slot-label">${slotLabels[slot]}</span>`;
      } else {
        card.className = 'tryon-item-card empty-slot';
        card.innerHTML = `<div class="tryon-slot-empty-icon">${slotIcons[slot]}</div>
          <span class="tryon-item-slot-label">${slotLabels[slot]}</span>`;
      }
      col.appendChild(card);
    });
  }

  buildCol(leftCol, leftSlots);
  buildCol(rightCol, rightSlots);

  // Update body-zone overlays
  const hasUpper = leftSlots.some(s => state.studioItems[s] != null);
  const hasLower = rightSlots.some(s => state.studioItems[s] != null);
  document.getElementById('body-zone-upper')?.classList.toggle('has-item', hasUpper);
  document.getElementById('body-zone-lower')?.classList.toggle('has-item', hasLower);

  // Item count badge
  const count = Object.values(state.studioItems).filter(v => v != null).length;
  const countEl = document.getElementById('preview-item-count');
  if (countEl) countEl.textContent = `${count} piece${count !== 1 ? 's' : ''}`;

  // Scene tag
  const sceneBadge = document.getElementById('preview-scene-badge');
  if (sceneBadge) {
    if (state.studioScene) {
      sceneBadge.textContent = state.studioScene.charAt(0).toUpperCase() + state.studioScene.slice(1);
      sceneBadge.classList.remove('hidden');
    } else {
      sceneBadge.classList.add('hidden');
    }
  }
}

async function runSceneAnalysis() {
  // Sync state.studioItems from current slot assignments
  state.studioItems = {};
  Object.entries(state.slotAssignments).forEach(([slot, assetId]) => {
    if (!assetId) return;
    const asset = state.clothingAssets.find(a => a.id === assetId);
    if (asset) state.studioItems[slot] = { file: asset.file, url: asset.rawImageUrl };
  });

  const btn        = document.getElementById('studio-check-btn');
  const loadingEl  = document.getElementById('studio-loading');
  const loadingText = document.getElementById('studio-loading-text');
  btn.disabled = true;
  if (loadingText) loadingText.textContent = `Checking for ${state.studioScene || 'this scene'}…`;
  loadingEl.classList.remove('hidden');
  document.getElementById('studio-analysis').classList.add('hidden');

  try {
    const form = new FormData();
    Object.entries(state.studioItems).forEach(([slot, item]) => {
      if (item) form.append(slot, item.file);
    });

    const resp = await fetch(`${API}/api/try-on-studio`, { method: 'POST', body: form });
    if (!resp.ok) await apiError(resp);
    const result = await resp.json();
    renderStudioAnalysis(result);
    state.studioStep = 'checked';
  } catch (err) {
    showToast('Analysis failed: ' + err.message, true);
  } finally {
    btn.disabled = false;
    loadingEl.classList.add('hidden');
    updateCheckButton();
  }
}

function renderStudioAnalysis(r) {
  const verdict = (r.verdict || 'adjust').toLowerCase();
  const badge = document.getElementById('analysis-verdict-badge');
  const verdictMap = {
    works:       { cls: 'analysis-verdict-works',     label: 'Works' },
    adjust:      { cls: 'analysis-verdict-adjust',    label: 'Adjust' },
    'not ideal': { cls: 'analysis-verdict-not-ideal', label: 'Not Ideal' },
    clash:       { cls: 'analysis-verdict-not-ideal', label: 'Not Ideal' },
  };
  const vm = verdictMap[verdict] || verdictMap.adjust;
  badge.className = `analysis-verdict-badge ${vm.cls}`;
  badge.textContent = vm.label;

  document.getElementById('ana-style-score').textContent = fmtScore(r.style_fit_score);
  document.getElementById('ana-body-score').textContent  = fmtScore(r.body_fit_score);
  document.getElementById('ana-scene-score').textContent = fmtScore(r.scene_fit_score);

  // Body fit notes
  const bodyNotes = r.body_fit_notes || [];
  const bodyNotesWrap = document.getElementById('ana-body-notes-wrap');
  const bodyNotesList = document.getElementById('ana-body-notes');
  bodyNotesList.innerHTML = '';
  bodyNotes.forEach(note => {
    const li = document.createElement('li');
    li.textContent = note;
    bodyNotesList.appendChild(li);
  });
  bodyNotesWrap.classList.toggle('hidden', bodyNotes.length === 0);

  // Scene chips
  const bestScenes = r.best_scenes || [];
  renderTags('ana-best-scenes', bestScenes);
  document.getElementById('ana-best-wrap').classList.toggle('hidden', bestScenes.length === 0);

  const avoidScenes = r.avoid_scenes || [];
  renderTags('ana-avoid-scenes', avoidScenes, false, 'danger');
  document.getElementById('ana-avoid-wrap').classList.toggle('hidden', avoidScenes.length === 0);

  // Short reasons
  const reasons = r.short_reasons || [];
  const reasonsList = document.getElementById('ana-reasons');
  reasonsList.innerHTML = '';
  reasons.slice(0, 3).forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    reasonsList.appendChild(li);
  });

  // Complete the Look chips
  const ctl = r.complete_the_look || {};
  const completeWrap = document.getElementById('ana-complete-wrap');
  const completeChips = document.getElementById('ana-complete-chips');
  completeChips.innerHTML = '';
  const ctlEntries = Object.entries(ctl).filter(([, v]) => v != null);
  if (ctlEntries.length > 0) {
    ctlEntries.forEach(([slot, suggestion]) => {
      const chip = document.createElement('span');
      chip.className = 'complete-chip';
      chip.innerHTML = `<span class="complete-chip-slot">${slot}</span> ${suggestion}`;
      completeChips.appendChild(chip);
    });
    completeWrap.classList.remove('hidden');
  } else {
    completeWrap.classList.add('hidden');
  }

  // Swap chips
  const swapSrc = r.suggested_swaps || [];
  const swapsRow = document.getElementById('ana-swaps');
  const swapsWrap = document.getElementById('ana-swaps-wrap');
  swapsRow.innerHTML = '';
  if (swapSrc.length > 0) {
    swapSrc.forEach(swap => {
      const chip = document.createElement('span');
      chip.className = 'swap-chip';
      chip.textContent = typeof swap === 'string' ? swap : `${swap.item || swap.from || ''} → ${swap.swap || swap.to || ''}`;
      swapsRow.appendChild(chip);
    });
    swapsWrap.classList.remove('hidden');
  } else {
    swapsWrap.classList.add('hidden');
  }

  document.getElementById('studio-analysis').classList.remove('hidden');
  document.getElementById('studio-ai-idle-msg')?.classList.add('hidden');

  // ── Buy / Maybe / Skip subsection ──────────────────────────────
  const bsvMap = {
    works:       { cls: 'bsv-buy',   label: 'Buy' },
    adjust:      { cls: 'bsv-maybe', label: 'Maybe' },
    'not ideal': { cls: 'bsv-skip',  label: 'Skip' },
    clash:       { cls: 'bsv-skip',  label: 'Skip' },
  };
  const bsv = bsvMap[verdict] || bsvMap.adjust;
  const bsvBadge = document.getElementById('bsv-badge');
  if (bsvBadge) { bsvBadge.textContent = bsv.label; bsvBadge.className = `buy-skip-verdict-badge ${bsv.cls}`; }

  // "Why it works" — first two short reasons joined
  const whyText = (r.short_reasons || []).slice(0, 2).join(' ');
  const whyEl = document.getElementById('bsv-why');
  if (whyEl) whyEl.textContent = whyText || '—';

  // "Concerns" — body fit notes or avoid scenes as fallback
  const concernsText = (r.body_fit_notes || []).join(' ');
  const concernsEl = document.getElementById('bsv-concerns');
  if (concernsEl) concernsEl.textContent = concernsText || '';
  document.getElementById('bsv-concerns-row')?.classList.toggle('hidden', !concernsText);

  // Scores
  document.getElementById('bsv-scene-fit').textContent = fmtScore(r.scene_fit_score);
  document.getElementById('bsv-style-fit').textContent = fmtScore(r.style_fit_score);

  // "Styling tip" — first suggested swap or first complete-the-look entry
  const swapSrc2 = r.suggested_swaps || [];
  const ctlSrc   = Object.values(r.complete_the_look || {}).filter(Boolean);
  let tipText = '';
  if (swapSrc2.length > 0) {
    const s = swapSrc2[0];
    tipText = typeof s === 'string' ? s : `${s.item || s.from || ''} → ${s.swap || s.to || ''}`;
  } else if (ctlSrc.length > 0) {
    tipText = String(ctlSrc[0]);
  }
  const tipEl = document.getElementById('bsv-tip');
  if (tipEl) tipEl.textContent = tipText || '';
  document.getElementById('bsv-tip-row')?.classList.toggle('hidden', !tipText);

  document.getElementById('buy-skip-empty')?.classList.add('hidden');
  document.getElementById('buy-skip-result')?.classList.remove('hidden');
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

/* ── Saved Looks (Issue 25) ──────────────────────────────────────────────── */

const LOOKS_KEY = 'stylesignal_saved_looks';
const LOOKS_MAX = 20;

function loadSavedLooks() {
  try {
    const raw = localStorage.getItem(LOOKS_KEY);
    if (!raw) { renderSavedLooks(); return; }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.savedLooks = parsed.filter(
        l => l && typeof l.id === 'string' && typeof l.imageUrl === 'string'
      );
    }
  } catch (_) {}
  renderSavedLooks();
}

function persistLooks() {
  try {
    localStorage.setItem(LOOKS_KEY, JSON.stringify(state.savedLooks));
    return true;
  } catch (_) {
    return false;
  }
}

function saveLook(imageUrl, source, label, fitAdjustment) {
  if (!imageUrl) return;
  if (state.savedLooks.length >= LOOKS_MAX) {
    showToast('You can save up to 20 looks in this version. Delete one to save a new look.', true);
    return;
  }
  const now = new Date();
  const look = {
    id: `look-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    imageUrl,
    label: label || formatLookLabel(source, fitAdjustment),
    source: source || 'try-on',
    date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    notes: '',
    favorite: false,
    fitAdjustment: fitAdjustment || null,
  };
  state.savedLooks.unshift(look);
  if (!persistLooks()) {
    state.savedLooks.shift();
    renderSavedLooks();
    showToast('Could not save this look locally. Please delete older looks or download the image.', true);
    return;
  }
  showToast('Look saved! Open "My Looks" to view and compare.');
  renderSavedLooks();
}

function formatLookLabel(source, fitAdjustment) {
  if (source === 'fit-preview' || source === 'fit_preview') {
    const adj = fitAdjustment === 'size_up' ? 'Size Up'
              : fitAdjustment === 'size_down' ? 'Size Down' : '';
    return adj ? `Fit Preview — ${adj}` : 'Fit Preview';
  }
  return 'Try-On Look';
}

function sourceBadgeLabel(source) {
  const map = {
    'try-on':       'Try-On',
    'try_on':       'Try-On',
    'whole_outfit': 'Whole Outfit',
    'add_to_look':  'Add to Look',
    'batch_add':    'Batch Add',
    'fit-preview':  'Fit Preview',
    'fit_preview':  'Fit Preview',
  };
  return map[source] || (source ? source.replace(/[_-]/g, ' ') : 'Try-On');
}

function sourceBadgeCls(source) {
  return (source === 'fit-preview' || source === 'fit_preview')
    ? 'look-badge-fitpreview'
    : 'look-badge-source';
}

function deleteLook(id) {
  state.savedLooks = state.savedLooks.filter(l => l.id !== id);
  state.looksCompareSelected.delete(id);
  persistLooks();
  renderSavedLooks();
  renderCompareBoard();
}

function updateLookNotes(id, notes) {
  const look = state.savedLooks.find(l => l.id === id);
  if (look) { look.notes = notes; persistLooks(); }
}

function updateLookLabel(id, label) {
  const look = state.savedLooks.find(l => l.id === id);
  if (look) { look.label = label || 'Saved Look'; persistLooks(); }
}

function toggleLookFavorite(id) {
  const look = state.savedLooks.find(l => l.id === id);
  if (!look) return;
  look.favorite = !look.favorite;
  persistLooks();
  renderSavedLooks();
}

function toggleLookCompare(id) {
  if (state.looksCompareSelected.has(id)) {
    state.looksCompareSelected.delete(id);
  } else {
    if (state.looksCompareSelected.size >= 4) {
      showToast('You can compare up to 4 looks at a time.', true);
      return;
    }
    state.looksCompareSelected.add(id);
  }
  renderSavedLooks();
  renderCompareBoard();
}

function editThisLook(id) {
  const look = state.savedLooks.find(l => l.id === id);
  if (!look?.imageUrl) return;

  // ── Abort and clear Fit Preview state ──────────────────────
  state.fitPreviewController.size_up?.abort();
  state.fitPreviewController.size_down?.abort();
  state.fitPreviewController.size_up    = null;
  state.fitPreviewController.size_down  = null;
  state.fitPreview.size_up.requestId   += 1;
  state.fitPreview.size_down.requestId += 1;
  state.fitPreview.size_up.loading      = false;
  state.fitPreview.size_down.loading    = false;
  state.fitPreview.size_up.imageUrl     = null;
  state.fitPreview.size_down.imageUrl   = null;
  state.fitPreviewLastAdjustment        = null;
  state.fitPreviewCache.clear();
  state.fitPreviewBaseImageUrl          = null;

  // ── Abort and clear Planned Edits state ────────────────────
  state.activePlanAbortController?.abort();
  state.activePlanAbortController = null;
  state.planRequestId            += 1;
  state.planItems                 = [];
  state.planFitShift              = 'none';
  state.planScene                 = 'original';
  state.planStatus                = 'idle';
  state.planResult                = null;
  state.planCache.clear();

  // ── Load saved look into the AI mirror — no GPT call ───────
  state.tryOnPreview.status   = 'ready';
  state.tryOnPreview.imageUrl = look.imageUrl;
  state.tryOnPreview.videoUrl = null;
  state.tryOnPreview.message  = null;
  state.tryOnPreview.mode     = 'saved_look';

  // Force Complete the Look and Color Fit to re-run for this image.
  state.completeLookImageUrl = null;
  state.colorFitImageUrl     = null;

  // Switch to AI Studio tab.
  document.querySelector('[data-tab="studio"]')?.click();

  renderTryOnPreview();
  showToast(`"${look.label}" loaded — apply edits, plan changes, or generate.`);
}

function renderSavedLooks() {
  const grid       = document.getElementById('looks-grid');
  const emptyState = document.getElementById('looks-empty-state');
  if (!grid) return;

  if (state.savedLooks.length === 0) {
    grid.innerHTML = '';
    emptyState?.classList.remove('hidden');
    renderCompareBoard();
    return;
  }
  emptyState?.classList.add('hidden');

  grid.innerHTML = state.savedLooks.map(look => {
    const isSelected = state.looksCompareSelected.has(look.id);
    const adj        = look.fitAdjustment;

    let badges = `<span class="look-badge ${sourceBadgeCls(look.source)}">${escHtml(sourceBadgeLabel(look.source))}</span>`;
    if (adj === 'size_up')   badges += `<span class="look-badge look-badge-sizeup">Size Up</span>`;
    if (adj === 'size_down') badges += `<span class="look-badge look-badge-sizedown">Size Down</span>`;

    const favCls   = look.favorite ? ' look-card-fav-active' : '';
    const selCls   = isSelected    ? ' look-card-selected'    : '';
    const favIcon  = look.favorite ? '&#9829;' : '&#9825;';
    const favTitle = look.favorite ? 'Remove from favourites' : 'Add to favourites';
    const cmpLabel = isSelected    ? '&#10003; In Compare'    : 'Compare';
    const cmpCls   = isSelected    ? ' look-btn-compare-active' : '';

    return `
      <div class="look-card${selCls}" data-id="${escHtml(look.id)}">
        <div class="look-card-img-wrap">
          <img class="look-card-img" src="${escHtml(look.imageUrl)}" alt="${escHtml(look.label)}" loading="lazy" />
          <button class="look-card-fav${favCls}" data-id="${escHtml(look.id)}" title="${favTitle}" aria-label="${favTitle}">${favIcon}</button>
          ${badges ? `<div class="look-card-badges">${badges}</div>` : ''}
        </div>
        <div class="look-card-body">
          <div class="look-card-meta">
            <span class="look-card-label" contenteditable="true" data-id="${escHtml(look.id)}" title="Click to rename">${escHtml(look.label)}</span>
            <span class="look-card-date">${escHtml(look.date)}</span>
          </div>
          <textarea class="look-card-notes" data-id="${escHtml(look.id)}" placeholder="Add notes…" rows="2">${escHtml(look.notes)}</textarea>
          <div class="look-card-actions">
            <button class="btn-look-edit" data-id="${escHtml(look.id)}">&#9999; Edit This Look</button>
            <button class="btn-look-view" data-id="${escHtml(look.id)}" data-url="${escHtml(look.imageUrl)}">&#8689; View</button>
            <button class="btn-look-compare${cmpCls}" data-id="${escHtml(look.id)}">${cmpLabel}</button>
            <button class="btn-look-delete" data-id="${escHtml(look.id)}">Delete</button>
          </div>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.btn-look-edit').forEach(btn => {
    btn.addEventListener('click', () => editThisLook(btn.dataset.id));
  });
  grid.querySelectorAll('.look-card-fav').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); toggleLookFavorite(btn.dataset.id); });
  });
  grid.querySelectorAll('.look-card-img').forEach(img => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => openLooksLightbox(img.src, img.alt));
  });
  grid.querySelectorAll('.btn-look-view').forEach(btn => {
    btn.addEventListener('click', () => {
      const look = state.savedLooks.find(l => l.id === btn.dataset.id);
      if (look) openLooksLightbox(look.imageUrl, look.label);
    });
  });
  grid.querySelectorAll('.btn-look-compare').forEach(btn => {
    btn.addEventListener('click', () => toggleLookCompare(btn.dataset.id));
  });
  grid.querySelectorAll('.btn-look-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this saved look?')) deleteLook(btn.dataset.id);
    });
  });
  grid.querySelectorAll('.look-card-notes').forEach(ta => {
    ta.addEventListener('change', () => updateLookNotes(ta.dataset.id, ta.value));
  });
  grid.querySelectorAll('.look-card-label[contenteditable]').forEach(el => {
    el.addEventListener('blur', () => updateLookLabel(el.dataset.id, el.textContent.trim()));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
  });

  renderCompareBoard();
}

function renderCompareBoard() {
  const board   = document.getElementById('looks-compare-board');
  const grid    = document.getElementById('looks-compare-grid');
  const countEl = document.getElementById('looks-compare-count');
  if (!board || !grid) return;

  const selected = state.savedLooks.filter(l => state.looksCompareSelected.has(l.id));
  if (selected.length < 2) { board.classList.add('hidden'); return; }

  board.classList.remove('hidden');
  if (countEl) countEl.textContent = selected.length;

  grid.innerHTML = selected.map(look => {
    const adj     = look.fitAdjustment;
    const favIcon = look.favorite ? '&#9829;' : '&#9825;';
    const favCls  = look.favorite ? ' look-card-fav-active' : '';

    let badges = `<span class="look-badge ${sourceBadgeCls(look.source)}">${escHtml(sourceBadgeLabel(look.source))}</span>`;
    if (adj === 'size_up')   badges += `<span class="look-badge look-badge-sizeup">Size Up</span>`;
    if (adj === 'size_down') badges += `<span class="look-badge look-badge-sizedown">Size Down</span>`;

    return `
      <div class="looks-compare-item">
        <img class="looks-compare-img" src="${escHtml(look.imageUrl)}" alt="${escHtml(look.label)}" />
        <div class="looks-compare-meta">
          <div class="looks-compare-badges">${badges}</div>
          <div class="looks-compare-label-row">
            <span class="looks-compare-label">${escHtml(look.label)}</span>
            <span class="looks-compare-fav${favCls}" aria-hidden="true">${favIcon}</span>
          </div>
          <span class="looks-compare-date">${escHtml(look.date)}</span>
          ${look.notes ? `<div class="looks-compare-notes">${escHtml(look.notes)}</div>` : ''}
          <button class="btn-look-view looks-compare-view-btn"
                  data-url="${escHtml(look.imageUrl)}"
                  data-label="${escHtml(look.label)}">&#8689; View Larger</button>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.looks-compare-view-btn').forEach(btn => {
    btn.addEventListener('click', () => openLooksLightbox(btn.dataset.url, btn.dataset.label));
  });
}

function openLooksLightbox(imageUrl, caption) {
  const lightbox      = document.getElementById('tryon-lightbox');
  const lightboxImg   = document.getElementById('tryon-lightbox-img');
  const lightboxVideo = document.getElementById('tryon-lightbox-video');
  const lightboxCap   = document.getElementById('tryon-lightbox-caption');
  if (!lightbox || !lightboxImg || !imageUrl) return;
  lightboxImg.src = imageUrl;
  lightboxImg.classList.remove('hidden');
  if (lightboxVideo) { lightboxVideo.pause(); lightboxVideo.removeAttribute('src'); lightboxVideo.classList.add('hidden'); }
  if (lightboxCap) lightboxCap.textContent = caption || 'Saved Look';
  lightbox.classList.remove('hidden');
  document.body.classList.add('lightbox-open');
}

/* ── Generation Plan (Issue 26) ─────────────────────────────── */

const PLAN_SLOT_ALLOWLIST = new Set([
  'bag', 'scarf', 'necklace', 'bracelet', 'belt', 'hat', 'watch',
  'glasses', 'earrings', 'hair_accessory', 'outerwear', 'shoes',
  'tights', 'socks', 'other',
]);

function addCustomToPlan() {
  const typeEl = document.getElementById('plan-custom-type');
  const descEl = document.getElementById('plan-custom-desc');
  const slot   = (typeEl?.value || '').trim();
  const name   = (descEl?.value || '').trim().slice(0, 80);

  if (!slot || !PLAN_SLOT_ALLOWLIST.has(slot)) {
    showToast('Please select an item type.', true);
    return;
  }
  if (!name) {
    showToast('Please enter a description.', true);
    descEl?.focus();
    return;
  }

  const already = state.planItems.some(p => p.slot === slot && p.name === name);
  if (already) { showToast('Already staged in plan.'); return; }

  invalidatePlanRequest();
  state.planItems.push({ slot, name });
  state.planStatus = 'idle';
  state.planResult = null;

  if (typeEl) typeEl.value = '';
  if (descEl) descEl.value = '';

  renderCompleteTheLook();
  renderPlanSection();
}

function invalidatePlanRequest() {
  if (state.activePlanAbortController) {
    state.activePlanAbortController.abort();
    state.activePlanAbortController = null;
  }
  state.planRequestId += 1;
}

function addToPlan(idx) {
  const s = state.completeLookSuggestions[idx];
  if (!s) return;
  const already = state.planItems.some(p => p.slot === s.slot && p.name === s.name);
  if (already) { showToast('Already staged in plan.'); return; }
  invalidatePlanRequest();
  state.planItems.push({ slot: s.slot, name: s.name });
  state.planStatus = 'idle';
  state.planResult = null;
  renderCompleteTheLook();
  renderPlanSection();
}

function addSelectedToPlan() {
  const toAdd = state.completeLookSuggestions.filter(s =>
    state.completeLookSelected.has(`${s.slot}::${s.name}`)
  );
  if (toAdd.length === 0) { showToast('No cards selected.', true); return; }
  let added = 0;
  for (const s of toAdd) {
    const already = state.planItems.some(p => p.slot === s.slot && p.name === s.name);
    if (!already) { state.planItems.push({ slot: s.slot, name: s.name }); added++; }
  }
  invalidatePlanRequest();
  state.planStatus = 'idle';
  state.planResult = null;
  state.completeLookSelected = new Set();
  renderCompleteTheLook();
  renderPlanSection();
  showToast(added === 0 ? 'All selected items already in plan.' : `${added} item${added > 1 ? 's' : ''} staged in plan.`);
}

function removeFromPlan(slot, name) {
  state.planItems = state.planItems.filter(p => !(p.slot === slot && p.name === name));
  invalidatePlanRequest();
  state.planStatus = 'idle';
  state.planResult = null;
  renderCompleteTheLook();
  renderPlanSection();
}

function clearPlan() {
  state.planItems    = [];
  state.planFitShift = 'none';
  state.planScene    = 'original';
  invalidatePlanRequest();
  state.planStatus   = 'idle';
  state.planResult   = null;
  renderCompleteTheLook();
  renderPlanSection();
}

function estimatePlan() {
  const hasItems = state.planItems.length > 0;
  const hasFit   = state.planFitShift !== 'none';
  const hasScene = state.planScene    !== 'original';
  const hasChanges = hasItems || hasFit || hasScene;
  let secs    = 60;
  let credits = 0.04;
  secs    += state.planItems.length * 30;
  credits += state.planItems.length * 0.02;
  if (hasFit)   { secs += 30; credits += 0.02; }
  if (hasScene) { secs += 45; credits += 0.03; }
  const mins = Math.ceil(secs / 60);
  return { time: `~${mins} min`, credits: `~$${credits.toFixed(2)}`, hasChanges };
}

function buildPlanCacheKey() {
  const base  = state.tryOnPreview.imageUrl || '';
  const items = [...state.planItems].sort((a, b) =>
    (a.slot + a.name).localeCompare(b.slot + b.name));
  return JSON.stringify({ base, items, fit: state.planFitShift, scene: state.planScene });
}

async function generatePlan() {
  if (state.planStatus === 'processing') return;
  if (!state.tryOnPreview.imageUrl) { showToast('Generate a try-on preview first.', true); return; }

  const cacheKey  = buildPlanCacheKey();
  const cached    = state.planCache.get(cacheKey);
  if (cached) {
    state.planResult = cached;
    state.planStatus = 'complete';
    renderPlanSection();
    return;
  }

  // Stale guard: capture request id and base image url before any await.
  state.planRequestId += 1;
  const myRequestId = state.planRequestId;
  const baseUrl     = state.tryOnPreview.imageUrl;

  state.activePlanAbortController?.abort();
  const controller = new AbortController();
  state.activePlanAbortController = controller;

  state.planStatus = 'processing';
  renderPlanSection();

  function isStale() {
    return myRequestId !== state.planRequestId || state.tryOnPreview.imageUrl !== baseUrl;
  }

  try {
    // Fetch the preview image as a blob to POST as multipart.
    let blob;
    if (baseUrl.startsWith('data:')) {
      const [meta, b64] = baseUrl.split(',');
      const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
      const bin  = atob(b64);
      const buf  = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      blob = new Blob([buf], { type: mime });
    } else {
      const r = await fetch(baseUrl, { signal: controller.signal });
      blob = await r.blob();
    }
    if (isStale()) return;

    const form = new FormData();
    form.append('preview_image', blob, 'preview.jpg');
    form.append('plan_items', JSON.stringify(state.planItems));
    form.append('fit_shift',  state.planFitShift);
    form.append('scene',      state.planScene);

    const resp = await fetch(`${API}/api/try-on/generate-plan`,
      { method: 'POST', body: form, signal: controller.signal, headers: { 'X-Demo-Code': getDemoCode() } });
    if (isStale()) return;
    if (!resp.ok) throw new Error(`Server error ${resp.status}`);
    const data = await resp.json();
    if (isStale()) return;

    if (data.status === 'demo_locked') {
      handleDemoLocked(data.message);
      state.planStatus = 'failed';
      state.planResult = { message: data.message || 'Demo code required.' };
      state.activePlanAbortController = null;
      renderPlanSection();
      return;
    }
    if (data.status === 'failed' || data.status === 'provider_required') {
      state.planStatus = 'failed';
      state.planResult = { message: data.message || 'Generation failed.' };
    } else if (data.preview_image_url) {
      state.planResult = { imageUrl: data.preview_image_url };
      state.planCache.set(cacheKey, state.planResult);
      state.planStatus = 'complete';
    } else {
      throw new Error('No image returned from server.');
    }
  } catch (err) {
    if (isStale() || err.name === 'AbortError') return;
    state.planStatus = 'failed';
    state.planResult = { message: err.message || 'Generation failed. Please try again.' };
  }
  if (!isStale()) {
    state.activePlanAbortController = null;
    renderPlanSection();
  }
}

function renderPlanSection() {
  const section = document.getElementById('plan-section');
  if (!section) return;

  // Show only when a try-on preview is ready with an image (not video).
  const isVisible = state.tryOnPreview.status === 'ready' && !!state.tryOnPreview.imageUrl && !state.tryOnPreview.videoUrl;
  section.classList.toggle('hidden', !isVisible);
  if (!isVisible) return;

  const est = estimatePlan();
  section.classList.toggle('has-staged-items', est.hasChanges);

  // Empty-state message — visible when nothing staged yet.
  const emptyMsg = document.getElementById('plan-empty-msg');
  emptyMsg?.classList.toggle('hidden', est.hasChanges);

  // Staged items section — hide when empty to avoid "None" clutter.
  const itemsSection = section.querySelector('.plan-items-section');
  itemsSection?.classList.toggle('hidden', !est.hasChanges);

  // Estimate row — hide when empty (no changes = nothing to estimate).
  const estimateEl = section.querySelector('.plan-estimate');
  estimateEl?.classList.toggle('hidden', !est.hasChanges);

  // Fit buttons active state.
  section.querySelectorAll('.btn-plan-fit').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.fit === state.planFitShift);
  });

  // Scene select value.
  const sceneEl = document.getElementById('plan-scene-select');
  if (sceneEl && sceneEl.value !== state.planScene) sceneEl.value = state.planScene;

  // Staged accessories list.
  const listEl = document.getElementById('plan-items-list');
  if (listEl && est.hasChanges) {
    if (state.planItems.length === 0) {
      listEl.innerHTML = '<span class="plan-items-empty">No accessories staged — changes are fit shift or scene only.</span>';
    } else {
      listEl.innerHTML = state.planItems.map(p => `
        <div class="plan-item-chip">
          <span class="plan-item-slot">${escHtml((p.slot || '').replace(/_/g, ' '))}</span>
          <span class="plan-item-name">${escHtml(p.name || '')}</span>
          <button class="btn-plan-remove-item" data-slot="${escHtml(p.slot)}" data-name="${escHtml(p.name)}" title="Remove">&times;</button>
        </div>`).join('');
      listEl.querySelectorAll('.btn-plan-remove-item').forEach(btn => {
        btn.addEventListener('click', () => removeFromPlan(btn.dataset.slot, btn.dataset.name));
      });
    }
  }

  // Estimate values.
  const timeEl = document.getElementById('plan-est-time');
  const credEl = document.getElementById('plan-est-credits');
  if (timeEl)  timeEl.textContent  = est.time;
  if (credEl)  credEl.textContent  = est.credits;

  // Generate button.
  const genBtn = document.getElementById('plan-generate-btn');
  if (genBtn) genBtn.disabled = !est.hasChanges || state.planStatus === 'processing';

  // Status row.
  const statusRow  = document.getElementById('plan-status-row');
  const stProc     = document.getElementById('plan-status-processing');
  const stComplete = document.getElementById('plan-status-complete');
  const stFailed   = document.getElementById('plan-status-failed');
  const stFailMsg  = document.getElementById('plan-status-failed-msg');

  const showStatus = state.planStatus !== 'idle';
  statusRow?.classList.toggle('hidden', !showStatus);
  stProc?.classList.toggle('hidden',     state.planStatus !== 'processing');
  stComplete?.classList.toggle('hidden', state.planStatus !== 'complete');
  stFailed?.classList.toggle('hidden',   state.planStatus !== 'failed');

  if (stFailMsg && state.planStatus === 'failed' && state.planResult?.message) {
    stFailMsg.textContent = state.planResult.message;
  }

  // Result preview.
  const resultDiv = document.getElementById('plan-result-preview');
  const resultImg = document.getElementById('plan-result-img');
  const show = state.planStatus === 'complete' && state.planResult?.imageUrl;
  resultDiv?.classList.toggle('hidden', !show);
  if (show && resultImg && resultImg.src !== state.planResult.imageUrl) {
    resultImg.src = state.planResult.imageUrl;
  }
}

function setupPlanSection() {
  // Fit shift buttons.
  document.getElementById('plan-fit-btns')?.addEventListener('click', e => {
    const btn = e.target.closest('.btn-plan-fit');
    if (!btn) return;
    state.planFitShift = btn.dataset.fit;
    invalidatePlanRequest();
    state.planStatus   = 'idle';
    state.planResult   = null;
    renderPlanSection();
  });

  // Scene select.
  document.getElementById('plan-scene-select')?.addEventListener('change', e => {
    state.planScene  = e.target.value;
    invalidatePlanRequest();
    state.planStatus = 'idle';
    state.planResult = null;
    renderPlanSection();
  });

  // Custom item input.
  document.getElementById('plan-custom-add-btn')?.addEventListener('click', addCustomToPlan);
  document.getElementById('plan-custom-desc')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addCustomToPlan(); }
  });

  // Clear button.
  document.getElementById('plan-clear-btn')?.addEventListener('click', clearPlan);

  // Generate button.
  document.getElementById('plan-generate-btn')?.addEventListener('click', generatePlan);

  // Retry button.
  document.getElementById('plan-retry-btn')?.addEventListener('click', generatePlan);

  // Save result button.
  document.getElementById('plan-save-result-btn')?.addEventListener('click', () => {
    const url = state.planResult?.imageUrl;
    if (!url) { showToast('No result to save.', true); return; }
    saveLook(url, 'plan', null, state.planFitShift !== 'none' ? state.planFitShift : null);
  });

  // View Larger button.
  document.getElementById('plan-view-result-btn')?.addEventListener('click', () => {
    const url = state.planResult?.imageUrl;
    if (url) openLooksLightbox(url, 'High-Quality Generated Look');
  });
}

function setupLooks() {
  document.getElementById('looks-go-studio-btn')?.addEventListener('click', () => {
    document.querySelector('[data-tab="studio"]')?.click();
  });

  document.getElementById('tryon-save-look-btn')?.addEventListener('click', () => {
    const url = state.tryOnPreview.imageUrl;
    if (!url) return;
    saveLook(url, 'try-on', null, null);
  });

  document.getElementById('fit-preview-save-btn')?.addEventListener('click', () => {
    const adj = state.fitPreviewLastAdjustment;
    const url = adj ? state.fitPreview[adj]?.imageUrl : null;
    if (!url) { showToast('Generate a fit preview first.', true); return; }
    saveLook(url, 'fit-preview', null, adj);
  });

  document.getElementById('fit-preview-orig-view-btn')?.addEventListener('click', () => {
    const url = state.tryOnPreview.imageUrl;
    if (url) openLooksLightbox(url, 'Original Preview');
  });
  document.getElementById('fit-preview-original-img')?.addEventListener('click', () => {
    const url = document.getElementById('fit-preview-original-img')?.src;
    if (url && url !== window.location.href) openLooksLightbox(url, 'Original Preview');
  });

  document.getElementById('fit-preview-result-view-btn')?.addEventListener('click', () => {
    const adj = state.fitPreviewLastAdjustment;
    const url = adj ? state.fitPreview[adj]?.imageUrl : null;
    const cap = adj === 'size_up' ? 'Size Up Preview' : 'Size Down Preview';
    if (url) openLooksLightbox(url, cap);
  });
  document.getElementById('fit-preview-result-img')?.addEventListener('click', () => {
    const adj = state.fitPreviewLastAdjustment;
    const url = adj ? state.fitPreview[adj]?.imageUrl : null;
    const cap = adj === 'size_up' ? 'Size Up Preview' : 'Size Down Preview';
    if (url) openLooksLightbox(url, cap);
  });

  document.getElementById('looks-compare-clear-btn')?.addEventListener('click', () => {
    state.looksCompareSelected = new Set();
    renderSavedLooks();
    renderCompareBoard();
  });
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

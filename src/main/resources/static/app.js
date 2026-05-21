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
  slotAssignments: { top: null, bottom: null, dress: null, outerwear: null, shoes: null, bag: null },
  draggedAssetId: null,
  // Studio — legacy (kept for API compatibility)
  studioItems: { top: null, bottom: null, dress: null, outerwear: null, shoes: null, bag: null },
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
};

const API = '';

/* ── Boot ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupModelTab();
  setupStudio();
  setupSceneCheck();
  setupBuyCheck();
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
  { key: 'top',       label: 'Top',       emoji: '👕' },
  { key: 'bottom',    label: 'Bottom',    emoji: '👖' },
  { key: 'dress',     label: 'Dress',     emoji: '👗' },
  { key: 'outerwear', label: 'Layer',     emoji: '🧥' },
  { key: 'shoes',     label: 'Shoes',     emoji: '👟' },
  { key: 'bag',       label: 'Bag',       emoji: '👜' },
];
const MAIN_DZ_SLOTS  = ['top', 'bottom', 'shoes'];
const EXTRA_DZ_SLOTS = ['dress', 'outerwear', 'bag'];
let _assetIdCounter  = 0;

function _guessType(file) {
  const n = file.name.toLowerCase();
  if (/shoe|boot|sneaker|heel|loafer|sandal/.test(n)) return 'shoes';
  if (/pant|jean|skirt|short|trouser|bottom/.test(n))  return 'bottom';
  if (/dress|gown|romper/.test(n))                     return 'dress';
  if (/jacket|coat|outer|blazer|cardigan/.test(n))     return 'outerwear';
  if (/bag|purse|clutch|tote/.test(n))                 return 'bag';
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
    type: _guessType(file),
  });
  renderAssetLibrary();
  updateStudioPieceCount();
  analyzeGarmentAsset(id, file);
}

function removeClothingAsset(id) {
  const asset = state.clothingAssets.find(a => a.id === id);
  if (!asset) return;
  Object.keys(state.slotAssignments).forEach(s => {
    if (state.slotAssignments[s] === id) state.slotAssignments[s] = null;
  });
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
  lib.innerHTML = '';
  state.clothingAssets.forEach(asset => {
    const t    = ASSET_TYPES.find(x => x.key === asset.type) || ASSET_TYPES[0];
    const card = document.createElement('div');
    card.className   = 'asset-card';
    card.draggable   = true;
    card.dataset.assetId = asset.id;
    const assigned = Object.values(state.slotAssignments).includes(asset.id);
    if (assigned) card.classList.add('asset-assigned');

    const statusInfo  = _extractionStatusInfo(asset.extractionStatus);
    const nameDisplay = asset.itemName || asset.file.name.replace(/\.[^.]+$/, '');
    const modelBadge  = asset.containsModel
      ? `<span class="asset-model-warning">has model</span>` : '';

    card.innerHTML = `
      <img class="asset-thumb" src="${asset.rawImageUrl}" alt="${t.label}" draggable="false" />
      <div class="asset-card-info">
        <p class="asset-item-name" title="${nameDisplay}">${nameDisplay}</p>
        <div class="asset-info-row">
          <span class="asset-status-chip asset-status-${asset.extractionStatus}">${statusInfo.label}</span>
          ${modelBadge}
        </div>
      </div>
      <div class="asset-card-footer">
        <button class="asset-type-btn" title="Click to change type">${t.emoji} ${t.label}</button>
        <button class="asset-remove-btn" title="Remove">✕</button>
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
    });
    card.querySelector('.asset-type-btn').addEventListener('click', e => {
      e.stopPropagation();
      cycleAssetType(asset.id);
    });
    card.querySelector('.asset-remove-btn').addEventListener('click', e => {
      e.stopPropagation();
      removeClothingAsset(asset.id);
    });
    lib.appendChild(card);
  });
}

function assignAssetToSlot(assetId, slotKey) {
  Object.keys(state.slotAssignments).forEach(s => {
    if (state.slotAssignments[s] === assetId) state.slotAssignments[s] = null;
  });
  state.slotAssignments[slotKey] = assetId;
  updateDropZones();
  updateStudioExtras();
  updateStudioPieceCount();
  renderAssetLibrary();
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

function updateDropZones() {
  MAIN_DZ_SLOTS.forEach(slot => {
    const zone       = document.getElementById(`dz-${slot}`);
    const thumb      = document.getElementById(`dz-${slot}-thumb`);
    const clearBtn   = document.getElementById(`dz-${slot}-clear`);
    const badge      = document.getElementById(`dz-${slot}-badge`);
    const slotLabel  = document.getElementById(`dz-${slot}-slotlabel`);
    const dzLabel    = zone?.querySelector('.dz-label');
    if (!zone) return;
    const assetId = state.slotAssignments[slot];
    if (assetId) {
      const asset = state.clothingAssets.find(a => a.id === assetId);
      if (asset) {
        // Use clean asset for the overlay; fall back to raw while analysis is pending
        const displayUrl = asset.cleanAssetUrl || asset.rawImageUrl;
        if (thumb) { thumb.src = displayUrl; thumb.classList.remove('hidden'); }
        clearBtn?.classList.remove('hidden');
        if (badge) {
          badge.classList.remove('hidden');
          if (asset.cleanAssetUrl) {
            if (asset.extractionStatus === 'failed') {
              badge.textContent = 'Fallback Preview';
            } else if (asset.containsModel || asset.cleanupNeeded) {
              badge.textContent = 'Needs Cleanup';
            } else {
              badge.textContent = 'Mock Clean';
            }
          } else {
            badge.textContent = 'Raw';
          }
        }
        slotLabel?.classList.remove('hidden');
        dzLabel?.classList.add('hidden');
        zone.classList.add('has-item');
      }
    } else {
      if (thumb) { thumb.src = ''; thumb.classList.add('hidden'); }
      clearBtn?.classList.add('hidden');
      badge?.classList.add('hidden');
      slotLabel?.classList.add('hidden');
      dzLabel?.classList.remove('hidden');
      zone.classList.remove('has-item');
    }
  });
}

function updateStudioExtras() {
  const wrap = document.getElementById('studio-extras');
  if (!wrap) return;
  wrap.innerHTML = '';
  EXTRA_DZ_SLOTS.forEach(slot => {
    const assetId = state.slotAssignments[slot];
    if (!assetId) return;
    const asset = state.clothingAssets.find(a => a.id === assetId);
    if (!asset) return;
    const t    = ASSET_TYPES.find(x => x.key === slot) || ASSET_TYPES[0];
    const chip = document.createElement('div');
    chip.className = 'studio-extra-chip';
    chip.innerHTML = `<img src="${asset.rawImageUrl}" alt="${t.label}" />
      <span>${t.emoji} ${t.label}</span>
      <button class="dz-clear" title="Remove">✕</button>`;
    chip.querySelector('.dz-clear').addEventListener('click', () => unassignSlot(slot));
    wrap.appendChild(chip);
  });
}

function updateStudioPieceCount() {
  const count = Object.values(state.slotAssignments).filter(Boolean).length;
  const el    = document.getElementById('studio-piece-count');
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
  MAIN_DZ_SLOTS.forEach(slot => {
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
  const WAVESPEED_ID = 'wavespeed_ai_virtual_outfit_tryon';

  // Provider selector — shown when more than one real provider exists
  const selectorHtml = configured.length > 1 ? `
    <p class="prov-select-label">Generate with:</p>
    <div class="prov-selector">
      ${configured.map(p => `
        <button class="prov-select-btn${state.selectedProviderId === p.id ? ' prov-select-active' : ''}"
          data-pid="${p.id}">
          ${p.name}
          ${p.id === WAVESPEED_ID ? '<span class="prov-badge prov-recommended">Full Outfit</span>' : ''}
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
  const hasItems = Object.values(state.slotAssignments).some(Boolean);
  btn.disabled = !hasItems;
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

  if (status === 'generating') {
    const msgEl = document.getElementById('tryon-generating-msg');
    if (msgEl) {
      const cap = getSelectedProviderCapability();
      msgEl.textContent = cap?.output_type === 'video'
        ? 'Generating full outfit preview... This may take 1–5 minutes. AI-generated — may adjust pose or background. Please keep this page open.'
        : 'Requesting try-on generation…';
    }
  }

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
    if (state.tryOnPreview.videoUrl) {
      // WaveSpeed video path: show canvas still-frame, keep video fully hidden.
      if (img)   img.classList.add('hidden');
      if (video) { video.removeAttribute('controls'); video.classList.add('hidden'); }
      if (videoNote)     videoNote.classList.remove('hidden');
      if (fullMotionRow) fullMotionRow.classList.remove('hidden');
      if (readyBdg)      readyBdg.textContent = 'Stable Outfit Preview';
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
      // FASHN / IDM-VTON image path: unchanged.
      if (img)   { img.src = state.tryOnPreview.imageUrl; img.classList.remove('hidden'); }
      if (video) {
        video.removeAttribute('controls');
        video.classList.add('hidden');
        delete video.dataset.loadedSrc;
      }
      if (canvas)        canvas.classList.add('hidden');
      if (stableActions) stableActions.classList.add('hidden');
      if (videoNote)     videoNote.classList.add('hidden');
      if (fullMotionRow) fullMotionRow.classList.add('hidden');
      if (readyBdg)      readyBdg.textContent = 'Preview Ready';
    }
  }
}

async function runTryOnGenerate() {
  const filledSlots = Object.entries(state.slotAssignments).filter(([, id]) => !!id);
  if (filledSlots.length === 0) return;

  // Derive rules from selected provider's capability metadata
  const provCap        = getSelectedProviderCapability();
  const maxGarments    = provCap?.max_garments    ?? 1;
  const unsupportedSls = provCap?.unsupported_slots ?? [];
  const isMultiGarment = maxGarments > 1;

  // Unsupported slot check — generalized for all providers (Fix 4)
  const unsupportedFilled = filledSlots.filter(([s]) => unsupportedSls.includes(s));
  if (unsupportedFilled.length > 0) {
    const slotStr  = unsupportedFilled.map(([s]) => s).join(', ');
    const provName = provCap?.name || 'This provider';
    state.tryOnPreview.status  = 'failed';
    state.tryOnPreview.message = `${provName} does not support: ${slotStr}. Remove this item before generating.`;
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

  state.tryOnPreview.status   = 'generating';
  state.tryOnPreview.imageUrl = null;
  state.tryOnPreview.videoUrl = null;
  state.tryOnPreview.message  = null;
  renderTryOnPreview();

  const btn = document.getElementById('studio-generate-btn');
  if (btn) btn.disabled = true;

  try {
    const form = new FormData();
    if (state.selectedProviderId)  form.append('provider_id',  state.selectedProviderId);
    if (state.model?.body_shape)   form.append('body_shape',   state.model.body_shape);

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

    const resp   = await fetch(`${API}/api/try-on/generate`, { method: 'POST', body: form });
    const result = await resp.json();

    if (!resp.ok) {
      state.tryOnPreview.status  = 'failed';
      state.tryOnPreview.message = result.message || result.error || 'Generation failed.';
    } else {
      state.tryOnPreview.status   = result.status            || 'provider_required';
      state.tryOnPreview.mode     = result.mode              || 'provider_stub';
      state.tryOnPreview.imageUrl = result.preview_image_url || null;
      state.tryOnPreview.videoUrl = result.preview_video_url || null;
      state.tryOnPreview.message  = result.message           || null;
    }
  } catch (err) {
    state.tryOnPreview.status  = 'failed';
    state.tryOnPreview.message = err.message;
  } finally {
    renderTryOnPreview();
    updateGenerateButton();
  }
}

/* ── Garment Clean Asset Pipeline (Issue #4) ─────────────────── */

function generateMockCleanAsset(rawImageUrl, type) {
  // Type-aware crop regions [xStart, yStart, xEnd, yEnd] as fractions of image dimensions.
  // Isolates the relevant garment area — for model photos, removes face / off-body regions.
  const CROP_REGIONS = {
    top:       [0.08, 0.08, 0.92, 0.62],  // upper torso only
    bottom:    [0.08, 0.35, 0.92, 0.95],  // waist-to-ankle
    shoes:     [0.08, 0.52, 0.92, 1.00],  // feet area
    dress:     [0.05, 0.05, 0.95, 0.90],  // tall garment, neck-to-hem
    outerwear: [0.05, 0.05, 0.95, 0.88],  // same as dress
    bag:       [0.12, 0.12, 0.88, 0.88],  // center square for accessories
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
    if (meta.detected_type && ASSET_TYPES.find(t => t.key === meta.detected_type)) {
      asset.detectedType = meta.detected_type;
      // Only update the user-visible type if the user hasn't manually overridden it
      if (!asset.userTypeOverride) asset.type = meta.detected_type;
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

function setupStudio() {
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

  // Wire generate try-on button
  document.getElementById('studio-generate-btn')?.addEventListener('click', runTryOnGenerate);

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
    if (!canvas || !lightbox || canvas.width === 0) return;

    // canvas.toDataURL() throws SecurityError when the video source is cross-origin
    // and the server did not send CORS headers, causing canvas taint.
    // In that case fall back to showing the raw video URL in a <video> element.
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
  };
  const closeLightbox = () => {
    const lightboxVideo = document.getElementById('tryon-lightbox-video');
    if (lightboxVideo) { lightboxVideo.pause(); lightboxVideo.removeAttribute('src'); }
    document.getElementById('tryon-lightbox')?.classList.add('hidden');
    document.body.classList.remove('lightbox-open');
  };

  // Clicking the canvas or the "View Larger Preview" button opens the lightbox.
  document.getElementById('tryon-preview-canvas')?.addEventListener('click', openLightbox);
  document.getElementById('tryon-view-larger-btn')?.addEventListener('click', openLightbox);

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

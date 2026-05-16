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
  studioScene:  null,
  studioVibe:   null,
  studioWeather: null,
  studioStep:   'build',  // 'build' | 'preview' | 'checked'
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

function syncStudioModelColumn(model, hasPhoto) {
  const hasModelEl = document.getElementById('studio-has-model');
  const noModelEl  = document.getElementById('studio-no-model');

  if (!model) {
    hasModelEl?.classList.add('hidden');
    noModelEl?.classList.remove('hidden');
    return;
  }

  hasModelEl?.classList.remove('hidden');
  noModelEl?.classList.add('hidden');

  if (hasPhoto) {
    const img = document.getElementById('studio-model-img');
    if (img) img.src = `/api/model/photo?t=${Date.now()}`;
  }

  const metaEl = document.getElementById('studio-model-meta');
  if (metaEl && model.body_shape) {
    const shapeLabel = model.body_shape.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    metaEl.innerHTML = `<span class="model-shape-badge" style="font-size:.6rem;padding:3px 9px">${shapeLabel}</span>`;
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
      updateStudioCTA();
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

  // Item slots
  document.querySelectorAll('#tab-studio .item-slot').forEach(slot => {
    const slotName = slot.dataset.slot;
    const fileInput = slot.querySelector('.slot-file-input');
    const removeBtn = slot.querySelector('.slot-remove');
    slot.addEventListener('click', e => { if (e.target !== removeBtn) fileInput.click(); });
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) setSlotPhoto(slot, slotName, fileInput.files[0]);
      fileInput.value = '';
    });
    removeBtn.addEventListener('click', e => { e.stopPropagation(); clearSlot(slot, slotName); });
  });

  // Clear all
  document.getElementById('studio-clear-btn')?.addEventListener('click', () => {
    document.querySelectorAll('#tab-studio .item-slot').forEach(slot => {
      if (slot.classList.contains('has-photo')) clearSlot(slot, slot.dataset.slot);
    });
    resetStudioPreview();
  });

  // Change/go-to model
  document.getElementById('studio-change-model-btn')?.addEventListener('click', switchToModelTab);
  document.getElementById('studio-go-model-btn')?.addEventListener('click', switchToModelTab);

  // Primary CTA → always "Preview This Look"
  document.getElementById('studio-primary-btn')?.addEventListener('click', handleStudioPrimary);

  // Secondary CTA → "Check This Look" (appears after preview)
  document.getElementById('studio-check-btn')?.addEventListener('click', runSceneAnalysis);

  updateStudioCTA();
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
  const btn = document.getElementById('studio-check-btn');
  const primaryBtn = document.getElementById('studio-primary-btn');
  const loadingEl = document.getElementById('studio-loading');
  const loadingText = document.getElementById('studio-loading-text');
  btn.disabled = true;
  primaryBtn.disabled = true;
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
    updateStudioCTA();
  } catch (err) {
    showToast('Analysis failed: ' + err.message, true);
    state.studioStep = 'preview';
    updateStudioCTA();
  } finally {
    primaryBtn.disabled = false;
    btn.disabled = false;
    loadingEl.classList.add('hidden');
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

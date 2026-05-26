/* Core application */
const App = {
  state: {
    configs: [],
    activeConfigId: '',
    activeConfig: null,
    referenceImages: [],
    queuePolling: null,
    sizeLocked: true,
    sizeRatio: 1,
    sizeAuto: false,
  },

  async init() {
    Viewer.init();
    History.initSearch();

    // Load config
    const cfgData = await API.getConfig();
    this.state.configs = cfgData.configs || [];
    this.state.activeConfigId = cfgData.active_config_id || '';

    // First run check
    if (!cfgData.first_run_done || !this.state.configs.length) {
      Wizard.show();
    } else {
      this.applyActiveConfig();
    }

    this.renderConfigDropdown();
    this.bindEvents();
    this.startQueuePolling();
    this.loadHistory();
    this.detectMode();
  },

  applyActiveConfig() {
    const cfg = this.state.configs.find(c => c.id === this.state.activeConfigId);
    this.state.activeConfig = cfg || this.state.configs[0] || null;
    if (this.state.activeConfig) {
      // Output directory
      document.getElementById('output-dir').value = this.state.activeConfig.default_output_dir || '';
      // Default params
      if (this.state.activeConfig.default_params) {
        const p = this.state.activeConfig.default_params;
        if (p.size) {
          if (p.size === 'auto') {
            this.setSizeAuto(true);
          } else {
            const m = p.size.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
            if (m) {
              this.setSizeValues(parseInt(m[1]), parseInt(m[2]));
            }
          }
        }
        if (p.quality) document.getElementById('quality').value = p.quality;
        if (p.output_format) document.getElementById('output-format').value = p.output_format;
      }
    }
  },

  renderConfigDropdown() {
    const sel = document.getElementById('config-dropdown');
    sel.innerHTML = this.state.configs.map(c =>
      `<option value="${c.id}" ${c.id === this.state.activeConfigId ? 'selected' : ''}>${this._esc(c.name)}</option>`
    ).join('');
  },

  bindEvents() {
    // Config dropdown
    document.getElementById('config-dropdown').onchange = async (e) => {
      const id = e.target.value;
      await API.activateConfig(id);
      this.state.activeConfigId = id;
      this.applyActiveConfig();
    };

    // Settings button
    document.getElementById('btn-settings').onclick = () => {
      Settings.show(this.state.configs, this.state.activeConfigId);
    };

    // Settings modal buttons
    document.getElementById('settings-new').onclick = () => Settings.newConfig();
    document.getElementById('settings-delete').onclick = () => Settings.del();
    document.getElementById('settings-test').onclick = () => Settings.test();
    document.getElementById('settings-save').onclick = () => Settings.save();
    document.getElementById('settings-overlay').onclick = (e) => {
      if (e.target === document.getElementById('settings-overlay')) Settings.hide();
    };

    // Wizard buttons
    document.getElementById('wizard-next').onclick = () => Wizard.next();
    document.getElementById('wizard-back').onclick = () => Wizard.back();

    // Size editor
    this.initSizeEditor();

    // Generate button
    document.getElementById('btn-generate').onclick = () => this.generate();

    // Keyboard shortcut: Ctrl+Enter
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.generate();
      }
      if (e.key === 'Escape') {
        Viewer.hide();
        Settings.hide();
        document.getElementById('context-menu').classList.add('hidden');
      }
    });

    // Drop zone
    const dz = document.getElementById('drop-zone');
    const fi = document.getElementById('ref-files');
    ['dragenter', 'dragover'].forEach(ev =>
      dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('dragover'); })
    );
    ['dragleave', 'drop'].forEach(ev =>
      dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('dragover'); })
    );
    dz.addEventListener('drop', e => {
      const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
      this.addRefImages(files);
    });
    fi.addEventListener('change', () => this.addRefImages([...fi.files]));

    // Paste
    document.addEventListener('paste', (e) => {
      const items = [...(e.clipboardData || {}).items || []];
      const imgs = items.filter(i => i.type.startsWith('image/')).map(i => i.getAsFile()).filter(Boolean);
      if (imgs.length) this.addRefImages(imgs);
    });

    // From history button
    document.getElementById('btn-from-history').onclick = () => this.openHistoryPicker();
    document.getElementById('history-picker-cancel').onclick = () => {
      document.getElementById('history-picker-overlay').classList.add('hidden');
    };
    document.getElementById('history-picker-overlay').onclick = (e) => {
      if (e.target === document.getElementById('history-picker-overlay'))
        document.getElementById('history-picker-overlay').classList.add('hidden');
    };

    // History delete all button
    document.getElementById('history-delete-all-btn').onclick = () => History.deleteAll();

    // History browse buttons
    document.getElementById('history-browse-btn').onclick = () => {
      const bar = document.getElementById('history-browse-bar');
      bar.classList.toggle('hidden');
      History.browseOutput('');
    };
    document.getElementById('history-back-btn').onclick = () => {
      document.getElementById('history-browse-bar').classList.add('hidden');
      History.showHistory();
    };
    document.getElementById('history-browse-path').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const dir = e.target.value.trim();
        if (dir) History.browseOutput(dir);
      }
    });
    document.getElementById('history-browse-pick').onclick = async () => {
      const r = await API.browseDirectory();
      if (r.path) {
        document.getElementById('history-browse-path').value = r.path;
        History.browseOutput(r.path);
      }
    };

    // Output directory browse
    document.getElementById('btn-browse-output').onclick = async () => {
      const r = await API.browseDirectory();
      if (r.path) {
        document.getElementById('output-dir').value = r.path;
        // Save to active config
        if (this.state.activeConfig) {
          await API.updateConfig(this.state.activeConfigId, { default_output_dir: r.path });
          this.state.activeConfig.default_output_dir = r.path;
        }
      }
    };
  },

  addRefImages(files) {
    for (const f of files) {
      if (this.state.referenceImages.length >= 10) break;
      this.state.referenceImages.push(f);
    }
    this.renderRefPreviews();
    this.detectMode();
  },

  renderRefPreviews() {
    const row = document.getElementById('ref-preview');
    row.innerHTML = '';
    this.state.referenceImages.forEach((f, i) => {
      const url = f instanceof File ? URL.createObjectURL(f) : f;
      const img = document.createElement('img');
      img.src = url;
      img.className = 'preview-thumb';
      img.title = f.name || `Image ${i + 1}`;
      img.onclick = () => {
        this.state.referenceImages.splice(i, 1);
        this.renderRefPreviews();
        this.detectMode();
      };
      row.appendChild(img);
    });
  },

  detectMode() {
    const has = this.state.referenceImages.length > 0;
    document.getElementById('mode-indicator').textContent = has
      ? 'Mode: Image Editing / 图生图'
      : 'Mode: Text to Image / 文生图';
    document.getElementById('fidelity-field').classList.toggle('hidden', !has);
  },

  getSize() {
    if (this.state.sizeAuto) return 'auto';
    const w = parseInt(document.getElementById('size-w').value) || 1024;
    const h = parseInt(document.getElementById('size-h').value) || 1024;
    return `${w}x${h}`;
  },

  gatherParams() {
    const size = this.getSize();
    const quality = document.getElementById('quality').value;
    const fmt = document.getElementById('output-format').value;
    const n = parseInt(document.getElementById('num-images').value) || 1;
    const compression = document.getElementById('output-compression').value;
    const moderation = document.getElementById('moderation').value;
    const fidelity = document.getElementById('input-fidelity').value;
    const filename = document.getElementById('custom-filename').value.trim();

    const params = { size, quality, output_format: fmt, n };
    if (compression) params.output_compression = parseInt(compression);
    if (moderation !== 'auto') params.moderation = moderation;
    if (this.state.referenceImages.length > 0) params.input_fidelity = fidelity;
    if (filename) params.custom_filename = filename;
    return params;
  },

  async generate() {
    const prompt = document.getElementById('prompt').value.trim();
    if (!prompt) { this.setStatus('Please enter a prompt / 请输入提示词', 'error'); return; }
    if (!this.state.activeConfig) { this.setStatus('Please configure API first / 请先配置 API', 'error'); return; }

    const outputDir = document.getElementById('output-dir').value.trim();
    const params = this.gatherParams();
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('config_id', this.state.activeConfigId);
    if (outputDir) form.append('output_dir', outputDir);
    for (const [k, v] of Object.entries(params)) {
      form.append(k, String(v));
    }
    for (const f of this.state.referenceImages) {
      if (f instanceof File) form.append('image', f);
    }

    this.setStatus('Submitting...');
    try {
      const r = await API.generate(form);
      if (r.error) {
        this.setStatus(r.error, 'error');
      } else {
        this.setStatus('Added to queue / 已加入队列', 'success');
      }
    } catch (e) {
      this.setStatus('Error: ' + e.message, 'error');
    }
  },

  startQueuePolling() {
    this.state.lastTaskStates = {};
    this.state.queuePolling = setInterval(async () => {
      try {
        const tasks = await API.getQueue();
        Queue.render(tasks);
        // Detect newly completed tasks and auto-refresh
        for (const t of tasks) {
          const prev = this.state.lastTaskStates[t.id];
          if (prev !== 'done' && t.status === 'done') {
            this.showTaskResult(t);
            this.loadHistory();
          }
        }
        this.state.lastTaskStates = {};
        for (const t of tasks) this.state.lastTaskStates[t.id] = t.status;
      } catch (e) { /* ignore */ }
    }, 1000);
  },

  async loadHistory() {
    try {
      const data = await API.getHistory();
      History.render(Array.isArray(data) ? data : (data.images || []));
    } catch (e) { /* ignore */ }
  },

  showTaskResult(task) {
    if (!task.result_files || !task.result_files.length) return;
    const urls = task.result_files.map(f => `/api/images/${task.id}/${f}`);
    const resultArea = document.getElementById('result-area');

    // Store task data for viewer
    const viewerData = JSON.stringify({urls, prompt: task.prompt, params: task.params});
    const makeImg = (u, i) => `<img src="${u}" class="result-img" data-viewer='${viewerData}' data-idx="${i}">`;
    const makeDownload = (u, name) => `<a href="${u}" download="${name}" class="btn btn-secondary btn-small">Download ${name}</a>`;

    if (urls.length === 1) {
      const fname = task.result_files[0];
      resultArea.innerHTML = `
        <div style="text-align:center">
          ${makeImg(urls[0], 0)}
          <div style="margin-top:12px;display:flex;gap:8px;justify-content:center">
            ${makeDownload(urls[0], fname)}
          </div>
        </div>`;
    } else {
      resultArea.innerHTML = `
        <div style="text-align:center">
          <div class="result-multi">${urls.map((u, i) => makeImg(u, i)).join('')}</div>
          <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            ${urls.map((u, i) => makeDownload(u, task.result_files[i])).join('')}
          </div>
        </div>`;
    }

    // Attach click handlers
    resultArea.querySelectorAll('.result-img').forEach(img => {
      img.onclick = () => {
        const d = JSON.parse(img.dataset.viewer);
        Viewer.show(d.urls, parseInt(img.dataset.idx), {prompt: d.prompt, params: d.params});
      };
    });
  },

  async loadRefFromUrl(url) {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const file = new File([blob], 'reference.png', { type: blob.type });
      this.addRefImages([file]);
    } catch (e) {
      console.error('Failed to load reference image:', e);
    }
  },

  async loadRefFromHistory(entry) {
    if (!entry.files || !entry.files.length) return;
    for (const f of entry.files) {
      await this.loadRefFromUrl(`/api/history/${entry.id}/images/${f}`);
    }
  },

  async openHistoryPicker() {
    document.getElementById('history-picker-overlay').classList.remove('hidden');
    const data = await API.getHistory();
    const entries = data.entries || data;
    const grid = document.getElementById('history-picker-grid');
    grid.innerHTML = entries.map(e => {
      const thumb = e.files && e.files.length ? `/api/history/${e.id}/images/${e.files[0]}` : '';
      return `<img src="${thumb}" title="${this._esc(e.prompt || '')}" data-id="${e.id}">`;
    }).join('');
    grid.querySelectorAll('img').forEach(img => {
      img.onclick = async () => {
        const entry = entries.find(e => e.id === img.dataset.id);
        if (entry) await this.loadRefFromHistory(entry);
        document.getElementById('history-picker-overlay').classList.add('hidden');
      };
    });
  },

  onConfigSaved() {
    API.getConfig().then(data => {
      this.state.configs = data.configs || [];
      this.state.activeConfigId = data.active_config_id || '';
      this.renderConfigDropdown();
      this.applyActiveConfig();
    });
  },

  setStatus(msg, cls) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status ' + (cls || '');
  },

  initSizeEditor() {
    const lockBtn = document.getElementById('size-lock');
    const wInput = document.getElementById('size-w');
    const hInput = document.getElementById('size-h');
    const presetBtns = document.querySelectorAll('.size-preset-btn');

    lockBtn.onclick = () => {
      this.state.sizeLocked = !this.state.sizeLocked;
      lockBtn.classList.toggle('locked', this.state.sizeLocked);
      if (this.state.sizeLocked) {
        this.state.sizeRatio = (parseInt(wInput.value) || 1024) / (parseInt(hInput.value) || 1024);
      }
    };
    lockBtn.classList.add('locked');
    this.state.sizeLocked = true;
    this.state.sizeRatio = 1;

    const onWChange = () => {
      this.state.sizeAuto = false;
      this.clearPresetActive();
      if (this.state.sizeLocked) {
        const w = parseInt(wInput.value) || 1;
        const h = Math.round(w / this.state.sizeRatio);
        hInput.value = Math.max(1, h);
      }
      this.updateSizeHint();
    };
    const onHChange = () => {
      this.state.sizeAuto = false;
      this.clearPresetActive();
      if (this.state.sizeLocked) {
        const h = parseInt(hInput.value) || 1;
        const w = Math.round(h * this.state.sizeRatio);
        wInput.value = Math.max(1, w);
      }
      this.updateSizeHint();
    };

    wInput.addEventListener('input', onWChange);
    hInput.addEventListener('input', onHChange);

    presetBtns.forEach(btn => {
      btn.onclick = () => {
        presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (btn.dataset.value === 'auto') {
          this.setSizeAuto(true);
        } else {
          const w = parseInt(btn.dataset.w);
          const h = parseInt(btn.dataset.h);
          this.setSizeValues(w, h);
        }
      };
    });

    this.updateSizeHint();
  },

  clearPresetActive() {
    document.querySelectorAll('.size-preset-btn').forEach(b => b.classList.remove('active'));
  },

  setSizeAuto(auto) {
    this.state.sizeAuto = auto;
    const wInput = document.getElementById('size-w');
    const hInput = document.getElementById('size-h');
    wInput.disabled = auto;
    hInput.disabled = auto;
    if (auto) {
      wInput.value = '';
      hInput.value = '';
      document.getElementById('size-hint').textContent = 'Auto';
      this.clearPresetActive();
      document.querySelector('.size-preset-btn[data-value="auto"]').classList.add('active');
    }
  },

  setSizeValues(w, h) {
    this.state.sizeAuto = false;
    this.state.sizeRatio = w / h;
    const wInput = document.getElementById('size-w');
    const hInput = document.getElementById('size-h');
    wInput.disabled = false;
    hInput.disabled = false;
    wInput.value = w;
    hInput.value = h;
    this.matchPresetBtn(w, h);
    this.updateSizeHint();
  },

  matchPresetBtn(w, h) {
    this.clearPresetActive();
    document.querySelectorAll('.size-preset-btn').forEach(btn => {
      if (btn.dataset.value) return;
      const bw = parseInt(btn.dataset.w);
      const bh = parseInt(btn.dataset.h);
      if (bw === w && bh === h) btn.classList.add('active');
    });
  },

  updateSizeHint() {
    const w = parseInt(document.getElementById('size-w').value) || 0;
    const h = parseInt(document.getElementById('size-h').value) || 0;
    const hint = document.getElementById('size-hint');
    const rect = document.getElementById('size-preview-rect');
    if (!w || !h) {
      hint.textContent = '';
      rect.style.width = '0px';
      rect.style.height = '0px';
      return;
    }
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const g = gcd(w, h);
    hint.textContent = `${w} × ${h} · ${w/g}:${h/g}`;
    const maxDim = 40;
    const ratio = w / h;
    let rw, rh;
    if (ratio >= 1) {
      rw = maxDim;
      rh = Math.max(4, Math.round(maxDim / ratio));
    } else {
      rh = maxDim;
      rw = Math.max(4, Math.round(maxDim * ratio));
    }
    rect.style.width = rw + 'px';
    rect.style.height = rh + 'px';
  },

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());

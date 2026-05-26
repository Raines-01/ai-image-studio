/* Settings modal */
const Settings = {
  configs: [],
  activeId: '',
  selectedId: '',
  isNew: false,

  show(configs, activeId) {
    this.configs = configs || [];
    this.activeId = activeId || '';
    this.selectedId = this.activeId || (this.configs.length ? this.configs[0].id : '');
    this.isNew = false;
    document.getElementById('settings-overlay').classList.remove('hidden');
    this.renderList();
    this.renderForm();
  },

  hide() {
    document.getElementById('settings-overlay').classList.add('hidden');
  },

  renderList() {
    const el = document.getElementById('settings-list');
    el.innerHTML = this.configs.map(c =>
      `<div class="settings-item ${c.id === this.selectedId ? 'active' : ''}" data-id="${c.id}">
        ${this._esc(c.name)}
        ${c.id === this.activeId ? ' <span style="opacity:.5;font-size:11px">(active)</span>' : ''}
      </div>`
    ).join('');
    el.querySelectorAll('.settings-item').forEach(item => {
      item.onclick = () => {
        this.selectedId = item.dataset.id;
        this.isNew = false;
        this.renderList();
        this.renderForm();
      };
    });
  },

  renderForm() {
    const el = document.getElementById('settings-form');
    const cfg = this.configs.find(c => c.id === this.selectedId);

    const outdirVal = (this.isNew || !cfg) ? '' : this._esc(cfg.default_output_dir || '');
    const outdirHtml = `
      <div class="field">
        <label>Default Output Directory</label>
        <div style="display:flex;gap:8px">
          <input type="text" id="sf-outdir" value="${outdirVal}" placeholder="Leave empty for default (~/.ai-image-studio/output/)" style="flex:1">
          <button class="btn btn-secondary" id="sf-browse" type="button">Browse</button>
        </div>
      </div>`;

    if (this.isNew || !cfg) {
      el.innerHTML = `
        <div class="field"><label>Name</label><input type="text" id="sf-name" placeholder="My API Provider"></div>
        <div class="field"><label>API Base URL</label><input type="text" id="sf-url" placeholder="https://api.example.com/v1"></div>
        <div class="field"><label>API Key</label><input type="password" id="sf-key" placeholder="sk-..."></div>
        <div class="field"><label>Model</label><input type="text" id="sf-model" placeholder="gpt-image-2" value="gpt-image-2"></div>
        ${outdirHtml}
      `;
    } else {
      el.innerHTML = `
        <div class="field"><label>Name</label><input type="text" id="sf-name" value="${this._esc(cfg.name)}"></div>
        <div class="field"><label>API Base URL</label><input type="text" id="sf-url" value="${this._esc(cfg.url)}"></div>
        <div class="field"><label>API Key</label><input type="password" id="sf-key" value="${this._esc(cfg.api_key)}"></div>
        <div class="field"><label>Model</label><input type="text" id="sf-model" value="${this._esc(cfg.model)}"></div>
        ${outdirHtml}
      `;
    }

    document.getElementById('sf-browse').onclick = async () => {
      const btn = document.getElementById('sf-browse');
      btn.disabled = true;
      btn.textContent = '...';
      try {
        const r = await API.browseDirectory();
        if (r.path) document.getElementById('sf-outdir').value = r.path;
      } catch (e) { /* ignore */ }
      btn.disabled = false;
      btn.textContent = 'Browse';
    };
  },

  getFormData() {
    return {
      name: document.getElementById('sf-name').value.trim(),
      url: document.getElementById('sf-url').value.trim(),
      api_key: document.getElementById('sf-key').value.trim(),
      model: document.getElementById('sf-model').value.trim(),
      default_output_dir: document.getElementById('sf-outdir').value.trim(),
    };
  },

  async save() {
    const data = this.getFormData();
    if (!data.name || !data.url || !data.api_key || !data.model) {
      alert('Please fill in all required fields');
      return;
    }
    try {
      if (this.isNew) {
        const cfg = await API.createConfig(data);
        this.configs.push(cfg);
        this.selectedId = cfg.id;
        this.isNew = false;
      } else {
        await API.updateConfig(this.selectedId, data);
        const idx = this.configs.findIndex(c => c.id === this.selectedId);
        if (idx >= 0) Object.assign(this.configs[idx], data);
      }
      this.renderList();
      if (typeof App !== 'undefined') App.onConfigSaved();
    } catch (e) {
      alert('Save failed: ' + e.message);
    }
  },

  async del() {
    if (!this.selectedId) return;
    if (!confirm('Delete this config?')) return;
    try {
      await API.deleteConfig(this.selectedId);
      this.configs = this.configs.filter(c => c.id !== this.selectedId);
      this.selectedId = this.configs.length ? this.configs[0].id : '';
      this.renderList();
      this.renderForm();
      if (typeof App !== 'undefined') App.onConfigSaved();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  },

  async test() {
    const data = this.getFormData();
    if (!data.url || !data.api_key) {
      alert('Please fill in URL and API Key');
      return;
    }
    const r = await API.testConfig(data);
    if (r.ok) {
      alert('✓ Connected!');
    } else {
      alert('✗ Failed: ' + (r.message || 'Unknown error'));
    }
  },

  newConfig() {
    this.isNew = true;
    this.selectedId = '';
    this.renderList();
    this.renderForm();
  },

  _esc(s) {
    return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
};

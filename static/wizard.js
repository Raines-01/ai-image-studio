/* First-run wizard */
const Wizard = {
  step: 1,
  data: { name: '', url: '', api_key: '', model: 'gpt-image-2' },

  show() {
    this.step = 1;
    this.data = { name: '', url: '', api_key: '', model: 'gpt-image-2' };
    document.getElementById('wizard-overlay').classList.remove('hidden');
    this.render();
  },

  hide() {
    document.getElementById('wizard-overlay').classList.add('hidden');
  },

  render() {
    const steps = document.querySelectorAll('.wizard-step');
    steps.forEach((s, i) => {
      s.classList.toggle('active', i + 1 === this.step);
      s.classList.toggle('done', i + 1 < this.step);
    });

    const body = document.getElementById('wizard-body');
    const back = document.getElementById('wizard-back');
    const next = document.getElementById('wizard-next');

    back.style.display = this.step > 1 ? '' : 'none';
    next.textContent = this.step === 3 ? 'Save & Start' : 'Next';

    if (this.step === 1) {
      body.innerHTML = `
        <div class="field">
          <label>Config Name / 配置名称</label>
          <input type="text" id="wiz-name" placeholder="e.g. My API Provider" value="${this._esc(this.data.name)}">
        </div>
        <div class="field">
          <label>API Base URL</label>
          <input type="text" id="wiz-url" placeholder="https://api.example.com/v1" value="${this._esc(this.data.url)}">
        </div>
      `;
    } else if (this.step === 2) {
      body.innerHTML = `
        <div class="field">
          <label>API Key</label>
          <input type="password" id="wiz-key" placeholder="sk-..." value="${this._esc(this.data.api_key)}">
        </div>
        <div class="field">
          <label>Model / 模型名称</label>
          <input type="text" id="wiz-model" placeholder="gpt-image-2" value="${this._esc(this.data.model)}">
        </div>
      `;
    } else if (this.step === 3) {
      body.innerHTML = `
        <div style="text-align:center;padding:20px 0">
          <div id="wiz-test-status" style="font-size:14px;color:var(--muted)">Click "Test Connection" to verify</div>
        </div>
      `;
    }
  },

  next() {
    if (this.step === 1) {
      const name = document.getElementById('wiz-name').value.trim();
      const url = document.getElementById('wiz-url').value.trim();
      if (!name || !url) { alert('Please fill in all fields'); return; }
      this.data.name = name;
      this.data.url = url;
      this.step = 2;
      this.render();
    } else if (this.step === 2) {
      const key = document.getElementById('wiz-key').value.trim();
      const model = document.getElementById('wiz-model').value.trim();
      if (!key || !model) { alert('Please fill in all fields'); return; }
      this.data.api_key = key;
      this.data.model = model;
      this.step = 3;
      this.render();
    } else if (this.step === 3) {
      this.save();
    }
  },

  back() {
    if (this.step > 1) {
      this.step--;
      this.render();
    }
  },

  async test() {
    const status = document.getElementById('wiz-test-status');
    status.textContent = 'Testing...';
    status.style.color = 'var(--muted)';
    try {
      const r = await API.testConfig({ url: this.data.url, api_key: this.data.api_key, model: this.data.model });
      if (r.ok) {
        status.textContent = '✓ Connected!';
        status.style.color = 'var(--success)';
      } else {
        status.textContent = '✗ Failed: ' + (r.message || 'Unknown error');
        status.style.color = 'var(--danger)';
      }
    } catch (e) {
      status.textContent = '✗ Error: ' + e.message;
      status.style.color = 'var(--danger)';
    }
  },

  async save() {
    try {
      const cfg = await API.createConfig(this.data);
      await API.activateConfig(cfg.id);
      await API.updateConfig(cfg.id, { _mark_first_run: true });
      // Mark first run done via a separate call
      await fetch('/api/config/first-run-done', { method: 'POST' });
      this.hide();
      if (typeof App !== 'undefined') App.onConfigSaved();
    } catch (e) {
      alert('Failed to save: ' + e.message);
    }
  },

  _esc(s) {
    return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
};

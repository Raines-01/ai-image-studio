/* History panel */
const History = {
  entries: [],
  searchTimer: null,
  browseDir: '',
  browseMode: false,

  render(entries) {
    this.entries = entries || [];
    if (this.browseMode) {
      this.renderBrowse();
      return;
    }
    const grid = document.getElementById('history-grid');
    if (!this.entries.length) {
      grid.innerHTML = '<div style="font-size:13px;color:var(--muted);text-align:center;padding:20px;grid-column:1/-1">No history yet</div>';
      return;
    }
    grid.innerHTML = this.entries.map(e => {
      const thumb = e.files && e.files.length
        ? `/api/history/${e.id}/images/${e.files[0]}` : '';
      return `<img src="${thumb}" title="${this._esc(e.prompt || '')}" data-id="${e.id}">`;
    }).join('');

    grid.querySelectorAll('img').forEach(img => {
      img.onclick = () => this.openViewer(img.dataset.id);
      img.oncontextmenu = (ev) => {
        ev.preventDefault();
        this.showContextMenu(ev, img.dataset.id);
      };
    });
  },

  renderBrowse() {
    const grid = document.getElementById('history-grid');
    if (!this.browseFiles || !this.browseFiles.length) {
      grid.innerHTML = '<div style="font-size:13px;color:var(--muted);text-align:center;padding:20px;grid-column:1/-1">No images in this folder</div>';
      return;
    }
    grid.innerHTML = this.browseFiles.map(f => {
      const url = `/api/serve-file?path=${encodeURIComponent(f.path)}`;
      return `<img src="${url}" title="${this._esc(f.name)}" data-path="${this._esc(f.path)}">`;
    }).join('');

    grid.querySelectorAll('img').forEach(img => {
      img.onclick = () => {
        const urls = this.browseFiles.map(f => `/api/serve-file?path=${encodeURIComponent(f.path)}`);
        const idx = this.browseFiles.findIndex(f => f.path === img.dataset.path);
        Viewer.show(urls, idx >= 0 ? idx : 0, {});
      };
      img.oncontextmenu = (ev) => {
        ev.preventDefault();
        this.showBrowseContextMenu(ev, img.dataset.path);
      };
    });
  },

  async browseOutput(dir) {
    if (!dir) {
      dir = this.browseDir || '';
    }
    if (!dir) {
      // Try to get from active config
      try {
        const cfgData = await API.getConfig();
        const active = cfgData.configs.find(c => c.id === cfgData.active_config_id);
        if (active && active.default_output_dir) {
          dir = active.default_output_dir;
        }
      } catch (e) {}
    }
    if (!dir) {
      alert('No output directory configured. Please set one in Settings.');
      return;
    }
    this.browseDir = dir;
    this.browseMode = true;
    document.getElementById('history-browse-path').value = dir;
    document.getElementById('history-browse-btn').classList.add('active');
    try {
      const files = await API.browseFiles(dir);
      this.browseFiles = files;
      this.renderBrowse();
    } catch (e) {
      this.browseFiles = [];
      this.renderBrowse();
    }
  },

  showHistory() {
    this.browseMode = false;
    document.getElementById('history-browse-btn').classList.remove('active');
    this.render(this.entries);
    this.loadHistory();
  },

  async loadHistory() {
    try {
      const data = await API.getHistory();
      this.entries = data.entries || data;
      if (!this.browseMode) this.render(this.entries);
    } catch (e) {}
  },

  openViewer(entryId) {
    const entry = this.entries.find(e => e.id === entryId);
    if (!entry || !entry.files) return;
    const urls = entry.files.map(f => `/api/history/${entry.id}/images/${f}`);
    if (typeof Viewer !== 'undefined') {
      Viewer.show(urls, 0, { prompt: entry.prompt, params: entry.params });
    }
  },

  showContextMenu(ev, entryId) {
    const menu = document.getElementById('context-menu');
    menu.innerHTML = `
      <div class="context-menu-item" data-action="view">View / 查看</div>
      <div class="context-menu-item" data-action="ref">Use as Reference / 作为参考图</div>
      <div class="context-menu-item danger" data-action="delete">Delete / 删除</div>
    `;
    menu.style.left = ev.clientX + 'px';
    menu.style.top = ev.clientY + 'px';
    menu.classList.remove('hidden');

    const close = () => { menu.classList.add('hidden'); document.removeEventListener('click', close); };
    setTimeout(() => document.addEventListener('click', close), 0);

    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.onclick = () => {
        const action = item.dataset.action;
        if (action === 'view') this.openViewer(entryId);
        else if (action === 'ref') this.useAsReference(entryId);
        else if (action === 'delete') this.deleteEntry(entryId);
        close();
      };
    });
  },

  showBrowseContextMenu(ev, filePath) {
    const menu = document.getElementById('context-menu');
    menu.innerHTML = `
      <div class="context-menu-item" data-action="view">View / 查看</div>
      <div class="context-menu-item" data-action="ref">Use as Reference / 作为参考图</div>
    `;
    menu.style.left = ev.clientX + 'px';
    menu.style.top = ev.clientY + 'px';
    menu.classList.remove('hidden');

    const close = () => { menu.classList.add('hidden'); document.removeEventListener('click', close); };
    setTimeout(() => document.addEventListener('click', close), 0);

    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.onclick = () => {
        const action = item.dataset.action;
        if (action === 'view') {
          const url = `/api/serve-file?path=${encodeURIComponent(filePath)}`;
          Viewer.show([url], 0, {});
        } else if (action === 'ref') {
          const url = `/api/serve-file?path=${encodeURIComponent(filePath)}`;
          if (typeof App !== 'undefined') App.loadRefFromUrl(url);
        }
        close();
      };
    });
  },

  async useAsReference(entryId) {
    const entry = this.entries.find(e => e.id === entryId);
    if (!entry || !entry.files || !entry.files.length) return;
    if (typeof App !== 'undefined' && App.loadRefFromHistory) {
      App.loadRefFromHistory(entry);
    }
  },

  async deleteEntry(entryId) {
    if (!confirm('Delete this history entry?')) return;
    try {
      await API.deleteHistory(entryId);
      this.entries = this.entries.filter(e => e.id !== entryId);
      this.render(this.entries);
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  },

  initSearch() {
    const input = document.getElementById('history-search');
    input.addEventListener('input', () => {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(async () => {
        if (this.browseMode) return;
        const q = input.value.trim();
        const data = await API.getHistory(q);
        this.entries = data.entries || data;
        this.render(this.entries);
      }, 300);
    });
  },

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
};

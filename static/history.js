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
      if (!e.files || !e.files.length) return '';
      return e.files.map(f => {
        const url = `/api/history/${e.id}/images/${f}`;
        return `<img src="${url}" title="${this._esc(e.prompt || '')}" data-id="${e.id}" data-filename="${this._esc(f)}">`;
      }).join('');
    }).join('');

    grid.querySelectorAll('img').forEach(img => {
      img.onclick = () => this.openViewer(img.dataset.id);
      img.oncontextmenu = (ev) => {
        ev.preventDefault();
        this.showContextMenu(ev, img.dataset.id, img.dataset.filename);
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
    if (!dir) dir = this.browseDir || '';
    if (!dir) {
      try {
        const cfgData = await API.getConfig();
        const active = cfgData.configs.find(c => c.id === cfgData.active_config_id);
        if (active && active.default_output_dir) dir = active.default_output_dir;
      } catch (e) {}
    }
    if (!dir) {
      try {
        const paths = await fetch('/api/default-paths').then(r => r.json());
        dir = paths.data_dir || '';
      } catch (e) {}
    }
    if (!dir) { alert('Cannot determine output directory.'); return; }
    this.browseDir = dir;
    this.browseMode = true;
    document.getElementById('history-browse-path').value = dir;
    document.getElementById('history-browse-btn').classList.add('active');
    try {
      this.browseFiles = await API.browseFiles(dir);
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
      this.entries = Array.isArray(data) ? data : (data.images || []);
      if (!this.browseMode) this.render(this.entries);
    } catch (e) {}
  },

  openViewer(entryId) {
    const allUrls = [];
    const allMeta = [];
    for (const e of this.entries) {
      if (!e.files) continue;
      for (const f of e.files) {
        allUrls.push(`/api/history/${e.id}/images/${f}`);
        allMeta.push({ prompt: e.prompt, params: e.params });
      }
    }
    const clickedEntry = this.entries.find(e => e.id === entryId);
    let startIdx = 0;
    if (clickedEntry && clickedEntry.files) {
      const clickedUrl = `/api/history/${clickedEntry.id}/images/${clickedEntry.files[0]}`;
      startIdx = allUrls.indexOf(clickedUrl);
      if (startIdx < 0) startIdx = 0;
    }
    if (typeof Viewer !== 'undefined' && allUrls.length) {
      Viewer.show(allUrls, startIdx, allMeta);
    }
  },

  showContextMenu(ev, entryId, filename) {
    const menu = document.getElementById('context-menu');
    const entry = this.entries.find(e => e.id === entryId);
    const hasMultiple = entry && entry.files && entry.files.length > 1;
    menu.innerHTML = `
      <div class="context-menu-item" data-action="view">View / 查看大图</div>
      <div class="context-menu-item" data-action="ref">Use as Reference / 作为参考图</div>
      <div class="context-menu-item danger" data-action="delete-image">Delete this image / 删除此图</div>
      ${hasMultiple ? '<div class="context-menu-item danger" data-action="delete-entry">Delete all in entry / 删除整组</div>' : ''}
      <div class="context-menu-item danger" data-action="delete-all">Delete ALL / 删除全部历史</div>
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
        else if (action === 'delete-image') this.deleteImage(entryId, filename);
        else if (action === 'delete-entry') this.deleteEntry(entryId);
        else if (action === 'delete-all') this.deleteAll();
        close();
      };
    });
  },

  showBrowseContextMenu(ev, filePath) {
    const menu = document.getElementById('context-menu');
    menu.innerHTML = `
      <div class="context-menu-item" data-action="view">View / 查看大图</div>
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
          Viewer.show([`/api/serve-file?path=${encodeURIComponent(filePath)}`], 0, {});
        } else if (action === 'ref') {
          if (typeof App !== 'undefined') App.loadRefFromUrl(`/api/serve-file?path=${encodeURIComponent(filePath)}`);
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

  async deleteImage(entryId, filename) {
    if (!confirm(`Delete ${filename}?`)) return;
    try {
      await API.deleteHistoryImage(entryId, filename);
      const entry = this.entries.find(e => e.id === entryId);
      if (entry && entry.files) {
        entry.files = entry.files.filter(f => f !== filename);
        if (!entry.files.length) {
          this.entries = this.entries.filter(e => e.id !== entryId);
        }
      }
      this.render(this.entries);
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  },

  async deleteEntry(entryId) {
    if (!confirm('Delete this group / 删除整组?')) return;
    try {
      await API.deleteHistory(entryId);
      this.entries = this.entries.filter(e => e.id !== entryId);
      this.render(this.entries);
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  },

  async deleteAll() {
    if (!confirm('Delete ALL history? / 删除全部历史记录？')) return;
    try {
      await API.deleteHistoryAll();
      this.entries = [];
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
        this.entries = Array.isArray(data) ? data : (data.images || []);
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

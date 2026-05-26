/* History panel */
const History = {
  entries: [],
  searchTimer: null,

  render(entries) {
    this.entries = entries || [];
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
        const q = input.value.trim();
        const data = await API.getHistory(q);
        this.render(data.entries || data);
      }, 300);
    });
  },

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
};

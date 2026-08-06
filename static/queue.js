/* Queue panel */
const Queue = {
  render(tasks) {
    const el = document.getElementById('queue-list');
    const area = el.closest('.queue-area');
    if (!tasks || tasks.length === 0) {
      area.classList.add('collapsed');
      return;
    }
    area.classList.remove('collapsed');
    el.innerHTML = tasks.map(t => {
      const badge = `badge-${t.status}`;
      const statusText = { waiting: 'Waiting', generating: 'Generating...', done: 'Done', failed: 'Failed' }[t.status] || t.status;
      const cancelBtn = (t.status === 'waiting' || t.status === 'generating')
        ? `<button class="cancel-btn" data-id="${t.id}" title="Cancel">&times;</button>` : '';
      const errorHtml = (t.status === 'failed' && t.error)
        ? `<div class="queue-error" title="${this._esc(t.error)}">${this._esc(t.error)}</div>` : '';
      return `
        <div class="queue-item" data-id="${t.id}">
          <span class="prompt-text">${this._esc(t.prompt || '')}</span>
          <span class="status-badge ${badge}">${statusText}</span>
          ${cancelBtn}
          ${errorHtml}
        </div>`;
    }).join('');

    el.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        API.cancelTask(btn.dataset.id);
      };
    });

    el.querySelectorAll('.queue-item').forEach(item => {
      item.onclick = () => {
        const task = tasks.find(t => t.id === item.dataset.id);
        if (task && task.status === 'done' && typeof App !== 'undefined') {
          App.showTaskResult(task);
        }
      };
    });
  },

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
};

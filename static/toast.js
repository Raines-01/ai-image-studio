/* Toast notification system */
const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toast-container');
  },

  show(title, msg, type = 'info', duration = 4000) {
    if (!this.container) this.init();

    const icons = { success: '✓', error: '✗', info: 'i' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
      </div>
      <button class="toast-close">&times;</button>
      <div class="toast-progress" style="animation-duration:${duration}ms"></div>
    `;

    toast.querySelector('.toast-close').onclick = () => this.dismiss(toast);
    this.container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => this.dismiss(toast), duration);
    }

    return toast;
  },

  success(title, msg, duration) { return this.show(title, msg, 'success', duration); },
  error(title, msg, duration) { return this.show(title, msg, 'error', duration || 6000); },
  info(title, msg, duration) { return this.show(title, msg, 'info', duration); },

  dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 250);
  }
};

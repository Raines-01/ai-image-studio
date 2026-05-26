/* Image viewer / lightbox */
const Viewer = {
  images: [],
  metaList: [],
  currentIndex: 0,
  metadata: null,

  init() {
    document.getElementById('viewer-close').onclick = () => this.hide();
    document.getElementById('viewer-prev').onclick = () => this.prev();
    document.getElementById('viewer-next').onclick = () => this.next();
    document.getElementById('viewer-download').onclick = () => this.download();
    document.getElementById('viewer-ref').onclick = () => this.useAsRef();
    document.getElementById('viewer-overlay').onclick = (e) => {
      if (e.target === document.getElementById('viewer-overlay')) this.hide();
    };
    document.addEventListener('keydown', (e) => {
      if (document.getElementById('viewer-overlay').classList.contains('hidden')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); this.next(); }
      else if (e.key === 'Escape') { this.hide(); }
    });
  },

  show(images, index, metadata) {
    this.images = images || [];
    this.currentIndex = index || 0;
    // metadata can be a single object or an array (per-image)
    if (Array.isArray(metadata)) {
      this.metaList = metadata;
      this.metadata = metadata[this.currentIndex] || null;
    } else {
      this.metaList = [];
      this.metadata = metadata || null;
    }
    if (!this.images.length) return;
    this.render();
    document.getElementById('viewer-overlay').classList.remove('hidden');
  },

  hide() {
    document.getElementById('viewer-overlay').classList.add('hidden');
  },

  render() {
    const img = document.getElementById('viewer-img');
    img.src = this.images[this.currentIndex];

    const prev = document.getElementById('viewer-prev');
    const next = document.getElementById('viewer-next');
    const hasMulti = this.images.length > 1;
    prev.style.display = hasMulti ? '' : 'none';
    next.style.display = hasMulti ? '' : 'none';

    // Use per-image metadata if available
    const meta = this.metaList.length ? this.metaList[this.currentIndex] : this.metadata;
    const info = document.getElementById('viewer-info');
    let text = `${this.currentIndex + 1} / ${this.images.length}`;
    if (meta) {
      if (meta.prompt) text += ` — ${meta.prompt}`;
      if (meta.params) {
        const p = meta.params;
        const parts = [p.size, p.quality, p.output_format].filter(Boolean);
        if (parts.length) text += ` | ${parts.join(' | ')}`;
      }
    }
    info.textContent = text;
  },

  prev() {
    if (this.images.length <= 1) return;
    this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
    this.render();
  },

  next() {
    if (this.images.length <= 1) return;
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
    this.render();
  },

  download() {
    const a = document.createElement('a');
    a.href = this.images[this.currentIndex];
    a.download = this.images[this.currentIndex].split('/').pop();
    a.click();
  },

  useAsRef() {
    if (typeof App !== 'undefined' && App.loadRefFromUrl) {
      App.loadRefFromUrl(this.images[this.currentIndex]);
      this.hide();
    }
  }
};

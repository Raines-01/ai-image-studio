/* Image viewer / lightbox */
const Viewer = {
  images: [],
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
  },

  show(images, index, metadata) {
    this.images = images;
    this.currentIndex = index || 0;
    this.metadata = metadata || null;
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
    prev.style.display = this.images.length > 1 ? '' : 'none';
    next.style.display = this.images.length > 1 ? '' : 'none';

    const info = document.getElementById('viewer-info');
    let text = `${this.currentIndex + 1} / ${this.images.length}`;
    if (this.metadata) {
      if (this.metadata.prompt) text += ` — ${this.metadata.prompt}`;
      if (this.metadata.params) {
        text += ` | ${this.metadata.params.size || ''} | ${this.metadata.params.quality || ''}`;
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

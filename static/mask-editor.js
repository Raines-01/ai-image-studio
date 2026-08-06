/* Mask Editor — paint inpainting masks on images */
const MaskEditor = {
  sourceImage: null,
  sourceBlob: null,
  maskCanvas: null,
  tintCanvas: null,
  cursorCanvas: null,
  container: null,
  isEraser: false,
  brushSize: 30,
  painting: false,
  strokes: [],        // [{points: [{x,y},...], eraser: bool}, ...]
  currentStroke: null,
  undoStack: [],
  scale: 1,
  imageUrl: '',
  onConfirm: null,

  open(imageUrl, onConfirm) {
    this.imageUrl = imageUrl;
    this.onConfirm = onConfirm;
    this.strokes = [];
    this.currentStroke = null;
    this.undoStack = [];
    this.isEraser = false;
    this.brushSize = 30;
    this._showOverlay();
    this._loadImage(imageUrl);
  },

  close() {
    this._hideOverlay();
    this.sourceImage = null;
    this.sourceBlob = null;
    this.strokes = [];
    this.currentStroke = null;
    this.undoStack = [];
  },

  _showOverlay() {
    document.getElementById('mask-editor-overlay').classList.remove('hidden');
    document.getElementById('mask-brush-size').value = this.brushSize;
    document.getElementById('mask-brush-size-label').textContent = this.brushSize;
    this._updateToolButtons();
  },

  _hideOverlay() {
    document.getElementById('mask-editor-overlay').classList.add('hidden');
  },

  async _loadImage(url) {
    try {
      const resp = await fetch(url);
      this.sourceBlob = await resp.blob();
      const img = new Image();
      img.onload = () => {
        this.sourceImage = img;
        this._initCanvases();
      };
      img.src = URL.createObjectURL(this.sourceBlob);
    } catch (e) {
      console.error('MaskEditor: failed to load image', e);
    }
  },

  _initCanvases() {
    const wrap = document.getElementById('mask-canvas-wrap');
    wrap.innerHTML = '';

    const natW = this.sourceImage.naturalWidth;
    const natH = this.sourceImage.naturalHeight;

    // Compute display scale to fit viewport
    const wrapRect = wrap.getBoundingClientRect();
    this.scale = Math.min(wrapRect.width / natW, wrapRect.height / natH, 1);
    const dispW = Math.round(natW * this.scale);
    const dispH = Math.round(natH * this.scale);

    // Source image canvas (visible)
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = natW;
    srcCanvas.height = natH;
    srcCanvas.style.width = dispW + 'px';
    srcCanvas.style.height = dispH + 'px';
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(this.sourceImage, 0, 0, natW, natH);

    // Tint canvas (visible, overlaid)
    this.tintCanvas = document.createElement('canvas');
    this.tintCanvas.width = natW;
    this.tintCanvas.height = natH;
    this.tintCanvas.style.width = dispW + 'px';
    this.tintCanvas.style.height = dispH + 'px';

    // Mask canvas (off-screen, holds the actual mask data)
    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = natW;
    this.maskCanvas.height = natH;
    this._clearMaskCanvas();

    // Cursor canvas (visible, topmost, captures events)
    this.cursorCanvas = document.createElement('canvas');
    this.cursorCanvas.width = natW;
    this.cursorCanvas.height = natH;
    this.cursorCanvas.style.width = dispW + 'px';
    this.cursorCanvas.style.height = dispH + 'px';
    this.cursorCanvas.style.pointerEvents = 'auto';

    wrap.appendChild(srcCanvas);
    wrap.appendChild(this.tintCanvas);
    wrap.appendChild(this.cursorCanvas);

    this._bindEvents();
    this._renderTint();
  },

  _clearMaskCanvas() {
    const ctx = this.maskCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgb(255,255,255)';
    ctx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
  },

  _bindEvents() {
    const c = this.cursorCanvas;

    c.onmousedown = (e) => { e.preventDefault(); this._onPointerDown(e.clientX, e.clientY); };
    c.onmousemove = (e) => this._onPointerMove(e.clientX, e.clientY);
    c.onmouseup = () => this._onPointerUp();
    c.onmouseleave = () => this._onPointerUp();

    c.ontouchstart = (e) => { e.preventDefault(); this._onPointerDown(e.touches[0].clientX, e.touches[0].clientY); };
    c.ontouchmove = (e) => { e.preventDefault(); this._onPointerMove(e.touches[0].clientX, e.touches[0].clientY); };
    c.ontouchend = (e) => { e.preventDefault(); this._onPointerUp(); };
  },

  _toImageCoords(clientX, clientY) {
    const rect = this.cursorCanvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / this.scale,
      y: (clientY - rect.top) / this.scale,
    };
  },

  _onPointerDown(clientX, clientY) {
    const p = this._toImageCoords(clientX, clientY);
    this.painting = true;

    // Save undo snapshot
    const ctx = this.maskCanvas.getContext('2d');
    this.undoStack.push(ctx.getImageData(0, 0, this.maskCanvas.width, this.maskCanvas.height));
    if (this.undoStack.length > 20) this.undoStack.shift();

    this.currentStroke = { points: [p], eraser: this.isEraser };
    this.strokes.push(this.currentStroke);
    this._renderMask();
    this._renderTint();
    this._renderCursor(clientX, clientY);
  },

  _onPointerMove(clientX, clientY) {
    this._renderCursor(clientX, clientY);
    if (!this.painting || !this.currentStroke) return;
    const p = this._toImageCoords(clientX, clientY);
    this.currentStroke.points.push(p);
    this._renderMask();
    this._renderTint();
  },

  _onPointerUp() {
    this.painting = false;
    this.currentStroke = null;
  },

  _renderMask() {
    const ctx = this.maskCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgb(255,255,255)';
    ctx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);

    for (const stroke of this.strokes) {
      if (stroke.points.length < 1) continue;
      ctx.globalCompositeOperation = stroke.eraser ? 'source-over' : 'destination-out';
      ctx.strokeStyle = stroke.eraser ? 'rgb(255,255,255)' : 'rgba(0,0,0,1)';
      ctx.lineWidth = this.brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      if (stroke.points.length === 1) {
        // Single dot
        ctx.lineTo(stroke.points[0].x + 0.1, stroke.points[0].y + 0.1);
      }
      ctx.stroke();
    }
  },

  _renderTint() {
    const ctx = this.tintCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.tintCanvas.width, this.tintCanvas.height);
    // Fill with red tint
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 50, 50, 0.4)';
    ctx.fillRect(0, 0, this.tintCanvas.width, this.tintCanvas.height);
    // Punch through where mask is white (keep area)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(this.maskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  },

  _renderCursor(clientX, clientY) {
    if (!this.cursorCanvas) return;
    const ctx = this.cursorCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.cursorCanvas.width, this.cursorCanvas.height);
    const p = this._toImageCoords(clientX, clientY);
    const r = this.brushSize / 2;
    ctx.strokeStyle = this.isEraser ? 'rgba(255,255,255,0.8)' : 'rgba(255,80,80,0.8)';
    ctx.lineWidth = 2 / this.scale;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  },

  undo() {
    if (this.undoStack.length === 0) return;
    const ctx = this.maskCanvas.getContext('2d');
    const snapshot = this.undoStack.pop();
    ctx.putImageData(snapshot, 0, 0);
    // Rebuild strokes from remaining (approximate — just remove last stroke)
    if (this.strokes.length > 0) this.strokes.pop();
    this._renderTint();
  },

  clearMask() {
    this.strokes = [];
    this.currentStroke = null;
    this.undoStack = [];
    this._clearMaskCanvas();
    this._renderTint();
  },

  toggleEraser() {
    this.isEraser = !this.isEraser;
    this._updateToolButtons();
  },

  setBrushSize(size) {
    this.brushSize = Math.max(2, Math.min(500, size));
    document.getElementById('mask-brush-size').value = this.brushSize;
    document.getElementById('mask-brush-size-label').textContent = this.brushSize;
  },

  _changeBrushSize(delta) {
    this.setBrushSize(this.brushSize + delta);
  },

  _updateToolButtons() {
    const brushBtn = document.getElementById('mask-brush-btn');
    const eraserBtn = document.getElementById('mask-eraser-btn');
    if (brushBtn && eraserBtn) {
      brushBtn.classList.toggle('active', !this.isEraser);
      eraserBtn.classList.toggle('active', this.isEraser);
    }
  },

  async _confirm() {
    if (!this.maskCanvas || !this.sourceBlob) return;
    const maskBlob = await new Promise(r => this.maskCanvas.toBlob(b => r(b), 'image/png'));
    const maskFile = new File([maskBlob], 'mask.png', { type: 'image/png' });
    const sourceFile = new File([this.sourceBlob], 'source.png', { type: this.sourceBlob.type || 'image/png' });

    // Generate a tint preview (red overlay on source) for UI display
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = this.sourceImage.naturalWidth;
    previewCanvas.height = this.sourceImage.naturalHeight;
    const pctx = previewCanvas.getContext('2d');
    pctx.drawImage(this.sourceImage, 0, 0);
    pctx.globalAlpha = 0.45;
    pctx.drawImage(this.tintCanvas, 0, 0);
    pctx.globalAlpha = 1;
    const previewUrl = previewCanvas.toDataURL('image/png');

    this.close();
    if (this.onConfirm) this.onConfirm(sourceFile, maskFile, previewUrl);
  },

  init() {
    // Header and toolbar buttons — stop propagation so overlay click handler doesn't close
    const stop = (el) => el.addEventListener('click', (e) => e.stopPropagation());

    const cancelBtn = document.getElementById('mask-cancel');
    const confirmBtn = document.getElementById('mask-confirm');
    const brushBtn = document.getElementById('mask-brush-btn');
    const eraserBtn = document.getElementById('mask-eraser-btn');
    const undoBtn = document.getElementById('mask-undo-btn');
    const clearBtn = document.getElementById('mask-clear-btn');
    const sizeSlider = document.getElementById('mask-brush-size');
    const header = document.querySelector('.mask-editor-header');
    const toolbar = document.getElementById('mask-toolbar');

    cancelBtn.onclick = () => this.close();
    confirmBtn.onclick = () => this._confirm();
    brushBtn.onclick = () => { this.isEraser = false; this._updateToolButtons(); };
    eraserBtn.onclick = () => { this.isEraser = true; this._updateToolButtons(); };
    undoBtn.onclick = () => this.undo();
    clearBtn.onclick = () => this.clearMask();
    sizeSlider.oninput = (e) => this.setBrushSize(parseInt(e.target.value));

    // Prevent overlay click handler from intercepting header/toolbar clicks
    [cancelBtn, confirmBtn, brushBtn, eraserBtn, undoBtn, clearBtn, sizeSlider, header, toolbar].forEach(stop);

    // Keyboard shortcuts (only once)
    if (!this._keyBound) {
      this._keyBound = true;
      document.addEventListener('keydown', (e) => {
        if (document.getElementById('mask-editor-overlay').classList.contains('hidden')) return;
        if (e.key === 'Escape') this.close();
        else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.undo(); }
        else if (e.key === 'e') this.toggleEraser();
        else if (e.key === '[') this._changeBrushSize(-5);
        else if (e.key === ']') this._changeBrushSize(5);
      });
    }
  },
};

const imageUrlInput = document.getElementById('imageUrl');
const copyLinkBtn = document.getElementById('copyLink');
const saveStateMarker = document.getElementById('saveState');
const baseImage = document.getElementById('baseImage');
const imageContainer = document.getElementById('imageContainer');
const pinsLayer = document.getElementById('pins');
const annotationList = document.getElementById('annotationList');
const clearAllBtn = document.getElementById('clearAll');
const toast = document.getElementById('toast');

let annotations = [];
let hasUnsaved = false;
let activePinId = null;
let pendingUpdate = null;

function parseQuery() {
  const query = new URLSearchParams(window.location.search);
  const i = query.get('i');
  const d = query.get('d');

  if (i) imageUrlInput.value = decodeURIComponent(i);

  if (!d) return;

  try {
    const decoded = atob(d);
    const parsed = JSON.parse(decoded);
    if (Array.isArray(parsed)) {
      annotations = parsed.map((it, idx) => ({ ...it, id: `a${idx}-${Date.now()}` }));
    }
  } catch (e) {
    console.warn('Unable to parse annotation data', e);
  }
}

function buildQuery() {
  const i = encodeURIComponent(imageUrlInput.value.trim());
  const d = btoa(JSON.stringify(annotations.map(({ x, y, note }) => ({ x, y, note }))));
  const q = new URLSearchParams();
  if (i) q.set('i', i);
  if (annotations.length) q.set('d', d);
  return `?${q.toString()}`;
}

function pushState() {
  const url = `${window.location.protocol}//${window.location.host}${window.location.pathname}${buildQuery()}`;
  window.history.replaceState({}, '', url);
  hasUnsaved = false;
  renderSaveState();
}

function getPointFromEvent(e) {
  const rect = baseImage.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  return {
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y)),
  };
}

function renderPins() {
  pinsLayer.innerHTML = '';
  annotations.forEach((ann) => {
    const el = document.createElement('button');
    el.className = `pin${activePinId === ann.id ? ' active' : ''}`;
    el.style.left = `${ann.x}%`;
    el.style.top = `${ann.y}%`;
    el.dataset.id = ann.id;
    el.dataset.tooltip = ann.note || 'Pin annotation';
    el.title = ann.note || 'Click to edit note';
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      activePinId = ann.id;
      render();
    });
    pinsLayer.appendChild(el);
  });
}

function renderAnnotations() {
  annotationList.innerHTML = '';
  if (!annotations.length) {
    annotationList.innerHTML = '<li class="annotation-item"><div class="content">No annotations yet. Click on the image to add one.</div></li>';
    return;
  }

  annotations.forEach((ann) => {
    const item = document.createElement('li');
    item.className = `annotation-item${activePinId === ann.id ? ' active' : ''}`;
    item.addEventListener('click', () => {
      activePinId = ann.id;
      render();
    });

    const content = document.createElement('div');
    content.className = 'content';

    const textarea = document.createElement('textarea');
    textarea.value = ann.note || '';
    textarea.placeholder = 'Annotation text...';
    textarea.addEventListener('input', (e) => {
      ann.note = e.target.value;
      markUnsaved();
      renderPins();
    });
    content.appendChild(textarea);

    const coordRow = document.createElement('div');
    coordRow.className = 'coord-row';

    const xLabel = document.createElement('label');
    xLabel.textContent = 'X';

    const xInput = document.createElement('input');
    xInput.type = 'number';
    xInput.min = 0;
    xInput.max = 100;
    xInput.step = 0.1;
    xInput.value = ann.x.toFixed(1);
    xInput.title = 'X coordinate (percent)';
    xInput.addEventListener('change', (e) => {
      ann.x = Math.min(100, Math.max(0, Number(e.target.value) || 0));
      markUnsaved();
      render();
    });

    const yLabel = document.createElement('label');
    yLabel.textContent = 'Y';

    const yInput = document.createElement('input');
    yInput.type = 'number';
    yInput.min = 0;
    yInput.max = 100;
    yInput.step = 0.1;
    yInput.value = ann.y.toFixed(1);
    yInput.title = 'Y coordinate (percent)';
    yInput.addEventListener('change', (e) => {
      ann.y = Math.min(100, Math.max(0, Number(e.target.value) || 0));
      markUnsaved();
      render();
    });

    coordRow.appendChild(xLabel);
    coordRow.appendChild(xInput);
    coordRow.appendChild(yLabel);
    coordRow.appendChild(yInput);

    content.appendChild(coordRow);

    const remove = document.createElement('button');
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      annotations = annotations.filter((n) => n.id !== ann.id);
      if (activePinId === ann.id) activePinId = null;
      render();
      markUnsaved();
    });

    item.appendChild(content);
    item.appendChild(remove);
    annotationList.appendChild(item);
  });
}

function renderSaveState() {
  saveStateMarker.textContent = hasUnsaved ? 'Unsaved changes' : 'Synced';
  saveStateMarker.style.backgroundColor = hasUnsaved ? 'var(--danger)' : 'var(--panel)';
}

function render() {
  renderPins();
  renderAnnotations();
  renderSaveState();
}

function markUnsaved() {
  if (!hasUnsaved) {
    hasUnsaved = true;
    renderSaveState();
  }
  window.clearTimeout(pendingUpdate);
  pendingUpdate = window.setTimeout(() => {
    pushState();
    showToast('URL auto-updated.');
  }, 400);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function loadImage() {
  const url = imageUrlInput.value.trim();
  if (!url) {
    showToast('Image URL is required.');
    return;
  }

  baseImage.src = url;
  baseImage.onload = () => {
    imageContainer.classList.remove('error');
    showToast('Image loaded. Click to add annotations.');
    pushState();
  };

  baseImage.onerror = () => {
    showToast('Image failed to load. Check URL/CORS.');
  };
}

function initialize() {
  parseQuery();

  if (imageUrlInput.value.trim()) {
    loadImage();
  }

  baseImage.addEventListener('click', (event) => {
    const rect = baseImage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const { x, y } = getPointFromEvent(event);
    const annotation = { id: `a${Date.now()}-${Math.random().toString(16).slice(2)}`, x, y, note: '' };
    annotations.unshift(annotation);
    activePinId = annotation.id;
    render();
    markUnsaved();
    
    // Focus the textarea of the newly created annotation
    window.requestAnimationFrame(() => {
      const textarea = annotationList.querySelector('textarea');
      if (textarea) textarea.focus();
    });
  });

  imageUrlInput.addEventListener('blur', () => {
    if (imageUrlInput.value.trim()) {
      loadImage();
    }
  });

  copyLinkBtn.addEventListener('click', async () => {
    const link = `${window.location.origin}${window.location.pathname}${buildQuery()}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast('Link copied to clipboard.');
    } catch (err) {
      showToast('Copy failed. Please copy manually from URL bar.');
    }
  });

  clearAllBtn.addEventListener('click', () => {
    if (!confirm('Delete all annotations?')) return;
    annotations = [];
    activePinId = null;
    render();
    markUnsaved();
  });

  window.addEventListener('popstate', () => {
    parseQuery();
    render();
  });

  render();
}

initialize();

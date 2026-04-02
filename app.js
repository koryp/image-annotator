const imageUrlInput = document.getElementById('imageUrl');
const loadImageBtn = document.getElementById('loadImage');
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

  annotations.forEach((ann, index) => {
    const item = document.createElement('li');
    item.className = 'annotation-item';

    const content = document.createElement('div');
    content.className = 'content';
    content.innerHTML = `<strong>#${index + 1}</strong> (${ann.x.toFixed(1)}%, ${ann.y.toFixed(1)}%)`;

    const textarea = document.createElement('textarea');
    textarea.value = ann.note || '';
    textarea.addEventListener('input', (e) => {
      ann.note = e.target.value;
      markUnsaved();
      renderPins();
    });
    content.appendChild(textarea);

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
    const note = prompt('Annotation note:', '');
    if (note === null) return;

    const annotation = { id: `a${Date.now()}-${Math.random().toString(16).slice(2)}`, x, y, note: note.trim() };
    annotations.push(annotation);
    activePinId = annotation.id;
    render();
    markUnsaved();
  });

  loadImageBtn.addEventListener('click', () => {
    loadImage();
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

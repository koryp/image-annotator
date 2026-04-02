const imageUrlInput = document.getElementById('imageUrl');
const newProjectBtn = document.getElementById('newProject');
const copyLinkBtn = document.getElementById('copyLink');
const saveStateMarker = document.getElementById('saveState');
const largeUrlBadge = document.getElementById('largeUrl');
const baseImage = document.getElementById('baseImage');
const imageContainer = document.getElementById('imageContainer');
const pinsLayer = document.getElementById('pins');
const annotationList = document.getElementById('annotationList');
const clearAllBtn = document.getElementById('clearAll');
const toast = document.getElementById('toast');
const projectsBtn = document.getElementById('projectsBtn');
const projectsModal = document.getElementById('projectsModal');
const closeModalBtn = document.getElementById('closeModal');
const projectNameInput = document.getElementById('projectName');
const saveProjectBtn = document.getElementById('saveProjectBtn');
const projectList = document.getElementById('projectList');

let annotations = [];
let hasUnsaved = false;
let activePinId = null;
let pendingUpdate = null;
let dragState = null; // { id, annotation }

const defaultLogoDataUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNjAiIGhlaWdodD0iODAiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMwZjE3MmEiLz48dGV4dCB4PSI1MCUiIHk9IjU1JSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkludGVyLHN5c3RlbS11aSxzYW5zLXNlcmlmIiBmb250LXNpemU9IjE4IiBmaWxsPSIjZTVlN2ViIj5pbWFnZS1hbm5vdGF0b3I8L3RleHQ+PC9zdmc+';

function parseQuery() {
  const query = new URLSearchParams(window.location.search);
  const i = query.get('i');
  const d = query.get('d');

  if (i) imageUrlInput.value = decodeURIComponent(i);

  if (!d) return;

  let parsed = null;

  // Try LZ-String decompression first (preferred)
  if (typeof LZString !== 'undefined') {
    try {
      const decompressed = LZString.decompressFromEncodedURIComponent(d);
      if (decompressed) {
        parsed = JSON.parse(decompressed);
      }
    } catch (e) {
      console.info('LZ compression decode failed; falling back to base64.', e);
    }
  }

  // Fallback to base64 JSON for legacy links or if LZ fails
  if (!parsed) {
    try {
      const decoded = atob(d);
      parsed = JSON.parse(decoded);
    } catch (e) {
      console.warn('Unable to parse annotation data', e);
    }
  }

  if (Array.isArray(parsed)) {
    annotations = parsed.map((it, idx) => ({ ...it, id: `a${idx}-${Date.now()}` }));
  }
}

function buildQuery() {
  const i = encodeURIComponent(imageUrlInput.value.trim());
  const payload = JSON.stringify(annotations.map(({ x, y, note }) => ({ x, y, note })));

  let d;
  if (typeof LZString !== 'undefined') {
    d = LZString.compressToEncodedURIComponent(payload);
  }

  // If LZString isn't available or compression fails, fallback to base64
  if (!d) {
    d = btoa(payload);
  }

  const q = new URLSearchParams();
  if (i) q.set('i', i);
  if (annotations.length) q.set('d', d);
  return `?${q.toString()}`;
}

function updateLargeUrlBadge(url) {
  const length = url.length;
  if (length > 2000) {
    largeUrlBadge.innerHTML = `${length} chars`;
    largeUrlBadge.style.display = 'inline-block';
    if (length > 32000) {
      largeUrlBadge.style.backgroundColor = 'var(--danger)';
    } else {
      largeUrlBadge.style.backgroundColor = 'var(--warning)';
    }
  } else {
    largeUrlBadge.style.display = 'none';
  }
}

function pushState() {
  const url = `${window.location.protocol}//${window.location.host}${window.location.pathname}${buildQuery()}`;
  window.history.replaceState({}, '', url);
  hasUnsaved = false;
  renderSaveState();
  updateLargeUrlBadge(url);
}

function pointToPercent(clientX, clientY) {
  const rect = baseImage.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;
  return {
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y)),
  };
}

function getPointFromEvent(e) {
  return pointToPercent(e.clientX, e.clientY);
}

function getProjectsFromStorage() {
  try {
    const projects = localStorage.getItem('imageAnnotatorProjects');
    return projects ? JSON.parse(projects) : [];
  } catch (e) {
    console.warn('Failed to read projects from localStorage', e);
    return [];
  }
}

function saveProjectsToStorage(projects) {
  try {
    localStorage.setItem('imageAnnotatorProjects', JSON.stringify(projects));
  } catch (e) {
    console.warn('Failed to save projects to localStorage', e);
    showToast('Failed to save project (storage full?)');
  }
}

function saveProject(name) {
  if (!name.trim()) {
    showToast('Project name cannot be empty.');
    return;
  }
  const querystring = buildQuery();
  const projects = getProjectsFromStorage();
  projects.unshift({ name: name.trim(), querystring, timestamp: Date.now() });
  saveProjectsToStorage(projects);
  projectNameInput.value = '';
  renderProjectList();
  showToast(`Project "${name.trim()}" saved.`);
}

function loadProject(querystring) {
  window.history.pushState({}, '', `${window.location.pathname}${querystring}`);
  parseQuery();
  if (imageUrlInput.value.trim()) {
    loadImage();
  }
  render();
  updateLargeUrlBadge(window.location.href);
  closeModal();
  showToast('Project loaded.');
}

function deleteProject(timestamp) {
  const projects = getProjectsFromStorage();
  const filtered = projects.filter((p) => p.timestamp !== timestamp);
  saveProjectsToStorage(filtered);
  renderProjectList();
  showToast('Project deleted.');
}

function renderProjectList() {
  const projects = getProjectsFromStorage();
  projectList.innerHTML = '';
  if (!projects.length) {
    projectList.innerHTML = '<li class="project-item"><div class="project-info">No saved projects yet.</div></li>';
    return;
  }
  projects.forEach((project) => {
    const item = document.createElement('li');
    item.className = 'project-item';
    
    const info = document.createElement('div');
    info.className = 'project-info';
    
    const name = document.createElement('div');
    name.className = 'project-name';
    name.textContent = project.name;
    
    const date = document.createElement('div');
    date.className = 'project-date';
    date.textContent = new Date(project.timestamp).toLocaleDateString() + ' ' + new Date(project.timestamp).toLocaleTimeString();
    
    info.appendChild(name);
    info.appendChild(date);
    
    const actions = document.createElement('div');
    actions.className = 'project-actions';
    
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.className = 'btn';
    loadBtn.addEventListener('click', () => {
      loadProject(project.querystring);
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'btn danger';
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Delete "${project.name}"?`)) {
        deleteProject(project.timestamp);
      }
    });
    
    actions.appendChild(loadBtn);
    actions.appendChild(deleteBtn);
    
    item.appendChild(info);
    item.appendChild(actions);
    projectList.appendChild(item);
  });
}

function openModal() {
  projectsModal.classList.add('show');
  renderProjectList();
}

function closeModal() {
  projectsModal.classList.remove('show');
}

function setActiveAnnotation(annId) {
  activePinId = annId;
  renderPins();
  annotationList.querySelectorAll('.annotation-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.id === annId);
  });
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
      setActiveAnnotation(ann.id);
    });
    el.addEventListener('focus', () => {
      setActiveAnnotation(ann.id);
    });
    el.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      event.preventDefault();
      dragState = { id: ann.id, annotation: ann };
      setActiveAnnotation(ann.id);
      // capture pointer for drag events
      el.setPointerCapture(event.pointerId);
    });
    pinsLayer.appendChild(el);
  });
}

function getAnnotationById(id) {
  return annotations.find((ann) => ann.id === id);
}

function onGlobalPointerMove(event) {
  if (!dragState) return;
  const coords = pointToPercent(event.clientX, event.clientY);
  dragState.annotation.x = coords.x;
  dragState.annotation.y = coords.y;
  activePinId = dragState.id;
  renderPins();
  renderAnnotations();
}

function onGlobalPointerUp() {
  if (!dragState) return;
  dragState = null;
  markUnsaved();
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
    item.dataset.id = ann.id;
    item.addEventListener('click', () => {
      setActiveAnnotation(ann.id);
    });

    const content = document.createElement('div');
    content.className = 'content';

    const textarea = document.createElement('textarea');
    textarea.value = ann.note || '';
    textarea.placeholder = 'Annotation text...';
    textarea.addEventListener('focus', () => {
      setActiveAnnotation(ann.id);
    });
    textarea.addEventListener('input', (e) => {
      ann.note = e.target.value;
      renderPins();
    });
    textarea.addEventListener('change', () => {
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
    xInput.addEventListener('focus', () => {
      setActiveAnnotation(ann.id);
    });
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
    yInput.addEventListener('focus', () => {
      setActiveAnnotation(ann.id);
    });
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
    remove.className = 'btn';
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
  baseImage.src = defaultLogoDataUrl;

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

  imageUrlInput.addEventListener('change', () => {
    if (imageUrlInput.value.trim()) {
      loadImage();
    }
  });

  newProjectBtn.addEventListener('click', async () => {
    const proceed = confirm('This will replace the active project. Copy the shareable link or save the project to prevent losing any work. Proceed with new project?');
    if (!proceed) return;
    const link = `${window.location.origin}${window.location.pathname}`;
    window.history.pushState({}, '', link);
    annotations = [];
    activePinId = null;
    baseImage.src = defaultLogoDataUrl;
    render();
    updateLargeUrlBadge(link);
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

  projectsBtn.addEventListener('click', () => {
    openModal();
  });

  closeModalBtn.addEventListener('click', () => {
    closeModal();
  });

  projectNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveProject(projectNameInput.value);
    }
  });

  saveProjectBtn.addEventListener('click', () => {
    saveProject(projectNameInput.value);
  });

  projectsModal.addEventListener('click', (e) => {
    if (e.target === projectsModal) {
      closeModal();
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
    updateLargeUrlBadge(window.location.href);
  });

  window.addEventListener('pointermove', onGlobalPointerMove);
  window.addEventListener('pointerup', onGlobalPointerUp);
  window.addEventListener('pointercancel', onGlobalPointerUp);

  updateLargeUrlBadge(window.location.href);
  render();
}

initialize();

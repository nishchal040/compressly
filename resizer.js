/**
 * Compressly - Image Resizer Script
 */

(function () {
  'use strict';

  // State Management
  const AppState = {
    files: [], // { id, file, originalSpecs: { name, size, width, height, format }, status, compressedBlob, compressedSpecs, thumbnailUrl }
    settings: {
      mode: 'pixels', // pixels, percent
      width: null,
      height: null,
      aspectRatioLock: true,
      percent: 50,
      format: 'webp' // auto, jpeg, png, webp
    },
    activeComparisonId: null
  };

  // DOM Query Selectors Cache
  const DOM = {
    html: document.documentElement,
    themeToggle: document.getElementById('themeToggle'),
    hamburgerBtn: document.getElementById('hamburgerBtn'),
    navMenu: document.getElementById('navMenu'),
    
    // File upload
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    workspace: document.getElementById('workspace'),
    
    // Settings inputs
    modePixels: document.getElementById('modePixels'),
    modePercent: document.getElementById('modePercent'),
    pixelSettings: document.getElementById('pixelSettings'),
    percentSettings: document.getElementById('percentSettings'),
    resizeWidth: document.getElementById('resizeWidth'),
    resizeHeight: document.getElementById('resizeHeight'),
    aspectRatioLock: document.getElementById('aspectRatioLock'),
    percentSlider: document.getElementById('percentSlider'),
    percentVal: document.getElementById('percentVal'),
    formatSelect: document.getElementById('formatSelect'),
    
    // Actions
    resizeBtn: document.getElementById('resizeBtn'),
    resizeBtnText: document.querySelector('#resizeBtn span') || document.getElementById('resizeBtn'),
    downloadAllBtn: document.getElementById('downloadAllBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    
    // Queue
    queueCount: document.getElementById('queueCount'),
    imageList: document.getElementById('imageList'),
    
    // Stats
    statsBar: document.getElementById('statsBar'),
    statProcessed: document.getElementById('statProcessed'),
    statOriginal: document.getElementById('statOriginal'),
    statCompressed: document.getElementById('statCompressed'),
    statSaved: document.getElementById('statSaved'),
    
    // Comparison
    comparisonSection: document.getElementById('comparisonSection'),
    compOrigImg: document.getElementById('compOrigImg'),
    compOrigSize: document.getElementById('compOrigSize'),
    compOrigDim: document.getElementById('compOrigDim'),
    compNewImg: document.getElementById('compNewImg'),
    compNewSize: document.getElementById('compNewSize'),
    compNewDim: document.getElementById('compNewDim')
  };

  /* ==========================================================================
     THEME / NAVIGATION MANAGEMENT
     ========================================================================== */
  function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
      DOM.html.setAttribute('data-theme', 'dark');
    } else {
      DOM.html.removeAttribute('data-theme');
    }
  }

  DOM.themeToggle.addEventListener('click', () => {
    const isDark = DOM.html.getAttribute('data-theme') === 'dark';
    if (isDark) {
      DOM.html.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    } else {
      DOM.html.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    }
  });

  DOM.hamburgerBtn.addEventListener('click', () => {
    const expanded = DOM.hamburgerBtn.getAttribute('aria-expanded') === 'true';
    DOM.hamburgerBtn.setAttribute('aria-expanded', !expanded);
    DOM.hamburgerBtn.classList.toggle('active');
    DOM.navMenu.classList.toggle('active');
  });

  // Tools dropdown toggle for mobile
  const dropdownToggle = document.getElementById('toolsDropdownToggle');
  if (dropdownToggle) {
    dropdownToggle.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        dropdownToggle.parentElement.classList.toggle('active');
      }
    });
  }

  /* ==========================================================================
     FILE UPLOADING
     ========================================================================== */
  DOM.dropZone.addEventListener('click', () => DOM.fileInput.click());
  DOM.dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      DOM.fileInput.click();
    }
  });

  ['dragenter', 'dragover'].forEach(name => {
    DOM.dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      DOM.dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    DOM.dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      DOM.dropZone.classList.remove('dragover');
    });
  });

  DOM.dropZone.addEventListener('drop', (e) => {
    handleFiles(e.dataTransfer.files);
  });

  DOM.fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  });

  function handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    const mimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!mimeTypes.includes(file.type)) {
        alert(`Warning: Format type of "${file.name}" is not supported.`);
        continue;
      }
      if (file.size > 50 * 1024 * 1024) {
        alert(`Warning: "${file.name}" is larger than 50MB limits.`);
        continue;
      }

      const id = 'res_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      const fileItem = {
        id,
        file,
        originalSpecs: {
          name: file.name,
          size: file.size,
          format: file.type.split('/')[1] || 'unknown',
          width: 0,
          height: 0
        },
        status: 'pending',
        compressedBlob: null,
        compressedSpecs: null,
        thumbnailUrl: null
      };

      AppState.files.push(fileItem);
      loadImageSpecs(fileItem);
    }
    DOM.workspace.classList.remove('hidden');
  }

  function loadImageSpecs(fileItem) {
    const reader = new FileReader();
    reader.onerror = () => {
      fileItem.status = 'error';
      updateUI();
    };
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        fileItem.status = 'error';
        updateUI();
      };
      img.onload = () => {
        fileItem.originalSpecs.width = img.width;
        fileItem.originalSpecs.height = img.height;
        fileItem.thumbnailUrl = e.target.result;
        
        // Default to first image dimensions in input
        if (AppState.files.indexOf(fileItem) === 0) {
          DOM.resizeWidth.value = img.width;
          DOM.resizeHeight.value = img.height;
          AppState.settings.width = img.width;
          AppState.settings.height = img.height;
        }
        
        updateUI();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(fileItem.file);
  }

  /* ==========================================================================
     RESIZING LOGIC
     ========================================================================== */
  function getResizedDimensions(origW, origH) {
    let targetW = origW;
    let targetH = origH;

    if (AppState.settings.mode === 'pixels') {
      const w = parseInt(AppState.settings.width, 10);
      const h = parseInt(AppState.settings.height, 10);

      if (AppState.settings.aspectRatioLock) {
        // Compute based on input that was changed last or prioritize width
        if (w && h) {
          // If both defined, check if we need to fit within box
          const ratio = Math.min(w / origW, h / origH);
          targetW = Math.round(origW * ratio);
          targetH = Math.round(origH * ratio);
        } else if (w) {
          targetW = w;
          targetH = Math.round(origH * (w / origW));
        } else if (h) {
          targetH = h;
          targetW = Math.round(origW * (h / origH));
        }
      } else {
        targetW = w || origW;
        targetH = h || origH;
      }
    } else {
      // percentage scale
      const factor = parseFloat(AppState.settings.percent) / 100;
      targetW = Math.round(origW * factor);
      targetH = Math.round(origH * factor);
    }

    return { width: Math.max(1, targetW), height: Math.max(1, targetH) };
  }

  function resizeFile(fileItem) {
    fileItem.status = 'processing';
    updateUI();

    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(fileItem.file);
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        fileItem.status = 'error';
        updateUI();
        resolve();
      };

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const dims = getResizedDimensions(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = dims.width;
        canvas.height = dims.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          fileItem.status = 'error';
          updateUI();
          resolve();
          return;
        }

        let mimeType = 'image/webp';
        if (AppState.settings.format === 'auto') {
          mimeType = fileItem.file.type;
        } else if (AppState.settings.format === 'jpeg') {
          mimeType = 'image/jpeg';
        } else if (AppState.settings.format === 'png') {
          mimeType = 'image/png';
        }

        if (mimeType === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const quality = 0.99; // Maximum quality — resizer is a transform tool, not a compressor
        canvas.toBlob((blob) => {
          if (blob) {
            fileItem.compressedBlob = blob;
            fileItem.compressedSpecs = {
              size: blob.size,
              width: dims.width,
              height: dims.height,
              format: blob.type.split('/')[1] || AppState.settings.format
            };
            fileItem.status = 'done';
          } else {
            fileItem.status = 'error';
          }
          updateUI();
          resolve();
        }, mimeType, quality);
      };

      img.src = objectUrl;
    });
  }

  /* ==========================================================================
     SETTINGS PANEL HANDLERS
     ========================================================================== */
  DOM.modePixels.addEventListener('click', () => {
    DOM.modePixels.classList.add('active');
    DOM.modePercent.classList.remove('active');
    DOM.pixelSettings.classList.remove('hidden');
    DOM.percentSettings.classList.add('hidden');
    AppState.settings.mode = 'pixels';
  });

  DOM.modePercent.addEventListener('click', () => {
    DOM.modePercent.classList.add('active');
    DOM.modePixels.classList.remove('active');
    DOM.percentSettings.classList.remove('hidden');
    DOM.pixelSettings.classList.add('hidden');
    AppState.settings.mode = 'percent';
  });

  DOM.resizeWidth.addEventListener('input', (e) => {
    AppState.settings.width = e.target.value ? parseInt(e.target.value, 10) : null;
    if (AppState.settings.aspectRatioLock && AppState.settings.width && AppState.files.length > 0) {
      const activeFile = AppState.files.find(f => f.id === AppState.activeComparisonId) || AppState.files[0];
      if (activeFile && activeFile.originalSpecs.width) {
        const ratio = activeFile.originalSpecs.height / activeFile.originalSpecs.width;
        DOM.resizeHeight.value = Math.round(AppState.settings.width * ratio);
        AppState.settings.height = parseInt(DOM.resizeHeight.value, 10);
      }
    }
  });

  DOM.resizeHeight.addEventListener('input', (e) => {
    AppState.settings.height = e.target.value ? parseInt(e.target.value, 10) : null;
    if (AppState.settings.aspectRatioLock && AppState.settings.height && AppState.files.length > 0) {
      const activeFile = AppState.files.find(f => f.id === AppState.activeComparisonId) || AppState.files[0];
      if (activeFile && activeFile.originalSpecs.height) {
        const ratio = activeFile.originalSpecs.width / activeFile.originalSpecs.height;
        DOM.resizeWidth.value = Math.round(AppState.settings.height * ratio);
        AppState.settings.width = parseInt(DOM.resizeWidth.value, 10);
      }
    }
  });

  DOM.aspectRatioLock.addEventListener('change', (e) => {
    AppState.settings.aspectRatioLock = e.target.checked;
  });

  DOM.percentSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    DOM.percentVal.textContent = val;
    AppState.settings.percent = parseInt(val, 10);
  });

  DOM.formatSelect.addEventListener('change', (e) => {
    AppState.settings.format = e.target.value;
  });

  DOM.clearAllBtn.addEventListener('click', () => {
    AppState.files.forEach(item => {
      if (item.thumbnailUrl && item.thumbnailUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.thumbnailUrl);
      }
    });
    AppState.files = [];
    AppState.activeComparisonId = null;
    updateUI();
  });

  DOM.resizeBtn.addEventListener('click', async () => {
    const pending = AppState.files.filter(f => f.status === 'pending' || f.status === 'error' || f.status === 'done');
    if (pending.length === 0) {
      alert("Please upload images first.");
      return;
    }

    DOM.resizeBtn.disabled = true;
    DOM.resizeBtnText.textContent = "Resizing...";

    for (let i = 0; i < pending.length; i++) {
      await resizeFile(pending[i]);
    }

    DOM.resizeBtn.disabled = false;
    DOM.resizeBtnText.textContent = "Resize Complete";
    setTimeout(() => {
      DOM.resizeBtnText.textContent = "Resize Images";
    }, 3000);

    const firstDone = AppState.files.find(f => f.status === 'done');
    if (firstDone) {
      AppState.activeComparisonId = firstDone.id;
    }
    updateUI();
  });

  /* ==========================================================================
     UI DRAWING & STATISTICS
     ========================================================================== */
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function updateUI() {
    DOM.queueCount.textContent = AppState.files.length;
    DOM.imageList.innerHTML = '';

    if (AppState.files.length === 0) {
      DOM.workspace.classList.add('hidden');
      DOM.statsBar.classList.add('hidden');
      DOM.comparisonSection.classList.add('hidden');
      DOM.downloadAllBtn.classList.add('hidden');
      return;
    }

    AppState.files.forEach(item => {
      const card = document.createElement('div');
      card.className = `image-card ${AppState.activeComparisonId === item.id ? 'active' : ''}`;
      card.setAttribute('data-id', item.id);

      let statusBadge = '';
      let savings = '';
      let downloadBtn = '';

      if (item.status === 'pending') {
        statusBadge = '<span class="status-badge pending">Pending</span>';
      } else if (item.status === 'processing') {
        statusBadge = '<span class="status-badge processing">Resizing...</span>';
      } else if (item.status === 'done' && item.compressedSpecs) {
        statusBadge = '<span class="status-badge done">Resized</span>';
        downloadBtn = `<button class="btn btn-secondary btn-sm card-download-btn" data-id="${item.id}">Download</button>`;
        
        if (item.compressedSpecs.size < item.originalSpecs.size) {
          const ratio = Math.round((1 - (item.compressedSpecs.size / item.originalSpecs.size)) * 100);
          savings = `<span class="meta-size-savings">-${ratio}%</span>`;
        }
      } else {
        statusBadge = '<span class="status-badge error">Failed</span>';
      }

      card.innerHTML = `
        <div class="card-details">
          <div class="img-thumbnail-wrapper">
            ${item.thumbnailUrl ? `<img src="${item.thumbnailUrl}" class="img-thumbnail" alt="thumbnail">` : ''}
          </div>
          <div class="img-meta-info">
            <span class="meta-title" title="${item.originalSpecs.name}">${item.originalSpecs.name}</span>
            <span class="meta-dims">${item.originalSpecs.width} × ${item.originalSpecs.height} px • ${item.originalSpecs.format.toUpperCase()}</span>
            <span class="meta-size">
              ${formatBytes(item.originalSpecs.size)} 
              ${item.compressedSpecs ? ` → <strong style="color: var(--text-primary);">${formatBytes(item.compressedSpecs.size)}</strong> (${item.compressedSpecs.width} × ${item.compressedSpecs.height} px)` : ''}
              ${savings}
            </span>
          </div>
        </div>
        <div class="card-actions-wrapper">
          ${statusBadge}
          ${downloadBtn}
          <button class="btn-remove" data-id="${item.id}" aria-label="Remove image">
            <svg fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      `;
      DOM.imageList.appendChild(card);
    });

    calculateStats();
    renderComparison();
  }

  function calculateStats() {
    const completed = AppState.files.filter(f => f.status === 'done' && f.compressedSpecs);
    if (completed.length === 0) {
      DOM.statsBar.classList.add('hidden');
      DOM.downloadAllBtn.classList.add('hidden');
      return;
    }

    DOM.statsBar.classList.remove('hidden');
    DOM.downloadAllBtn.classList.toggle('hidden', completed.length <= 1);

    let origTotal = 0;
    let compTotal = 0;
    completed.forEach(f => {
      origTotal += f.originalSpecs.size;
      compTotal += f.compressedSpecs.size;
    });

    DOM.statProcessed.textContent = `${completed.length} / ${AppState.files.length} Files`;
    DOM.statOriginal.textContent = formatBytes(origTotal);
    DOM.statCompressed.textContent = formatBytes(compTotal);
    
    const savedRatio = origTotal > 0 ? Math.round((1 - (compTotal / origTotal)) * 100) : 0;
    DOM.statSaved.textContent = `${savedRatio >= 0 ? savedRatio : 0}%`;
  }

  function renderComparison() {
    const item = AppState.files.find(f => f.id === AppState.activeComparisonId);
    if (!item || item.status !== 'done' || !item.compressedBlob) {
      DOM.comparisonSection.classList.add('hidden');
      return;
    }

    DOM.comparisonSection.classList.remove('hidden');

    if (DOM.compOrigImg.src.startsWith('blob:')) URL.revokeObjectURL(DOM.compOrigImg.src);
    if (DOM.compNewImg.src.startsWith('blob:')) URL.revokeObjectURL(DOM.compNewImg.src);

    DOM.compOrigImg.src = URL.createObjectURL(item.file);
    DOM.compOrigSize.textContent = formatBytes(item.originalSpecs.size);
    DOM.compOrigDim.textContent = `${item.originalSpecs.width} × ${item.originalSpecs.height} px`;

    DOM.compNewImg.src = URL.createObjectURL(item.compressedBlob);
    DOM.compNewSize.textContent = formatBytes(item.compressedSpecs.size);
    DOM.compNewDim.textContent = `${item.compressedSpecs.width} × ${item.compressedSpecs.height} px`;
  }

  /* ==========================================================================
     DELEGATIONS & DOWNLOADS
     ========================================================================== */
  DOM.imageList.addEventListener('click', (e) => {
    const target = e.target;
    const download = target.closest('.card-download-btn');
    if (download) {
      e.stopPropagation();
      downloadSingle(download.dataset.id);
      return;
    }

    const remove = target.closest('.btn-remove');
    if (remove) {
      e.stopPropagation();
      removeFile(remove.dataset.id);
      return;
    }

    const card = target.closest('.image-card');
    if (card) {
      const id = card.dataset.id;
      const file = AppState.files.find(f => f.id === id);
      if (file && file.status === 'done') {
        AppState.activeComparisonId = AppState.activeComparisonId === id ? null : id;
        
        // Fill settings inputs with this file's specs
        if (AppState.settings.mode === 'pixels') {
          DOM.resizeWidth.value = file.compressedSpecs.width;
          DOM.resizeHeight.value = file.compressedSpecs.height;
          AppState.settings.width = file.compressedSpecs.width;
          AppState.settings.height = file.compressedSpecs.height;
        }

        updateUI();
      }
    }
  });

  function removeFile(id) {
    if (AppState.activeComparisonId === id) AppState.activeComparisonId = null;
    const file = AppState.files.find(f => f.id === id);
    if (file && file.thumbnailUrl && file.thumbnailUrl.startsWith('blob:')) {
      URL.revokeObjectURL(file.thumbnailUrl);
    }
    AppState.files = AppState.files.filter(f => f.id !== id);
    updateUI();
  }

  function getFilename(name, format) {
    const dot = name.lastIndexOf('.');
    const base = dot !== -1 ? name.substring(0, dot) : name;
    const ext = format === 'jpeg' ? 'jpg' : format;
    return `${base}-resized.${ext}`;
  }

  function downloadSingle(id) {
    const item = AppState.files.find(f => f.id === id);
    if (!item || !item.compressedBlob) return;

    const url = URL.createObjectURL(item.compressedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = getFilename(item.originalSpecs.name, item.compressedSpecs.format);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  DOM.downloadAllBtn.addEventListener('click', () => {
    const completed = AppState.files.filter(f => f.status === 'done' && f.compressedBlob);
    if (completed.length === 0) return;

    DOM.downloadAllBtn.disabled = true;
    DOM.downloadAllBtn.textContent = "Packing ZIP...";

    const zip = new JSZip();
    completed.forEach(f => {
      zip.file(getFilename(f.originalSpecs.name, f.compressedSpecs.format), f.compressedBlob);
    });

    zip.generateAsync({ type: 'blob' }).then(content => {
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'compressly-resized-images.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      DOM.downloadAllBtn.disabled = false;
      DOM.downloadAllBtn.textContent = "Download All (ZIP)";
    }).catch(err => {
      console.error(err);
      alert("Failed to build ZIP archive.");
      DOM.downloadAllBtn.disabled = false;
      DOM.downloadAllBtn.textContent = "Download All (ZIP)";
    });
  });

  // Init
  initTheme();
  updateUI();
})();

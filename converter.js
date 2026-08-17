/**
 * Compressly - Image Converter & Format Translator Script
 */

(function () {
  'use strict';

  // State Management
  const AppState = {
    files: [], // { id, file, originalSpecs: { name, size, width, height, format }, status, compressedBlob, compressedSpecs, thumbnailUrl }
    settings: {
      from: null, // read from body dataset
      to: null,   // read from body dataset
      format: 'webp',
      quality: 0.95
    },
    activeComparisonId: null
  };

  // DOM Query Selectors Cache
  const DOM = {
    html: document.documentElement,
    body: document.body,
    themeToggle: document.getElementById('themeToggle'),
    hamburgerBtn: document.getElementById('hamburgerBtn'),
    navMenu: document.getElementById('navMenu'),
    
    // UI dynamic texts
    toolTitle: document.getElementById('toolTitle'),
    toolSubtitle: document.getElementById('toolSubtitle'),
    uploadMainText: document.getElementById('uploadMainText'),
    uploadFormatsText: document.getElementById('uploadFormatsText'),
    
    // File upload
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    workspace: document.getElementById('workspace'),
    
    // Settings inputs
    formatSelect: document.getElementById('formatSelect'),
    qualitySlider: document.getElementById('qualitySlider'),
    qualityVal: document.getElementById('qualityVal'),
    formatSelectGroup: document.getElementById('formatSelectGroup'),
    
    // Actions
    convertBtn: document.getElementById('convertBtn'),
    convertBtnText: document.querySelector('#convertBtn span') || document.getElementById('convertBtn'),
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
     SEO PARAMETERS INITIALIZATION
     ========================================================================== */
  function initSEOConfig() {
    const fromVal = DOM.body.dataset.from; // e.g. "jpg"
    const toVal = DOM.body.dataset.to;     // e.g. "png"

    if (fromVal && toVal) {
      AppState.settings.from = fromVal.toLowerCase();
      AppState.settings.to = toVal.toLowerCase();
      AppState.settings.format = toVal.toLowerCase();

      // Configure File Input accepts
      if (AppState.settings.from === 'jpg' || AppState.settings.from === 'jpeg') {
        DOM.fileInput.accept = 'image/jpeg, image/jpg';
        DOM.uploadFormatsText.textContent = 'Supports JPG and JPEG formats';
      } else if (AppState.settings.from === 'png') {
        DOM.fileInput.accept = 'image/png';
        DOM.uploadFormatsText.textContent = 'Supports PNG format';
      } else if (AppState.settings.from === 'webp') {
        DOM.fileInput.accept = 'image/webp';
        DOM.uploadFormatsText.textContent = 'Supports WebP format';
      }

      // Update Texts
      const fromLabel = AppState.settings.from.toUpperCase();
      const toLabel = AppState.settings.to.toUpperCase();
      
      DOM.toolTitle.textContent = `${fromLabel} to ${toLabel} Converter`;
      DOM.toolSubtitle.textContent = `Convert your ${fromLabel} files to ${toLabel} format instantly. Simple, secure, and processing happens locally.`;
      DOM.uploadMainText.textContent = `Drop your ${fromLabel} files here`;
      DOM.convertBtnText.textContent = `Convert to ${toLabel}`;

      // Update and hide target select input
      DOM.formatSelect.value = AppState.settings.to === 'jpg' ? 'jpeg' : AppState.settings.to;
      DOM.formatSelectGroup.style.display = 'none';
    }
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

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];

      // Validate input format if data-from locked
      if (AppState.settings.from) {
        const fileExt = file.name.split('.').pop().toLowerCase();
        const allowedJpg = (AppState.settings.from === 'jpg' || AppState.settings.from === 'jpeg') && (fileExt === 'jpg' || fileExt === 'jpeg');
        const allowedPng = AppState.settings.from === 'png' && fileExt === 'png';
        const allowedWebp = AppState.settings.from === 'webp' && fileExt === 'webp';
        
        if (!allowedJpg && !allowedPng && !allowedWebp) {
          alert(`Warning: Only ${AppState.settings.from.toUpperCase()} files are accepted on this page.`);
          continue;
        }
      }

      if (file.size > 50 * 1024 * 1024) {
        alert(`Warning: "${file.name}" is larger than 50MB limits.`);
        continue;
      }

      const id = 'conv_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      const fileItem = {
        id,
        file,
        originalSpecs: {
          name: file.name,
          size: file.size,
          format: file.type.split('/')[1] || file.name.split('.').pop() || 'unknown',
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
      // SVG handling wrapper
      const isSvg = fileItem.originalSpecs.format.includes('svg') || fileItem.file.name.endsWith('.svg');
      
      const img = new Image();
      img.onerror = () => {
        fileItem.status = 'error';
        updateUI();
      };
      img.onload = () => {
        fileItem.originalSpecs.width = img.width || 300; // default for vector SVG if missing bounds
        fileItem.originalSpecs.height = img.height || 300;
        fileItem.thumbnailUrl = e.target.result;
        updateUI();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(fileItem.file);
  }

  /* ==========================================================================
     CONVERSION TRANSLATION ENGINE
     ========================================================================== */
  function convertFile(fileItem) {
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

        const canvas = document.createElement('canvas');
        canvas.width = img.width || 300;
        canvas.height = img.height || 300;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          fileItem.status = 'error';
          updateUI();
          resolve();
          return;
        }

        let mimeType = 'image/webp';
        const targetFormat = AppState.settings.format;

        if (targetFormat === 'jpeg') {
          mimeType = 'image/jpeg';
        } else if (targetFormat === 'png') {
          mimeType = 'image/png';
        }

        // Draw background white pixels for JPEG target
        if (mimeType === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const quality = parseFloat(AppState.settings.quality);
        if (mimeType === 'image/png') {
          canvas.toBlob((blob) => {
            saveResult(fileItem, blob, canvas.width, canvas.height, 'png');
            resolve();
          }, 'image/png');
        } else {
          canvas.toBlob((blob) => {
            saveResult(fileItem, blob, canvas.width, canvas.height, targetFormat);
            resolve();
          }, mimeType, quality);
        }
      };

      img.src = objectUrl;
    });
  }

  function saveResult(fileItem, blob, width, height, format) {
    if (blob) {
      fileItem.compressedBlob = blob;
      fileItem.compressedSpecs = {
        size: blob.size,
        width: width,
        height: height,
        format: format === 'jpeg' ? 'jpg' : format
      };
      fileItem.status = 'done';
    } else {
      fileItem.status = 'error';
    }
    updateUI();
  }

  /* ==========================================================================
     SETTINGS PANEL HANDLERS
     ========================================================================== */
  DOM.formatSelect.addEventListener('change', (e) => {
    AppState.settings.format = e.target.value;
  });

  DOM.qualitySlider.addEventListener('input', (e) => {
    const val = e.target.value;
    DOM.qualityVal.textContent = val;
    AppState.settings.quality = parseFloat(val) / 100;
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

  DOM.convertBtn.addEventListener('click', async () => {
    const pending = AppState.files.filter(f => f.status === 'pending' || f.status === 'error' || f.status === 'done');
    if (pending.length === 0) {
      alert("Please upload images first.");
      return;
    }

    DOM.convertBtn.disabled = true;
    const originalText = DOM.convertBtnText.textContent;
    DOM.convertBtnText.textContent = "Converting...";

    for (let i = 0; i < pending.length; i++) {
      await convertFile(pending[i]);
    }

    DOM.convertBtn.disabled = false;
    DOM.convertBtnText.textContent = "Conversion Complete";
    setTimeout(() => {
      DOM.convertBtnText.textContent = originalText;
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
        statusBadge = '<span class="status-badge processing">Converting...</span>';
      } else if (item.status === 'done' && item.compressedSpecs) {
        statusBadge = '<span class="status-badge done">Converted</span>';
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
              ${item.compressedSpecs ? ` → <strong style="color: var(--text-primary);">${formatBytes(item.compressedSpecs.size)}</strong> (${item.compressedSpecs.format.toUpperCase()})` : ''}
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
    const completed = AppState.files.filter(f => f.status === 'done' && f.compressedBlob);
    if (completed.length === 0) {
      DOM.statsBar.classList.add('hidden');
      DOM.downloadAllBtn.classList.add('hidden');
      return;
    }

    DOM.statsBar.classList.remove('hidden');
    DOM.downloadAllBtn.toggle('hidden', completed.length <= 1);

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
    return `${base}-converted.${ext}`;
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
      link.download = 'compressly-converted-images.zip';
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
  initSEOConfig();
  updateUI();
})();

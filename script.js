/**
 * Compressly - High Performance, Privacy-First Browser-Based Image Optimizer
 * 
 * Flow Structure:
 * File selection -> Parsing -> Core HTML5 Canvas Manipulation -> In-memory BLOB Generation
 */

(function () {
  'use strict';

  // State Management Object
  const AppState = {
    files: [], // Holds file payload entities: { id, file, originalSpecs: { name, size, width, height, format }, status, compressedBlob, compressedSpecs }
    settings: {
      quality: 0.8,
      format: 'webp', // auto, jpeg, png, webp
      resizeEnabled: false,
      maxWidth: null,
      maxHeight: null
    },
    activeComparisonId: null
  };

  // DOM Query Selectors Cache
  const DOM = {
    html: document.documentElement,
    themeToggle: document.getElementById('themeToggle'),
    hamburgerBtn: document.getElementById('hamburgerBtn'),
    navMenu: document.getElementById('navMenu'),
    
    // File upload elements
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    workspace: document.getElementById('workspace'),
    
    // Settings configuration inputs
    qualitySlider: document.getElementById('qualitySlider'),
    qualityVal: document.getElementById('qualityVal'),
    formatSelect: document.getElementById('formatSelect'),
    pngWarning: document.getElementById('pngWarning'),
    resizeCheckbox: document.getElementById('resizeCheckbox'),
    resizeDimensions: document.getElementById('resizeDimensions'),
    maxWidthInput: document.getElementById('maxWidth'),
    maxHeightInput: document.getElementById('maxHeight'),
    
    // Functional action triggers
    compressBtn: document.getElementById('compressBtn'),
    compressBtnText: document.getElementById('compressBtnText'),
    downloadAllBtn: document.getElementById('downloadAllBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    
    // Dynamic List components
    queueCount: document.getElementById('queueCount'),
    imageList: document.getElementById('imageList'),
    
    // Statistics counters
    statsBar: document.getElementById('statsBar'),
    statProcessed: document.getElementById('statProcessed'),
    statOriginal: document.getElementById('statOriginal'),
    statCompressed: document.getElementById('statCompressed'),
    statSaved: document.getElementById('statSaved'),
    
    // Inter-card compare systems
    comparisonSection: document.getElementById('comparisonSection'),
    compOrigImg: document.getElementById('compOrigImg'),
    compOrigSize: document.getElementById('compOrigSize'),
    compOrigDim: document.getElementById('compOrigDim'),
    compNewImg: document.getElementById('compNewImg'),
    compNewSize: document.getElementById('compNewSize'),
    compNewDim: document.getElementById('compNewDim'),
    compSavings: document.getElementById('compSavings')
  };

  /* ==========================================================================
     THEME / UI CONFIGURATION MODULE
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

  // Mobile navigation hamburger toggle
  DOM.hamburgerBtn.addEventListener('click', () => {
    const expanded = DOM.hamburgerBtn.getAttribute('aria-expanded') === 'true';
    DOM.hamburgerBtn.setAttribute('aria-expanded', !expanded);
    DOM.hamburgerBtn.classList.toggle('active');
    DOM.navMenu.classList.toggle('active');
  });

  // Smooth scroll links anchor configuration for mobile
  document.querySelectorAll('.nav-link').forEach(anchor => {
    anchor.addEventListener('click', () => {
      DOM.hamburgerBtn.classList.remove('active');
      DOM.navMenu.classList.remove('active');
      DOM.hamburgerBtn.setAttribute('aria-expanded', 'false');
    });
  });

  // Accordion FAQ implementation
  document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
      const parent = button.parentElement;
      const isActive = parent.classList.contains('active');
      
      // Close other accordion elements
      document.querySelectorAll('.faq-item').forEach(item => item.classList.remove('active'));
      
      if (!isActive) {
        parent.classList.add('active');
      }
    });
  });

  /* ==========================================================================
     FILE HANDLER & FILE QUEUE UTILITIES
     ========================================================================== */

  // Custom click handling on wrapper dropzone for accessibility
  DOM.dropZone.addEventListener('click', () => DOM.fileInput.click());
  DOM.dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      DOM.fileInput.click();
    }
  });

  // HTML5 Drag events
  ['dragenter', 'dragover'].forEach(eventName => {
    DOM.dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      DOM.dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    DOM.dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      DOM.dropZone.classList.remove('dragover');
    }, false);
  });

  DOM.dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleIncomingFiles(files);
  });

  DOM.fileInput.addEventListener('change', (e) => {
    handleIncomingFiles(e.target.files);
    e.target.value = ''; // Flush input value to handle upload of identical elements
  });

  // Inline clip paste support
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    const pastedFiles = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        pastedFiles.push(items[i].getAsFile());
      }
    }
    if (pastedFiles.length > 0) {
      handleIncomingFiles(pastedFiles);
    }
  });

  /**
   * Safe operational ingestion of files to state object
   */
  function handleIncomingFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    const supportedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    let errorDetected = false;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      
      if (!supportedMimeTypes.includes(file.type)) {
        alert(`Warning: Format profile type of "${file.name}" is not directly supported inside local decoding frameworks.`);
        errorDetected = true;
        continue;
      }

      // Check for extremely large file sizes to prevent browser heap memory limits
      if (file.size > 50 * 1024 * 1024) {
        alert(`Warning: "${file.name}" is too large (> 50MB) and may crash the local browser engine canvas.`);
        errorDetected = true;
        continue;
      }

      const id = 'file_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      
      const newFileObj = {
        id: id,
        file: file,
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

      AppState.files.push(newFileObj);
      loadSpecsAndThumbnail(newFileObj);
    }

    if (AppState.files.length > 0) {
      DOM.workspace.classList.remove('hidden');
    }
  }

  /**
   * Reads raw file inputs to fetch image attributes offline
   */
  function loadSpecsAndThumbnail(fileItem) {
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
        updateUI();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(fileItem.file);
  }

  /* ==========================================================================
     CORE CANVAS ENGINE (IMAGE MANIPULATION)
     ========================================================================== */

  /**
   * Process and calculate resized proportional specifications safely
   */
  function calculateDimensions(origWidth, origHeight, maxWidth, maxHeight) {
    let width = origWidth;
    let height = origHeight;

    if (AppState.settings.resizeEnabled) {
      const maxW = parseInt(maxWidth, 10) || origWidth;
      const maxH = parseInt(maxHeight, 10) || origHeight;

      if (width > maxW || height > maxH) {
        const ratio = Math.min(maxW / width, maxH / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
    }
    return { width, height };
  }

  /**
   * Primary image compression runner
   */
  async function compressFile(fileItem) {
    fileItem.status = 'processing';
    updateUI();

    try {
      const blob = await executeCanvasTransformation(fileItem);
      fileItem.compressedBlob = blob;
      
      const imgDimensions = await getImageBlobDimensions(blob);
      
      fileItem.compressedSpecs = {
        size: blob.size,
        width: imgDimensions.width,
        height: imgDimensions.height,
        format: blob.type.split('/')[1] || AppState.settings.format
      };
      fileItem.status = 'done';
    } catch (err) {
      console.error("Internal processing error:", err);
      fileItem.status = 'error';
    }
    
    updateUI();
  }

  /**
   * Loads a Blob image to retrieve its spatial dimensions
   */
  function getImageBlobDimensions(blob) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  }

  /**
   * Promisified Canvas engine interface utilizing core browser APIs
   */
  function executeCanvasTransformation(fileItem) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(fileItem.file);
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Unable to parse file stream into image container."));
      };

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const dims = calculateDimensions(
          img.width,
          img.height,
          AppState.settings.maxWidth,
          AppState.settings.maxHeight
        );

        const canvas = document.createElement('canvas');
        canvas.width = dims.width;
        canvas.height = dims.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error("Canvas graphic context generation failure."));
          return;
        }

        // Apply alpha parameters / background canvas options
        let targetMimeType = 'image/webp';
        const formatSetting = AppState.settings.format;

        if (formatSetting === 'auto') {
          targetMimeType = fileItem.file.type;
        } else if (formatSetting === 'jpeg') {
          targetMimeType = 'image/jpeg';
        } else if (formatSetting === 'png') {
          targetMimeType = 'image/png';
        }

        // Draw background white pixels for opaque conversions to prevent black backdrop artifacts
        if (targetMimeType === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Draw image frame elements
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Perform canvas extraction
        let quality = parseFloat(AppState.settings.quality);
        if (targetMimeType === 'image/png') {
          // Standard browser implementation ignores quality factor parameters for Lossless PNG conversions
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("PNG parsing structure error."));
          }, 'image/png');
        } else {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Image stream conversion error."));
          }, targetMimeType, quality);
        }
      };

      img.src = objectUrl;
    });
  }

  /* ==========================================================================
     UI DRAWING & STATE RENDERING CONTROLLERS
     ========================================================================== */

  function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Refreshes UI elements based on the state in AppState
   */
  function updateUI() {
    DOM.queueCount.textContent = AppState.files.length;
    
    // Clear and re-render the list items
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
      
      let statusBadgeHTML = '';
      let savingsHTML = '';
      let actionHTML = '';

      if (item.status === 'pending') {
        statusBadgeHTML = `<span class="status-badge pending">Pending</span>`;
      } else if (item.status === 'processing') {
        statusBadgeHTML = `<span class="status-badge processing">Compressing...</span>`;
      } else if (item.status === 'done' && item.compressedSpecs) {
        statusBadgeHTML = `<span class="status-badge done">Optimized</span>`;
        
        const originalVal = item.originalSpecs.size;
        const compressedVal = item.compressedSpecs.size;
        
        if (compressedVal < originalVal) {
          const savings = Math.round(((originalVal - compressedVal) / originalVal) * 100);
          savingsHTML = `<span class="meta-size-savings">-${savings}%</span>`;
        } else {
          savingsHTML = `<span class="meta-size-savings" style="color: var(--text-muted);">0%</span>`;
        }

        actionHTML = `
          <button class="btn btn-secondary btn-sm card-download-btn" data-id="${item.id}">Download</button>
        `;
      } else {
        statusBadgeHTML = `<span class="status-badge error">Failed</span>`;
      }

      const originalFormattedSize = formatBytes(item.originalSpecs.size);
      const compressedFormattedSize = item.compressedSpecs ? formatBytes(item.compressedSpecs.size) : '';

      card.innerHTML = `
        <div class="card-details">
          <div class="img-thumbnail-wrapper">
            ${item.thumbnailUrl ? `<img src="${item.thumbnailUrl}" class="img-thumbnail" alt="${item.originalSpecs.name}">` : `
              <svg width="24" height="24" fill="var(--text-muted)" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1zm-4.5-5L11 15.51 8.5 12.5 5 17h14l-4.5-3z"/></svg>
            `}
          </div>
          <div class="img-meta-info">
            <span class="meta-title" title="${item.originalSpecs.name}">${item.originalSpecs.name}</span>
            <span class="meta-dims">${item.originalSpecs.width} × ${item.originalSpecs.height} px • ${item.originalSpecs.format.toUpperCase()}</span>
            <span class="meta-size">
              ${originalFormattedSize} 
              ${compressedFormattedSize ? ` → <strong style="color: var(--text-primary);">${compressedFormattedSize}</strong>` : ''} 
              ${savingsHTML}
            </span>
          </div>
        </div>
        <div class="card-actions-wrapper">
          ${statusBadgeHTML}
          ${actionHTML}
          <button class="btn-remove" data-id="${item.id}" aria-label="Remove image from queue">
            <svg fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      `;

      DOM.imageList.appendChild(card);
    });

    calculateGlobalStats();
    renderComparisonPreview();
  }

  /**
   * Scrapes currently processed specs to display accumulated values
   */
  function calculateGlobalStats() {
    const completedItems = AppState.files.filter(f => f.status === 'done' && f.compressedSpecs);
    
    if (completedItems.length === 0) {
      DOM.statsBar.classList.add('hidden');
      DOM.downloadAllBtn.classList.add('hidden');
      return;
    }

    DOM.statsBar.classList.remove('hidden');
    if (completedItems.length > 1) {
      DOM.downloadAllBtn.classList.remove('hidden');
    } else {
      DOM.downloadAllBtn.classList.add('hidden');
    }

    let origSum = 0;
    let compSum = 0;

    completedItems.forEach(item => {
      origSum += item.originalSpecs.size;
      compSum += item.compressedSpecs.size;
    });

    const percentSaved = origSum > 0 ? Math.round(((origSum - compSum) / origSum) * 100) : 0;

    DOM.statProcessed.textContent = `${completedItems.length} / ${AppState.files.length} Files`;
    DOM.statOriginal.textContent = formatBytes(origSum);
    DOM.statCompressed.textContent = formatBytes(compSum);
    DOM.statSaved.textContent = `${percentSaved}%`;
  }

  /**
   * Refreshes comparison system side-by-side display metrics
   */
  function renderComparisonPreview() {
    const activeId = AppState.activeComparisonId;
    const targetItem = AppState.files.find(f => f.id === activeId);

    if (!targetItem || targetItem.status !== 'done' || !targetItem.compressedBlob) {
      DOM.comparisonSection.classList.add('hidden');
      return;
    }

    DOM.comparisonSection.classList.remove('hidden');
    
    // Revoke old blob comparison URLs
    if (DOM.compNewImg.src && DOM.compNewImg.src.startsWith('blob:')) {
      URL.revokeObjectURL(DOM.compNewImg.src);
    }
    if (DOM.compOrigImg.src && DOM.compOrigImg.src.startsWith('blob:')) {
      URL.revokeObjectURL(DOM.compOrigImg.src);
    }

    DOM.compOrigImg.src = URL.createObjectURL(targetItem.file);
    DOM.compOrigSize.textContent = formatBytes(targetItem.originalSpecs.size);
    DOM.compOrigDim.textContent = `${targetItem.originalSpecs.width} × ${targetItem.originalSpecs.height} px`;

    DOM.compNewImg.src = URL.createObjectURL(targetItem.compressedBlob);
    DOM.compNewSize.textContent = formatBytes(targetItem.compressedSpecs.size);
    DOM.compNewDim.textContent = `${targetItem.compressedSpecs.width} × ${targetItem.compressedSpecs.height} px`;

    const rawSavings = targetItem.originalSpecs.size - targetItem.compressedSpecs.size;
    const percentage = rawSavings > 0 ? Math.round((rawSavings / targetItem.originalSpecs.size) * 100) : 0;
    DOM.compSavings.textContent = `${percentage}%`;
  }

  /* ==========================================================================
     EVENT INTERACTION TRIGGERS & DELEGATES
     ========================================================================== */

  // Event Delegation for Image Queue Items
  DOM.imageList.addEventListener('click', (e) => {
    const target = e.target;
    
    // Check if the user clicked the individual card download button
    const downloadBtn = target.closest('.card-download-btn');
    if (downloadBtn) {
      e.stopPropagation();
      const id = downloadBtn.getAttribute('data-id');
      triggerSingleFileDownload(id);
      return;
    }

    // Check if the user clicked the card removal button
    const removeBtn = target.closest('.btn-remove');
    if (removeBtn) {
      e.stopPropagation();
      const id = removeBtn.getAttribute('data-id');
      removeFileFromQueue(id);
      return;
    }

    // Otherwise, toggle card activation to view in the visual comparison component
    const card = target.closest('.image-card');
    if (card) {
      const id = card.getAttribute('data-id');
      const item = AppState.files.find(f => f.id === id);
      if (item && item.status === 'done') {
        AppState.activeComparisonId = (AppState.activeComparisonId === id) ? null : id;
        updateUI();
      }
    }
  });

  function removeFileFromQueue(id) {
    if (AppState.activeComparisonId === id) {
      AppState.activeComparisonId = null;
    }
    
    // Revoke object URLs to prevent memory leaks
    const item = AppState.files.find(f => f.id === id);
    if (item) {
      if (item.thumbnailUrl && item.thumbnailUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.thumbnailUrl);
      }
    }

    AppState.files = AppState.files.filter(f => f.id !== id);
    updateUI();
  }

  // Clear All Queue button
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

  // Quality parameters changes
  DOM.qualitySlider.addEventListener('input', (e) => {
    const val = e.target.value;
    DOM.qualityVal.textContent = val;
    AppState.settings.quality = parseFloat(val) / 100;
  });

  // Settings dropdown format toggle selector
  DOM.formatSelect.addEventListener('change', (e) => {
    const selectedFormat = e.target.value;
    AppState.settings.format = selectedFormat;
    
    if (selectedFormat === 'png') {
      DOM.pngWarning.classList.remove('hidden');
    } else {
      DOM.pngWarning.classList.add('hidden');
    }
  });

  // Dimensions configuration toggle
  DOM.resizeCheckbox.addEventListener('change', (e) => {
    AppState.settings.resizeEnabled = e.target.checked;
    if (e.target.checked) {
      DOM.resizeDimensions.classList.remove('hidden');
    } else {
      DOM.resizeDimensions.classList.add('hidden');
    }
  });

  // Core dimensions boundary input changes
  DOM.maxWidthInput.addEventListener('input', (e) => {
    AppState.settings.maxWidth = e.target.value ? parseInt(e.target.value, 10) : null;
  });
  DOM.maxHeightInput.addEventListener('input', (e) => {
    AppState.settings.maxHeight = e.target.value ? parseInt(e.target.value, 10) : null;
  });

  // Main single actions processor loop trigger
  DOM.compressBtn.addEventListener('click', async () => {
    const itemsToProcess = AppState.files.filter(f => f.status === 'pending' || f.status === 'error' || f.status === 'done');
    
    if (itemsToProcess.length === 0) {
      alert("Please add files to the queue first.");
      return;
    }

    DOM.compressBtn.disabled = true;
    DOM.compressBtnText.textContent = "Compressing...";

    for (let i = 0; i < itemsToProcess.length; i++) {
      await compressFile(itemsToProcess[i]);
    }

    DOM.compressBtn.disabled = false;
    DOM.compressBtnText.textContent = "Compression Complete";
    
    // Highlight the first processed item in the comparison section
    const firstDone = AppState.files.find(f => f.status === 'done');
    if (firstDone) {
      AppState.activeComparisonId = firstDone.id;
    }

    setTimeout(() => {
      DOM.compressBtnText.textContent = "Compress Images";
    }, 3000);

    updateUI();
  });

  /* ==========================================================================
     DOWNLOAD TRIGGERS & BULK PACKAGING (CLIENT SIDE ZIP)
     ========================================================================== */

  /**
   * Helper function to construct structured filenames safely
   */
  function generateOutputFilename(originalName, targetFormat) {
    const dotIndex = originalName.lastIndexOf('.');
    const baseName = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName;
    const formatExt = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
    return `${baseName}-optimized.${formatExt}`;
  }

  function triggerSingleFileDownload(id) {
    const item = AppState.files.find(f => f.id === id);
    if (!item || !item.compressedBlob) return;

    const url = URL.createObjectURL(item.compressedBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = generateOutputFilename(item.originalSpecs.name, item.compressedSpecs.format);
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  }

  // Bulk ZIP package compilation using JSZip from CDN
  DOM.downloadAllBtn.addEventListener('click', () => {
    const completedItems = AppState.files.filter(f => f.status === 'done' && f.compressedBlob);
    if (completedItems.length === 0) return;

    if (typeof JSZip === 'undefined') {
      alert("ZIP packaging compression library failed to load. Please verify your internet connection.");
      return;
    }

    DOM.downloadAllBtn.disabled = true;
    DOM.downloadAllBtn.textContent = "Packing ZIP...";

    const zip = new JSZip();

    completedItems.forEach(item => {
      const filename = generateOutputFilename(item.originalSpecs.name, item.compressedSpecs.format);
      zip.file(filename, item.compressedBlob);
    });

    zip.generateAsync({ type: 'blob' }).then((content) => {
      const url = URL.createObjectURL(content);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = 'compressly-optimized-images.zip';
      
      document.body.appendChild(downloadLink);
      downloadLink.click();
      
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);

      DOM.downloadAllBtn.disabled = false;
      DOM.downloadAllBtn.textContent = "Download All (ZIP)";
    }).catch(err => {
      console.error(err);
      alert("An unexpected error occurred while building the ZIP file.");
      DOM.downloadAllBtn.disabled = false;
      DOM.downloadAllBtn.textContent = "Download All (ZIP)";
    });
  });

  // App Initialization sequence
  initTheme();

})();
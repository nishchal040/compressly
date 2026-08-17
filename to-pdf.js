/**
 * Compressly - Image to PDF Script
 */

(function () {
  'use strict';

  // State Management
  const AppState = {
    files: [], // { id, file, name, size, width, height, format, dataUrl }
    settings: {
      pageSize: 'a4', // a4, letter, fit
      orientation: 'auto', // auto, portrait, landscape
      margin: 'none' // none, small, large
    }
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
    pageSizeSelect: document.getElementById('pageSizeSelect'),
    orientationSelect: document.getElementById('orientationSelect'),
    marginSelect: document.getElementById('marginSelect'),
    orientationGroup: document.getElementById('orientationGroup'),
    marginGroup: document.getElementById('marginGroup'),
    
    // Actions
    compilePdfBtn: document.getElementById('compilePdfBtn'),
    compilePdfBtnText: document.querySelector('#compilePdfBtn span') || document.getElementById('compilePdfBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    
    // Queue
    queueCount: document.getElementById('queueCount'),
    imageList: document.getElementById('imageList')
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

      const id = 'pdf_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      const fileItem = {
        id,
        file,
        name: file.name,
        size: file.size,
        format: file.type.split('/')[1] || 'unknown',
        width: 0,
        height: 0,
        dataUrl: null
      };

      AppState.files.push(fileItem);
      loadImageData(fileItem);
    }
    DOM.workspace.classList.remove('hidden');
  }

  function loadImageData(fileItem) {
    const reader = new FileReader();
    reader.onerror = () => {
      removeFile(fileItem.id);
    };
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        removeFile(fileItem.id);
      };
      img.onload = () => {
        fileItem.width = img.width;
        fileItem.height = img.height;
        fileItem.dataUrl = e.target.result;
        updateUI();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(fileItem.file);
  }

  /* ==========================================================================
     SETTINGS PANEL HANDLERS
     ========================================================================== */
  DOM.pageSizeSelect.addEventListener('change', (e) => {
    AppState.settings.pageSize = e.target.value;
    
    // Hide details if 'fit' selected since they are auto-configured
    if (AppState.settings.pageSize === 'fit') {
      DOM.orientationGroup.classList.add('hidden');
      DOM.marginGroup.classList.add('hidden');
    } else {
      DOM.orientationGroup.classList.remove('hidden');
      DOM.marginGroup.classList.remove('hidden');
    }
  });

  DOM.orientationSelect.addEventListener('change', (e) => {
    AppState.settings.orientation = e.target.value;
  });

  DOM.marginSelect.addEventListener('change', (e) => {
    AppState.settings.margin = e.target.value;
  });

  DOM.clearAllBtn.addEventListener('click', () => {
    AppState.files = [];
    updateUI();
  });

  /* ==========================================================================
     PDF GENERATION ENGINE
     ========================================================================== */
  DOM.compilePdfBtn.addEventListener('click', async () => {
    if (AppState.files.length === 0) {
      alert("Please upload images first.");
      return;
    }

    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      alert("PDF generation engine library failed to load.");
      return;
    }

    DOM.compilePdfBtn.disabled = true;
    DOM.compilePdfBtnText.textContent = "Generating PDF...";

    // Run PDF generation in timeout to let UI update
    setTimeout(() => {
      try {
        let pdf = null;
        
        // Loop through all selected images
        for (let i = 0; i < AppState.files.length; i++) {
          const item = AppState.files[i];
          const format = item.format === 'jpg' ? 'JPEG' : item.format.toUpperCase();
          
          let pageW, pageH, x, y, drawW, drawH;
          let orientation = 'p'; // 'p' or 'l'
          let marginVal = 0; // margin in mm

          // Calculate dimensions
          if (AppState.settings.pageSize === 'fit') {
            // Convert pixels to mm roughly (1 px = 0.264583 mm)
            pageW = item.width * 0.264583;
            pageH = item.height * 0.264583;
            orientation = pageW > pageH ? 'l' : 'p';
            marginVal = 0;
            
            drawW = pageW;
            drawH = pageH;
            x = 0;
            y = 0;
          } else {
            // Margins in mm
            if (AppState.settings.margin === 'small') marginVal = 10;
            else if (AppState.settings.margin === 'large') marginVal = 20;

            // Dimensions in mm
            if (AppState.settings.pageSize === 'a4') {
              pageW = 210;
              pageH = 297;
            } else { // letter
              pageW = 215.9;
              pageH = 279.4;
            }

            // Orientation
            if (AppState.settings.orientation === 'auto') {
              orientation = item.width > item.height ? 'l' : 'p';
            } else {
              orientation = AppState.settings.orientation === 'landscape' ? 'l' : 'p';
            }

            // If landscape, swap page width and height
            if (orientation === 'l') {
              const temp = pageW;
              pageW = pageH;
              pageH = temp;
            }

            // Fit image inside printable bounds
            const printW = pageW - (2 * marginVal);
            const printH = pageH - (2 * marginVal);
            
            const ratio = Math.min(printW / item.width, printH / item.height);
            drawW = item.width * ratio;
            drawH = item.height * ratio;

            // Center image
            x = marginVal + ((printW - drawW) / 2);
            y = marginVal + ((printH - drawH) / 2);
          }

          // Initialize PDF or add new page
          if (i === 0) {
            pdf = new jsPDF({
              orientation: orientation,
              unit: 'mm',
              format: AppState.settings.pageSize === 'fit' ? [pageW, pageH] : AppState.settings.pageSize
            });
          } else {
            pdf.addPage(
              AppState.settings.pageSize === 'fit' ? [pageW, pageH] : AppState.settings.pageSize, 
              orientation
            );
          }

          pdf.addImage(item.dataUrl, format, x, y, drawW, drawH);
        }

        // Save PDF file
        pdf.save('compressly-converted-document.pdf');

        DOM.compilePdfBtn.disabled = false;
        DOM.compilePdfBtnText.textContent = "Generated PDF";
        setTimeout(() => {
          DOM.compilePdfBtnText.textContent = "Generate PDF";
        }, 3000);

      } catch (err) {
        console.error(err);
        alert("An unexpected error occurred during PDF generation.");
        DOM.compilePdfBtn.disabled = false;
        DOM.compilePdfBtnText.textContent = "Generate PDF";
      }
    }, 50);
  });

  /* ==========================================================================
     UI DRAWING & QUEUE SWAPPING
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
      return;
    }

    AppState.files.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'image-card';
      card.setAttribute('data-id', item.id);

      const isFirst = index === 0;
      const isLast = index === AppState.files.length - 1;

      card.innerHTML = `
        <div class="card-details">
          <div class="img-thumbnail-wrapper">
            ${item.dataUrl ? `<img src="${item.dataUrl}" class="img-thumbnail" alt="Page ${index + 1}">` : ''}
          </div>
          <div class="img-meta-info">
            <span class="meta-title" title="${item.name}">${item.name}</span>
            <span class="meta-dims">Page ${index + 1} • ${item.width} × ${item.height} px • ${item.format.toUpperCase()}</span>
            <span class="meta-size">${formatBytes(item.size)}</span>
          </div>
        </div>
        <div class="card-actions-wrapper">
          <div class="pdf-item-actions">
            <button class="btn-arrow btn-up" data-id="${item.id}" ${isFirst ? 'disabled' : ''} title="Move page up">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button class="btn-arrow btn-down" data-id="${item.id}" ${isLast ? 'disabled' : ''} title="Move page down">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <button class="btn-remove" data-id="${item.id}" aria-label="Remove page">
            <svg fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      `;
      DOM.imageList.appendChild(card);
    });
  }

  DOM.imageList.addEventListener('click', (e) => {
    const target = e.target;

    const upBtn = target.closest('.btn-up');
    if (upBtn && !upBtn.disabled) {
      e.stopPropagation();
      swapItems(upBtn.dataset.id, -1);
      return;
    }

    const downBtn = target.closest('.btn-down');
    if (downBtn && !downBtn.disabled) {
      e.stopPropagation();
      swapItems(downBtn.dataset.id, 1);
      return;
    }

    const removeBtn = target.closest('.btn-remove');
    if (removeBtn) {
      e.stopPropagation();
      removeFile(removeBtn.dataset.id);
      return;
    }
  });

  function swapItems(id, direction) {
    const index = AppState.files.findIndex(f => f.id === id);
    if (index === -1) return;

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= AppState.files.length) return;

    // Swap elements in place
    const temp = AppState.files[index];
    AppState.files[index] = AppState.files[targetIndex];
    AppState.files[targetIndex] = temp;

    updateUI();
  }

  function removeFile(id) {
    AppState.files = AppState.files.filter(f => f.id !== id);
    updateUI();
  }

  // Init
  initTheme();
})();

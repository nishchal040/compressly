/**
 * Compressly - Image Flipper Script
 */

(function () {
  'use strict';

  // State Management
  const AppState = {
    file: null,
    fileName: '',
    scaleX: 1, // 1 or -1
    scaleY: 1, // 1 or -1
    settings: {
      format: 'webp'
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
    previewImage: document.getElementById('previewImage'),
    
    // Controls
    btnFlipH: document.getElementById('btnFlipH'),
    btnFlipV: document.getElementById('btnFlipV'),
    formatSelect: document.getElementById('formatSelect'),
    saveBtn: document.getElementById('saveBtn'),
    clearAllBtn: document.getElementById('clearAllBtn')
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
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      loadImage(e.dataTransfer.files[0]);
    }
  });

  DOM.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      loadImage(e.target.files[0]);
    }
    e.target.value = '';
  });

  function loadImage(file) {
    const mimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!mimeTypes.includes(file.type)) {
      alert(`Warning: Format type of "${file.name}" is not supported.`);
      return;
    }

    AppState.file = file;
    AppState.fileName = file.name;
    AppState.scaleX = 1;
    AppState.scaleY = 1;

    DOM.btnFlipH.classList.remove('crop-btn-active');
    DOM.btnFlipV.classList.remove('crop-btn-active');

    const reader = new FileReader();
    reader.onload = (e) => {
      DOM.previewImage.src = e.target.result;
      
      // Setup smooth transition properties
      DOM.previewImage.style.transition = 'transform 0.2s ease-in-out';
      DOM.previewImage.style.transform = 'scale(1, 1)';

      DOM.dropZone.classList.add('hidden');
      DOM.workspace.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  /* ==========================================================================
     FLIP CONTROLS HANDLERS
     ========================================================================== */
  function updateFlipPreview() {
    DOM.previewImage.style.transform = `scale(${AppState.scaleX}, ${AppState.scaleY})`;
    
    // Toggle active visual states
    DOM.btnFlipH.classList.toggle('crop-btn-active', AppState.scaleX === -1);
    DOM.btnFlipV.classList.toggle('crop-btn-active', AppState.scaleY === -1);
  }

  DOM.btnFlipH.addEventListener('click', () => {
    AppState.scaleX = AppState.scaleX === 1 ? -1 : 1;
    updateFlipPreview();
  });

  DOM.btnFlipV.addEventListener('click', () => {
    AppState.scaleY = AppState.scaleY === 1 ? -1 : 1;
    updateFlipPreview();
  });

  DOM.formatSelect.addEventListener('change', (e) => {
    AppState.settings.format = e.target.value;
  });

  DOM.clearAllBtn.addEventListener('click', () => {
    DOM.previewImage.src = '';
    DOM.dropZone.classList.remove('hidden');
    DOM.workspace.classList.add('hidden');
    AppState.file = null;
    AppState.scaleX = 1;
    AppState.scaleY = 1;
  });

  DOM.saveBtn.addEventListener('click', () => {
    if (!AppState.file) return;

    DOM.saveBtn.disabled = true;
    DOM.saveBtn.textContent = "Processing...";

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        alert("Failed to create 2D canvas context.");
        DOM.saveBtn.disabled = false;
        DOM.saveBtn.textContent = "Apply & Download";
        return;
      }

      let mimeType = 'image/webp';
      if (AppState.settings.format === 'auto') {
        mimeType = AppState.file.type;
      } else if (AppState.settings.format === 'jpeg') {
        mimeType = 'image/jpeg';
      } else if (AppState.settings.format === 'png') {
        mimeType = 'image/png';
      }

      // Draw background white pixels for JPEG target
      if (mimeType === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Perform coordinate mapping mirror transforms on canvas
      ctx.translate(
        AppState.scaleX === -1 ? canvas.width : 0,
        AppState.scaleY === -1 ? canvas.height : 0
      );
      ctx.scale(AppState.scaleX, AppState.scaleY);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw flipped canvas frame
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) {
          alert("Failed to render canvas.");
          DOM.saveBtn.disabled = false;
          DOM.saveBtn.textContent = "Apply & Download";
          return;
        }

        const dot = AppState.fileName.lastIndexOf('.');
        const base = dot !== -1 ? AppState.fileName.substring(0, dot) : AppState.fileName;
        const formatExt = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
        const downloadName = `${base}-flipped.${formatExt}`;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = downloadName;
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        DOM.saveBtn.disabled = false;
        DOM.saveBtn.textContent = "Apply & Download";
      }, mimeType, 0.99);
    };
    img.src = DOM.previewImage.src;
  });

  // Init
  initTheme();
})();

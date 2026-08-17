/**
 * Compressly - Image Cropper Script
 */

(function () {
  'use strict';

  // State Management
  const AppState = {
    file: null,
    fileName: '',
    croppedBlob: null,
    croppedFormat: 'webp',
    scaleX: 1,
    scaleY: 1
  };

  let cropperInstance = null;

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
    sourceImage: document.getElementById('sourceImage'),
    
    // Controls
    ratioButtons: document.querySelectorAll('.crop-preset-grid button'),
    rotateLeft: document.getElementById('rotateLeft'),
    rotateRight: document.getElementById('rotateRight'),
    flipH: document.getElementById('flipH'),
    flipV: document.getElementById('flipV'),
    formatSelect: document.getElementById('formatSelect'),
    cropBtn: document.getElementById('cropBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    
    // Result
    resultSection: document.getElementById('resultSection'),
    resultImage: document.getElementById('resultImage'),
    resultSpecs: document.getElementById('resultSpecs'),
    downloadResultBtn: document.getElementById('downloadResultBtn')
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

    const reader = new FileReader();
    reader.onload = (e) => {
      DOM.sourceImage.src = e.target.result;
      
      // Hide upload zone and show workspace
      DOM.dropZone.classList.add('hidden');
      DOM.workspace.classList.remove('hidden');

      // Initialize Cropper.js after source loaded
      if (cropperInstance) {
        cropperInstance.destroy();
      }

      // Small delay to make sure DOM rendered and image layout established
      setTimeout(() => {
        cropperInstance = new Cropper(DOM.sourceImage, {
          aspectRatio: NaN, // Free ratio default
          viewMode: 1,
          autoCropArea: 0.85,
          responsive: true,
          background: true
        });
      }, 50);
    };
    reader.readAsDataURL(file);
  }

  /* ==========================================================================
     CROPPER INTERACTION HANDLERS
     ========================================================================== */
  DOM.ratioButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!cropperInstance) return;
      
      // Reset active button class
      DOM.ratioButtons.forEach(b => b.classList.remove('crop-btn-active'));
      btn.classList.add('crop-btn-active');

      const ratio = parseFloat(btn.dataset.ratio);
      cropperInstance.setAspectRatio(ratio);
    });
  });

  DOM.rotateLeft.addEventListener('click', () => {
    if (cropperInstance) cropperInstance.rotate(-90);
  });

  DOM.rotateRight.addEventListener('click', () => {
    if (cropperInstance) cropperInstance.rotate(90);
  });

  DOM.flipH.addEventListener('click', () => {
    if (!cropperInstance) return;
    AppState.scaleX = AppState.scaleX === 1 ? -1 : 1;
    cropperInstance.scaleX(AppState.scaleX);
  });

  DOM.flipV.addEventListener('click', () => {
    if (!cropperInstance) return;
    AppState.scaleY = AppState.scaleY === 1 ? -1 : 1;
    cropperInstance.scaleY(AppState.scaleY);
  });

  DOM.clearAllBtn.addEventListener('click', () => {
    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }
    DOM.sourceImage.src = '';
    DOM.resultImage.src = '';
    DOM.resultSection.classList.add('hidden');
    DOM.workspace.classList.add('hidden');
    DOM.dropZone.classList.remove('hidden');
    AppState.file = null;
    AppState.croppedBlob = null;
  });

  DOM.cropBtn.addEventListener('click', () => {
    if (!cropperInstance) return;

    // Get cropped canvas
    const canvas = cropperInstance.getCroppedCanvas({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    });

    const format = DOM.formatSelect.value; // png, jpeg, webp
    let mimeType = 'image/webp';
    if (format === 'png') mimeType = 'image/png';
    else if (format === 'jpeg') mimeType = 'image/jpeg';

    canvas.toBlob((blob) => {
      if (!blob) {
        alert("Failed to render cropped canvas.");
        return;
      }

      if (DOM.resultImage.src.startsWith('blob:')) {
        URL.revokeObjectURL(DOM.resultImage.src);
      }

      AppState.croppedBlob = blob;
      AppState.croppedFormat = format;

      DOM.resultImage.src = URL.createObjectURL(blob);
      DOM.resultSpecs.textContent = `${canvas.width} × ${canvas.height} px • ${formatBytes(blob.size)}`;
      DOM.resultSection.classList.remove('hidden');
      
      // Smooth scroll to results
      DOM.resultSection.scrollIntoView({ behavior: 'smooth' });
    }, mimeType, 0.99);
  });

  DOM.downloadResultBtn.addEventListener('click', () => {
    if (!AppState.croppedBlob) return;

    const dot = AppState.fileName.lastIndexOf('.');
    const base = dot !== -1 ? AppState.fileName.substring(0, dot) : AppState.fileName;
    const ext = AppState.croppedFormat === 'jpeg' ? 'jpg' : AppState.croppedFormat;
    const downloadName = `${base}-cropped.${ext}`;

    const url = URL.createObjectURL(AppState.croppedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Init
  initTheme();
})();

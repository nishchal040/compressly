/**
 * Compressly - Image Rotator Script
 */

(function () {
  'use strict';

  // State Management
  const AppState = {
    file: null,
    fileName: '',
    angle: 0,
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
    rotateCCW: document.getElementById('rotateCCW'),
    rotateCW: document.getElementById('rotateCW'),
    rotate180: document.getElementById('rotate180'),
    angleSlider: document.getElementById('angleSlider'),
    angleVal: document.getElementById('angleVal'),
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
    AppState.angle = 0;
    
    // Set slider value
    DOM.angleSlider.value = 0;
    DOM.angleVal.textContent = 0;

    const reader = new FileReader();
    reader.onload = (e) => {
      DOM.previewImage.src = e.target.result;
      
      // Add smooth transition style
      DOM.previewImage.style.transition = 'transform 0.2s ease-out';
      DOM.previewImage.style.transform = 'rotate(0deg)';

      DOM.dropZone.classList.add('hidden');
      DOM.workspace.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  /* ==========================================================================
     ROTATOR CONTROLS HANDLERS
     ========================================================================== */
  function updateRotationPreview() {
    DOM.previewImage.style.transform = `rotate(${AppState.angle}deg)`;
    DOM.angleSlider.value = AppState.angle;
    DOM.angleVal.textContent = AppState.angle;
  }

  DOM.rotateCCW.addEventListener('click', () => {
    AppState.angle = (AppState.angle - 90 + 360) % 360;
    updateRotationPreview();
  });

  DOM.rotateCW.addEventListener('click', () => {
    AppState.angle = (AppState.angle + 90) % 360;
    updateRotationPreview();
  });

  DOM.rotate180.addEventListener('click', () => {
    AppState.angle = (AppState.angle + 180) % 360;
    updateRotationPreview();
  });

  DOM.angleSlider.addEventListener('input', (e) => {
    AppState.angle = parseInt(e.target.value, 10);
    DOM.angleVal.textContent = AppState.angle;
    DOM.previewImage.style.transform = `rotate(${AppState.angle}deg)`;
  });

  DOM.formatSelect.addEventListener('change', (e) => {
    AppState.settings.format = e.target.value;
  });

  DOM.clearAllBtn.addEventListener('click', () => {
    DOM.previewImage.src = '';
    DOM.dropZone.classList.remove('hidden');
    DOM.workspace.classList.add('hidden');
    AppState.file = null;
    AppState.angle = 0;
  });

  DOM.saveBtn.addEventListener('click', () => {
    if (!AppState.file) return;

    DOM.saveBtn.disabled = true;
    DOM.saveBtn.textContent = "Processing...";

    const img = new Image();
    img.onload = () => {
      const angleRad = (AppState.angle * Math.PI) / 180;
      const sin = Math.abs(Math.sin(angleRad));
      const cos = Math.abs(Math.cos(angleRad));
      
      // Dynamic bounding box dimensions to prevent crop clipping
      const newW = img.width * cos + img.height * sin;
      const newH = img.width * sin + img.height * cos;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, newW);
      canvas.height = Math.max(1, newH);
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

      // Draw background white background for JPEG target
      if (mimeType === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Rotate and draw with maximum sharpness
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(angleRad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

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
        const downloadName = `${base}-rotated.${formatExt}`;

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

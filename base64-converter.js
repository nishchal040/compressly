/**
 * Compressly - Base64 Image Converter Script
 */

(function () {
  'use strict';

  // State Management
  const AppState = {
    file: null,
    fileName: 'decoded-image',
    decodedBlob: null,
    decodedMime: 'image/png'
  };

  // DOM Query Selectors Cache
  const DOM = {
    html: document.documentElement,
    themeToggle: document.getElementById('themeToggle'),
    hamburgerBtn: document.getElementById('hamburgerBtn'),
    navMenu: document.getElementById('navMenu'),
    
    // Tab toggles
    tabEncode: document.getElementById('tabEncode'),
    tabDecode: document.getElementById('tabDecode'),
    encodeWorkspace: document.getElementById('encodeWorkspace'),
    decodeWorkspace: document.getElementById('decodeWorkspace'),
    
    // Encode side
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    encodeResults: document.getElementById('encodeResults'),
    dataUriText: document.getElementById('dataUriText'),
    htmlTagText: document.getElementById('htmlTagText'),
    cssText: document.getElementById('cssText'),
    rawBase64Text: document.getElementById('rawBase64Text'),
    clearEncodeBtn: document.getElementById('clearEncodeBtn'),
    
    // Decode side
    decodeInput: document.getElementById('decodeInput'),
    decodeStatus: document.getElementById('decodeStatus'),
    decodeBtn: document.getElementById('decodeBtn'),
    clearDecodeBtn: document.getElementById('clearDecodeBtn'),
    decodePreview: document.getElementById('decodePreview'),
    downloadDecodedBtn: document.getElementById('downloadDecodedBtn')
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
     TAB TOGGLE CONTROLLER
     ========================================================================== */
  DOM.tabEncode.addEventListener('click', () => {
    DOM.tabEncode.classList.add('active');
    DOM.tabDecode.classList.remove('active');
    DOM.encodeWorkspace.classList.remove('hidden');
    DOM.decodeWorkspace.classList.add('hidden');
  });

  DOM.tabDecode.addEventListener('click', () => {
    DOM.tabDecode.classList.add('active');
    DOM.tabEncode.classList.remove('active');
    DOM.decodeWorkspace.classList.remove('hidden');
    DOM.encodeWorkspace.classList.add('hidden');
  });

  /* ==========================================================================
     ENCODER MODULE (IMAGE TO BASE64)
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
      encodeImage(e.dataTransfer.files[0]);
    }
  });

  DOM.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      encodeImage(e.target.files[0]);
    }
    e.target.value = '';
  });

  function encodeImage(file) {
    const mimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!mimeTypes.includes(file.type)) {
      alert(`Warning: Format type of "${file.name}" is not supported.`);
      return;
    }

    AppState.file = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUri = e.target.result;
      const rawBase64 = dataUri.split(',')[1];
      
      DOM.dataUriText.value = dataUri;
      DOM.htmlTagText.value = `<img src="${dataUri}" alt="${file.name}">`;
      DOM.cssText.value = `background-image: url('${dataUri}');`;
      DOM.rawBase64Text.value = rawBase64;

      DOM.dropZone.classList.add('hidden');
      DOM.encodeResults.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  DOM.clearEncodeBtn.addEventListener('click', () => {
    DOM.dataUriText.value = '';
    DOM.htmlTagText.value = '';
    DOM.cssText.value = '';
    DOM.rawBase64Text.value = '';
    
    DOM.dropZone.classList.remove('hidden');
    DOM.encodeResults.classList.add('hidden');
    AppState.file = null;
  });

  /* ==========================================================================
     DECODER MODULE (BASE64 TO IMAGE)
     ========================================================================== */
  function base64ToBlob(base64, mimeType) {
    try {
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: mimeType });
    } catch (err) {
      return null;
    }
  }

  DOM.decodeBtn.addEventListener('click', () => {
    const rawVal = DOM.decodeInput.value.trim();
    if (!rawVal) {
      alert("Please paste a Base64 string first.");
      return;
    }

    DOM.decodeStatus.textContent = "Validating...";
    DOM.decodeStatus.style.color = "var(--text-muted)";

    let dataUrl = rawVal;
    
    // Auto-detect raw Base64 and prepend standard PNG header
    if (!rawVal.startsWith('data:image/')) {
      dataUrl = `data:image/png;base64,${rawVal}`;
    }

    // Load into temporary image to test validity
    const img = new Image();
    img.onerror = () => {
      DOM.decodeStatus.textContent = "Error: Invalid Base64 or corrupt format.";
      DOM.decodeStatus.style.color = "var(--error-color)";
      DOM.decodePreview.innerHTML = '<span style="color:var(--error-color); font-size:0.9rem;">Invalid Image Data.</span>';
      DOM.downloadDecodedBtn.disabled = true;
      AppState.decodedBlob = null;
    };
    
    img.onload = () => {
      // Find MIME type from string
      const match = dataUrl.match(/^data:(image\/[a-z0-9-+.]+);base64,(.*)$/);
      if (match) {
        const mime = match[1];
        const base64Data = match[2];
        const blob = base64ToBlob(base64Data, mime);

        if (blob) {
          AppState.decodedBlob = blob;
          AppState.decodedMime = mime;

          DOM.decodeStatus.textContent = `Valid ${mime.split('/')[1].toUpperCase()} image decoded successfully.`;
          DOM.decodeStatus.style.color = "var(--success-color)";

          // Set preview
          DOM.decodePreview.innerHTML = '';
          const previewImg = document.createElement('img');
          previewImg.src = dataUrl;
          DOM.decodePreview.appendChild(previewImg);

          DOM.downloadDecodedBtn.disabled = false;
          return;
        }
      }
      img.onerror();
    };

    img.src = dataUrl;
  });

  DOM.downloadDecodedBtn.addEventListener('click', () => {
    if (!AppState.decodedBlob) return;

    const mimeExt = AppState.decodedMime.split('/')[1] || 'png';
    const ext = mimeExt === 'jpeg' ? 'jpg' : mimeExt;
    const downloadName = `decoded-image.${ext}`;

    const url = URL.createObjectURL(AppState.decodedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  DOM.clearDecodeBtn.addEventListener('click', () => {
    DOM.decodeInput.value = '';
    DOM.decodeStatus.textContent = "Waiting for input...";
    DOM.decodeStatus.style.color = "var(--text-muted)";
    DOM.decodePreview.innerHTML = '<span style="color:var(--text-muted); font-size:0.9rem;">No image decoded. Paste string on the left.</span>';
    DOM.downloadDecodedBtn.disabled = true;
    AppState.decodedBlob = null;
  });

  /* ==========================================================================
     CLIPBOARD COPY TRIGGERS
     ========================================================================== */
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const textarea = document.getElementById(targetId);
      if (!textarea || !textarea.value) return;

      navigator.clipboard.writeText(textarea.value).then(() => {
        const originalText = btn.textContent;
        btn.textContent = "Copied!";
        btn.style.backgroundColor = "var(--success-color)";
        btn.style.color = "#ffffff";
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.backgroundColor = "";
          btn.style.color = "";
        }, 1500);
      }).catch(err => {
        console.error("Failed to copy text:", err);
      });
    });
  });

  // Init
  initTheme();
})();

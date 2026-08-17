/**
 * Compressly - Image Metadata Viewer & EXIF Stripper Script
 */

(function () {
  'use strict';

  // State Management
  const AppState = {
    file: null,
    fileName: '',
    fileType: '',
    fileSize: 0,
    lastModified: '',
    exifTags: {}
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
    
    // Tables
    fileMetaTable: document.querySelector('#fileMetaTable tbody'),
    exifMetaTable: document.querySelector('#exifMetaTable tbody'),
    
    // Actions
    stripBtn: document.getElementById('stripBtn'),
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
     FILE UPLOADING & METADATA READING
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
      processImage(e.dataTransfer.files[0]);
    }
  });

  DOM.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      processImage(e.target.files[0]);
    }
    e.target.value = '';
  });

  function processImage(file) {
    const mimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!mimeTypes.includes(file.type)) {
      alert(`Warning: Format type of "${file.name}" is not supported.`);
      return;
    }

    AppState.file = file;
    AppState.fileName = file.name;
    AppState.fileType = file.type;
    AppState.fileSize = file.size;
    AppState.lastModified = new Date(file.lastModified).toLocaleString();

    // Show Workspace
    DOM.dropZone.classList.add('hidden');
    DOM.workspace.classList.remove('hidden');

    // Create Thumbnail
    const url = URL.createObjectURL(file);
    DOM.previewImage.src = url;

    // Render File details table
    renderFileTable();

    // Parse EXIF tags using exif-js CDN
    if (typeof EXIF !== 'undefined') {
      EXIF.getData(file, function () {
        const allTags = EXIF.getAllTags(this);
        AppState.exifTags = allTags;
        renderExifTable(allTags);
      });
    } else {
      DOM.exifMetaTable.innerHTML = `
        <tr>
          <td colspan="2" class="text-center" style="color: var(--error-color);">
            EXIF library failed to load. Please check your internet connection.
          </td>
        </tr>
      `;
    }
  }

  /* ==========================================================================
     EXIF COORDINATES & CONVERSION HELPERS
     ========================================================================== */
  function parseGPSCoordinate(coordinate, reference) {
    if (!coordinate || coordinate.length < 3) return null;
    
    // EXIF coordinates coordinates format: [deg, min, sec]
    const deg = parseFloat(coordinate[0]);
    const min = parseFloat(coordinate[1]);
    const sec = parseFloat(coordinate[2]);

    let decimal = deg + (min / 60) + (sec / 3600);
    if (reference === 'S' || reference === 'W') {
      decimal = -decimal;
    }
    return decimal.toFixed(6);
  }

  function formatFraction(val) {
    if (!val) return '';
    if (typeof val === 'number') return val;
    if (val.numerator && val.denominator) {
      if (val.numerator === val.denominator) return '1';
      if (val.numerator < val.denominator) return `${val.numerator}/${val.denominator}`;
      return (val.numerator / val.denominator).toFixed(2);
    }
    return val.toString();
  }

  /* ==========================================================================
     TABLE RENDERING UTILITIES
     ========================================================================== */
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function renderFileTable() {
    DOM.fileMetaTable.innerHTML = `
      <tr>
        <th>File Name</th>
        <td>${AppState.fileName}</td>
      </tr>
      <tr>
        <th>File Size</th>
        <td>${formatBytes(AppState.fileSize)} (${AppState.fileSize.toLocaleString()} bytes)</td>
      </tr>
      <tr>
        <th>MIME Type</th>
        <td>${AppState.fileType}</td>
      </tr>
      <tr>
        <th>Last Modified</th>
        <td>${AppState.lastModified}</td>
      </tr>
    `;
  }

  function renderExifTable(tags) {
    if (!tags || Object.keys(tags).length === 0) {
      DOM.exifMetaTable.innerHTML = `
        <tr>
          <td colspan="2" class="text-center" style="color: var(--text-muted);">
            No EXIF metadata tags detected in this image.
          </td>
        </tr>
      `;
      return;
    }

    DOM.exifMetaTable.innerHTML = '';

    const exifFriendlyNames = {
      Make: 'Camera Manufacturer',
      Model: 'Camera Model',
      DateTimeOriginal: 'Date & Time Taken',
      Software: 'Software / OS',
      ExposureTime: 'Exposure Time',
      FNumber: 'Aperture (F-Stop)',
      ISOSpeedRatings: 'ISO Speed',
      FocalLength: 'Focal Length',
      LensModel: 'Lens Model',
      Flash: 'Flash Status'
    };

    let tagsRendered = 0;

    // Render key tags
    for (const key in exifFriendlyNames) {
      if (tags[key] !== undefined) {
        let value = tags[key];
        
        // Format specific EXIF tags
        if (key === 'ExposureTime') {
          value = formatFraction(value) + ' sec';
        } else if (key === 'FNumber') {
          value = 'f/' + formatFraction(value);
        } else if (key === 'FocalLength') {
          value = formatFraction(value) + ' mm';
        } else if (key === 'Flash') {
          value = value.toString().includes('Flash fired') ? 'Fired' : 'Did not fire';
        }

        const row = document.createElement('tr');
        row.innerHTML = `
          <th>${exifFriendlyNames[key]}</th>
          <td>${value}</td>
        `;
        DOM.exifMetaTable.appendChild(row);
        tagsRendered++;
      }
    }

    // Render GPS coordinate tags if available
    const lat = parseGPSCoordinate(tags.GPSLatitude, tags.GPSLatitudeRef);
    const lng = parseGPSCoordinate(tags.GPSLongitude, tags.GPSLongitudeRef);

    if (lat && lng) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <th>GPS Location</th>
        <td>
          <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener" style="color: var(--primary-color); font-weight:600; text-decoration:underline;">
            ${lat}, ${lng} (View on Map)
          </a>
        </td>
      `;
      DOM.exifMetaTable.appendChild(row);
      tagsRendered++;
    }

    // Fallback if tags exist but none are in our key list
    if (tagsRendered === 0) {
      DOM.exifMetaTable.innerHTML = `
        <tr>
          <td colspan="2" class="text-center" style="color: var(--text-secondary);">
            Standard photographic EXIF tags not found. (${Object.keys(tags).length} general metadata tags parsed).
          </td>
        </tr>
      `;
    }
  }

  /* ==========================================================================
     METADATA STRIPPING ENGINE
     ========================================================================== */
  DOM.stripBtn.addEventListener('click', () => {
    if (!AppState.file) return;

    DOM.stripBtn.disabled = true;
    DOM.stripBtn.textContent = "Stripping...";

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        alert("Failed to create canvas context.");
        DOM.stripBtn.disabled = false;
        DOM.stripBtn.textContent = "Strip EXIF & Download";
        return;
      }

      // Draw image onto canvas which naturally strips raw EXIF data chunks.
      // Use high-quality settings to preserve pixel fidelity.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0);

      const mimeType = AppState.file.type;
      canvas.toBlob((blob) => {
        if (!blob) {
          alert("Failed to render canvas.");
          DOM.stripBtn.disabled = false;
          DOM.stripBtn.textContent = "Strip EXIF & Download";
          return;
        }

        const dot = AppState.fileName.lastIndexOf('.');
        const base = dot !== -1 ? AppState.fileName.substring(0, dot) : AppState.fileName;
        const ext = AppState.fileName.split('.').pop() || 'jpg';
        const downloadName = `${base}-privacy-safe.${ext}`;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = downloadName;
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        DOM.stripBtn.disabled = false;
        DOM.stripBtn.textContent = "Strip EXIF & Download";
      }, mimeType, 0.99);
    };
    img.src = DOM.previewImage.src;
  });

  DOM.clearAllBtn.addEventListener('click', () => {
    DOM.previewImage.src = '';
    DOM.fileMetaTable.innerHTML = '';
    DOM.exifMetaTable.innerHTML = `
      <tr>
        <td colspan="2" class="text-center" style="color: var(--text-muted);">
          No EXIF tags detected yet.
        </td>
      </tr>
    `;
    DOM.dropZone.classList.remove('hidden');
    DOM.workspace.classList.add('hidden');
    AppState.file = null;
    AppState.exifTags = {};
  });

  // Init
  initTheme();
})();

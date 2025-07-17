// --- Scan Section Logic ---
const scanModeCameraBtn = document.getElementById('scan-mode-camera');
const scanModeImageBtn = document.getElementById('scan-mode-image');
const cameraScanDiv = document.getElementById('camera-scan');
const imageScanDiv = document.getElementById('image-scan');
const scanVideo = document.getElementById('scan-video');
const startCameraBtn = document.getElementById('start-camera-btn');
const resetCameraBtn = document.getElementById('reset-camera-btn');
const scanFileInput = document.getElementById('scan-file-input');
const scanImgBox = document.getElementById('scan-img-box');
const scanResultMeta = document.getElementById('scan-result-meta');
const scanResultImgBox = document.getElementById('scan-result-img-box');
const useScanBtn = document.getElementById('use-scan-btn');
let scanCodeReader = null;
let scanStream = null;
let lastScanResult = null;

function showScanMode(mode) {
  if (mode === 'camera') {
    cameraScanDiv.style.display = '';
    imageScanDiv.style.display = 'none';
    scanResultMeta.textContent = '';
    scanImgBox.innerHTML = '';
  } else {
    cameraScanDiv.style.display = 'none';
    imageScanDiv.style.display = '';
    scanResultMeta.textContent = '';
    scanImgBox.innerHTML = '';
  }
  if (scanResultImgBox) scanResultImgBox.innerHTML = '';
  useScanBtn.style.display = 'none';
  lastScanResult = null;
}
scanModeCameraBtn.onclick = () => showScanMode('camera');
scanModeImageBtn.onclick = () => showScanMode('image');
showScanMode('camera');

// Add camera selection dropdown
const cameraSelectPanel = document.createElement('div');
cameraSelectPanel.id = 'cameraSelectPanel';
cameraSelectPanel.style.display = 'none';
cameraSelectPanel.innerHTML = '<label for="cameraSelect">Change video source:</label> <select id="cameraSelect" style="max-width:400px"></select>';
cameraScanDiv.insertBefore(cameraSelectPanel, scanVideo.nextSibling);
const cameraSelect = cameraSelectPanel.querySelector('#cameraSelect');
let selectedDeviceId = null;

// Camera scan logic
startCameraBtn.onclick = async () => {
  scanResultMeta.textContent = '';
  if (scanResultImgBox) scanResultImgBox.innerHTML = '';
  useScanBtn.style.display = 'none';
  if (!scanCodeReader) scanCodeReader = new ZXing.BrowserQRCodeReader();
  try {
    const devices = await scanCodeReader.getVideoInputDevices();
    console.log('Video input devices:', devices);
    if (!devices.length) {
      scanResultMeta.textContent = 'No cameras found. Please check your device and browser permissions.';
      console.error('No cameras found.');
      cameraSelectPanel.style.display = 'none';
      return;
    }
    // Populate camera select dropdown
    cameraSelect.innerHTML = '';
    devices.forEach((device, idx) => {
      const option = document.createElement('option');
      option.text = device.label || `Camera ${idx+1}`;
      option.value = device.deviceId;
      cameraSelect.appendChild(option);
    });
    selectedDeviceId = cameraSelect.value = devices[0].deviceId;
    cameraSelectPanel.style.display = devices.length > 1 ? '' : 'none';
    cameraSelect.onchange = function() {
      selectedDeviceId = this.value;
    };
    console.log('Using deviceId:', selectedDeviceId);
    scanCodeReader.decodeFromInputVideoDevice(selectedDeviceId, scanVideo).then(result => {
      scanResultMeta.innerHTML = `<b>Text:</b> ${result.text}<br><b>Version:</b> ${result.version ?? '-'}<br><b>EC Level:</b> ${(result.resultMetadata && result.resultMetadata.get(3)) || '-'}`;
      if (scanResultImgBox) scanResultImgBox.innerHTML = '';
      useScanBtn.style.display = '';
      lastScanResult = result;
      addHistoryEntry('Scan', result.text, result.version, (result.resultMetadata && result.resultMetadata.get(3)) || '-');
    }).catch(err => {
      scanResultMeta.textContent = 'No QR code found or camera error.';
      console.error('decodeFromInputVideoDevice error:', err);
    });
  } catch (e) {
    scanResultMeta.textContent = 'Camera error: ' + (e && e.message ? e.message : e);
    console.error('Camera error:', e);
  }
};
resetCameraBtn.onclick = () => {
  if (scanCodeReader) scanCodeReader.reset();
  scanResultMeta.textContent = '';
  if (scanResultImgBox) scanResultImgBox.innerHTML = '';
  useScanBtn.style.display = 'none';
  lastScanResult = null;
};

// Image scan logic
scanFileInput.onchange = function(e) {
  scanResultMeta.textContent = '';
  if (scanResultImgBox) scanResultImgBox.innerHTML = '';
  useScanBtn.style.display = 'none';
  lastScanResult = null;
  scanImgBox.innerHTML = '';
  const file = e.target.files[0];
  if (!file) return;
  const img = document.createElement('img');
  img.style.maxWidth = '128px';
  img.style.maxHeight = '128px';
  img.onload = function() {
    scanImgBox.appendChild(img);
    if (!scanCodeReader) scanCodeReader = new ZXing.BrowserQRCodeReader();
    scanCodeReader.decodeFromImage(img).then(result => {
      scanResultMeta.innerHTML = `<b>Text:</b> ${result.text}<br><b>Version:</b> ${result.version ?? '-'}<br><b>EC Level:</b> ${(result.resultMetadata && result.resultMetadata.get(3)) || '-'}`;
      if (scanResultImgBox) scanResultImgBox.innerHTML = '';
      useScanBtn.style.display = '';
      lastScanResult = result;
      addHistoryEntry('Scan', result.text, result.version, (result.resultMetadata && result.resultMetadata.get(3)) || '-');
    }).catch(err => {
      scanResultMeta.textContent = 'No QR code found.';
    });
  };
  img.onerror = function() {
    scanResultMeta.textContent = 'Image load error.';
  };
  img.src = URL.createObjectURL(file);
};

// Use scanned data for creation
useScanBtn.onclick = function() {
  if (!lastScanResult) return;
  document.getElementById('create-text').value = lastScanResult.text || '';
  document.getElementById('create-version').value = lastScanResult.version || '';
  document.getElementById('create-eclevel').value = (lastScanResult.resultMetadata && lastScanResult.resultMetadata.get(3)) || 'L';
  document.getElementById('create-text').focus();
  // Switch to create tab if on mobile
  if (window.innerWidth < 900) {
    switchToTab('create');
  } else {
    window.scrollTo({top: document.getElementById('create-section').offsetTop - 10, behavior: 'smooth'});
  }
};

// --- Create/Edit Section Logic ---
const createForm = document.getElementById('create-form');
const outputQrBox = document.getElementById('output-qr-box');
const outputMeta = document.getElementById('output-meta');
let lastGeneratedCanvas = null;
const outputVerify = document.createElement('div');
outputVerify.className = 'meta';
outputVerify.style.marginTop = '0.5em';
outputQrBox.parentNode.insertBefore(outputVerify, outputQrBox.nextSibling);
createForm.addEventListener('submit', function() {
  const text = document.getElementById('create-text').value;
  const version = parseInt(document.getElementById('create-version').value, 10);
  const ecLevel = document.getElementById('create-eclevel').value;
  outputQrBox.innerHTML = '';
  outputMeta.textContent = '';
  outputVerify.textContent = '';
  if (!text) {
    outputMeta.textContent = 'Please enter text.';
    return;
  }
  const options = {
    errorCorrectionLevel: ecLevel,
    width: 256,
    margin: 2,
    color: { dark: '#000', light: '#fff' }
  };
  if (!isNaN(version)) options.version = version;
  const canvas = document.createElement('canvas');
  QRCode.toCanvas(canvas, text, options, function (error) {
    if (error) {
      outputMeta.textContent = 'Error generating QR code.';
      console.error(error);
      return;
    }
    outputQrBox.appendChild(canvas);
    lastGeneratedCanvas = canvas;
    outputMeta.innerHTML = `<b>Text:</b> ${text}<br><b>Version:</b> ${!isNaN(version) ? version : 'auto'}<br><b>EC Level:</b> ${ecLevel}`;
    addHistoryEntry('Generated', text, !isNaN(version) ? version : '-', ecLevel);
    // --- Verification with zxing-js ---
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const img = document.createElement('img');
      img.onload = function() {
        const codeReader = new ZXing.BrowserQRCodeReader();
        codeReader.decodeFromImage(img).then(result => {
          let match = true;
          let details = [];
          if (result.text !== text) {
            match = false;
            details.push(`Text mismatch: got "${result.text}"`);
          }
          if (!isNaN(version) && result.version !== undefined && result.version !== null && result.version !== version) {
            match = false;
            details.push(`Version mismatch: got ${result.version}`);
          }
          const decodedEC = result.resultMetadata && result.resultMetadata.get(3);
          if (ecLevel && decodedEC && decodedEC !== ecLevel) {
            match = false;
            details.push(`EC Level mismatch: got ${decodedEC}`);
          }
          if (match) {
            outputVerify.innerHTML = '<span style="color:green;">✔ QR code verified: all fields match.</span>';
          } else {
            outputVerify.innerHTML = '<span style="color:red;">✖ QR code verification failed.<br>' + details.join('<br>') + '</span>';
          }
        }).catch(err => {
          outputVerify.innerHTML = '<span style="color:red;">✖ Could not verify QR code: ' + (err && err.message ? err.message : err) + '</span>';
        });
      };
      img.onerror = function() {
        outputVerify.innerHTML = '<span style="color:red;">✖ Verification error: Could not load generated QR image.</span>';
      };
      img.src = dataUrl;
    } catch (e) {
      outputVerify.innerHTML = '<span style="color:red;">✖ Verification error: ' + e + '</span>';
    }
    // Switch to output tab if on mobile
    if (window.innerWidth < 900) {
      switchToTab('output');
    } else {
      window.scrollTo({top: document.getElementById('output-section').offsetTop - 10, behavior: 'smooth'});
    }
  });
});

// --- Output Section Logic ---
document.getElementById('download-btn').onclick = function() {
  if (!lastGeneratedCanvas) return;
  const link = document.createElement('a');
  link.download = 'qr-code.png';
  link.href = lastGeneratedCanvas.toDataURL('image/png');
  link.click();
};
document.getElementById('copy-btn').onclick = function() {
  if (!lastGeneratedCanvas) return;
  lastGeneratedCanvas.toBlob(blob => {
    if (navigator.clipboard && navigator.clipboard.write) {
      const item = new ClipboardItem({ 'image/png': blob });
      navigator.clipboard.write([item]);
    }
  });
};

// --- History Logic ---
const historyList = document.getElementById('history-list');
let historyEntries = [];
function addHistoryEntry(type, text, version, ecLevel) {
  const timestamp = new Date().toLocaleString();
  const entry = { type, text, version, ecLevel, timestamp };
  historyEntries.unshift(entry);
  renderHistory();
}
function renderHistory() {
  historyList.innerHTML = '';
  historyEntries.slice(0, 50).forEach((entry, idx) => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '0.5em';
    div.style.borderBottom = '1px solid #eee';
    div.style.padding = '0.25em 0';
    // QR code image
    const qrCanvas = document.createElement('canvas');
    qrCanvas.className = 'history-qr';
    QRCode.toCanvas(qrCanvas, entry.text, { width: 48, errorCorrectionLevel: entry.ecLevel || 'L', version: !isNaN(entry.version) ? entry.version : undefined }, function() {
      // nothing
    });
    // Info
    const info = document.createElement('div');
    info.style.flex = '1';
    info.innerHTML = `<b>${entry.type}</b> <span style="font-size:0.9em; color:#888;">${entry.timestamp}</span><br><span style="font-size:0.95em;">Text:</span> <span style="font-family:monospace;">${entry.text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span><br>Version: ${entry.version || '-'} | EC: ${entry.ecLevel || '-'}`;
    // Click to repopulate
    div.title = 'Click to use this data in the create/edit form';
    div.style.cursor = 'pointer';
    div.onclick = function() {
      document.getElementById('create-text').value = entry.text;
      document.getElementById('create-version').value = entry.version || '';
      document.getElementById('create-eclevel').value = entry.ecLevel || 'L';
      document.getElementById('create-text').focus();
      if (window.innerWidth < 900) {
        // Mobile: switch to edit tab
        var tabBtn = document.getElementById('tab-create');
        if (tabBtn) {
          var tab = new bootstrap.Tab(tabBtn);
          tab.show();
        }
      } else {
        // Desktop: scroll to edit section
        window.scrollTo({top: document.getElementById('create-section').offsetTop - 10, behavior: 'smooth'});
      }
    };
    div.appendChild(qrCanvas);
    div.appendChild(info);
    historyList.appendChild(div);
  });
}

// Clear button for create/edit
document.getElementById('clear-create-btn').onclick = function() {
  document.getElementById('create-text').value = '';
  document.getElementById('create-version').value = '';
  document.getElementById('create-eclevel').value = 'L';
  document.getElementById('create-text').focus();
};

// --- Tabbed navigation for mobile ---
// Use Bootstrap's Tab API to switch tabs programmatically
function switchToTab(tabId) {
  var tabBtn = document.getElementById('tab-' + tabId);
  if (tabBtn) {
    var tab = new bootstrap.Tab(tabBtn);
    tab.show();
  }
}
(function() {
  // Default to scan tab on load
  switchToTab('scan');
})(); 
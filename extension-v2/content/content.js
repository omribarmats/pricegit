// Content script for LLM-powered price capture
// Flow: Screenshot → Crop → Blur → LLM Analysis → Form

// Auth sync from web app localStorage (works on any domain)
try {
  if (!window.priceGitAuthSynced) {
    window.priceGitAuthSynced = true;
    const syncAuthFromLocalStorage = () => {
      const authData = localStorage.getItem("priceGitExtensionAuth");
      if (!authData) return;
      const { authToken, refreshToken, username } = JSON.parse(authData);
      if (authToken && username) {
        try {
          chrome.storage.local.set({ authToken, refreshToken, username });
        } catch {
          // Storage error — non-critical
        }
        chrome.runtime.sendMessage({
          action: "setAuth",
          authToken,
          refreshToken,
          username,
        });
      }
    };

    // Try immediately and retry for a short window to catch late writes
    syncAuthFromLocalStorage();
    let attempts = 0;
    const interval = setInterval(() => {
      syncAuthFromLocalStorage();
      attempts += 1;
      if (attempts >= 5) clearInterval(interval);
    }, 1000);
  }
} catch {
  // Auth sync error — non-critical
}

// Listen for auth data posted from the web app
window.addEventListener("message", (event) => {
  if (!event?.data || event.data.type !== "PRICEGIT_AUTH") return;
  const { authToken, refreshToken, username } = event.data;
  if (authToken && username) {
    try {
      chrome.storage.local.set({ authToken, refreshToken, username });
    } catch {
      // Storage error — non-critical
    }
    chrome.runtime.sendMessage({
      action: "setAuth",
      authToken,
      refreshToken,
      username,
    });
  }
});

// State
let screenshotDataUrl = null;
let croppedDataUrl = null;
let formData = {};
let userLocation = null;
let locationPromise = null; // Background location fetch

// Crop selection state
let cropRect = { x: 100, y: 100, width: 400, height: 300 };
let isDragging = false;
let isResizing = false;
let resizeHandle = null;
let dragStartX = 0;
let dragStartY = 0;
let initialCropRect = null;

// Blur tool state
let blurRectangles = [];
let isDrawingBlur = false;
let blurStartX = 0;
let blurStartY = 0;
let blurCanvasImage = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (
    request.action === "startPriceCapture" ||
    request.action === "startLLMCapture"
  ) {
    startLLMCapture();
    sendResponse({ success: true });
  }

  if (request.action === "showInstructionPopup") {
    showInstructionPopup();
    sendResponse({ success: true });
  }

  return true;
});

function showInstructionPopup() {
  // Remove any existing popup
  const existingPopup = document.getElementById("extension-instruction-popup");
  if (existingPopup) {
    existingPopup.remove();
  }

  const popup = document.createElement("div");
  popup.id = "extension-instruction-popup";
  popup.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
    z-index: 2147483647;
    max-width: 350px;
    font-family: system-ui, -apple-system, sans-serif;
    animation: slideInRight 0.4s ease-out;
  `;

  popup.innerHTML = `
    <style>
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    </style>
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
      <div style="font-size: 18px; font-weight: 600;">🪙 Next Step</div>
      <button id="close-popup-btn" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0; line-height: 1; margin-left: 12px;">&times;</button>
    </div>
    <div style="font-size: 14px; line-height: 1.6; margin-bottom: 8px;">
      Click the <strong>PriceListener extension icon (🪙)</strong> in your browser toolbar (top-right) to capture the price
    </div>
    <div style="font-size: 24px; text-align: center; margin-top: 8px;">
      ☝️
    </div>
  `;

  document.body.appendChild(popup);

  // Close button handler
  const closeBtn = document.getElementById("close-popup-btn");
  if (closeBtn) {
    closeBtn.onclick = () => {
      popup.remove();
    };
  }

  // No auto-dismiss - stays until user closes it or starts capture
}

// ==========================================
// MAIN CAPTURE FLOW
// ==========================================

async function startLLMCapture() {
  try {
    // Remove instruction popup if it exists
    const instructionPopup = document.getElementById(
      "extension-instruction-popup",
    );
    if (instructionPopup) {
      instructionPopup.remove();
    }

    // Start location fetch in background (non-blocking)
    // Location is only needed at analyze/submit time, not for screenshot
    locationPromise = getUserLocation()
      .then((loc) => {
        userLocation = loc;
        return loc;
      })
      .catch(() => null); // Handle denial later at analyze time

    // Capture screenshot immediately — no waiting for location
    const response = await chrome.runtime.sendMessage({
      action: "captureScreenshot",
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to capture screenshot");
    }

    screenshotDataUrl = response.dataUrl;

    // Show crop selection
    showCropSelection();
  } catch (error) {
    alert("Failed to start capture: " + error.message);
  }
}

// ==========================================
// GEOLOCATION
// ==========================================

async function getUserLocation() {
  // Always get fresh location (no caching - user may use VPN)
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Reverse geocode to get country/city
          const location = await reverseGeocode(latitude, longitude);
          resolve(location);
        } catch (error) {
          // Fallback: return coordinates only
          resolve({
            latitude,
            longitude,
            city: "Unknown",
            country: "Unknown",
            fullAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          });
        }
      },
      (error) => {
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

async function reverseGeocode(latitude, longitude) {
  const result = await chrome.runtime.sendMessage({
    action: "fetchAPI",
    url: `http://localhost:3000/api/reverse-geocode?lat=${latitude}&lng=${longitude}`,
  });

  if (result.success && result.data.success) {
    return result.data.data;
  }

  throw new Error("Reverse geocode failed");
}

// ==========================================
// CROP SELECTION
// ==========================================

function showCropSelection() {
  // Reset crop rect to center of viewport
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  cropRect = {
    x: Math.floor(viewportWidth * 0.2),
    y: Math.floor(viewportHeight * 0.2),
    width: Math.floor(viewportWidth * 0.6),
    height: Math.floor(viewportHeight * 0.5),
  };

  const overlay = document.createElement("div");
  overlay.id = "pc-crop-overlay";
  overlay.innerHTML = `
    <img class="pc-crop-background" src="${screenshotDataUrl}" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;">
    <div class="pc-crop-selection" id="pc-crop-selection">
      <div class="pc-crop-handle pc-crop-handle-nw" data-handle="nw"></div>
      <div class="pc-crop-handle pc-crop-handle-ne" data-handle="ne"></div>
      <div class="pc-crop-handle pc-crop-handle-sw" data-handle="sw"></div>
      <div class="pc-crop-handle pc-crop-handle-se" data-handle="se"></div>
      <div class="pc-crop-handle pc-crop-handle-n" data-handle="n"></div>
      <div class="pc-crop-handle pc-crop-handle-s" data-handle="s"></div>
      <div class="pc-crop-handle pc-crop-handle-w" data-handle="w"></div>
      <div class="pc-crop-handle pc-crop-handle-e" data-handle="e"></div>
    </div>
    <div class="pc-crop-toolbar">
      <div class="pc-crop-instructions">
        <span class="pc-crop-toolbar-text">Select the area to capture</span>
        <span class="pc-crop-toolbar-tip">✅ <strong>Must show:</strong> Product name + Price breakdown (item price + shipping + taxes)</span>
      </div>
      <div class="pc-crop-buttons">
        <button class="pc-crop-btn pc-crop-btn-cancel" id="pc-crop-cancel">Cancel</button>
        <button class="pc-crop-btn pc-crop-btn-continue" id="pc-crop-continue">Continue</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  updateCropSelection();
  attachCropEventListeners();

  // Add Escape key listener
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      closeCropSelection();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

function updateCropSelection() {
  const selection = document.getElementById("pc-crop-selection");
  if (selection) {
    selection.style.left = cropRect.x + "px";
    selection.style.top = cropRect.y + "px";
    selection.style.width = cropRect.width + "px";
    selection.style.height = cropRect.height + "px";
  }
}

function attachCropEventListeners() {
  const overlay = document.getElementById("pc-crop-overlay");
  const selection = document.getElementById("pc-crop-selection");
  const cancelBtn = document.getElementById("pc-crop-cancel");
  const continueBtn = document.getElementById("pc-crop-continue");

  // Selection drag
  selection.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("pc-crop-handle")) {
      isResizing = true;
      resizeHandle = e.target.dataset.handle;
    } else {
      isDragging = true;
    }
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialCropRect = { ...cropRect };
    e.preventDefault();
  });

  // Mouse move
  document.addEventListener("mousemove", handleCropMouseMove);
  document.addEventListener("mouseup", handleCropMouseUp);

  // Buttons
  cancelBtn.addEventListener("click", () => {
    closeCropSelection();
    screenshotDataUrl = null;
  });

  continueBtn.addEventListener("click", () => {
    cropScreenshot();
  });
}

function handleCropMouseMove(e) {
  if (!isDragging && !isResizing) return;

  const deltaX = e.clientX - dragStartX;
  const deltaY = e.clientY - dragStartY;

  if (isDragging) {
    cropRect.x = Math.max(
      0,
      Math.min(window.innerWidth - cropRect.width, initialCropRect.x + deltaX),
    );
    cropRect.y = Math.max(
      0,
      Math.min(
        window.innerHeight - cropRect.height,
        initialCropRect.y + deltaY,
      ),
    );
  } else if (isResizing) {
    const minSize = 100;

    switch (resizeHandle) {
      case "nw":
        cropRect.x = Math.min(
          initialCropRect.x + initialCropRect.width - minSize,
          initialCropRect.x + deltaX,
        );
        cropRect.y = Math.min(
          initialCropRect.y + initialCropRect.height - minSize,
          initialCropRect.y + deltaY,
        );
        cropRect.width =
          initialCropRect.width - (cropRect.x - initialCropRect.x);
        cropRect.height =
          initialCropRect.height - (cropRect.y - initialCropRect.y);
        break;
      case "ne":
        cropRect.y = Math.min(
          initialCropRect.y + initialCropRect.height - minSize,
          initialCropRect.y + deltaY,
        );
        cropRect.width = Math.max(minSize, initialCropRect.width + deltaX);
        cropRect.height =
          initialCropRect.height - (cropRect.y - initialCropRect.y);
        break;
      case "sw":
        cropRect.x = Math.min(
          initialCropRect.x + initialCropRect.width - minSize,
          initialCropRect.x + deltaX,
        );
        cropRect.width =
          initialCropRect.width - (cropRect.x - initialCropRect.x);
        cropRect.height = Math.max(minSize, initialCropRect.height + deltaY);
        break;
      case "se":
        cropRect.width = Math.max(minSize, initialCropRect.width + deltaX);
        cropRect.height = Math.max(minSize, initialCropRect.height + deltaY);
        break;
      case "n":
        cropRect.y = Math.min(
          initialCropRect.y + initialCropRect.height - minSize,
          initialCropRect.y + deltaY,
        );
        cropRect.height =
          initialCropRect.height - (cropRect.y - initialCropRect.y);
        break;
      case "s":
        cropRect.height = Math.max(minSize, initialCropRect.height + deltaY);
        break;
      case "w":
        cropRect.x = Math.min(
          initialCropRect.x + initialCropRect.width - minSize,
          initialCropRect.x + deltaX,
        );
        cropRect.width =
          initialCropRect.width - (cropRect.x - initialCropRect.x);
        break;
      case "e":
        cropRect.width = Math.max(minSize, initialCropRect.width + deltaX);
        break;
    }
  }

  updateCropSelection();
}

function handleCropMouseUp() {
  isDragging = false;
  isResizing = false;
  resizeHandle = null;
}

function closeCropSelection() {
  document.removeEventListener("mousemove", handleCropMouseMove);
  document.removeEventListener("mouseup", handleCropMouseUp);
  const overlay = document.getElementById("pc-crop-overlay");
  if (overlay) overlay.remove();
}

function cropScreenshot() {
  // Create canvas to crop the screenshot
  const img = new Image();
  img.onload = () => {
    // Calculate scale factor (screenshot is at device pixel ratio)
    const scale = img.width / window.innerWidth;

    const canvas = document.createElement("canvas");
    canvas.width = cropRect.width * scale;
    canvas.height = cropRect.height * scale;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(
      img,
      cropRect.x * scale,
      cropRect.y * scale,
      cropRect.width * scale,
      cropRect.height * scale,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    croppedDataUrl = canvas.toDataURL("image/png");
    closeCropSelection();
    showBlurEditor();
  };
  img.src = screenshotDataUrl;
}

// ==========================================
// BLUR EDITOR (Pre-LLM)
// ==========================================

function showBlurEditor() {
  blurRectangles = [];

  const editor = document.createElement("div");
  editor.id = "pc-blur-editor";
  editor.innerHTML = `
    <div class="pc-blur-editor-overlay">
      <div class="pc-blur-editor-content">
        <div class="pc-blur-editor-header">
          <h2>Hide Any Personal Information</h2>
          <button class="pc-close-btn" id="pc-blur-close">×</button>
        </div>
        <div class="pc-blur-editor-body">
          <div class="pc-blur-canvas-container">
            <canvas id="pc-blur-canvas"></canvas>
          </div>
          <div class="pc-blur-tools">
            <button class="pc-tool-btn pc-tool-active" id="pc-blur-tool">Blur Tool</button>
            <button class="pc-tool-btn" id="pc-blur-undo">Undo</button>
            <button class="pc-tool-btn" id="pc-blur-clear">Clear All</button>
          </div>
          <p class="pc-blur-hint">Draw rectangles to blur addresses, names, or other sensitive details</p>
        </div>
        <div class="pc-blur-editor-footer">
          <button class="pc-blur-btn-back" id="pc-blur-back">Back to Crop</button>
          <button class="pc-blur-btn-analyze" id="pc-blur-analyze">Continue</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(editor);

  initializeBlurCanvas();
  attachBlurEditorListeners();

  // Add Escape key listener
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      closeBlurEditor();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

function initializeBlurCanvas() {
  const canvas = document.getElementById("pc-blur-canvas");
  if (!canvas || !croppedDataUrl) return;

  // Hide canvas until fully sized to prevent flash
  canvas.style.opacity = "0";

  const ctx = canvas.getContext("2d", { alpha: false });
  const img = new Image();

  img.onload = () => {
    blurCanvasImage = img;

    // Calculate size constraints
    const maxWidth = 900;
    const maxHeight = window.innerHeight * 0.65; // 65vh
    const widthScale = Math.min(1, maxWidth / img.width);
    const heightScale = Math.min(1, maxHeight / img.height);
    const scale = Math.min(widthScale, heightScale);

    const dpr = window.devicePixelRatio || 1;

    // Set canvas internal resolution higher for DPI (makes it sharper)
    canvas.width = img.width * scale * dpr;
    canvas.height = img.height * scale * dpr;

    // Set CSS display size
    canvas.style.width = img.width * scale + "px";
    canvas.style.height = img.height * scale + "px";

    canvas.dataset.scale = scale;
    canvas.dataset.dpr = dpr;
    canvas.dataset.originalWidth = img.width;
    canvas.dataset.originalHeight = img.height;

    // Scale context to match DPI and use high-quality rendering
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale);

    // Show canvas now that it's fully sized and drawn
    canvas.style.opacity = "1";
    canvas.style.transition = "opacity 0.15s ease-in";

    attachBlurCanvasListeners(canvas);
  };

  img.src = croppedDataUrl;
}

function attachBlurCanvasListeners(canvas) {
  canvas.addEventListener("mousedown", startBlurDraw);
  canvas.addEventListener("mousemove", drawBlurPreview);
  canvas.addEventListener("mouseup", finishBlurDraw);
  canvas.addEventListener("mouseleave", cancelBlurDraw);
}

function startBlurDraw(e) {
  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  isDrawingBlur = true;
  blurStartX = e.clientX - rect.left;
  blurStartY = e.clientY - rect.top;
}

function drawBlurPreview(e) {
  if (!isDrawingBlur) return;

  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;

  redrawBlurCanvas(canvas, {
    x: Math.min(blurStartX, currentX),
    y: Math.min(blurStartY, currentY),
    width: Math.abs(currentX - blurStartX),
    height: Math.abs(currentY - blurStartY),
    isPreview: true,
  });
}

function finishBlurDraw(e) {
  if (!isDrawingBlur) return;

  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;

  const width = Math.abs(endX - blurStartX);
  const height = Math.abs(endY - blurStartY);

  if (width > 5 && height > 5) {
    blurRectangles.push({
      x: Math.min(blurStartX, endX),
      y: Math.min(blurStartY, endY),
      width: width,
      height: height,
    });
  }

  isDrawingBlur = false;
  redrawBlurCanvas(canvas);
}

function cancelBlurDraw() {
  isDrawingBlur = false;
  const canvas = document.getElementById("pc-blur-canvas");
  if (canvas) redrawBlurCanvas(canvas);
}

function redrawBlurCanvas(canvas, previewRect = null) {
  if (!blurCanvasImage) return;

  const ctx = canvas.getContext("2d");
  const dpr = parseFloat(canvas.dataset.dpr) || 1;
  const scale = parseFloat(canvas.dataset.scale) || 1;
  const originalWidth = parseFloat(canvas.dataset.originalWidth);
  const originalHeight = parseFloat(canvas.dataset.originalHeight);

  // Reset transform and clear
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Apply DPI scaling and redraw base image
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    blurCanvasImage,
    0,
    0,
    originalWidth * scale,
    originalHeight * scale,
  );

  const allRects = previewRect
    ? [...blurRectangles, previewRect]
    : blurRectangles;

  allRects.forEach((rect) => {
    // Reset transform for pixel operations (getImageData/putImageData work in device pixels)
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Convert display coordinates to canvas coordinates (accounting for DPI)
    const x = Math.max(0, Math.floor(rect.x * dpr));
    const y = Math.max(0, Math.floor(rect.y * dpr));
    const w = Math.min(Math.floor(rect.width * dpr), canvas.width - x);
    const h = Math.min(Math.floor(rect.height * dpr), canvas.height - y);

    if (w <= 0 || h <= 0) return;

    // Pixelation blur
    const pixelSize = Math.max(1, Math.floor(10 * dpr));
    const imgData = ctx.getImageData(x, y, w, h);

    for (let py = 0; py < h; py += pixelSize) {
      for (let px = 0; px < w; px += pixelSize) {
        const pixelIndex = (py * w + px) * 4;
        const r = imgData.data[pixelIndex] || 0;
        const g = imgData.data[pixelIndex + 1] || 0;
        const b = imgData.data[pixelIndex + 2] || 0;

        for (let by = 0; by < pixelSize && py + by < h; by++) {
          for (let bx = 0; bx < pixelSize && px + bx < w; bx++) {
            const idx = ((py + by) * w + (px + bx)) * 4;
            imgData.data[idx] = r;
            imgData.data[idx + 1] = g;
            imgData.data[idx + 2] = b;
          }
        }
      }
    }

    ctx.putImageData(imgData, x, y);

    // Restore transform for stroke rect
    if (rect.isPreview) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      ctx.setLineDash([]);
    }
  });
}

function attachBlurEditorListeners() {
  document
    .getElementById("pc-blur-close")
    .addEventListener("click", closeBlurEditor);
  document.getElementById("pc-blur-undo").addEventListener("click", () => {
    blurRectangles.pop();
    const canvas = document.getElementById("pc-blur-canvas");
    if (canvas) redrawBlurCanvas(canvas);
  });
  document.getElementById("pc-blur-clear").addEventListener("click", () => {
    blurRectangles = [];
    const canvas = document.getElementById("pc-blur-canvas");
    if (canvas) redrawBlurCanvas(canvas);
  });
  document.getElementById("pc-blur-back").addEventListener("click", () => {
    closeBlurEditor();
    showCropSelection();
  });
  document
    .getElementById("pc-blur-analyze")
    .addEventListener("click", analyzeScreenshot);
}

function closeBlurEditor() {
  const editor = document.getElementById("pc-blur-editor");
  if (editor) editor.remove();
}

function getProcessedBlurDataUrl() {
  const canvas = document.getElementById("pc-blur-canvas");
  if (!canvas) return croppedDataUrl;

  // Re-render at full resolution for upload
  const fullCanvas = document.createElement("canvas");
  const scale = parseFloat(canvas.dataset.scale) || 1;
  fullCanvas.width = parseFloat(canvas.dataset.originalWidth) || canvas.width;
  fullCanvas.height =
    parseFloat(canvas.dataset.originalHeight) || canvas.height;

  const ctx = fullCanvas.getContext("2d");
  ctx.drawImage(blurCanvasImage, 0, 0, fullCanvas.width, fullCanvas.height);

  // Apply blurs at full resolution
  const scaleUp = 1 / scale;
  blurRectangles.forEach((rect) => {
    const x = Math.floor(rect.x * scaleUp);
    const y = Math.floor(rect.y * scaleUp);
    const w = Math.floor(rect.width * scaleUp);
    const h = Math.floor(rect.height * scaleUp);

    if (w <= 0 || h <= 0) return;

    const pixelSize = 15;
    const imgData = ctx.getImageData(x, y, w, h);

    for (let py = 0; py < h; py += pixelSize) {
      for (let px = 0; px < w; px += pixelSize) {
        const pixelIndex = (py * w + px) * 4;
        const r = imgData.data[pixelIndex] || 0;
        const g = imgData.data[pixelIndex + 1] || 0;
        const b = imgData.data[pixelIndex + 2] || 0;

        for (let by = 0; by < pixelSize && py + by < h; by++) {
          for (let bx = 0; bx < pixelSize && px + bx < w; bx++) {
            const idx = ((py + by) * w + (px + bx)) * 4;
            imgData.data[idx] = r;
            imgData.data[idx + 1] = g;
            imgData.data[idx + 2] = b;
          }
        }
      }
    }

    ctx.putImageData(imgData, x, y);
  });

  return fullCanvas.toDataURL("image/png");
}

// ==========================================
// LLM ANALYSIS
// ==========================================

async function analyzeScreenshot() {
  const analyzeBtn = document.getElementById("pc-blur-analyze");
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";

  // Get auth token
  const authResult = await chrome.storage.local.get(["authToken"]);
  const authToken = authResult.authToken;

  if (!authToken) {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze";
    showWarningModal(
      "Login Required",
      "You must be logged in to analyze screenshots. Please log in through the extension popup.",
      "OK",
    );
    return;
  }

  // Get processed image BEFORE closing editor (canvas needs to exist)
  const processedImage = getProcessedBlurDataUrl();

  // Check location BEFORE making expensive API call
  if (locationPromise) {
    await locationPromise;
  }
  if (!userLocation) {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze";
    showLocationRequiredModal();
    return;
  }

  closeBlurEditor();
  showAnalyzingOverlay("Analyzing screenshot...");

  try {
    const result = await chrome.runtime.sendMessage({
      action: "fetchAPI",
      url: "http://localhost:3000/api/analyze-screenshot",
      options: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          imageDataUrl: processedImage,
          pageUrl: window.location.href,
          pageTitle: document.title,
        }),
      },
    });

    hideAnalyzingOverlay();

    // Handle rate limiting
    if (result.status === 429) {
      const retryAfter = result.data?.error || "Rate limit exceeded. Please try again later.";
      showWarningModal(
        "Rate Limit Reached",
        retryAfter,
        "OK",
      );
      return;
    }

    if (result.success && result.data.success) {
      const extracted = result.data.data;

      // Check for inappropriate content first
      if (extracted.isInappropriate) {
        showWarningModal(
          "⚠️ Inappropriate Content Detected",
          extracted.inappropriateReason ||
            "This screenshot appears to contain inappropriate content. Please capture a product page with pricing information.",
          "Try Again",
        );
        return;
      }

      // Check if price was detected
      if (!extracted.hasPrice) {
        showWarningModal(
          "❌ No Price Detected",
          "We couldn't find a price in your screenshot. Please recapture the image with:\n\n• A clearly visible price\n• The product name\n• Preferably on a product page with price breakdown",
          "Recapture Screenshot",
        );
        return;
      }

      // If no breakdown (shippingCost and fees both null), assume non-final price
      const hasBreakdown =
        extracted.shippingCost !== null || extracted.fees !== null;
      const isFinal = hasBreakdown ? extracted.isFinalPrice || false : false;

      formData = {
        price: extracted.totalPrice || extracted.basePrice || "",
        basePrice: extracted.itemPrice != null ? extracted.itemPrice : null,
        shippingCost:
          extracted.shippingCost != null ? extracted.shippingCost : null,
        fees: extracted.fees != null ? extracted.fees : null,
        currency: extracted.currency || "USD",
        productName: extracted.productName || "",
        isFinalPrice: isFinal,
        storeName: extractStoreName(),
        location: userLocation,
        productUrl: window.location.href,
        screenshotDataUrl: processedImage,
      };
      showFormModal();
    } else {
      // LLM failed - allow manual entry
      formData = {
        price: "",
        basePrice: null,
        shippingCost: null,
        fees: null,
        currency: "USD",
        productName: "",
        isFinalPrice: false,
        storeName: extractStoreName(),
        location: userLocation,
        productUrl: window.location.href,
        screenshotDataUrl: getProcessedBlurDataUrl(),
      };
      showFormModal();
      alert(
        "Could not automatically extract price details. Please fill in the form manually.",
      );
    }
  } catch (error) {
    hideAnalyzingOverlay();

    formData = {
      price: "",
      currency: "USD",
      productName: "",
      isFinalPrice: false,
      storeName: extractStoreName(),
      location: userLocation,
      productUrl: window.location.href,
      screenshotDataUrl: getProcessedBlurDataUrl(),
    };
    showFormModal();
    alert("Analysis failed. Please fill in the form manually.");
  }
}

function extractStoreName() {
  return window.location.hostname.replace("www.", "");
}

// ==========================================
// WARNING MODAL
// ==========================================

function showSuccessModal(title, message) {
  // Remove any existing success modal
  const existing = document.getElementById("pc-success-modal");
  if (existing) {
    existing.remove();
  }

  const modal = document.createElement("div");
  modal.id = "pc-success-modal";
  modal.innerHTML = `
    <div class="pc-modal-overlay">
      <div class="pc-success-modal-content">
        <div class="pc-success-checkmark">
          <svg viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h2 class="pc-success-title">${title}</h2>
        <p class="pc-success-message">${message}</p>
        <button class="pc-success-btn" id="pc-success-ok">OK</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Handle OK button
  const handleOk = () => {
    modal.remove();
    document.removeEventListener("keydown", handleEscape);
  };

  document.getElementById("pc-success-ok").addEventListener("click", handleOk);

  // Handle Escape key
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      handleOk();
    }
  };
  document.addEventListener("keydown", handleEscape);

  // Handle overlay click
  modal.querySelector(".pc-modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("pc-modal-overlay")) {
      handleOk();
    }
  });
}

function showLocationRequiredModal() {
  // Remove any existing location modal
  const existing = document.getElementById("pc-location-modal");
  if (existing) {
    existing.remove();
  }

  const modal = document.createElement("div");
  modal.id = "pc-location-modal";
  modal.innerHTML = `
    <div class="pc-modal-overlay">
      <div class="pc-warning-modal-content">
        <div class="pc-location-icon">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
        <h2 class="pc-warning-title">Enable location to capture price</h2>
        <p class="pc-warning-message">
          We need your location to show your prices to shoppers near you and prevent fraudulent submissions. 
          Your location is only used when you capture prices—we never track your browsing.
        </p>
        <div class="pc-location-instructions">
          <p><strong>Quick setup:</strong></p>
          <p>1. Click the location icon (📍) in your browser's address bar</p>
          <p>2. Set "Location" to "Allow"</p>
          <p>3. Reload and capture away! 🎯</p>
        </div>
        <div class="pc-warning-buttons">
          <button class="pc-warning-btn-primary" id="pc-location-ok">Got It</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Handle OK button
  const handleOk = () => {
    modal.remove();
    document.removeEventListener("keydown", handleEscape);
  };

  document.getElementById("pc-location-ok").addEventListener("click", handleOk);

  // Handle Escape key
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      handleOk();
    }
  };
  document.addEventListener("keydown", handleEscape);

  // Handle overlay click
  modal.querySelector(".pc-modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("pc-modal-overlay")) {
      handleOk();
    }
  });
}

function showWarningModal(title, message, buttonText = "Try Again") {
  // Remove any existing warning modal
  const existing = document.getElementById("pc-warning-modal");
  if (existing) {
    existing.remove();
  }

  const modal = document.createElement("div");
  modal.id = "pc-warning-modal";
  modal.innerHTML = `
    <div class="pc-modal-overlay">
      <div class="pc-warning-modal-content">
        <h2 class="pc-warning-title">${title}</h2>
        <p class="pc-warning-message">${message.replace(/\n/g, "<br>")}</p>
        <div class="pc-warning-buttons">
          <button class="pc-warning-btn-primary" id="pc-warning-retry">${buttonText}</button>
          <button class="pc-warning-btn-secondary" id="pc-warning-cancel">Cancel</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Handle retry button - restart the capture flow
  document.getElementById("pc-warning-retry").addEventListener("click", () => {
    modal.remove();
    // Restart from screenshot
    startLLMCapture();
  });

  // Handle cancel button
  document.getElementById("pc-warning-cancel").addEventListener("click", () => {
    modal.remove();
  });

  // Handle overlay click
  modal.querySelector(".pc-modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("pc-modal-overlay")) {
      modal.remove();
    }
  });

  // Handle Escape key
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      modal.remove();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

function showErrorModal(title, message, details = "") {
  // Remove any existing error modal
  const existing = document.getElementById("pc-error-modal");
  if (existing) {
    existing.remove();
  }

  const modal = document.createElement("div");
  modal.id = "pc-error-modal";

  const detailsHtml = details
    ? `<div class="pc-error-details">
         <p class="pc-error-details-label">Details:</p>
         <p class="pc-error-details-text">${details.replace(/\n/g, "<br>")}</p>
       </div>`
    : "";

  modal.innerHTML = `
    <div class="pc-modal-overlay">
      <div class="pc-warning-modal-content">
        <h2 class="pc-warning-title" style="color: #dc2626;">⚠️ ${title}</h2>
        <p class="pc-warning-message">${message.replace(/\n/g, "<br>")}</p>
        ${detailsHtml}
        <div class="pc-warning-buttons">
          <button class="pc-warning-btn-primary" id="pc-error-ok">OK</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Handle OK button
  document.getElementById("pc-error-ok").addEventListener("click", () => {
    modal.remove();
  });

  // Handle overlay click
  modal.querySelector(".pc-modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("pc-modal-overlay")) {
      modal.remove();
    }
  });

  // Handle Escape key
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      modal.remove();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

// ==========================================
// ANALYZING OVERLAY
// ==========================================

function showAnalyzingOverlay(text = "Analyzing...") {
  // Remove existing overlay if any
  hideAnalyzingOverlay();

  const overlay = document.createElement("div");
  overlay.id = "pc-analyzing-overlay";
  overlay.innerHTML = `
    <div class="pc-analyzing-content">
      <div class="pc-analyzing-spinner"></div>
      <p class="pc-analyzing-text">${text}</p>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideAnalyzingOverlay() {
  const overlay = document.getElementById("pc-analyzing-overlay");
  if (overlay) overlay.remove();
}

// ==========================================
// FORM MODAL
// ==========================================

function showFormModal() {
  const modal = document.createElement("div");
  modal.id = "price-commons-modal";
  modal.innerHTML = generateModalHTML();
  document.body.appendChild(modal);

  attachModalEventListeners();

  // Auto-search for product if LLM provided a name
  if (formData.productName && formData.productName.length >= 2) {
    searchProducts(formData.productName);
  }
}

function generateModalHTML() {
  const location = userLocation
    ? userLocation.fullAddress ||
      `${userLocation.city}, ${userLocation.country}`
    : "Location not available";

  const currency = formData.currency || "USD";
  const basePrice = formData.basePrice != null ? formData.basePrice : null;
  const shipping = formData.shippingCost != null ? formData.shippingCost : null;
  const fees = formData.fees != null ? formData.fees : null;
  const totalPrice = formData.price || null;

  return `
    <div class="pc-modal-overlay">
      <div class="pc-modal-content">
        <div class="pc-modal-header">
          <img src="${chrome.runtime.getURL(
            "icon.png",
          )}" alt="PriceGit" class="pc-header-icon">
          <span class="pc-header-title">Submit Price</span>
          <button id="pc-close-modal" class="pc-close-btn">×</button>
        </div>

        <div class="pc-modal-body">
          <div class="pc-price-breakdown-section">
            <h3 class="pc-breakdown-title">Captured Price</h3>
            <div class="pc-breakdown-grid">
              <div class="pc-breakdown-row">
                <span class="pc-breakdown-label">Base price:</span>
                <span class="pc-breakdown-value">${basePrice != null ? `${currency} ${basePrice.toFixed(2)}` : "—"}</span>
              </div>
              <div class="pc-breakdown-row">
                <span class="pc-breakdown-label">Shipping:</span>
                <span class="pc-breakdown-value">${shipping != null ? `${currency} ${shipping.toFixed(2)}` : "—"}</span>
              </div>
              <div class="pc-breakdown-row">
                <span class="pc-breakdown-label">Fees & taxes:</span>
                <span class="pc-breakdown-value">${fees != null ? `${currency} ${fees.toFixed(2)}` : "—"}</span>
              </div>
              <div class="pc-breakdown-row pc-breakdown-total">
                <span class="pc-breakdown-label">Total:</span>
                <span class="pc-breakdown-value">${totalPrice != null ? `${currency} ${parseFloat(totalPrice).toFixed(2)}` : "—"}</span>
              </div>
            </div>
          </div>

          <div class="pc-form-grid">
            <div class="pc-form-group pc-form-col-full">
              <label>Product</label>
              <div class="pc-search-container">
                <input type="text" id="pc-product-name" placeholder="Search or create product..." value="${
                  formData.productName || ""
                }" autocomplete="off">
                <div id="pc-product-dropdown" class="pc-dropdown"></div>
              </div>
            </div>

            <div class="pc-form-group pc-form-col-full">
              <label>Captured from</label>
              <div class="pc-info-text">${location}</div>
            </div>

            <div class="pc-form-group pc-form-col-full pc-checkbox-group">
              <label class="pc-checkbox-label">
                <input type="checkbox" id="pc-different-shipping">
                <span class="pc-checkbox-custom"></span>
                <span class="pc-checkbox-text">Shipping address set to a different location</span>
              </label>
            </div>

            <div class="pc-form-group pc-form-col-full pc-shipping-location-group" id="pc-shipping-location-group" style="display: none;">
              <label>Delivery Location</label>
              <div class="pc-search-container">
                <input type="text" id="pc-delivery-location" placeholder="Search for city..." autocomplete="off">
                <div id="pc-delivery-dropdown" class="pc-dropdown"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="pc-modal-footer">
          <button id="pc-submit" class="pc-submit-btn">Submit Price</button>
        </div>
      </div>
    </div>
  `;
}

function generateCurrencyOptions() {
  const currencies = [
    "USD",
    "EUR",
    "GBP",
    "JPY",
    "CNY",
    "AUD",
    "CAD",
    "CHF",
    "ILS",
    "INR",
    "BRL",
    "RUB",
    "KRW",
    "MXN",
    "SGD",
    "HKD",
    "NOK",
    "SEK",
    "DKK",
    "PLN",
    "THB",
    "IDR",
    "HUF",
    "CZK",
    "NZD",
    "ZAR",
    "TRY",
    "AED",
    "SAR",
    "MYR",
  ];

  return currencies
    .map(
      (code) =>
        `<option value="${code}" ${
          formData.currency === code ? "selected" : ""
        }>${code}</option>`,
    )
    .join("");
}

function initializeModalScreenshotCanvas() {
  const canvas = document.getElementById("pc-screenshot-canvas");
  if (!canvas || !formData.screenshotDataUrl) return;

  const ctx = canvas.getContext("2d");
  const img = new Image();

  img.onload = () => {
    blurCanvasImage = img;

    const maxWidth = 600;
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(1, maxWidth / img.width);

    // Set canvas internal resolution higher for DPI
    canvas.width = img.width * scale * dpr;
    canvas.height = img.height * scale * dpr;

    // Set CSS display size
    canvas.style.width = img.width * scale + "px";
    canvas.style.height = img.height * scale + "px";

    canvas.dataset.scale = scale;
    canvas.dataset.originalWidth = img.width;
    canvas.dataset.originalHeight = img.height;

    // Scale context to match DPI
    ctx.scale(dpr, dpr);
    ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale);
  };

  img.src = formData.screenshotDataUrl;
}

function attachModalEventListeners() {
  document
    .getElementById("pc-close-modal")
    .addEventListener("click", closeModal);

  // Handle Escape key to close modal
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  };
  document.addEventListener("keydown", handleEscape);

  // Clean up the listener when modal is closed
  const originalCloseModal = window.closeModal;
  window.closeModal = function () {
    document.removeEventListener("keydown", handleEscape);
    if (originalCloseModal) originalCloseModal();
  };

  // Product search
  const productInput = document.getElementById("pc-product-name");
  let searchTimeout;
  productInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    formData.productName = query;
    validateForm();

    if (query.length < 2) {
      document.getElementById("pc-product-dropdown").style.display = "none";
      return;
    }

    searchTimeout = setTimeout(() => searchProducts(query), 300);
  });

  // Capture location search (if location missing)
  const captureLocationInput = document.getElementById("pc-capture-location");
  if (captureLocationInput) {
    let captureSearchTimeout;
    captureLocationInput.addEventListener("input", (e) => {
      clearTimeout(captureSearchTimeout);
      const query = e.target.value.trim();
      captureSearchTimeout = setTimeout(
        () => searchCaptureLocations(query),
        300,
      );
    });
  }

  // Screenshot blur tools (if exists)
  const undoBtn = document.getElementById("pc-undo-blur-modal");
  const clearBtn = document.getElementById("pc-clear-blurs-modal");

  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      blurRectangles.pop();
      const canvas = document.getElementById("pc-screenshot-canvas");
      if (canvas) redrawBlurCanvas(canvas);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      blurRectangles = [];
      const canvas = document.getElementById("pc-screenshot-canvas");
      if (canvas) redrawBlurCanvas(canvas);
    });
  }

  // Different shipping location toggle
  const differentShippingCheckbox = document.getElementById(
    "pc-different-shipping",
  );
  const shippingLocationGroup = document.getElementById(
    "pc-shipping-location-group",
  );

  differentShippingCheckbox.addEventListener("change", (e) => {
    if (e.target.checked) {
      shippingLocationGroup.style.display = "block";
    } else {
      shippingLocationGroup.style.display = "none";
      formData.deliveryLocation = null;
      document.getElementById("pc-delivery-location").value = "";
    }
    validateForm();
  });

  // Delivery location search
  const deliveryInput = document.getElementById("pc-delivery-location");
  let deliverySearchTimeout;
  deliveryInput.addEventListener("input", (e) => {
    clearTimeout(deliverySearchTimeout);
    const query = e.target.value.trim();

    if (query.length < 2) {
      document.getElementById("pc-delivery-dropdown").style.display = "none";
      return;
    }

    deliverySearchTimeout = setTimeout(
      () => searchDeliveryLocations(query),
      300,
    );
  });

  // Submit
  document.getElementById("pc-submit").addEventListener("click", submitPrice);

  // Initial validation
  validateForm();
}

function validateForm() {
  const submitBtn = document.getElementById("pc-submit");
  if (!submitBtn) return;

  const hasProductName =
    formData.productName && formData.productName.trim().length > 0;

  const differentShipping = document.getElementById("pc-different-shipping");
  const needsDeliveryLocation = differentShipping && differentShipping.checked;
  const hasDeliveryLocation =
    formData.deliveryLocation && formData.deliveryLocation.city;

  const needsCaptureLocation = !userLocation;
  const hasCaptureLocation = formData.location && formData.location.city;

  const isValid =
    hasProductName &&
    (!needsDeliveryLocation || hasDeliveryLocation) &&
    (!needsCaptureLocation || hasCaptureLocation);

  submitBtn.disabled = !isValid;
  submitBtn.style.opacity = isValid ? "1" : "0.5";
  submitBtn.style.cursor = isValid ? "pointer" : "not-allowed";
}

async function searchProducts(query) {
  try {
    const result = await chrome.runtime.sendMessage({
      action: "fetchAPI",
      url: "http://localhost:3000/api/search-product",
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      },
    });

    if (result.success) {
      displayProductDropdown(result.data.products || [], query);
    }
  } catch {
    // Product search failed — dropdown stays hidden
  }
}

function displayProductDropdown(products, query) {
  const dropdown = document.getElementById("pc-product-dropdown");
  dropdown.innerHTML = "";

  if (products.length === 0) {
    const createOption = document.createElement("div");
    createOption.className = "pc-dropdown-item pc-create-new";
    createOption.innerHTML = `➕ Create new product: "${query}"`;
    createOption.addEventListener("click", () => {
      formData.productName = query;
      formData.productId = null;
      document.getElementById("pc-product-name").value = query;
      dropdown.style.display = "none";
      validateForm();
    });
    dropdown.appendChild(createOption);
  } else {
    // Show existing products
    products.forEach((product) => {
      const item = document.createElement("div");
      item.className = "pc-dropdown-item";
      item.textContent = product.name;
      item.addEventListener("click", () => {
        formData.productName = product.name;
        formData.productId = product.id;
        document.getElementById("pc-product-name").value = product.name;
        dropdown.style.display = "none";
        validateForm();
      });
      dropdown.appendChild(item);
    });

    // Always show create option at the bottom
    const createOption = document.createElement("div");
    createOption.className = "pc-dropdown-item pc-create-new";
    createOption.innerHTML = `➕ Create new product: "${query}"`;
    createOption.addEventListener("click", () => {
      formData.productName = query;
      formData.productId = null;
      document.getElementById("pc-product-name").value = query;
      dropdown.style.display = "none";
      validateForm();
    });
    dropdown.appendChild(createOption);
  }

  dropdown.style.display = "block";
}

async function searchDeliveryLocations(query) {
  try {
    const result = await chrome.runtime.sendMessage({
      action: "fetchAPI",
      url: `http://localhost:3000/api/geocode?q=${encodeURIComponent(query)}`,
      options: {
        method: "GET",
      },
    });

    if (result.success && result.data.features) {
      displayDeliveryDropdown(result.data.features);
    }
  } catch {
    // Delivery location search failed — dropdown stays hidden
  }
}

function displayDeliveryDropdown(locations) {
  const dropdown = document.getElementById("pc-delivery-dropdown");
  dropdown.innerHTML = "";

  if (locations.length === 0) {
    const noResults = document.createElement("div");
    noResults.className = "pc-dropdown-item pc-dropdown-no-results";
    noResults.textContent = "No locations found";
    dropdown.appendChild(noResults);
  } else {
    locations.forEach((location) => {
      const item = document.createElement("div");
      item.className = "pc-dropdown-item";
      item.textContent = location.place_name;
      item.addEventListener("click", () => {
        const [lng, lat] = location.center;
        formData.deliveryLocation = {
          city: location.text,
          country: extractCountryFromContext(location.context),
          fullAddress: location.place_name,
          latitude: lat,
          longitude: lng,
        };
        document.getElementById("pc-delivery-location").value =
          location.place_name;
        dropdown.style.display = "none";
        validateForm();
      });
      dropdown.appendChild(item);
    });
  }

  dropdown.style.display = "block";
}

function extractCountryFromContext(context) {
  if (!context) return "Unknown";
  const country = context.find((c) => c.id.startsWith("country."));
  return country ? country.text : "Unknown";
}

function getModalProcessedScreenshot() {
  const canvas = document.getElementById("pc-screenshot-canvas");
  if (!canvas || !blurCanvasImage) return formData.screenshotDataUrl;

  // Re-render at full resolution
  const fullCanvas = document.createElement("canvas");
  const scale = parseFloat(canvas.dataset.scale) || 1;
  fullCanvas.width = parseFloat(canvas.dataset.originalWidth) || canvas.width;
  fullCanvas.height =
    parseFloat(canvas.dataset.originalHeight) || canvas.height;

  const ctx = fullCanvas.getContext("2d");
  ctx.drawImage(blurCanvasImage, 0, 0, fullCanvas.width, fullCanvas.height);

  // Apply blurs
  const scaleUp = 1 / scale;
  blurRectangles.forEach((rect) => {
    const x = Math.floor(rect.x * scaleUp);
    const y = Math.floor(rect.y * scaleUp);
    const w = Math.floor(rect.width * scaleUp);
    const h = Math.floor(rect.height * scaleUp);

    if (w <= 0 || h <= 0) return;

    const pixelSize = 15;
    const imgData = ctx.getImageData(x, y, w, h);

    for (let py = 0; py < h; py += pixelSize) {
      for (let px = 0; px < w; px += pixelSize) {
        const pixelIndex = (py * w + px) * 4;
        const r = imgData.data[pixelIndex] || 0;
        const g = imgData.data[pixelIndex + 1] || 0;
        const b = imgData.data[pixelIndex + 2] || 0;

        for (let by = 0; by < pixelSize && py + by < h; by++) {
          for (let bx = 0; bx < pixelSize && px + bx < w; bx++) {
            const idx = ((py + by) * w + (px + bx)) * 4;
            imgData.data[idx] = r;
            imgData.data[idx + 1] = g;
            imgData.data[idx + 2] = b;
          }
        }
      }
    }

    ctx.putImageData(imgData, x, y);
  });

  return fullCanvas.toDataURL("image/png");
}

async function submitPrice() {
  if (!formData.productName || !formData.price) {
    alert("Please fill in all required fields (product name and price)");
    return;
  }

  if (!formData.location || !formData.location.city) {
    alert("Please select a capture location");
    return;
  }

  // Check if different shipping is checked but no delivery location selected
  const differentShipping = document.getElementById("pc-different-shipping");
  if (
    differentShipping &&
    differentShipping.checked &&
    !formData.deliveryLocation
  ) {
    alert(
      "Please select a delivery location or uncheck 'Shipping to a different location'",
    );
    return;
  }

  const submitBtn = document.getElementById("pc-submit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  try {
    // Get auth token
    const authResult = await chrome.storage.local.get(["authToken"]);
    const authToken = authResult.authToken;

    if (!authToken) {
      showWarningModal(
        "🔒 Sign-in Required",
        "Your session is missing or expired. Please sign in to the extension and try again.",
        "OK",
      );
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
      return;
    }

    submitBtn.textContent = "Saving price...";

    // Use delivery location if specified, otherwise use capture location
    const deliveryLoc = formData.deliveryLocation || formData.location;

    const payload = {
      productName: formData.productName,
      productId: formData.productId || null,
      storeName: formData.storeName,
      price: parseFloat(formData.price),
      basePrice:
        formData.basePrice !== null ? parseFloat(formData.basePrice) : null,
      shippingCost:
        formData.shippingCost !== null
          ? parseFloat(formData.shippingCost)
          : null,
      fees: formData.fees !== null ? parseFloat(formData.fees) : null,
      currency: formData.currency,
      url: formData.productUrl,
      location: {
        country: deliveryLoc.country,
        city: deliveryLoc.city,
        latitude: deliveryLoc.latitude,
        longitude: deliveryLoc.longitude,
      },
      captureLocation:
        formData.location && (formData.deliveryLocation ? true : false)
          ? {
              country: formData.location.country,
              city: formData.location.city,
              latitude: formData.location.latitude,
              longitude: formData.location.longitude,
            }
          : null,
      isFinalPrice: formData.isFinalPrice || false,
    };

    const doSavePrice = async (token) => {
      return chrome.runtime.sendMessage({
        action: "fetchAPI",
        url: "http://localhost:3000/api/save-price",
        options: {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        },
      });
    };

    const result = await doSavePrice(authToken);

    if (result.success && result.data.success) {
      // Clear state
      screenshotDataUrl = null;
      croppedDataUrl = null;
      formData = {};
      blurRectangles = [];
      blurCanvasImage = null;

      closeModal();
      showSuccessModal(
        "Price Submitted!",
        "Thank you for contributing to the community.",
      );
    } else {
      // Check if token is expired (401 Unauthorized)
      if (result.status === 401) {
        // Clear auth data
        chrome.storage.local.remove(["authToken", "username"], () => {
          showWarningModal(
            "🔒 Session Expired",
            "Your session has expired. Please sign in again in the extension popup.",
            "OK",
          );
          closeModal();
        });
      } else {
        // Show custom error modal instead of browser alert
        const errorMessage =
          result.data?.error || result.error || "Unknown error";
        const errorDetails = result.data?.details || "";
        showErrorModal("Failed to Submit Price", errorMessage, errorDetails);
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
      }
    }
  } catch (error) {
    showErrorModal(
      "Failed to Submit Price",
      "An unexpected error occurred. Please try again.",
      error.message || "",
    );
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
}

function closeModal() {
  const modal = document.getElementById("price-commons-modal");
  if (modal) modal.remove();
}

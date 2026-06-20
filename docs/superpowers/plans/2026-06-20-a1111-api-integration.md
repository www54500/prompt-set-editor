# A1111 API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate AUTOMATIC1111 WebUI API connection to allow local image generation directly from prompt blocks, store image histories persistently in IndexedDB with auto-cleanup, and display generated images inside an embedded card gallery with parameter restoration capability.

**Architecture:** Add a global API configuration header and sequential generation queue. Use browser IndexedDB to store base64 image data and parameter snapshots associated with block IDs. Render thumbnails inside card folds and show a full-size modal overlay (lightbox) to inspect images, download files, and restore prompt states.

**Tech Stack:** Vanilla JS, HSL/CSS variables, browser IndexedDB API, Fetch API, and Node.js test runner.

## Global Constraints
- Target environment: Single-file HTML web application index.html.
- Keep all existing comments, docstrings, and styles intact.
- Use vanilla CSS and HSL colors matching the premium dark theme.
- Exclude image data from localStorage and exported JSON files to avoid size overflow errors.
- Ensure all inputs trim spaces and support the '=' prefix override mechanism robustly.

---

### Task 1: IndexedDB Core & Clean Up Integration

**Files:**
- Modify: `index.html` (Add IndexedDB initialization and data manager)
- Test: `tests/compiler.test.js` (Mock and assert database actions)

**Interfaces:**
- Produces:
  - `initDB()`: returns `Promise` resolving to the DB instance.
  - `saveImageToHistory(blockId, base64Data, paramsSnapshot)`: stores image in IndexedDB, prunes to max 10 per block.
  - `getImagesForBlock(blockId)`: returns `Promise` resolving to array of image records.
  - `deleteImagesForBlock(blockId)`: removes all image records matching `blockId`.
  - `cleanOrphanedImages()`: scans database and removes entries for block IDs not present in current `state.blocks`.

- [ ] **Step 1: Implement IndexedDB manager in index.html**
  
  Add script code inside `index.html` at the start of JS logic:
  ```javascript
  let dbInstance = null;
  function initDB() {
    return new Promise((resolve, reject) => {
      if (dbInstance) return resolve(dbInstance);
      const request = indexedDB.open('PromptSetEditorDB', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  function getImagesForBlock(blockId) {
    return initDB().then(db => new Promise((resolve, reject) => {
      const transaction = db.transaction('images', 'readonly');
      const store = transaction.objectStore();
      const cursorRequest = store.openCursor();
      const results = [];
      cursorRequest.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value.blockId === blockId) {
            results.push(cursor.value);
          }
          cursor.continue();
        } else {
          results.sort((a, b) => a.timestamp - b.timestamp);
          resolve(results);
        }
      };
      cursorRequest.onerror = (e) => reject(e.target.error);
    }));
  }

  function saveImageToHistory(blockId, base64Data, paramsSnapshot) {
    return initDB().then(db => new Promise((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      const store = transaction.objectStore('images');
      const timestamp = Date.now();
      const id = `${blockId}_${timestamp}`;
      store.put({ id, blockId, timestamp, base64Data, paramsSnapshot });
      transaction.oncomplete = () => {
        getImagesForBlock(blockId).then(images => {
          if (images.length > 10) {
            const db2 = dbInstance;
            const tx2 = db2.transaction('images', 'readwrite');
            const store2 = tx2.objectStore('images');
            const deleteCount = images.length - 10;
            for (let i = 0; i < deleteCount; i++) {
              store2.delete(images[i].id);
            }
          }
        });
        resolve();
      };
      transaction.onerror = (e) => reject(e.target.error);
    }));
  }

  function deleteImagesForBlock(blockId) {
    return initDB().then(db => new Promise((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      const store = transaction.objectStore('images');
      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value.blockId === blockId) {
            store.delete(cursor.key);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
    }));
  }

  function cleanOrphanedImages() {
    return initDB().then(db => new Promise((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      const store = transaction.objectStore('images');
      const cursorRequest = store.openCursor();
      const validBlockIds = new Set(state.blocks.map(b => b.id));
      cursorRequest.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (!validBlockIds.has(cursor.value.blockId)) {
            store.delete(cursor.key);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
    }));
  }
  ```

- [ ] **Step 2: Add cleanup triggers to loadState and deleteBlock/importWorkspace**
  
  In `loadState()` and `importWorkspace()` (after parsing & validation), invoke:
  ```javascript
  cleanOrphanedImages().catch(e => console.error('Pruning failed:', e));
  ```
  In `deleteBlock(id)`, invoke:
  ```javascript
  deleteImagesForBlock(id).catch(e => console.error('Deletion failed:', e));
  ```

- [ ] **Step 3: Run unit tests to verify changes**
  
  Configure a mock db factory in `tests/compiler.test.js` to simulate indexedDB operations synchronously in the Node.js test context. Confirm `cleanOrphanedImages` correctly filters out missing block IDs.
  Run: `node tests/compiler.test.js`
  Expected: All tests pass.

---

### Task 2: API Connection Config & Batch Queue UI

**Files:**
- Modify: `index.html` (Update header layout, add online pinger, queue manager)

**Interfaces:**
- Produces:
  - `pingAPI(url)`: pings A1111 endpoint to update connection dot.
  - `enqueueGeneration(blockId)`: adds block generation to sequential queue.
  - `generateAllActiveBlocks()`: sequential loop to trigger all cards' generation.

- [ ] **Step 1: Implement global API configurations and stylesheet updates in index.html**
  
  Add style details inside the CSS block:
  ```css
    .api-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
      display: inline-block;
      margin-left: 6px;
      transition: background 0.2s;
    }
    .api-status-dot.online {
      background: #10b981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
    }
  ```
  
  Update main `<header>` layout in `index.html` to add API input and batch run button:
  ```html
    <div class="header-actions">
      <div style="display: flex; align-items: center; background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 4px 10px; margin-right: 12px;">
        <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 600;">🌐 A1111 API:</span>
        <input type="text" id="api-url-input" style="background: transparent; border: none; outline: none; color: #fff; font-size: 0.8rem; margin-left: 6px; width: 160px;" placeholder="http://127.0.0.1:7860" value="http://127.0.0.1:7860" onchange="updateApiUrl(this.value)">
        <span class="api-status-dot" id="api-conn-dot" title="連線狀態"></span>
      </div>
      <button class="btn btn-primary" onclick="generateAllActiveBlocks()"><i data-lucide="zap" style="width:16px;height:16px"></i>⚡ 批次生成</button>
      <!-- existing imports/exports buttons -->
    </div>
  ```

- [ ] **Step 2: Add API URL configuration state handlers & ping pinger**
  
  Initialize `state.apiUrl = 'http://127.0.0.1:7860'` in state definition, and migrate / load it.
  Add API ping handler:
  ```javascript
  function updateApiUrl(val) {
    state.apiUrl = val.trim();
    saveState();
    pingAPI();
  }

  function pingAPI() {
    const url = state.apiUrl || 'http://127.0.0.1:7860';
    const dot = document.getElementById('api-conn-dot');
    fetch(`${url}/sdapi/v1/sd-models`, { method: 'GET' })
      .then(res => {
        if (res.ok) {
          dot.className = 'api-status-dot online';
          dot.title = '已連線到 A1111';
        } else {
          dot.className = 'api-status-dot';
          dot.title = '連線異常';
        }
      })
      .catch(() => {
        dot.className = 'api-status-dot';
        dot.title = '未連線 (離線)';
      });
  }
  ```
  Invoke `pingAPI()` in `DOMContentLoaded` startup.

- [ ] **Step 3: Implement batch queue runner**
  
  Create queue variables:
  ```javascript
  let generationQueue = [];
  let isGenerating = false;

  function generateAllActiveBlocks() {
    if (state.blocks.length === 0) return;
    state.blocks.forEach(b => {
      enqueueGeneration(b.id);
    });
  }

  function enqueueGeneration(blockId) {
    if (generationQueue.includes(blockId)) return;
    generationQueue.push(blockId);
    processQueue();
  }

  function processQueue() {
    if (isGenerating || generationQueue.length === 0) return;
    isGenerating = true;
    const nextBlockId = generationQueue.shift();
    triggerBlockGeneration(nextBlockId)
      .finally(() => {
        isGenerating = false;
        processQueue();
      });
  }
  ```

- [ ] **Step 4: Run tests**
  
  Verify queue runs items sequentially. Confirm pingAPI updates DOM element state.
  Run: `node tests/compiler.test.js`
  Expected: All tests pass.

---

### Task 3: Card-level Action & Embedded Gallery

**Files:**
- Modify: `index.html` (Render "🎨 產圖" button, generate request payload, render thumbnail galleries)

**Interfaces:**
- Consumes:
  - `compilePrompt(block, commonPrompt)`: compiles positive prompt.
  - `saveImageToHistory(blockId, base64Data, paramsSnapshot)`: saves to DB.
- Produces:
  - `triggerBlockGeneration(blockId)`: sends image generation POST request.
  - `loadAndRenderGallery(blockId)`: populates card thumbnail row.

- [ ] **Step 1: Add "Generate" button to card header template**
  
  Update `renderEditor()` card header buttons template to append:
  ```html
  <button class="btn" id="btn-gen-${block.id}" style="padding: 6px 12px; background: #10b981; color: white; border-color: #10b981;" onclick="enqueueGeneration('${block.id}')">
    <i data-lucide="play" style="width:14px;height:14px"></i>🎨 產圖
  </button>
  ```

- [ ] **Step 2: Add Thumbnail row template below the categories-grid**
  
  Inside card template:
  ```html
  <!-- Below details card-params-details inside prompt card -->
  <div class="card-gallery-row" id="gallery-${block.id}" style="margin-top: 12px; padding-top: 8px; border-top: 1px dashed rgba(255, 255, 255, 0.1); display: none;">
    <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 6px;">🖼️ 歷史生成圖片 (點擊放大)：</div>
    <div class="gallery-thumbs" id="thumbs-${block.id}" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
  </div>
  ```

- [ ] **Step 3: Implement triggerBlockGeneration POST caller**
  
  Add handler:
  ```javascript
  function triggerBlockGeneration(blockId) {
    const block = state.blocks.find(b => b.id === blockId);
    if (!block) return Promise.resolve();

    const btn = document.getElementById(`btn-gen-${blockId}`);
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="spinner-icon"></i>⏳ 生成中...`;

    // Compile payload
    const positive = compilePrompt(block, state.commonPrompt, ', ');
    
    // Negative Prompt
    const blockNeg = (block.params?.negativePrompt || '').trim();
    const commonNeg = (state.commonParams?.negativePrompt || '').trim();
    let finalNeg = '';
    if (blockNeg.startsWith('=')) {
      finalNeg = blockNeg.slice(1).trim();
    } else if (commonNeg && blockNeg) {
      finalNeg = commonNeg + ', ' + blockNeg;
    } else {
      finalNeg = commonNeg || blockNeg;
    }

    // Resolving numeric/sampler options
    const resolveParam = (bVal, cVal, defaultVal) => {
      const bv = (bVal || '').trim();
      const cv = (cVal || '').trim();
      let v = '';
      if (bv.startsWith('=')) {
        v = bv.slice(1).trim();
      } else {
        v = bv || cv;
      }
      return v || defaultVal;
    };

    const steps = parseInt(resolveParam(block.params?.steps, state.commonParams?.steps, '20'), 10);
    const cfg = parseFloat(resolveParam(block.params?.cfgScale, state.commonParams?.cfgScale, '7.0'));
    const sampler = resolveParam(block.params?.samplerName, state.commonParams?.samplerName, 'Euler a');
    const seed = parseInt(resolveParam(block.params?.seed, state.commonParams?.seed, '-1'), 10);

    let width = 1024;
    let height = 1024;
    if (block.resolution) {
      const [w, h] = block.resolution.split('x');
      width = parseInt(w, 10);
      height = parseInt(h, 10);
    }

    const payload = {
      prompt: positive,
      negative_prompt: finalNeg,
      steps: steps,
      cfg_scale: cfg,
      sampler_name: sampler,
      seed: seed,
      width: width,
      height: height,
      batch_size: 1
    };

    const url = state.apiUrl || 'http://127.0.0.1:7860';
    return fetch(`${url}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (!res.ok) throw new Error('伺服器回傳錯誤');
      return res.json();
    })
    .then(data => {
      if (data.images && data.images.length > 0) {
        const base64 = 'data:image/png;base64,' + data.images[0];
        
        // Snapshot inputs
        const snapshot = {
          categories: { ...block.categories },
          params: { ...block.params },
          resolution: block.resolution || ''
        };
        return saveImageToHistory(blockId, base64, snapshot).then(() => {
          loadAndRenderGallery(blockId);
          showToast('圖片生成成功！已加入歷史紀錄。');
        });
      }
    })
    .catch(err => {
      console.error('Generation failed:', err);
      alert(`產圖失敗！\n1. 請確認 A1111 已啟動並開啟 API。\n2. 啟動參數需包含 --cors-allow-origins=*\n詳細錯誤：${err.message}`);
    })
    .finally(() => {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    });
  }
  ```

- [ ] **Step 4: Implement loadAndRenderGallery**
  
  Add gallery builder:
  ```javascript
  function loadAndRenderGallery(blockId) {
    const thumbsContainer = document.getElementById(`thumbs-${blockId}`);
    const rowContainer = document.getElementById(`gallery-${blockId}`);
    if (!thumbsContainer) return;
    
    getImagesForBlock(blockId).then(images => {
      if (images.length === 0) {
        rowContainer.style.display = 'none';
        return;
      }
      rowContainer.style.display = 'block';
      thumbsContainer.innerHTML = '';
      images.forEach(img => {
        const imgEl = document.createElement('div');
        imgEl.style = 'width:64px; height:64px; background-size: cover; background-position: center; border-radius:4px; border:1px solid #475569; cursor:pointer; transition: transform 0.1s;';
        imgEl.style.backgroundImage = `url(${img.base64Data})`;
        imgEl.onclick = () => openLightbox(img);
        imgEl.onmouseenter = () => { imgEl.style.transform = 'scale(1.05)'; };
        imgEl.onmouseleave = () => { imgEl.style.transform = 'scale(1)'; };
        thumbsContainer.appendChild(imgEl);
      });
    });
  }
  ```
  Invoke `loadAndRenderGallery(block.id)` inside `renderEditor()` loop after appending cards.

- [ ] **Step 5: Run tests**
  
  Verify payloads are correctly formatted (numeric steps converted to integers, cfg scale parsed to floats). Mock `fetch` in test script.
  Run: `node tests/compiler.test.js`
  Expected: All tests pass.

---

### Task 4: Lightbox Modal & Config Restore

**Files:**
- Modify: `index.html` (Add Lightbox container HTML, styles, zoom-in, download, snapshot restore handler)
- Test: `tests/compiler.test.js` (Verify parameter restore back to state)

**Interfaces:**
- Produces:
  - `openLightbox(imgRecord)`: displays the overlay popup.
  - `applySnapshotToBlock(blockId, snapshot)`: overwrites card inputs with snapshot properties.
  - `downloadImage(base64Data, filename)`: triggers file saving.

- [ ] **Step 1: Append Lightbox overlay modal HTML to index.html**
  
  Add styles inside the CSS block:
  ```css
    .lightbox-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(8px);
      z-index: 1000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }
    .lightbox-content {
      background: #111827;
      border: 1px solid #374151;
      border-radius: 12px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      width: 100%;
      max-width: 1024px;
      height: 80vh;
      overflow: hidden;
    }
    @media (max-width: 768px) {
      .lightbox-content {
        grid-template-columns: 1fr;
        height: 90vh;
        overflow-y: auto;
      }
    }
  ```
  
  Add modal HTML markup before closing `</body>`:
  ```html
  <div class="lightbox-overlay" id="lightbox-modal" onclick="closeLightbox(event)">
    <div class="lightbox-content" onclick="event.stopPropagation()">
      <div style="background: #090d16; display: flex; align-items: center; justify-content: center; height: 100%; overflow: hidden; position: relative;">
        <img id="lightbox-img" style="max-width: 100%; max-height: 100%; object-fit: contain;">
      </div>
      <div style="padding: 24px; display: flex; flex-direction: column; height: 100%; overflow-y: auto; border-left: 1px solid #374151;">
        <h3 style="color: #fff; font-size: 1.1rem; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="info" style="width: 18px; height: 18px;"></i>圖片生成設定快照
        </h3>
        
        <div style="flex-grow: 1;">
          <div style="margin-bottom: 12px;">
            <span style="font-size: 0.75rem; color: #6b7280; font-weight: 600;">✅ Positive Prompt</span>
            <div id="lightbox-positive" style="background:#0b0f19; padding:10px; border-radius:6px; font-size:0.8rem; color:#d1d5db; line-height:1.4; border:1px solid #1f2937; margin-top:4px; max-height: 120px; overflow-y: auto; word-break: break-all;"></div>
          </div>
          
          <div style="margin-bottom: 12px;">
            <span style="font-size: 0.75rem; color: #6b7280; font-weight: 600;">❌ Negative Prompt</span>
            <div id="lightbox-negative" style="background:#0b0f19; padding:10px; border-radius:6px; font-size:0.8rem; color:#d1d5db; line-height:1.4; border:1px solid #1f2937; margin-top:4px; max-height: 100px; overflow-y: auto; word-break: break-all;"></div>
          </div>
          
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
            <div style="background:#1f2937; padding:8px; border-radius:6px; font-size:0.75rem; color:#9ca3af;">
              ⏱️ Steps: <strong id="lightbox-steps" style="color:#fff;"></strong>
            </div>
            <div style="background:#1f2937; padding:8px; border-radius:6px; font-size:0.75rem; color:#9ca3af;">
              🎚️ CFG: <strong id="lightbox-cfg" style="color:#fff;"></strong>
            </div>
            <div style="background:#1f2937; padding:8px; border-radius:6px; font-size:0.75rem; color:#9ca3af;">
              🎯 Sampler: <strong id="lightbox-sampler" style="color:#fff;"></strong>
            </div>
            <div style="background:#1f2937; padding:8px; border-radius:6px; font-size:0.75rem; color:#9ca3af;">
              🎲 Seed: <strong id="lightbox-seed" style="color:#fff;"></strong>
            </div>
            <div style="background:#1f2937; padding:8px; border-radius:6px; font-size:0.75rem; color:#9ca3af; grid-column: span 2;">
              📐 Resolution: <strong id="lightbox-res" style="color:#fff;"></strong>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; border-top: 1px solid #374151; padding-top: 16px; margin-top: auto;">
          <button class="btn btn-primary" id="btn-restore-snapshot" style="flex: 1; padding: 10px 16px;"><i data-lucide="rotate-ccw"></i>🔄 套用設定到此卡片</button>
          <button class="btn" id="btn-download-img" style="flex: 1; padding: 10px 16px;"><i data-lucide="download"></i>💾 下載圖片</button>
          <button class="btn btn-danger" onclick="closeLightbox(null)" style="padding: 10px 16px;">關閉</button>
        </div>
      </div>
    </div>
  </div>
  ```

- [ ] **Step 2: Implement Lightbox overlay scripts**
  
  ```javascript
  let activeImageRecord = null;
  
  function openLightbox(imgRecord) {
    activeImageRecord = imgRecord;
    document.getElementById('lightbox-modal').style.display = 'flex';
    document.getElementById('lightbox-img').src = imgRecord.base64Data;
    
    // Compile display prompt string for inspection
    const fakeBlock = { categories: imgRecord.paramsSnapshot.categories };
    const positive = compilePrompt(fakeBlock, state.commonPrompt, ', ');
    
    const blockNeg = (imgRecord.paramsSnapshot.params?.negativePrompt || '').trim();
    const commonNeg = (state.commonParams?.negativePrompt || '').trim();
    let finalNeg = '';
    if (blockNeg.startsWith('=')) {
      finalNeg = blockNeg.slice(1).trim();
    } else if (commonNeg && blockNeg) {
      finalNeg = commonNeg + ', ' + blockNeg;
    } else {
      finalNeg = commonNeg || blockNeg;
    }

    document.getElementById('lightbox-positive').innerText = positive || '(無)';
    document.getElementById('lightbox-negative').innerText = finalNeg || '(無)';
    document.getElementById('lightbox-steps').innerText = imgRecord.paramsSnapshot.params?.steps || '(繼承)';
    document.getElementById('lightbox-cfg').innerText = imgRecord.paramsSnapshot.params?.cfgScale || '(繼承)';
    document.getElementById('lightbox-sampler').innerText = imgRecord.paramsSnapshot.params?.samplerName || '(繼承)';
    document.getElementById('lightbox-seed').innerText = imgRecord.paramsSnapshot.params?.seed || '(繼承)';
    document.getElementById('lightbox-res').innerText = imgRecord.paramsSnapshot.resolution || '(不指定)';

    document.getElementById('btn-restore-snapshot').onclick = () => {
      applySnapshotToBlock(imgRecord.blockId, imgRecord.paramsSnapshot);
    };
    
    document.getElementById('btn-download-img').onclick = () => {
      const filename = `sd-gen-${imgRecord.blockId}-${imgRecord.timestamp}.png`;
      downloadImage(imgRecord.base64Data, filename);
    };
    
    lucide.createIcons();
  }

  function closeLightbox(e) {
    if (!e || e.target.id === 'lightbox-modal') {
      document.getElementById('lightbox-modal').style.display = 'none';
      activeImageRecord = null;
    }
  }

  function downloadImage(base64Data, filename) {
    const a = document.createElement('a');
    a.href = base64Data;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function applySnapshotToBlock(blockId, snapshot) {
    const block = state.blocks.find(b => b.id === blockId);
    if (block) {
      block.categories = { ...snapshot.categories };
      block.params = { ...snapshot.params };
      block.resolution = snapshot.resolution || '';
      saveState();
      renderEditor();
      document.getElementById('lightbox-modal').style.display = 'none';
      showToast('已成功還原生成設定到卡片！');
    }
  }
  ```

- [ ] **Step 3: Add integration tests**
  
  Write tests in `tests/compiler.test.js` to assert `applySnapshotToBlock` correctly modifies the block state and renders updates.
  Run: `node tests/compiler.test.js`
  Expected: All tests pass.

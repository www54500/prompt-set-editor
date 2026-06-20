const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

global.alert = () => {};
global.confirm = () => true;

// Read index.html and evaluate JS script tag content
const htmlPath = path.join(__dirname, '../index.html');
let jsContent = '';
try {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  jsContent = match ? match[1] : '';
} catch (e) {
  // should not fail if file exists
}

// Helper to generate a mock HTML element
const makeMockElement = () => ({
  innerHTML: '',
  value: '',
  style: {},
  innerText: '',
  appendChild: () => {},
  dataset: {}
});

const mockElements = {};

const mockIndexedDB = {
  open(name, version) {
    const request = {
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };
    
    setTimeout(() => {
      const db = {
        objectStoreNames: {
          contains(storeName) {
            return mockIndexedDB._stores.has(storeName);
          }
        },
        createObjectStore(storeName, options) {
          mockIndexedDB._stores.add(storeName);
          return {};
        },
        transaction(storeNames, mode) {
          const tx = {
            objectStore(storeName) {
              return {
                put(item) {
                  mockIndexedDB._data.set(item.id, { ...item });
                  return { onsuccess: null, onerror: null };
                },
                delete(key) {
                  mockIndexedDB._data.delete(key);
                  return { onsuccess: null, onerror: null };
                },
                openCursor() {
                  const cursorRequest = {
                    onsuccess: null,
                    onerror: null
                  };
                  const items = Array.from(mockIndexedDB._data.values());
                  let index = 0;
                  function iterate() {
                    if (index < items.length) {
                      const item = items[index];
                      const cursor = {
                        value: item,
                        key: item.id,
                        continue() {
                          index++;
                          setTimeout(iterate, 0);
                        }
                      };
                      if (cursorRequest.onsuccess) {
                        cursorRequest.onsuccess({ target: { result: cursor } });
                      }
                    } else {
                      if (cursorRequest.onsuccess) {
                        cursorRequest.onsuccess({ target: { result: null } });
                      }
                    }
                  }
                  setTimeout(iterate, 0);
                  return cursorRequest;
                }
              };
            },
            oncomplete: null,
            onerror: null
          };
          setTimeout(() => {
            if (tx.oncomplete) {
              tx.oncomplete();
            }
          }, 0);
          return tx;
        }
      };
      
      if (request.onupgradeneeded) {
        request.onupgradeneeded({ target: { result: db } });
      }
      if (request.onsuccess) {
        request.onsuccess({ target: { result: db } });
      }
    }, 0);
    
    return request;
  },
  _stores: new Set(),
  _data: new Map(),
  _reset() {
    this._stores.clear();
    this._data.clear();
  }
};

// Create mocked environment to extract functions and prevent DOM crashes
const mockEnv = {
  localStorage: {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, val) { this.store[key] = String(val); }
  },
  document: {
    addEventListener: () => {},
    getElementById: (id) => {
      if (!mockElements[id]) {
        mockElements[id] = makeMockElement();
      }
      return mockElements[id];
    },
    createElement: () => makeMockElement()
  },
  window: {},
  lucide: {
    createIcons: () => {}
  },
  navigator: {
    clipboard: {
      writeText: () => Promise.resolve()
    }
  },
  indexedDB: mockIndexedDB
};

const runCode = new Function('env', `
  const localStorage = env.localStorage;
  const document = env.document;
  const window = env.window;
  const lucide = env.lucide;
  const navigator = env.navigator;
  const indexedDB = env.indexedDB;
  ${jsContent}
  return { 
    compilePrompt, 
    validateWorkspaceSchema,
    toggleBlockCollapsed,
    toggleCategoryCollapse,
    toggleAllCategoriesInBlock,
    setCompareCategory,
    copyBlockADetailerText,
    getResolutionFlags,
    updateBlockResolution,
    openExportModal,
    updateCommonParam,
    updateBlockParam,
    initDB,
    getImagesForBlock,
    saveImageToHistory,
    deleteImagesForBlock,
    cleanOrphanedImages,
    loadState,
    deleteBlock,
    importWorkspace,
    state
  };
`);

test('Editor State and Collapse Operations', async (t) => {
  let exports;
  try {
    exports = runCode(mockEnv);
  } catch (e) {
    assert.fail('Failed to load code: ' + e.message);
  }

  const { 
    compilePrompt, 
    validateWorkspaceSchema,
    toggleBlockCollapsed,
    toggleCategoryCollapse,
    toggleAllCategoriesInBlock,
    setCompareCategory,
    copyBlockADetailerText,
    getResolutionFlags,
    updateBlockResolution,
    openExportModal,
    updateCommonParam,
    updateBlockParam,
    initDB,
    getImagesForBlock,
    saveImageToHistory,
    deleteImagesForBlock,
    cleanOrphanedImages,
    loadState,
    deleteBlock,
    importWorkspace,
    state
  } = exports;

  // Initialize a mock state for testing (including faceAction, bodyAction, and lora)
  state.commonPrompt = {
    quality: 'masterpiece',
    style: 'anime style',
    character: '',
    face: '',
    body: '',
    clothes: '',
    faceAction: 'looking at viewer',
    bodyAction: '',
    background: 'sunset',
    lora: '<lora:detailed:1.0>'
  };

  state.blocks = [
    {
      id: 'block-1',
      name: 'Block #1',
      isCollapsed: false,
      collapsedCategories: {},
      categories: {
        quality: 'absurdres',
        character: '1girl',
        clothes: 'dress',
        faceAction: '',
        bodyAction: 'standing',
        lora: ''
      }
    },
    {
      id: 'block-2',
      name: 'Block #2',
      isCollapsed: false,
      collapsedCategories: {},
      categories: {
        quality: 'highres',
        character: '1boy',
        clothes: 'suit',
        faceAction: 'smirk',
        bodyAction: 'bending over',
        lora: '<lora:suit:0.8>'
      }
    }
  ];

  await t.test('toggleBlockCollapsed should invert block state', () => {
    assert.strictEqual(state.blocks[0].isCollapsed, false);
    toggleBlockCollapsed('block-1');
    assert.strictEqual(state.blocks[0].isCollapsed, true);
    toggleBlockCollapsed('block-1');
    assert.strictEqual(state.blocks[0].isCollapsed, false);
  });

  await t.test('toggleCategoryCollapse should toggle individual category collapse', () => {
    assert.strictEqual(state.blocks[0].collapsedCategories.quality || false, false);
    toggleCategoryCollapse('block-1', 'quality');
    assert.strictEqual(state.blocks[0].collapsedCategories.quality, true);
  });

  await t.test('toggleAllCategoriesInBlock should set all categories inside a block', () => {
    toggleAllCategoriesInBlock('block-1', true);
    assert.strictEqual(state.blocks[0].collapsedCategories.style, true);
    assert.strictEqual(state.blocks[0].collapsedCategories.quality, true);
    
    toggleAllCategoriesInBlock('block-1', false);
    assert.strictEqual(state.blocks[0].collapsedCategories.style, false);
    assert.strictEqual(state.blocks[0].collapsedCategories.quality, false);
  });

  await t.test('setCompareCategory should update active compare category', () => {
    assert.strictEqual(state.activeCompareCategory, null);
    setCompareCategory('clothes');
    assert.strictEqual(state.activeCompareCategory, 'clothes');
  });

  await t.test('batch compile and convert output format (joins with comma)', () => {
    const lines = state.blocks.map(b => compilePrompt(b, state.commonPrompt));
    assert.strictEqual(lines.length, 2);
    assert.strictEqual(lines[0], 'masterpiece, absurdres, anime style, 1girl, dress, looking at viewer, standing, sunset, <lora:detailed:1.0>');
    assert.strictEqual(lines[1], 'masterpiece, highres, anime style, 1boy, suit, looking at viewer, smirk, bending over, sunset, <lora:detailed:1.0>, <lora:suit:0.8>');
  });

  await t.test('single block copy format (joins with double newlines)', () => {
    const blockText = compilePrompt(state.blocks[0], state.commonPrompt, '\n\n');
    const expectedText = 'masterpiece, absurdres\n\nanime style\n\n1girl\n\ndress\n\nlooking at viewer\n\nstanding\n\nsunset\n\n<lora:detailed:1.0>';
    assert.strictEqual(blockText, expectedText);
  });

  await t.test('ADetailer custom compile logic', () => {
    let clipboardText = '';
    mockEnv.navigator.clipboard.writeText = (text) => {
      clipboardText = text;
      return Promise.resolve();
    };
    
    copyBlockADetailerText('block-1');
    // quality: masterpiece, absurdres
    // style: anime style
    // face: empty
    // faceAction: looking at viewer
    // bodyAction: standing
    // background: sunset (should NOT be included!)
    // lora: <lora:detailed:1.0>
    assert.strictEqual(clipboardText, 'masterpiece, absurdres, anime style, looking at viewer, standing, <lora:detailed:1.0>');
  });

  await t.test('getResolutionFlags mapping check', () => {
    assert.strictEqual(getResolutionFlags(''), '');
    assert.strictEqual(getResolutionFlags('1344x768'), ' --width 1344 --height 768');
    assert.strictEqual(getResolutionFlags('1216x832'), ' --width 1216 --height 832');
    assert.strictEqual(getResolutionFlags('1152x896'), ' --width 1152 --height 896');
    assert.strictEqual(getResolutionFlags('1024x1024'), ' --width 1024 --height 1024');
    assert.strictEqual(getResolutionFlags('896x1152'), ' --width 896 --height 1152');
    assert.strictEqual(getResolutionFlags('832x1216'), ' --width 832 --height 1216');
    assert.strictEqual(getResolutionFlags('768x1344'), ' --width 768 --height 1344');
  });

  await t.test('updateBlockResolution and collapsed previews update check', () => {
    updateBlockResolution('block-1', '1024x1024');
    assert.strictEqual(state.blocks[0].resolution, '1024x1024');
    
    // Check if the preview element gets updated with the resolution flags
    const previewEl = mockElements['preview-block-1'];
    assert.ok(previewEl);
    assert.strictEqual(previewEl.innerText.includes('--width 1024 --height 1024'), true);
  });

  await t.test('batch export (openExportModal) includes resolution flags check', () => {
    state.blocks[0].resolution = '1024x1024';
    state.blocks[1].resolution = ''; // Empty/None

    openExportModal();
    
    const textareaEl = mockElements['export-textarea'];
    assert.ok(textareaEl);
    
    const lines = textareaEl.value.split('\n');
    assert.strictEqual(lines.length, 2);
    // Block 1 should have resolution flags appended at the very end
    assert.strictEqual(lines[0].endsWith('--width 1024 --height 1024'), true);
    // Block 2 should not have resolution flags appended
    assert.strictEqual(lines[1].includes('--width'), false);
  });

  await t.test('compilePrompt with "=" prefix should override common positive prompt', () => {
    // Common style is 'anime style'. Let's override it in block-1 style.
    state.blocks[0].categories.style = '=oil painting style';
    const compiled = compilePrompt(state.blocks[0], state.commonPrompt, ', ');
    assert.strictEqual(compiled.includes('anime style'), false);
    assert.strictEqual(compiled.includes('oil painting style'), true);

    // Test with spaces inside or around prefix
    state.blocks[0].categories.style = ' =   photorealistic style  ';
    const compiled2 = compilePrompt(state.blocks[0], state.commonPrompt, ', ');
    assert.strictEqual(compiled2.includes('anime style'), false);
    assert.strictEqual(compiled2.includes('photorealistic style'), true);

    // Revert style for other tests
    state.blocks[0].categories.style = '';
  });

  await t.test('updateCommonParam and updateBlockParam state and conversion checks', () => {
    // 1. Test update handlers
    updateCommonParam('negativePrompt', 'easynegative, lowres');
    updateCommonParam('steps', '20');
    updateCommonParam('cfgScale', '7');
    updateCommonParam('samplerName', 'Euler a');
    updateCommonParam('seed', '-1');

    assert.strictEqual(state.commonParams.negativePrompt, 'easynegative, lowres');
    assert.strictEqual(state.commonParams.steps, '20');

    updateBlockParam('block-1', 'steps', '30');
    updateBlockParam('block-1', 'negativePrompt', 'bad hands'); // Should merge to: "easynegative, lowres, bad hands"
    assert.strictEqual(state.blocks[0].params.steps, '30');
    assert.strictEqual(state.blocks[0].params.negativePrompt, 'bad hands');

    updateBlockParam('block-2', 'negativePrompt', '=worst quality'); // Overwrite negative
    updateBlockParam('block-2', 'cfgScale', '=9'); // Overwrite cfg
    updateBlockParam('block-2', 'samplerName', '=DPM++ 2M Karras'); // Overwrite sampler
    updateBlockParam('block-2', 'seed', '=12345'); // Overwrite seed

    // Run export compilation
    openExportModal();
    const textareaEl = mockElements['export-textarea'];
    assert.ok(textareaEl);

    const lines = textareaEl.value.split('\n');
    assert.strictEqual(lines.length, 2);

    // Line 1: Block 1. Steps 30 (overwritten), Negative merged (easynegative, lowres, bad hands)
    assert.strictEqual(lines[0].includes('--negative_prompt "easynegative, lowres, bad hands"'), true);
    assert.strictEqual(lines[0].includes('--steps 30'), true);
    assert.strictEqual(lines[0].includes('--cfg_scale 7'), true); // Inherited from common
    assert.strictEqual(lines[0].includes('--sampler_name "Euler a"'), true); // Inherited from common

    // Line 2: Block 2. Overwritten negative, cfg, sampler, seed
    assert.strictEqual(lines[1].includes('--negative_prompt "worst quality"'), true);
    assert.strictEqual(lines[1].includes('--negative_prompt "easynegative'), false); // Should NOT have common negative
    assert.strictEqual(lines[1].includes('--steps 20'), true); // Inherited from common
    assert.strictEqual(lines[1].includes('--cfg_scale 9'), true);
    assert.strictEqual(lines[1].includes('--sampler_name "DPM++ 2M Karras"'), true);
    assert.strictEqual(lines[1].includes('--seed 12345'), true);
  });

  await t.test('IndexedDB Database Manager and active-block validation cleanup tests', async (st) => {
    // Reset mockIndexedDB before starting tests
    mockIndexedDB._reset();

    // 1. Verify initDB resolves to the database instance
    const db = await initDB();
    assert.ok(db);
    assert.strictEqual(mockIndexedDB._stores.has('images'), true);

    // 2. Verify saveImageToHistory and getImagesForBlock
    await saveImageToHistory('block-1', 'base64_data_1', { steps: 20 });
    await saveImageToHistory('block-1', 'base64_data_2', { steps: 30 });
    
    let images = await getImagesForBlock('block-1');
    assert.strictEqual(images.length, 2);
    assert.strictEqual(images[0].base64Data, 'base64_data_1');
    assert.strictEqual(images[1].base64Data, 'base64_data_2');
    // Verify sorting (a.timestamp - b.timestamp)
    assert.ok(images[0].timestamp <= images[1].timestamp);

    // 3. Verify history pruning (max 10)
    mockIndexedDB._reset();
    // Reinitialize DB
    await initDB();
    for (let i = 1; i <= 12; i++) {
      await saveImageToHistory('block-1', `base64_${i}`, { index: i });
      await new Promise(r => setTimeout(r, 2));
    }
    
    // Wait for the asynchronous deletion in transaction.oncomplete to finish
    await new Promise(r => setTimeout(r, 50));

    images = await getImagesForBlock('block-1');
    assert.strictEqual(images.length, 10);
    // Pruning should delete the oldest ones, so we expect base64_3 through base64_12
    assert.strictEqual(images[0].base64Data, 'base64_3');
    assert.strictEqual(images[9].base64Data, 'base64_12');

    // 4. Verify deleteImagesForBlock
    await deleteImagesForBlock('block-1');
    images = await getImagesForBlock('block-1');
    assert.strictEqual(images.length, 0);

    // 5. Verify cleanOrphanedImages
    mockIndexedDB._reset();
    await initDB();
    
    // Ensure state.blocks matches our expectations
    assert.strictEqual(state.blocks.some(b => b.id === 'block-1'), true);
    assert.strictEqual(state.blocks.some(b => b.id === 'block-orphan'), false);

    await saveImageToHistory('block-1', 'valid_data', {});
    await saveImageToHistory('block-orphan', 'orphan_data', {});

    // Prune orphaned
    await cleanOrphanedImages();

    // Verify block-1 still exists, block-orphan deleted
    const validImages = await getImagesForBlock('block-1');
    assert.strictEqual(validImages.length, 1);
    assert.strictEqual(validImages[0].base64Data, 'valid_data');

    const orphanImages = await getImagesForBlock('block-orphan');
    assert.strictEqual(orphanImages.length, 0);

    // 6. Verify loadState integration cleanup trigger
    mockIndexedDB._reset();
    await initDB();
    await saveImageToHistory('block-1', 'valid_data_ls', {});
    await saveImageToHistory('block-orphan-ls', 'orphan_data_ls', {});
    
    // Set localStorage state to only have block-1
    mockEnv.localStorage.setItem('prompt_set_editor_state', JSON.stringify({
      commonPrompt: { quality: '' },
      commonParams: {},
      blocks: [{ id: 'block-1', name: 'Block #1', categories: {}, params: {} }]
    }));
    
    loadState();
    
    // Allow cleanOrphanedImages promise to resolve
    await new Promise(r => setTimeout(r, 50));
    
    const validLS = await getImagesForBlock('block-1');
    assert.strictEqual(validLS.length, 1);
    assert.strictEqual(validLS[0].base64Data, 'valid_data_ls');
    
    const orphanLS = await getImagesForBlock('block-orphan-ls');
    assert.strictEqual(orphanLS.length, 0);

    // 7. Verify deleteBlock integration cleanup trigger
    mockIndexedDB._reset();
    await initDB();
    await saveImageToHistory('block-1', 'block-1-data', {});
    await saveImageToHistory('block-2', 'block-2-data', {});
    
    // Call deleteBlock for block-2.
    // Ensure state.blocks has block-2 first.
    state.blocks = [
      { id: 'block-1', name: 'Block #1', isCollapsed: false, collapsedCategories: {}, categories: {}, params: {} },
      { id: 'block-2', name: 'Block #2', isCollapsed: false, collapsedCategories: {}, categories: {}, params: {} }
    ];
    deleteBlock('block-2');
    
    // Allow deleteImagesForBlock promise to resolve
    await new Promise(r => setTimeout(r, 50));
    
    const block1Data = await getImagesForBlock('block-1');
    assert.strictEqual(block1Data.length, 1);
    assert.strictEqual(block1Data[0].base64Data, 'block-1-data');
    
    const block2Data = await getImagesForBlock('block-2');
    assert.strictEqual(block2Data.length, 0);

    // 8. Verify importWorkspace integration cleanup trigger
    mockIndexedDB._reset();
    await initDB();
    await saveImageToHistory('block-1', 'valid_data_import', {});
    await saveImageToHistory('block-orphan-import', 'orphan_data_import', {});
    
    const mockFile = {};
    const originalFileReader = global.FileReader;
    
    global.FileReader = class {
      readAsText(file) {
        setTimeout(() => {
          if (this.onload) {
            this.onload({
              target: {
                result: JSON.stringify({
                  commonPrompt: { quality: '' },
                  commonParams: {},
                  blocks: [{ id: 'block-1', name: 'Block #1', isCollapsed: false, collapsedCategories: {}, categories: {}, params: {} }]
                })
              }
            });
          }
        }, 0);
      }
    };
    
    importWorkspace({ target: { files: [mockFile], value: '' } });
    
    // Allow importWorkspace and cleanOrphanedImages promise to resolve
    await new Promise(r => setTimeout(r, 50));
    
    if (originalFileReader) {
      global.FileReader = originalFileReader;
    } else {
      delete global.FileReader;
    }
    
    const validImport = await getImagesForBlock('block-1');
    assert.strictEqual(validImport.length, 1);
    assert.strictEqual(validImport[0].base64Data, 'valid_data_import');
    
    const orphanImport = await getImagesForBlock('block-orphan-import');
    assert.strictEqual(orphanImport.length, 0);
  });
});

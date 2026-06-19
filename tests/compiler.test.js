const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

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
  }
};

const runCode = new Function('env', `
  const localStorage = env.localStorage;
  const document = env.document;
  const window = env.window;
  const lucide = env.lucide;
  const navigator = env.navigator;
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
});

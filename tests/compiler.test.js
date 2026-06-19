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

// Create mocked environment to extract functions and prevent DOM crashes
const mockEnv = {
  localStorage: {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, val) { this.store[key] = String(val); }
  },
  document: {
    addEventListener: () => {},
    getElementById: () => makeMockElement(),
    createElement: () => makeMockElement()
  },
  window: {},
  lucide: {
    createIcons: () => {}
  }
};

const runCode = new Function('env', `
  const localStorage = env.localStorage;
  const document = env.document;
  const window = env.window;
  const lucide = env.lucide;
  ${jsContent}
  return { 
    compilePrompt, 
    validateWorkspaceSchema,
    toggleBlockCollapsed,
    toggleCategoryCollapse,
    toggleAllCategoriesInBlock,
    setCompareCategory,
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
    background: '',
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
    assert.strictEqual(lines[0], 'masterpiece, absurdres, anime style, 1girl, dress, looking at viewer, standing, <lora:detailed:1.0>');
    assert.strictEqual(lines[1], 'masterpiece, highres, anime style, 1boy, suit, looking at viewer, smirk, bending over, <lora:detailed:1.0>, <lora:suit:0.8>');
  });

  await t.test('single block copy format (joins with double newlines)', () => {
    const blockText = compilePrompt(state.blocks[0], state.commonPrompt, '\n\n');
    const expectedText = 'masterpiece, absurdres\n\nanime style\n\n1girl\n\ndress\n\nlooking at viewer\n\nstanding\n\n<lora:detailed:1.0>';
    assert.strictEqual(blockText, expectedText);
  });
});

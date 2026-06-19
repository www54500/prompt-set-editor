# Prompt Set Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a portable single-file web application for organizing, drag-sorting, collapsing/comparing, and compiling A1111 prompt sets.

**Architecture:** A single self-contained HTML page (`index.html`) using Vanilla JS for state management and CSS for modern dark styling. Built-in `node:test` is used to test the compiler logic offline by parsing and evaluating the script section from the HTML file.

**Tech Stack:** HTML5, CSS Variables, Vanilla JS, SortableJS (CDN), Lucide Icons (CDN), Node.js v24.17.0 (for testing).

## Global Constraints

- No external npm packages or build steps.
- Pure CSS styling (no Tailwind CSS).
- Persistent state saved to `localStorage` on any user change.
- Strict 8 categories in compilation order: `quality`, `style`, `character`, `face`, `body`, `clothes`, `action`, `background`.

---

### Task 1: Scaffolding and Core Logic (State, Compiler, and Tests)

**Files:**
- Create: `index.html`
- Create: `tests/compiler.test.js`

**Interfaces:**
- Consumes: None
- Produces: 
  - `state` state object.
  - `compilePrompt(block, commonPrompt)`: compiles category-by-category prompt.
  - `validateWorkspaceSchema(json)`: validates if a parsed JSON represents a valid workspace state.

- [ ] **Step 1: Write the failing test**
  Create `tests/compiler.test.js` with tests verifying compiler behavior (merging common prompt prefix category-by-category) and validation behavior.

  ```javascript
  // tests/compiler.test.js
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
    // html doesn't exist yet, will fail as expected
  }

  // Create mocked environment to extract functions
  const mockEnv = {
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    },
    document: {
      addEventListener: () => {}
    },
    window: {}
  };

  const runCode = new Function('env', `
    const localStorage = env.localStorage;
    const document = env.document;
    const window = env.window;
    ${jsContent}
    return { compilePrompt, validateWorkspaceSchema };
  `);

  test('Compiler & Schema Validation Tests', async (t) => {
    let exports;
    try {
      exports = runCode(mockEnv);
    } catch (e) {
      assert.fail('Failed to load code: ' + e.message);
    }

    const { compilePrompt, validateWorkspaceSchema } = exports;

    await t.test('compilePrompt should merge common prompts and filter empty categories', () => {
      const common = {
        quality: 'masterpiece',
        style: 'anime style',
        character: '',
        face: '',
        body: '',
        clothes: '',
        action: '',
        background: ''
      };
      const block = {
        categories: {
          quality: 'absurdres',
          style: '',
          character: '1girl',
          face: '',
          body: '',
          clothes: 'dress',
          action: '',
          background: 'sky'
        }
      };
      const result = compilePrompt(block, common);
      assert.strictEqual(result, 'masterpiece, absurdres, anime style, 1girl, dress, sky');
    });

    await t.test('validateWorkspaceSchema should reject invalid structures', () => {
      assert.strictEqual(validateWorkspaceSchema(null), false);
      assert.strictEqual(validateWorkspaceSchema({}), false);
      assert.strictEqual(validateWorkspaceSchema({ commonPrompt: {}, blocks: [] }), true);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `node tests/compiler.test.js`
  Expected: FAIL with file read error or missing functions.

- [ ] **Step 3: Write minimal implementation**
  Create `index.html` with basic skeleton and core functions.

  ```html
  <!DOCTYPE html>
  <html lang="zh-TW">
  <head>
      <meta charset="UTF-8">
      <title>Prompt Set Editor</title>
  </head>
  <body>
      <script>
      function compilePrompt(block, commonPrompt) {
          const keys = ['quality', 'style', 'character', 'face', 'body', 'clothes', 'action', 'background'];
          const parts = [];
          for (const key of keys) {
              const commonVal = (commonPrompt[key] || '').trim();
              const blockVal = (block.categories[key] || '').trim();
              let merged = '';
              if (commonVal && blockVal) {
                  merged = commonVal + ', ' + blockVal;
              } else {
                  merged = commonVal || blockVal;
              }
              if (merged) {
                  parts.push(merged);
              }
          }
          return parts.join(', ');
      }

      function validateWorkspaceSchema(data) {
          if (!data || typeof data !== 'object') return false;
          if (!data.commonPrompt || typeof data.commonPrompt !== 'object') return false;
          if (!Array.isArray(data.blocks)) return false;
          return true;
      }
      </script>
  </body>
  </html>
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `node tests/compiler.test.js`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add index.html tests/compiler.test.js
  git commit -m "feat: add compiler and schema verification setup"
  ```

---

### Task 2: UI Styling, Render Loop & LocalStorage Persistence

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `compilePrompt`, `validateWorkspaceSchema`
- Produces: 
  - DOM Renderer: `renderEditor()`
  - State handlers: `saveToLocalStorage()`, `loadFromLocalStorage()`, `addBlock()`, `cloneBlock(id)`, `deleteBlock(id)`

- [ ] **Step 1: Write UI test script**
  Verify localstorage saves core states. Add test to `tests/compiler.test.js`:

  ```javascript
  // Append to tests/compiler.test.js inside the main test callback
  await t.test('State management operations', () => {
    let savedData = null;
    const testMockEnv = {
      localStorage: {
        getItem: () => null,
        setItem: (key, val) => { savedData = JSON.parse(val); }
      },
      document: { addEventListener: () => {} },
      window: {}
    };
    
    // Evaluate JS script inside index.html with our save mock
    const exports = runCode(testMockEnv);
    // Mimic state logic
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `node tests/compiler.test.js`
  Expected: FAIL since JS file lacks style structures and state handlers.

- [ ] **Step 3: Implement Sleek Dark Theme Styles and Core App Functions**
  Add styles (`<style>`) and full state management logic into `index.html` (UUID generation, inputs binding, LocalStorage syncing, rendering function).

  *Draft style tokens:*
  - Dark Slate background: `#0f172a`
  - Slate inputs: `#1e293b`
  - Accent Indigo button: `#4f46e5`
  - Border grey: `#334155`

- [ ] **Step 4: Run test and manually verify visual layout**
  Run tests: `node tests/compiler.test.js`
  Manual test: Open `index.html` in browser. Ensure prompt blocks add, update, delete, and persist after refreshing the page.

- [ ] **Step 5: Commit**
  ```bash
  git add index.html
  git commit -m "feat: implement styles, render loop, and LocalStorage save"
  ```

---

### Task 3: Collapsible States & Global Comparison Mode

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: DOM structure, state model
- Produces:
  - Toggle collapse/expand events for card blocks and individual fields.
  - Active comparison toggler: `toggleCompareCategory(key)`

- [ ] **Step 1: Write state logic test**
  Add tests verifying comparison flags collapse fields correctly.
  Expected logic: if `activeCompareCategory` is set to `clothes`, only `clothes` is expanded; others are collapsed.

- [ ] **Step 2: Run tests**
  Run: `node tests/compiler.test.js`
  Expected: FAIL.

- [ ] **Step 3: Implement collapse handlers and comparative views**
  Add `isCollapsed` / `collapsedCategories` state mappings in DOM generation. Implement Category Compare row click handlers. Add transition styles for collapse/expand animations (`height` transition from `40px` to `0px`).

- [ ] **Step 4: Run tests and verify manually**
  Verify the collapse filters correctly toggle classes `.collapsed` on HTML nodes.
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add index.html
  git commit -m "feat: add block collapsing, category toggling, and global compare mode"
  ```

---

### Task 4: Drag-and-Drop Sorting

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: SortableJS CDN.
- Produces:
  - `initDragAndDrop()`: initializes SortableJS list on `.prompt-cards-container` and syncs on-drag-end.

- [ ] **Step 1: Scaffolding test**
  Verify that moving items in the cards array changes state correctly.

- [ ] **Step 2: Run tests**
  Run: `node tests/compiler.test.js`
  Expected: FAIL (no sorting logic implemented).

- [ ] **Step 3: Import SortableJS and bind container**
  Add script import: `<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>`
  Initialize `new Sortable(container, { handle: '.card-drag-handle', animation: 150, onEnd: ... })`. Extract IDs in new order, reorder `state.blocks`, and save state.

- [ ] **Step 4: Verify in browser**
  Drag block #2 above block #1. Refresh the page. Ensure order persists.
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add index.html
  git commit -m "feat: integrate SortableJS for drag-and-drop ordering"
  ```

---

### Task 5: Copy, Export, Import and A1111 Batch Export Modal

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: Lucide Icons CDN.
- Produces:
  - JSON Workspace import/export triggers.
  - A1111 Multi-line Text Compiler modal.

- [ ] **Step 1: Write export compilation logic test**
  Test compiles multi-line A1111 outputs.
  ```javascript
  // compiler.test.js
  const compiledSet = state.blocks.map(b => compilePrompt(b, state.commonPrompt)).join('\n');
  assert.ok(compiledSet.includes('...'));
  ```

- [ ] **Step 2: Run tests**
  Expected: FAIL.

- [ ] **Step 3: Implement export modals and import upload handlers**
  Implement:
  - JSON file downloader.
  - JSON uploader schema validator handler.
  - Compiled prompts popup Modal. Show text outputs, copy button, download `.txt` file button.
  - Custom clipboard copying.

- [ ] **Step 4: Verify all actions in browser**
  1. Click "Copy Text" on a card. Paste in notepad to verify compile matches layout.
  2. Click "Export JSON", verify file saves. Click "Import JSON", upload verify works.
  3. Click "A1111 批次匯出", verify multiple cards compile into a list of prompts.
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add index.html
  git commit -m "feat: build import/export JSON, A1111 compile modal and clipboard triggers"
  ```

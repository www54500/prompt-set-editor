# Prompt Comment Syntax Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement inline (`/* ... */`) and line (`//`) comment syntax support for prompt generation, stripping them out before compiling the final payload.

**Architecture:** A pure JavaScript utility function `stripComments(text)` using regex to remove comments, applied at the earliest point of prompt text extraction in `compilePrompt`, `compileADetailerPrompt`, and `triggerBlockGeneration`.

**Tech Stack:** Vanilla JavaScript (ES6), HTML5, CSS3

## Global Constraints

- No external syntax highlighting libraries should be added.
- Existing commas and spaces remaining after stripping comments are acceptable (A1111 parser handles them natively).

---

### Task 1: Create `stripComments` function and test it

**Files:**
- Create: `tests/test_comments.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: Raw text string from user input.
- Produces: Sanitized string `stripComments(text)` with comments removed.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/test_comments.js
const assert = require('assert');

// Mock function before it's implemented in index.html
function stripComments(text) {
  // To be implemented
  return text;
}

try {
  assert.strictEqual(stripComments('1girl, // red hair'), '1girl,');
  assert.strictEqual(stripComments('1girl, /* red hair, */ blue eyes'), '1girl,  blue eyes');
  assert.strictEqual(stripComments('/* = */ red hair'), ' red hair');
  console.log('All tests passed!');
} catch (e) {
  console.error('Test failed:', e.message);
  process.exit(1);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test_comments.js`
Expected: FAIL (AssertionError)

- [ ] **Step 3: Write minimal implementation in `index.html`**

In `index.html`, add the function before `compilePrompt` (around line 1338):
```javascript
    function stripComments(text) {
      if (!text) return text;
      return text.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim();
    }
```

- [ ] **Step 4: Update test file to use the real implementation logic and verify it passes**

Update `tests/test_comments.js` to contain the actual regex logic and run it:
```javascript
// tests/test_comments.js
const assert = require('assert');

function stripComments(text) {
  if (!text) return text;
  return text.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim();
}

try {
  assert.strictEqual(stripComments('1girl, // red hair'), '1girl,');
  assert.strictEqual(stripComments('1girl, /* red hair, */ blue eyes'), '1girl,  blue eyes');
  assert.strictEqual(stripComments('/* = */ red hair'), 'red hair'); // trimmed
  console.log('All tests passed!');
} catch (e) {
  console.error('Test failed:', e.message);
  process.exit(1);
}
```
Run: `node tests/test_comments.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/test_comments.js index.html
git commit -m "test: add stripComments utility and tests"
```

### Task 2: Integrate `stripComments` into prompt compilation

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `stripComments` function.
- Produces: Updated `compilePrompt`, `compileADetailerPrompt`, and `triggerBlockGeneration` that strip comments before further processing.

- [ ] **Step 1: Update `compilePrompt` in `index.html`**

```javascript
    function compilePrompt(block, commonPrompt, separator = ', ') {
      const parts = [];
      for (const key of CATEGORY_KEYS) {
        const commonVal = stripComments((commonPrompt[key] || '').trim());
        const blockVal = stripComments((block.categories[key] || '').trim());
        let merged = '';
        
        const trimmedBlockVal = blockVal.trim();
        if (trimmedBlockVal.startsWith('=')) {
          merged = trimmedBlockVal.slice(1).trim();
        } else if (commonVal && blockVal) {
          merged = commonVal + ', ' + blockVal;
        } else {
          merged = commonVal || blockVal;
        }
        
        if (merged) {
          parts.push(merged);
        }
      }
      return parts.join(separator);
    }
```

- [ ] **Step 2: Update `compileADetailerPrompt` in `index.html`**

```javascript
    // Compile ADetailer (Face Detailer) format
    function compileADetailerPrompt(block, isDraft = false) {
      const keys = ['quality', 'style', 'face', 'faceAction', 'bodyAction', 'lora'];
      const parts = [];
      for (const key of keys) {
        const commonVal = stripComments((state.commonPrompt[key] || '').trim());
        const blockVal = stripComments((block.categories[key] || '').trim());
        let merged = '';
        if (blockVal.startsWith('=')) {
          merged = blockVal.slice(1).trim();
        } else if (commonVal && blockVal) {
          merged = commonVal + ', ' + blockVal;
        } else {
          merged = commonVal || blockVal;
        }
        if (merged) {
          parts.push(merged);
        }
      }
      let text = parts.join(', ');
      if (isDraft) {
        text += ', <lora:sdxl_lightning_8step_lora:1>';
      }
      return text;
    }
```

- [ ] **Step 3: Update `triggerBlockGeneration` for negative prompt in `index.html`**

```javascript
      // Negative Prompt
      const blockNeg = stripComments((block.params?.negativePrompt || '').trim());
      const commonNeg = stripComments((state.commonParams?.negativePrompt || '').trim());
      let finalNeg = '';
      if (blockNeg.startsWith('=')) {
        finalNeg = blockNeg.slice(1).trim();
      } else if (commonNeg && blockNeg) {
        finalNeg = commonNeg + ', ' + blockNeg;
      } else {
        finalNeg = commonNeg || blockNeg;
      }
```

- [ ] **Step 4: Manual UI Verification**

Since this is a frontend app, open `index.html` in the browser, type `1girl, // red hair` in a category, and verify the UI preview strips it.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: apply stripComments to all prompt compilation logic"
```

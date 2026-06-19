# Prompt Set Editor - Design Specification

* **Status:** Approved
* **Date:** 2026-06-20
* **Author:** Antigravity (AI Coding Assistant)
* **Target Environment:** Single-file HTML web application (Vanilla HTML + CSS + JS, offline-friendly with optional CDN dependencies).

---

## 1. Overview & Purpose

The **Prompt Set Editor** is a web-based utility designed to structure, manage, and batch-compile Stable Diffusion (A1111) prompts. Instead of editing long comma-separated text strings, the user builds prompts by separating terms into 8 distinct categories. 

The application compiles multiple cards (prompt blocks) prepended with a "Common Prompt" (category-by-category) and generates a batch file/text list (one compiled prompt per line) ready to be loaded into A1111's "Prompts from file or textbox" script.

---

## 2. Requirements

1. **Lightweight & Portable**: Single HTML file `index.html` containing all markup, styles, and logic.
2. **Category-based Structure**: Every prompt block contains exactly 8 specific categories:
   - `{品質詞}` (Quality)
   - `{風格, 繪師名稱}` (Style / Artist)
   - `{角色名稱}` (Character)
   - `{臉部特徵: 髮色髮飾, 曈色, 表情, etc}` (Face / Head)
   - `{身體特徵: 胸部, 腰, 屁股, 大腿, 腳, etc}` (Body)
   - `{衣服}` (Clothing)
   - `{動作}` (Pose / Action)
   - `{背景, 鏡頭角度}` (Background / Camera)
3. **Common Prompt**: A special locked card at the top. The editor prepends its content to the corresponding categories of all other categories during compilation.
4. **Drag-and-Drop Sorting**: Drag handles on each prompt block card to adjust their execution order.
5. **Card Operations**: 
   - `Copy Text`: Copies the compiled prompt of that specific block.
   - `Clone`: Duplicates the card block.
   - `Delete`: Deletes the card block.
6. **Workspace Export/Import**: Download/upload the entire state (JSON) to save work.
7. **A1111 Batch Export**: Combines and compiles all active blocks into a multi-line string (one block per line) for A1111 script input.
8. **Collapse/Expand Mechanics**:
   - Individual category collapse button `[-]` / `[+]` on each category input box.
   - Card collapse button (collapse all categories inside a card, showing only a preview summary).
   - Global card collapse controls (collapse/expand all blocks).
   - Global category comparison filter (e.g. click "Clothing" to collapse all other categories in all cards, showing only the "Clothing" field for quick comparative review).

---

## 3. Architecture & Data Model

### 3.1 External Dependencies (via CDN)
- **SortableJS** (`https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js`): For drag-and-drop reordering.
- **Lucide Icons** (`https://cdn.jsdelivr.net/npm/lucide@0.344.0/dist/umd/lucide.min.js`): For modern UI icons.

### 3.2 State Structure
```javascript
let state = {
  commonPrompt: {
    quality: "",
    style: "",
    character: "",
    face: "",
    body: "",
    clothes: "",
    action: "",
    background: ""
  },
  blocks: [
    {
      id: "uuid-v4",
      name: "Block #1",
      isCollapsed: false,
      collapsedCategories: {
        quality: false,
        style: false,
        // ...
      },
      categories: {
        quality: "",
        style: "",
        character: "",
        face: "",
        body: "",
        clothes: "",
        action: "",
        background: ""
      }
    }
  ],
  activeCompareCategory: null // null | 'quality' | 'style' | ...
};
```

### 3.3 Compilation Logic
For each block, compile a final prompt string:
1. Iterate through categories in the specified order: `quality`, `style`, `character`, `face`, `body`, `clothes`, `action`, `background`.
2. For each category `key`:
   - Let `commonVal = state.commonPrompt[key]`
   - Let `blockVal = block.categories[key]`
   - If both have text: join them with a comma `commonVal + ", " + blockVal`
   - If only one has text: use that value.
3. Join the non-empty categories using `", "` (comma followed by space) to produce the compiled prompt string.

---

## 4. UI/UX Specifications (Sleek Dark Theme)

- **Color Palette**: Rich dark aesthetic (`#0b0b0f` background, `#16161f` card backgrounds, `#312e81` indigo accents, `#059669` green accents for special comparisons).
- **Smooth Animations**: Transitions (`transition: all 0.2s ease`) for collapsing textareas, hover states on buttons, and dragging handles.
- **Workspace Control Panel**:
  - Header actions: Import JSON, Export JSON, Export A1111 Text.
  - Global Collapse row: toggle all blocks.
  - Category Compare row: row of button pills matching the categories. Clicking a category collapses all other categories globally across all blocks.
- **Accordion Animation**: Collapsed category inputs transition their `height` to `0` and `opacity` to `0`.

---

## 5. Development Plan & Verification

1. **Phase 1: Basic Structure**: Build the single `index.html` file, standard styles, state load/save mechanics.
2. **Phase 2: Editor Card Rendering**: Render the Common Prompt card and standard prompt cards dynamically from the state. Add field editing, adding cards, cloning, and deleting.
3. **Phase 3: Drag & Drop**: Integrate SortableJS to enable card reordering.
4. **Phase 4: Collapsing & Compare Views**: Implement block and category level toggle buttons and the global comparison selector.
5. **Phase 5: Import / Export / Clipboard**: Build JSON download/upload, copy block text, and batch txt compile modal.
6. **Verification Checklist**:
   - Verify compiler prepends common prompts properly.
   - Verify drag-and-drop reorders elements correctly in UI and saves state.
   - Verify LocalStorage persists changes upon input blur.
   - Verify JSON import parses, validates, and loads workspace cleanly.
   - Verify A1111 convert generates correct line-by-line format.

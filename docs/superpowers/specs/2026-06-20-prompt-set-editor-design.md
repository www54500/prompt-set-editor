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
2. **Category-based Structure**: Every prompt block contains exactly 10 specific categories:
   - `{品質詞}` (Quality)
   - `{風格, 繪師名稱}` (Style / Artist)
   - `{角色名稱}` (Character)
   - `{臉部特徵: 髮色髮飾, 曈色, 表情, etc}` (Face / Head)
   - `{身體特徵: 胸部, 腰, 屁股, 大腿, 腳, etc}` (Body)
   - `{衣服}` (Clothing)
   - `{臉部動作}` (Facial Action / Looking)
   - `{身體動作}` (Body Action / Pose)
   - `{背景, 鏡頭角度}` (Background / Camera)
   - `{lora}` (LoRA / Addons)
3. **Common Prompt**: A special locked card at the top. The editor prepends its content to the corresponding categories of all other categories during compilation.
4. **Drag-and-Drop Sorting**: Drag handles on each prompt block card to adjust their execution order.
5. **Card Operations**: 
   - `Copy Text`: Copies the compiled prompt of that specific block, formatted with each non-empty category on its own line, separated by an empty line (`\n\n`).
   - `Copy ADetailer`: Copies the compiled prompt of that specific block, formatted as a single line, containing only `quality`, `style`, `face`, `faceAction`, and `lora` categories.
   - `Clone`: Duplicates the card block.
   - `Delete`: Deletes the card block.
6. **Workspace Export/Import**: Download/upload the entire state (JSON) to save work.
7. **A1111 Batch Export**: Combines and compiles all active blocks into a multi-line string (one block per line, categories joined with `, `) for A1111 script input.
8. **Collapse/Expand Mechanics**:
   - Individual category collapse button `[-]` / `[+]` on each category input box.
   - Card collapse button (collapse all categories inside a card, showing only a preview summary).
   - Global card collapse controls (collapse/expand all blocks).
   - Global category comparison filter (e.g. click "Clothing" to collapse all other categories in all cards, showing only the "Clothing" field for quick comparative review).
9. **A1111 Parameters & Resolution Controls**:
   - Each card has a Resolution selector dropdown (e.g. `w1024 x h1024`, `w1344 x h768`) to set custom sizes for batch export.
   - Global and card-level A1111 parameter blocks (Negative Prompt, Steps, CFG Scale, Sampler, Seed). Card-level parameters are folded inside an accordion details view.
   - **Global ADetailer Toggle**: A global setting to enable/disable ADetailer face fixing for all generation requests.
   - **Prefix `=` Overrides**: If a positive prompt category or negative prompt starts with `=`, it completely overwrites the global counterpart rather than merging. For numerical/name parameters, adding `=` as the entire value blocks inheritance (hides the flag).
10. **Prompt Comments**: Supports C-style inline (`/* ... */`) and line (`//`) comments within any prompt text box. Comments are automatically stripped during compilation before being sent to the A1111 API or copied to the clipboard.

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
    faceAction: "",
    bodyAction: "",
    background: "",
    lora: ""
  },
  commonParams: {
    negativePrompt: "",
    steps: "",
    cfgScale: "",
    samplerName: "",
    seed: "",
    enableAdetailer: true
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
      resolution: "",
      categories: {
        quality: "",
        style: "",
        character: "",
        face: "",
        body: "",
        clothes: "",
        faceAction: "",
        bodyAction: "",
        background: "",
        lora: ""
      },
      params: {
        negativePrompt: "",
        steps: "",
        cfgScale: "",
        samplerName: "",
        seed: ""
      }
    }
  ],
  activeCompareCategory: null // null | 'quality' | 'style' | ...
};
```

### 3.3 Compilation Logic
For each block, compile a final prompt string:
1. Iterate through categories in the specified order: `quality`, `style`, `character`, `face`, `body`, `clothes`, `faceAction`, `bodyAction`, `background`, `lora`.
2. For each category `key`:
   - Let `commonVal = state.commonPrompt[key]`
   - Let `blockVal = block.categories[key]`
   - If `blockVal` starts with `=` (after trimming): completely overwrite with the remainder of `blockVal` (ignoring `commonVal`).
   - Else if both have text: join them with a comma `commonVal + ", " + blockVal`.
   - Else: use whichever has text.
3. Join the non-empty categories using the requested separator:
   - For **Individual Clipboard Copying**: join using `\n\n` (double newline) to display each category on its own line.
   - For **ADetailer (Face Detailer) Copying**: compiles only `quality`, `style`, `face`, `faceAction`, `bodyAction`, and `lora` categories, and joins them using `, `.
   - Resolution and parameters are **EXCLUDED** from individual/ADetailer clipboard copies to keep prompts clean.
4. For **Batch Exporting (A1111 Textbox format)**:
   - Compile positive prompt as above, joined with `, `.
   - Append negative prompt parameter: `--negative_prompt "[neg]"`. If block negative prompt starts with `=`, it overwrites the global one. Otherwise, it merges them with `, `.
   - Append other parameters (`--steps`, `--cfg_scale`, `--sampler_name`, `--seed`) using the card values if provided, falling back to global values. Prefixing card values with `=` completely overrides the global values (a lone `=` skips/disables the flag).
   - Append resolution flags: `--width [w] --height [h]` if block resolution is selected.

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

## 6. A1111 API Connection & Generation Specs

### 6.1 Network & API endpoints
- **API URL Configuration**: Configured via a text input in the main header (default: `http://127.0.0.1:7860`).
- **Connection Status**: Pings `GET /sdapi/v1/sd-models` to update connection dot indicator (🟢 Online / 🔴 Offline).
- **Generation Endpoint**: Sends `POST /sdapi/v1/txt2img` with JSON payload containing prompt, negative prompt, steps, cfg scale, sampler name, seed, width, and height. If `enableAdetailer` is true, it also appends an `alwayson_scripts` payload using the Minimum configuration and `face_yolov8n.pt` model, populated with the block's Face Detailer prompt.

### 6.2 Generation Actions & Flow
- **Card-level Generation**: A "🎨 產圖" button on each expanded card. Displays loading/progress state when clicked.
- **Draft Generation**: A "🖍️ 草稿" button on each expanded card. Injects `<lora:sdxl_lightning_8step_lora:1>` into the prompt (and ADetailer prompt) and overrides parameters with `steps = 8` and `cfg_scale = 1` for rapid testing.
- **Global Batch Generation**: A "⚡ 批次生成" button in the header that generates all active blocks sequentially.
- **Queue Control**: Prevents concurrent requests by processing generations in a sequential queue.

### 6.3 Local Image Storage (IndexedDB)
- **Database Schema**: Stored in a database `PromptSetEditorDB` under object store `images` with keys `${blockId}_${timestamp}` containing:
  - `blockId` (string)
  - `timestamp` (number)
  - `base64Data` (string, raw PNG data url)
  - `paramsSnapshot` (object containing categories, params, resolution, and `isDraft` flag at the time of generation)
- **Automatic Pruning**:
  - Max 10 images stored per block card.
  - Orphaned images (where `blockId` is not present in `state.blocks`) are deleted on startup and on JSON workspace import.
  - Card deletion triggers immediate removal of its images from IndexedDB.

### 6.4 Lightbox Modal (Click to Enlarge)
- Shows high-res image on the left.
- Shows prompt and parameter snapshot on the right. (Adds a `[草稿]` badge if generated as a draft).
- Buttons to `💾 下載圖片` (Save to file) and `🔄 套用設定到此卡片` (restores categories/params snapshot back to card).

---

## 7. Development Plan & Verification

1. **Phase 1: Basic Structure**: Build the single `index.html` file, standard styles, state load/save mechanics (Completed).
2. **Phase 2: Editor Card Rendering**: Render the Common Prompt card and standard prompt cards dynamically from the state. Add field editing, adding cards, cloning, and deleting (Completed).
3. **Phase 3: Drag & Drop**: Integrate SortableJS to enable card reordering (Completed).
4. **Phase 4: Collapsing & Compare Views**: Implement block and category level toggle buttons and the global comparison selector (Completed).
5. **Phase 5: Import / Export / Clipboard**: Build JSON download/upload, copy block text, and batch txt compile modal (Completed).
6. **Phase 6: A1111 API Call & Lightbox**: Implement A1111 API inputs, status pinger, txt2img calling queue, IndexedDB image manager, embedded thumbnail row, parameters snapshot restore, and lightbox modal overlay.
7. **Verification Checklist**:
   - Verify compiler prepends common prompts and supports `=` override prefix.
   - Verify resolution dropdown sets size flags correctly in batch export.
   - Verify API status indicator shows 🟢 when local A1111 is running and 🔴 when offline.
   - Verify card generation compiles prompts/params correctly and sends POST request to `/sdapi/v1/txt2img`.
   - Verify generated images are saved in IndexedDB and displayed inside the card.
   - Verify clicking thumbnail launches lightbox modal showing correct parameters snapshot.
   - Verify `🔄 套用設定` restores categories and params back to card.
   - Verify importing workspace JSON or deleting card cleans up orphaned image records in IndexedDB.

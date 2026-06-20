# 草稿 (Draft) 功能實作計畫

此計畫旨在為 Prompt Set Editor 增加一個「草稿」按鈕，讓使用者能快速以低步數與特定 Lora 產圖測試。

## Proposed Changes

### [Prompt Set Editor UI & Logic]

#### [MODIFY] index.html
- **DOM/UI**: 
  - 在卡片的 `card-actions` 區塊，在「🎨 產圖」按鈕旁邊新增一個「🖍️ 草稿」按鈕。
- **排程邏輯**: 
  - 修改 `enqueueGeneration` 與 `processQueue` 支援傳遞 `isDraft` 參數。
  - 確保產圖佇列 (Queue) 能正確辨識並區分「一般產圖」與「草稿產圖」。
- **產圖邏輯 (`triggerBlockGeneration`)**:
  - 當 `isDraft` 為 true 時：
    - 將 `<lora:sdxl_lightning_8step_lora:1>` 附加在正向提示詞的尾端。
    - 覆寫 `steps = 8`。
    - 覆寫 `cfg_scale = 1`。
  - 將 `isDraft` 旗標存入產圖的快照 (snapshot) 中。
- **歷史紀錄渲染 (`loadAndRenderGallery` & `openLightbox`)**:
  - 在歷史縮圖右下角顯示「草稿」小標籤 (Badge)。
  - 點開大圖的詳細資訊區塊，標示此圖為草稿，並如實反映覆寫後的參數。

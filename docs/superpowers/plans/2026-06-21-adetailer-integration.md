# ADetailer API 整合實作計畫

此計畫旨在將 ADetailer 的 API 整合至產圖流程中，在呼叫 A1111 `txt2img` API 時，自動帶入 ADetailer 的最簡設定檔 (Minimum configuration)。

## User Review Required

- 根據 ADetailer 的文件，最簡設定的 `ad_model` 預設會是 `face_yolov8n.pt`。這是你要使用的模型沒錯吧？

## Open Questions

- **是否需要全域開關 (Toggle)**？  
  ADetailer 會增加算圖時間，你希望：
  1. **永遠開啟**：每一次點擊「產圖」或「草稿」都強制包含 ADetailer 參數。
  2. **加上開關**：在畫面的最上方 (或全域設定區) 加一個「啟用 ADetailer」的 Checkbox，打勾時才會帶入 ADetailer 參數。  
  *(推薦選項 2，這樣如果偶爾不需要修臉時可以關掉省時間)*

## Proposed Changes

### [Prompt Set Editor UI & Logic]

#### [MODIFY] index.html
- **重構邏輯**: 
  - 將目前 `copyBlockADetailerText` 中組合 Face Detailer 提示詞的邏輯抽離成獨立的 `compileADetailerPrompt(block, isDraft)` 函式。
  - 在組合邏輯中，加上前置 `=` 符號覆寫全域變數的支援 (原本的 `copyBlockADetailerText` 似乎漏掉了 `=` 的支援，順便補上)。
- **產圖邏輯 (`triggerBlockGeneration`)**:
  - 在發送給 A1111 的 `payload` 中，加入 `alwayson_scripts` 物件。
  - 依照 ADetailer Minimum API 規範，帶入 `args: [{ ad_model: "face_yolov8n.pt", ad_prompt: compileADetailerPrompt(block, isDraft) }]`。
- **UI 調整 (視 Open Question 決定)**:
  - 若需要開關，則在全域參數區塊新增一個 `<input type="checkbox" id="enable-adetailer" checked>`。

## Verification Plan

### Manual Verification
- 複製現有的卡片並點擊「產圖」，觀察 A1111 終端機是否有顯示 ADetailer 的運作進度 (Detection & Inpainting)。
- 確認 `copyBlockADetailerText` 按鈕是否依然能正常複製。

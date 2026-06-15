# GetaJob - AI 智慧求職與客製化求職信助手：專案大綱

本專案旨在開發一個本機運行的 Web 應用程式，結合網頁爬蟲、瀏覽器書籤小工具 (Bookmarklet) 與 Gemini AI，協助求職者高效管理職缺、分析履歷契合度，並生成量身打造的求職信 (Cover Letter)。

---

## 1. 系統架構圖 (Architecture Overview)

```mermaid
graph TD
    User([使用者]) -->|上傳履歷/操作 UI| WebUI[Next.js React 前端]
    Bookmarklet[瀏覽器書籤小工具] -->|傳送職缺 HTML/純文字| API_Bookmarklet[pages/api/scrape/bookmarklet.js]
    
    subgraph 本機後端 (Node.js Next.js API Routes)
        API_Jobs[pages/api/db/jobs.js]
        API_Parser[pages/api/ai/parse-resume.js]
        API_Analyze[pages/api/ai/analyze-job.js]
        API_Letter[pages/api/ai/generate-cover-letter.js]
        API_Scraper[pages/api/scrape/104.js]
    end

    WebUI --> API_Jobs
    WebUI --> API_Parser
    WebUI --> API_Analyze
    WebUI --> API_Letter
    WebUI --> API_Scraper
    API_Bookmarklet --> SQLite[(SQLite 資料庫)]
    API_Jobs --> SQLite

    API_Parser -->|呼叫 SDK| Gemini[Gemini API]
    API_Analyze --> Gemini
    API_Letter --> Gemini
```

---

## 2. 功能模組設計 (Core Modules)

### 2.1 履歷管理與 AI 解析
- **功能簡述**：支援上傳 PDF 或文字格式履歷，呼叫 Gemini 提取結構化 JSON 資料。
- **資料儲存**：快取解析後的學經歷與技能，避免重複呼叫 AI 消耗 Token。

### 2.2 職缺爬蟲與書籤匯入
- **自動爬蟲**：針對 104、CakeResume 提供關鍵字與地區自動爬取。
- **書籤匯入 (Bookmarklet)**：使用者點擊瀏覽器書籤，一鍵將 LinkedIn、1111 等平台的當前職缺頁面解析並發送回本機。
- **手動新增**：支援手動輸入職稱、公司、工作描述 (Job Description)。

### 2.3 職缺契合度分析 (Match Score)
- **分析內容**：比對求職者履歷與職缺要求的技能、經驗。
- **輸出指標**：契合度百分比 (0-100%)、優勢 (Matches)、待補足技能/劣勢 (Gaps)。

### 2.4 AI 客製化 Cover Letter 生成
- **智慧生成**：結合履歷優勢與職缺描述，撰寫精準、專業的求職信。
- **線上編輯**：提供 Markdown 編輯器，使用者可自由調整內容並一鍵複製。

### 2.5 求職看板 (Kanban)
- **狀態管理**：包含「感興趣 (Interested)」、「已投遞 (Applied)」、「面試中 (Interviewing)」、「已錄取 (Offered)」、「不考慮/婉拒 (Rejected)」。

---

## 3. 資料庫結構設計 (Database Schema)

使用 SQLite 作為輕量化本地儲存，包含以下資料表：

### `settings` (系統設定)
- `key` (TEXT, 主鍵): 設定名稱 (例如 `gemini_api_key`)
- `value` (TEXT): 設定值

### `resumes` (履歷資料)
- `id` (INTEGER, 主鍵, 自增)
- `file_name` (TEXT): 履歷原始檔名
- `raw_text` (TEXT): 履歷純文字內容
- `parsed_json` (TEXT): 解析後的結構化 JSON（包含姓名、聯絡方式、學歷、經歷、技能）
- `is_active` (INTEGER): 是否為當前選用履歷 (1/0)
- `created_at` (DATETIME): 建立時間

### `jobs` (職缺資料)
- `id` (INTEGER, 主鍵, 自增)
- `title` (TEXT): 職缺名稱
- `company` (TEXT): 公司名稱
- `location` (TEXT): 工作地區
- `salary` (TEXT): 薪資待遇
- `url` (TEXT): 職缺連結
- `description` (TEXT): 工作描述
- `source` (TEXT): 來源平台 (104, CakeResume, LinkedIn, 1111, Manual)
- `match_score` (INTEGER): 契合度評分 (0-100)
- `match_analysis` (TEXT): 契合度優勢與劣勢分析 (JSON 或 Markdown)
- `status` (TEXT): 目前狀態 (Interested, Applied, Interviewing, Offered, Rejected)
- `cover_letter` (TEXT): 已生成的求職信內容
- `created_at` (DATETIME): 建立時間

---

## 4. API 端點規劃 (API Endpoints)

| 端點 | 方法 | 功能說明 |
| :--- | :--- | :--- |
| `/api/settings` | GET / POST | 讀取與更新設定（如 Gemini 金鑰） |
| `/api/resumes` | GET / POST / DELETE | 讀取、上傳與刪除履歷 |
| `/api/resumes/parse` | POST | 呼叫 Gemini 解析特定履歷並結構化 |
| `/api/jobs` | GET / POST / PUT / DELETE | 職缺的增刪查改與狀態更新 |
| `/api/scrape/104` | GET | 執行 104/CakeResume 自動爬蟲 |
| `/api/scrape/bookmarklet` | POST | 接收書籤小工具傳回的職缺資料 |
| `/api/ai/analyze-job` | POST | 計算職缺與履歷的契合度 |
| `/api/ai/generate-cover-letter` | POST | 生成客製化 Cover Letter |

---

## 5. 開發步驟與時程

1. **第一階段：專案初始化與資料庫設定** (Next.js 專案建立、SQLite 連線與 Schema 初始化)
2. **第二階段：履歷解析與 Gemini AI 整合** (實作 PDF 解析與 Gemini 履歷結構化、Cover Letter 生成 API)
3. **第三階段：職缺爬蟲與書籤小工具實作** (完成 104 自動爬蟲與跨平台 Bookmarklet 腳本)
4. **第四階段：前端 UI 開發** (採用 Premium 暗色毛玻璃風格，開發職缺列表、Kanban 看板、Cover Letter 編輯器)
5. **第五階段：系統整合與驗證** (端到端測試、效能優化與 API 金鑰安全處理)

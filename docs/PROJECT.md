# Project: GetaJob

## Architecture
GetaJob is a local-running Web app implemented in Next.js (React frontend + API routes backend). It uses SQLite for persistent storage, `@google/genai` SDK for Gemini API integration, and a Chrome Extension to clip job descriptions.

### Core Components
- **Next.js Frontend**: Bauhaus-inspired UI (cream background, thin borders, Morandi colors, offset shadows). Features Resume Upload, Kanban Board, Settings Panel, and AI Analysis/Cover Letter Modal.
- **Next.js Backend (API Routes)**:
  - `/api/settings`: Read/write key-value settings (e.g. Gemini key, target region, target platforms).
  - `/api/resumes`: CRUD operations for PDF/JSON resumes. Includes a PDF text extractor.
  - `/api/resumes/parse`: AI-driven parser transforming raw resume text into structured JSON.
  - `/api/jobs`: CRUD and status updates for clipped/manually created job listings.
  - `/api/scrape/extension`: Handles incoming POST request from the Chrome Extension with scraped job info.
  - `/api/ai/analyze-job`: Analyzes fit between a specific resume and job listing (stores score, pros/cons in `job_analyses`).
  - `/api/ai/generate-cover-letter`: Generates tailored Cover Letter based on the fit analysis.
- **SQLite Database**: Located at `~/.getajob/getajob.db`. Automatically initialized if missing. Tables: `settings`, `resumes`, `jobs`, `job_analyses`.
- **Chrome Extension**: Scrapes DOM of job listings (104, CakeResume, Indeed, LinkedIn) and sends payload to the Next.js API.
- **Gemini Free Tier Wrapper**: Rate limiter (15 RPM), retry with exponential backoff and jitter, and DB-backed caching.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Test Suite Setup (E2E) | Create test infrastructure (`TEST_INFRA.md`), test harness, and Tiers 1-4 test cases. Publish `TEST_READY.md`. | None | PLANNED |
| 2 | Project Setup & DB Layer | Next.js setup with Morandi/Bauhaus variables, SQLite schema initialization, and API routes for `settings` & `jobs`. | None | PLANNED |
| 3 | Resume Upload & AI Parsing | PDF drag-and-drop, server-side pdf-parse, Gemini structured resume JSON parser, active resume management. | M2 | PLANNED |
| 4 | Settings & Rate Limiter | Settings panel, Gemini Rate-limiter (15 RPM bucket), exponential backoff, database cache wrapper. | M2, M3 | PLANNED |
| 5 | Chrome Extension & Clipping API | CORS-enabled extension API `/api/scrape/extension`, scraping scripts for 104, CakeResume, Indeed, LinkedIn. | M2, M4 | PLANNED |
| 6 | Kanban Board & AI Copilot | Bauhaus Kanban Board (optimistic drag-and-drop), Match Analysis & Cover Letter generator with MD editor. | M3, M4, M5 | PLANNED |
| 7 | E2E Verification & Hardening | Phase 1: Pass 100% of E2E test suite. Phase 2: Adversarial Coverage Hardening (Tier 5). Add `start.bat`. | M1, M6 | PLANNED |

## Interface Contracts
### Chrome Extension ↔ Next.js API (`/api/scrape/extension`)
- **Method**: POST
- **Request Body**:
  ```json
  {
    "title": "Software Engineer",
    "company": "Tech Corp",
    "location": "Taipei, Taiwan",
    "salary": "NT$ 80,000 - 100,000 / month",
    "url": "https://www.104.com.tw/job/...",
    "description": "Job requirements...",
    "source": "104"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "jobId": 123
  }
  ```
- **Error Response**: `400 Bad Request` if `title` or `company` is missing.

### AI Fit Analysis API (`/api/ai/analyze-job`)
- **Method**: POST
- **Request Body**:
  ```json
  {
    "jobId": 123,
    "resumeId": 45
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "match_score": 85,
    "match_analysis": {
      "advantages": ["React", "TypeScript", "Node.js"],
      "gaps": ["Docker", "AWS"]
    }
  }
  ```

### AI Cover Letter API (`/api/ai/generate-cover-letter`)
- **Method**: POST
- **Request Body**:
  ```json
  {
    "jobId": 123,
    "resumeId": 45
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "cover_letter": "Dear Hiring Manager,\n\nI am writing to express my interest..."
  }
  ```

## Code Layout
```
/
├── .agents/                 # Agent metadata
├── public/                  # Static assets
├── src/                     # Source directory
│   ├── components/          # React components (Bauhaus cards, Kanban, Settings, etc.)
│   ├── lib/                 # Shared logic (SQLite connection, Rate Limiter, Gemini wrapper)
│   ├── pages/               # Next.js Pages
│   │   ├── api/             # API routes
│   │   │   ├── ai/          # AI endpoints
│   │   │   ├── db/          # Database endpoints
│   │   │   ├── scrape/      # Scraper/extension endpoints
│   │   │   └── settings.js  # Settings endpoint
│   │   └── index.js         # Main UI dashboard
│   └── styles/              # Global styles and variables (Bauhaus variables)
├── extension/               # Chrome Extension
│   ├── manifest.json
│   ├── content.js
│   ├── background.js
│   ├── popup.html
│   └── popup.js
├── tests/                   # E2E Test suite
├── package.json
└── start.bat                # One-click startup script
```

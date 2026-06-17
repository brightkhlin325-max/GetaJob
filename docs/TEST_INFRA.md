# GetaJob E2E Testing Infrastructure

This document defines the E2E Testing Infrastructure for GetaJob. It outlines the environment configuration, test runner setup, directory layout, mock servers, and the test case matrices for Tiers 1-4.

---

## 1. Directory Structure

The E2E testing resources and test specifications are placed in the `/tests` folder at the project root:

```text
/tests/
├── e2e/                             # Playwright E2E spec files
│   ├── tier1_feature_coverage/      # F1-F6 happy path feature coverage tests
│   │   ├── resumes.spec.js          # Resume drag-and-drop & list (F1)
│   │   ├── extension.spec.js        # Chrome Extension CORS API (F2)
│   │   ├── settings.spec.js         # Settings config (F3)
│   │   ├── ai_analysis.spec.js      # Fit score & cover letter generator (F4)
│   │   ├── kanban.spec.js           # Bauhaus Kanban columns & cards (F5)
│   │   └── startup.spec.js          # Startup script checking (F6)
│   ├── tier2_boundary_corner/       # Edge cases, limit checks & rate limit errors
│   │   ├── resumes_boundary.spec.js
│   │   ├── extension_boundary.spec.js
│   │   ├── settings_boundary.spec.js
│   │   ├── ai_analysis_boundary.spec.js
│   │   ├── kanban_boundary.spec.js
│   │   └── startup_boundary.spec.js
│   ├── tier3_cross_feature/         # Cross-feature combinations (7 cases)
│   │   └── cross_feature.spec.js
│   └── tier4_real_world/            # Real-world user workflow scenarios (5 cases)
│       ├── scenario_onboarding.spec.js
│       ├── scenario_multi_resume.spec.js
│       ├── scenario_api_outage.spec.js
│       ├── scenario_bulk_analysis.spec.js
│       └── scenario_fresh_start.spec.js
├── fixtures/                        # Statically structured mock data
│   ├── resumes/                     # Raw text and PDF resumes
│   │   ├── resume_john_react.pdf    # PDF containing frontend react experience
│   │   ├── resume_sarah_python.pdf  # PDF containing backend Django experience
│   │   └── invalid_format.docx      # Unsupported document extension
│   ├── scraped_jobs/                # JSON payloads from the Chrome extension
│   │   ├── 104_job.json
│   │   ├── cakresume_job.json
│   │   ├── linkedin_job.json
│   │   └── missing_required.json    # Payload missing 'title' or 'company'
│   └── gemini_responses/            # Gemini structured mock responses
│       ├── parse_resume_react.json
│       ├── parse_resume_python.json
│       ├── analyze_react_ok.json
│       └── cover_letter_ok.json
├── helpers/                         # Infrastructure support scripts
│   ├── db-helper.js                 # SQLite database clean & seed utility
│   └── gemini-mock.js               # Local mock Gemini HTTP server
└── package.json                     # Shared devDependencies for the E2E test suite
```

---

## 2. Playwright Configuration (`playwright.config.js`)

To prevent SQLite database locking conflicts during E2E runs, the test suite must execute sequentially with the worker limit set to 1. The test runner uses `getajob_test.db` to isolate tests from production user data.

```javascript
// playwright.config.js
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Crucial for SQLite single-writer database consistency
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    env: {
      NODE_ENV: 'test',
      GETAJOB_ENV: 'test',
      GETAJOB_DB_PATH: path.join(
        process.env.USERPROFILE || process.env.HOME || os.homedir(),
        '.getajob',
        'getajob_test.db'
      ),
      GEMINI_BASE_URL: 'http://localhost:8089',
    },
  },
});
```

---

## 3. Database & Gemini API Mocking Strategy

### 3.1 Database Helper (`tests/helpers/db-helper.js`)
To guarantee test isolation, `tests/helpers/db-helper.js` handles schema setup, table truncations, and seeding initial conditions (`settings`, `resumes`, `jobs`, and `job_analyses`).

### 3.2 Gemini API Mock Server (`tests/helpers/gemini-mock.js`)
Because API wrappers operate on the server side, E2E browser routes cannot mock Gemini requests using simple client-side interceptors. GetaJob hosts a mock Gemini API server on port `8089` during test execution. It logs invocations and supports configurable test states:
- `forceServerError = true`: Returns HTTP 503 Service Unavailable to test retry mechanisms.
- `forceRateLimit = true`: Returns HTTP 429 Too Many Requests to test the token bucket rate limiter and backoff pacing.

---

## 4. Test Case Matrix (Tiers 1-4)

### 4.1 Tier 1: Feature Coverage (Happy Paths)

#### F1: Resume Import & Management
| Test ID | Title | Input | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **F1-T1-1** | Upload Valid Resume PDF | `resume_john_react.pdf` | 1. Navigate to Resume Manager UI.<br>2. Drag and drop file into upload zone.<br>3. Wait for parser. | Resume appears in list; UI displays extracted structured fields. |
| **F1-T1-2** | Toggle Active Resume | Resumes A (active) and B (inactive) | 1. Open Resume Manager.<br>2. Click "Set Active" on B. | Resume B gains "Active" badge; SQLite database toggles `is_active` fields. |
| **F1-T1-3** | Delete Resume | Resume A | 1. Click "Delete" on Resume A and confirm. | Resume is removed from UI and SQLite database. |
| **F1-T1-4** | List Multiple Resumes | Pre-seeded resumes | 1. Navigate to Resume Manager. | All resumes are listed with proper metadata. |
| **F1-T1-5** | Edit Structured Fields | Edited text inputs | 1. Click "Edit" on resume card.<br>2. Modify fields and click "Save". | Updated values persist in UI and SQLite database. |

#### F2: Chrome Extension clipping & API
| Test ID | Title | Input | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **F2-T1-1** | Successful Job Clip POST | Valid job JSON payload | 1. Send POST request to `/api/scrape/extension`. | Response: `201 Created` with `{ success: true, jobId }`; job saved as `Interested`. |
| **F2-T1-2** | CORS Preflight OPTIONS | OPTIONS request | 1. Send OPTIONS request with Origin header to extension API. | Headers `Access-Control-Allow-Origin` and methods are present in response. |
| **F2-T1-3** | Job Visible in Kanban | Clipped job | 1. Clip job via API.<br>2. Open Kanban Board dashboard. | Card appears in "Interested" column with correct details. |
| **F2-T1-4** | Mock Scraper on LinkedIn DOM | Mock LinkedIn DOM | 1. Run Content Scraper in mock LinkedIn environment. | Payload parameters (title, company, description, url) are parsed accurately. |
| **F2-T1-5** | Create Job Record Manually | Web form inputs | 1. Click "Add Job Manually".<br>2. Fill details and click save. | Card is added to "Interested" column; SQLite record created. |

#### F3: Settings Management
| Test ID | Title | Input | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **F3-T1-1** | Save Gemini API Key | Valid format key | 1. Enter key in Settings UI.<br>2. Click "Save Settings". | SQLite `settings` table updates `gemini_api_key`; UI indicates success. |
| **F3-T1-2** | Save Target Region | Region choice: "US" | 1. Change region dropdown to "US".<br>2. Save Settings. | SQLite table persists `target_region` = `'US'`; persists on page refresh. |
| **F3-T1-3** | Toggle Platforms | Disable "CakeResume" | 1. Toggle OFF CakeResume.<br>2. Save Settings. | SQLite persists active platforms; GET `/api/settings` returns updated list. |
| **F3-T1-4** | Load Default Settings | Clean settings table | 1. Open settings page. | Inputs show defaults: Blank key, Region = "Taiwan", platforms enabled. |
| **F3-T1-5** | Settings API GET | DB settings | 1. GET request `/api/settings`. | Returns JSON with current configuration with status `200 OK`. |

#### F4: AI Fit Analysis & Cover Letter
| Test ID | Title | Input | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **F4-T1-01** | Fit Analysis Generation | Active resume & job card | 1. Open job card modal.<br>2. Click "Analyze Fit" and wait. | Modal displays match score, advantages, gaps. Record saved in `job_analyses`. |
| **F4-T1-02** | Cover Letter Generation | Job fit analysis exists | 1. Open job card modal.<br>2. Click "Generate Cover Letter" and wait. | Tailored cover letter populated in Markdown editor and persisted in database. |
| **F4-T1-03** | Cover Letter Editing & Save | Appended letter text | 1. Modify cover letter in Markdown editor.<br>2. Click "Save". | Updated cover letter persists in UI and database. |
| **F4-T1-04** | Copy Cover Letter | Populated cover letter | 1. Click "Copy to Clipboard".<br>2. Read clipboard value. | Clipboard text exactly matches the displayed cover letter text. |
| **F4-T1-05** | DB-Backed Caching | Existing analysis | 1. Trigger fit analysis on same job/resume pair twice. | Second analysis completes instantly without invoking mock Gemini API. |

#### F5: Bauhaus Kanban Board & UI
| Test ID | Title | Input | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **F5-T1-01** | Kanban Columns Render | Dashboard load | 1. Navigate to dashboard. | 5 columns are displayed with Bauhaus styling (borders, shadows, titles). |
| **F5-T1-02** | Job Card Layout & Hover | Card in "Interested" | 1. Inspect card elements.<br>2. Hover mouse cursor over card. | Card shows details and score. Card translates `(-2px, -2px)` on hover. |
| **F5-T1-03** | Optimistic Drag-and-Drop Success | Card in "Interested" | 1. Drag card to "Applied" column. | Card moves instantly. PUT request is fired. Database updates status to "Applied". |
| **F5-T1-04** | Board State Persistence | Moved card | 1. Drag card to "Applied" column.<br>2. Reload page. | Card remains in "Applied" column after page reload. |
| **F5-T1-05** | Settings Panel Integration | Settings change | 1. Modify settings and save.<br>2. Reload page. | Settings are saved to database and reflect in UI. |

#### F6: One-click start.bat Script
| Test ID | Title | Input | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **F6-T1-01** | Script Executable | `start.bat` file | 1. Run `start.bat` in a shell. | Script executes without syntax errors. |
| **F6-T1-02** | Auto-DB Initialization | Clean directory | 1. Run `start.bat` with no `~/.getajob` folder. | Script creates folder and initializes SQLite database structure. |
| **F6-T1-03** | Next.js Server Start | Execute script | 1. Run `start.bat`.<br>2. Listen on port 3000. | Next.js server starts and successfully listens on port 3000. |
| **F6-T1-04** | Auto-Open Web UI | Browser run | 1. Run `start.bat`. | Default browser automatically opens `http://localhost:3000`. |
| **F6-T1-05** | Clean Termination | Close signal | 1. Send Ctrl+C to terminal running script. | Server process terminates and releases port 3000. |

---

### 4.2 Tier 2: Boundary & Corner Cases (Error & Edge Cases)

#### F1: Resume Import & Management
| Test ID | Title | Input | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **F1-T2-1** | Upload Non-PDF Format | `invalid_format.docx` | 1. Drag and drop file. | Upload is blocked; UI warns "Only PDF files are supported". |
| **F1-T2-2** | Upload Password-Protected PDF | Encrypted PDF | 1. Upload encrypted file. | Server parser fails; UI shows "Failed to parse password-protected PDF". |
| **F1-T2-3** | Upload Scanned/Empty PDF | PDF without text | 1. Upload textless PDF. | Text extractor returns empty; UI alerts user and prompts for manual entry. |
| **F1-T2-4** | Gemini Parser API Failure | Mock server returns 500 | 1. Upload resume PDF. | System saves raw text, displays warning "AI parser unavailable", enables manual editing. |
| **F1-T2-5** | Upload Large File (Boundary) | 15MB PDF resume | 1. Drag and drop file. | Upload is blocked; UI displays "File size exceeds 10MB limit". |

#### F2: Chrome Extension clipping & API
| Test ID | Title | Input | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **F2-T2-1** | Missing Required Fields | Payload missing title | 1. POST to `/api/scrape/extension` without `title`. | Response: `400 Bad Request` with validation error; database unchanged. |
| **F2-T2-2** | Missing Optional Fields | Payload missing location | 1. POST to `/api/scrape/extension` with empty location. | Response: `201 Created`; card renders without crashing. |
| **F2-T2-3** | XSS Payload Sanitization | `<script>` in description | 1. POST description with script tag.<br>2. Open card in UI. | Script tag is rendered as plain text/escaped HTML safely; no execution. |
| **F2-T2-4** | Duplicate Job Clip URLs | Sequential identical URL POSTs | 1. POST job payload twice. | Idempotency preserved (duplicate ignored or record updated). |
| **F2-T2-5** | Broken Job Board DOM Layout | Missing elements in DOM | 1. Scrape broken mock DOM layout. | Scraper handles missing selectors gracefully; falls back to "N/A" values. |

#### F3: Settings Management
| Test ID | Title | Input | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **F3-T2-1** | Empty Gemini API Key | Blank key | 1. Clear key and save.<br>2. Click "Analyze Fit" in Kanban. | Key is set to empty; fit analysis blocks request and shows warning modal. |
| **F3-T2-2** | Platform Exclusion Enforcement | Indeed disabled | 1. Disable Indeed platform in Settings.<br>2. Trigger clip on Indeed page. | Extension pop-up blocks request, stating Indeed is disabled in GetaJob. |
| **F3-T2-3** | SQL Injection in Input Fields | `' OR '1'='1` payload | 1. Enter SQL injection payload in inputs.<br>2. Save settings. | Values stored literally; SQL statement remains secure due to parameterized queries. |
| **F3-T2-4** | Concurrent Settings Updates | Rapid sequential POSTs | 1. Send concurrent settings requests. | Database executes transactions sequentially; last write wins without locks. |
| **F3-T2-5** | Invalid Platform Payload JSON | `{"target_platforms": "str"}` | 1. POST invalid data schema. | Response: `400 Bad Request`; database settings unmodified. |

#### F4: AI Fit Analysis & Cover Letter
| Test ID | Title | Input | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **F4-T2-01** | Backend Rate Limiter Throttling | 16 distinct requests | 1. Fire 16 requests to `/api/ai/analyze-job` within 10s. | First 15 succeed (200 OK); 16th call is throttled (429 Too Many Requests). |
| **F4-T2-02** | Upstream 429 Exponential Backoff | Mock configured to 429 twice | 1. Trigger fit analysis in UI.<br>2. Track attempts and delays. | Analysis succeeds; retry backoff delays requests according to rules. |
| **F4-T2-03** | Missing Gemini API Key | API key cleared | 1. Click "Analyze Fit". | Backend returns HTTP 400/401; UI shows banner to configure settings. |
| **F4-T2-04** | Empty or Malformed Input | Empty job description | 1. Trigger fit analysis on empty job text. | API returns validation error or handles gracefully with 0 score without crash. |
| **F4-T2-05** | Multi-Resume Cache Isolation | Resumes A and B | 1. Set A active; analyze Job X.<br>2. Set B active; analyze Job X. | Two separate analyses stored; active resume selection determines score. |

#### F5: Bauhaus Kanban Board & UI
| Test ID | Title | Input | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **F5-T2-01** | Optimistic Update Reversal | Backend fails on PUT | 1. Move card to "Applied" while `/api/jobs` is mocked to fail. | Card moves optimism-style, then reverts to original column; toast error displays. |
| **F5-T2-02** | Rapid Multiple Card Drags | Rapid drag actions | 1. Drag card: Interested -> Applied -> Interviewing in 500ms. | Card settles in "Interviewing"; database reflects final card position. |
| **F5-T2-03** | Extreme Text Overflow | 150-char continuous string | 1. Display job card with long string. | Column width is preserved; text wraps or truncates, keeping layout clean. |
| **F5-T2-04** | Empty Kanban Board | Zero database records | 1. Navigate to dashboard. | Columns display geometric dashed border and placeholder text. |
| **F5-T2-05** | Platform Filter Enforcement | Disabled platform jobs | 1. Disable Indeed in settings.<br>2. Open Kanban board. | Indeed job cards are filtered out or flagged visually. |

#### F6: One-click start.bat Script
| Test ID | Title | Input | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **F6-T2-01** | Port 3000 Conflict | Busy port 3000 | 1. Start background mock on port 3000.<br>2. Run `start.bat`. | Script detects port collision, prints warning, and exits gracefully. |
| **F6-T2-02** | Node.js Environment Missing | Missing PATH variable | 1. Temporarily clear Node path.<br>2. Run `start.bat`. | Script catches missing command, prints instruction to install Node.js. |
| **F6-T2-03** | Missing dependencies | `node_modules` deleted | 1. Delete `node_modules` directory.<br>2. Run `start.bat`. | Script runs `npm install` automatically before starting Next.js. |
| **F6-T2-04** | Existing DB Protection | Existing data records | 1. Run `start.bat` on populated database folder. | Migrations execute safely; existing database contents are fully preserved. |
| **F6-T2-05** | Concurrent script runs | Existing running instance | 1. Execute `start.bat` twice. | Second instance detects active server and terminates to prevent conflicts. |

---

### 4.3 Tier 3: Cross-Feature Combinations (Pairwise Coverage)

| Test ID | Primary Features | Interaction Description | Verification Method |
| :--- | :--- | :--- | :--- |
| **T3-01** | F1 (Settings) × F3 (Extension API) | Extension scraping requests are filtered/validated against active platform configuration in settings. | API returns `400 Bad Request` if platform is disabled; `201 Created` when enabled. |
| **T3-02** | F2 (Resumes) × F4 (AI Fit Analysis) | Swapping the active resume invalidates caches and generates unique analysis records per resume/job pair. | Assert score changes from 45% (Python) to 90% (React) for a frontend job after resume swap. |
| **T3-03** | F3 (Job CRUD) × F5 (Kanban UI) | Dragging a Kanban card triggers an optimistic UI change; network failure causes rollback and error toast. | Intercept `/api/jobs` with 500 error; assert card returns to original column and toast appears. |
| **T3-04** | F4 (Cover Letter) × F5 (Kanban Board) | Modifications made in the modal Markdown editor persist across reloads and update the database analysis record. | Edit letter in editor, save, reload page, and assert text edits are preserved in UI and DB. |
| **T3-05** | F1 (Settings) × F6 (Gemini Wrapper) | Missing Gemini API key in settings short-circuits the AI wrapper, preventing api calls and alerting the user. | Clear key in DB, trigger analysis, assert instant validation warning, and verify no mock server hits. |
| **T3-06** | F3 (Extension API) × F5 (Kanban UI) | Background POST requests from the Chrome Extension trigger reactive additions to the Kanban board. | POST job scrape payload; assert "Interested" column card count increments by 1 without refresh. |
| **T3-07** | F4 (AI Analysis) × F6 (Gemini Wrapper) | Cache hits bypass the rate-limiter queue entirely; cache misses are paced strictly by the Token Bucket rate limiter. | Trigger identical analysis 20 times (instant); trigger 5 unique analyses (paced at 15 RPM). |

*Test Command*: `npx playwright test tests/e2e/tier3_cross_feature/`

---

### 4.4 Tier 4: Real-World Application Scenarios

#### T4-01: End-to-End Onboarding & First Job Application
* **Description**: Verifies a new user's onboarding, setting configurations, uploading a resume, clipping a job via extension, running fit analysis, editing/copying the cover letter, and changing the job status on the Kanban board.
* **Command**: `npx playwright test tests/e2e/tier4_real_world/scenario_onboarding.spec.js`

#### T4-02: Multi-Resume Job Alignment (A/B Testing Resumes)
* **Description**: Models a user applying for different job families (frontend vs backend) using multiple resumes. Verifies that switching active resumes correctly recalculates scores, isolates analysis records, and updates caches.
* **Command**: `npx playwright test tests/e2e/tier4_real_world/scenario_multi_resume.spec.js`

#### T4-03: System Resilience & Graceful Degradation under Gemini Outage
* **Description**: Simulates transient and permanent Gemini API outages (429 and 503 HTTP statuses). Verifies that the client exhibits exponential backoff, retries automatically, and degrades gracefully by showing error toasts without crashing.
* **Command**: `npx playwright test tests/e2e/tier4_real_world/scenario_api_outage.spec.js`

#### T4-04: Bulk Job Processing under Gemini Free Tier Constraints
* **Description**: Simulates clipping 12 jobs and running fit analyses on all of them in quick succession. Verifies that the backend rate-limiter bucket spaces requests properly, updates card statuses progressively, and isolates failures.
* **Command**: `npx playwright test tests/e2e/tier4_real_world/scenario_bulk_analysis.spec.js`

#### T4-05: Clean State Recovery, DB Auto-Init & Script Launch
* **Description**: Simulates deleting the database and running the one-click startup script. Verifies database creation, table migrations, port-checking, and the automatic redirect of unconfigured users to the onboarding page.
* **Command**: `npx playwright test tests/e2e/tier4_real_world/scenario_fresh_start.spec.js`

---

## 5. Execution Instructions

The E2E test suite uses Playwright to run tests. Playwright is configured to automatically start and stop both the local Next.js development server and the mock Gemini API server globally. You do not need to start them manually.

### Running All Tests
To run the entire E2E test suite:
```bash
npx playwright test
```

### Running Specific Test Tiers (Feature, Boundary, Cross-Feature, Real-World)
To run a specific test tier, provide the directory path to Playwright:
```bash
# Run Tier 1: Feature Coverage (Feature Tests)
npx playwright test tests/e2e/tier1_feature_coverage/

# Run Tier 2: Boundary & Corner Case Tests
npx playwright test tests/e2e/tier2_boundary_corner/

# Run Tier 3: Cross-Feature Interaction Tests
npx playwright test tests/e2e/tier3_cross_feature/

# Run Tier 4: Real-World Scenario Tests
npx playwright test tests/e2e/tier4_real_world/
```

### Running a Specific Test File
To run a single test file:
```bash
npx playwright test tests/e2e/tier1_feature_coverage/resumes.spec.js
```

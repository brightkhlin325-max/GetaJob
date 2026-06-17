# Original User Request

## Initial Request — 2026-06-15T17:32:55+08:00

Collaboratively revise and expand the `project_outline.md` file in the GetaJob project to incorporate the newly agreed system architecture decisions, with specific contributions from each simulated role (System Architect, QA, Frontend, Backend, User Flow Analyst, Product Manager).

Working directory: d:/github/GetaJob
Integrity mode: development

## Requirements

### R1. Integrate Core Architectural Revisions
The team must modify `project_outline.md` to reflect:
1. **Chrome/Edge Extension**: Replace the browser Bookmarklet design with a dedicated Chrome Extension to bypass CORS and Mixed Content.
2. **SQLite Storage Path**: Define database storage in the user's home directory (e.g., `~/.getajob/getajob.db`) rather than the local project workspace.
3. **Database Schema Optimization**: Associate job analyses with specific resumes using a `job_analyses` table (or proper foreign key structure) to support multi-resume scenarios.
4. **Hybrid Crawler**: Use Axios/Cheerio for simple sites (like 104) and Puppeteer for SPA/anti-bot protected sites (like CakeResume).
5. **AI API Integration**: Use the `@google/genai` SDK with Structured Outputs (`responseSchema`) for robust JSON schema compliance.
6. **UI styling**: Use Vanilla CSS / CSS Modules with variables to establish a dark Glassmorphism design system.

### R2. Add Role-Specific Details
Each role must contribute specialized sections or paragraphs in the outline:
- **Product Manager / User Flow Analyst**: Clearly map out step-by-step user onboarding and main flows.
- **Backend / System Architect**: Define detailed endpoints, schema columns, and error handling for Extension APIs.
- **Frontend**: Outline the visual guidelines, state management for the Kanban board, and UI components.
- **QA Engineer**: Include an explicit verification test matrix for testing API endpoints, database persistence, and browser extensions.

### R3. Diagram Updates
Update the Mermaid diagram(s) in `project_outline.md` to accurately represent the revised architecture (including the Chrome Extension and the new database schema relations).

## Acceptance Criteria

### Content and Completeness
- [ ] `project_outline.md` must mention "Chrome Extension" and replace all occurrences of "Bookmarklet".
- [ ] The database schema section must show `job_analyses` linked to both `jobs` and `resumes`.
- [ ] The crawler section must explicitly state the Axios/Puppeteer hybrid approach.
- [ ] The style section must specify Vanilla CSS/CSS Modules for dark glassmorphism.
- [ ] Role-specific details (onboarding flow, QA test matrix, frontend variables) must be clearly visible in their respective sections.

### Syntactic Correctness
- [ ] The revised `project_outline.md` must be valid Markdown.
- [ ] Any Mermaid diagram blocks must be syntactically valid and render without errors.

## Follow-up — 2026-06-15T17:46:42+08:00

The user has provided critical feedback based on past pain points. Please ensure the team incorporates the following requirements into the revised `project_outline.md`:

1. **Flexible Location and Platform Settings**: The app must make it very easy to switch target job regions (e.g., Taiwan, US) and platforms (e.g., 104, CakeResume, LinkedIn, Indeed) in the UI settings without complex configuration. The crawler and extension should respect these regional preferences.
2. **Resume Import (File Upload)**: The outline must highlight a seamless PDF resume upload and parser feature, avoiding manual copy-paste.
3. **No Generation Constraints**: Ensure the UI settings and backend leverages the Gemini API free tier effectively so that the user is not heavily restricted in cover letter generation limits.

Please confirm these points will be integrated into the outline.

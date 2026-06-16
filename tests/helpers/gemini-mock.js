/**
 * Gemini API Mock Server
 * File: /tests/helpers/gemini-mock.js
 */
const express = require('express');
const app = express();
app.use(express.json());

let requestLogs = [];
let forceRateLimit = false; // Toggled to simulate HTTP 429
let forceServerError = false; // Toggled to simulate HTTP 500/503

// Retrieve mock logs
app.get('/__mock/logs', (req, res) => {
  res.json({ count: requestLogs.length, logs: requestLogs });
});

// Clear mock state
app.post('/__mock/reset', (req, res) => {
  requestLogs = [];
  forceRateLimit = false;
  forceServerError = false;
  res.json({ success: true });
});

// Configure behavior
app.post('/__mock/config', (req, res) => {
  if (req.body.forceRateLimit !== undefined) forceRateLimit = req.body.forceRateLimit;
  if (req.body.forceServerError !== undefined) forceServerError = req.body.forceServerError;
  res.json({ success: true });
});

// Handle structured content generation calls from @google/genai SDK
app.post('/v1beta/models/:model:generateContent', (req, res) => {
  requestLogs.push({
    timestamp: new Date().toISOString(),
    body: req.body,
    url: req.originalUrl
  });

  const prompt = JSON.stringify(req.body);

  if (forceServerError || prompt.includes("fail") || prompt.includes("Company 5") || prompt.includes("Job 5")) {
    return res.status(503).json({
      error: {
        code: 503,
        message: "The service is currently unavailable.",
        status: "UNAVAILABLE"
      }
    });
  }

  if (forceRateLimit) {
    return res.status(429).json({
      error: {
        code: 429,
        message: "Resource has been exhausted (queries per minute limit).",
        status: "RESOURCE_EXHAUSTED"
      }
    });
  }
  if (prompt.includes("structured JSON") || prompt.includes("parsed_json") || prompt.includes("education")) {
    const parsedResume = {
      name: "John Doe",
      contact: { email: "john@example.com", phone: "+886912345" },
      education: [{ school: "NTU", degree: "CS", grad_year: 2024 }],
      experience: [{ company: "Tech Inc", role: "React Intern", duration: "1 year", description: "React code" }],
      skills: ["React", "TypeScript", "TailwindCSS"]
    };
    return res.json({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify(parsedResume) }]
        }
      }]
    });
  }

  // Job Fit Analysis Request
  if (prompt.includes("fit") || prompt.includes("match_score") || prompt.includes("advantages")) {
    let score = 90;
    let advantages = ["Proficient in React", "TypeScript experience match"];
    let gaps = ["No backend node experience listed"];

    if (prompt.includes("Python Specialist") && prompt.includes("React Developer")) {
      score = 45;
      advantages = ["Basic frontend understanding"];
      gaps = ["Missing React framework experience", "Missing TypeScript skills"];
    } else if (prompt.includes("Python Specialist") && prompt.includes("Django Developer")) {
      score = 88;
      advantages = ["Excellent Python knowledge", "Hands-on Django backend experience"];
      gaps = ["No cloud deployment listed"];
    } else if (prompt.includes("React Specialist") && prompt.includes("Django Developer")) {
      score = 40;
      advantages = ["Web architecture awareness"];
      gaps = ["No backend Python experience", "No Django framework skills"];
    } else if (prompt.includes("React Specialist") && prompt.includes("React Developer")) {
      score = 92;
      advantages = ["Extensive React development", "Strong TypeScript matching"];
      gaps = ["No unit testing listed"];
    }

    const analysis = {
      success: true,
      match_score: score,
      match_analysis: {
        advantages,
        gaps
      }
    };
    return res.json({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify(analysis) }]
        }
      }]
    });
  }

  // Cover Letter Generation Request
  if (prompt.includes("cover letter") || prompt.includes("Dear Hiring Manager")) {
    return res.json({
      candidates: [{
        content: {
          parts: [{ text: "# Cover Letter\n\nDear Hiring Manager,\n\nI am writing to express my interest in the position. I have React experience..." }]
        }
      }]
    });
  }

  return res.status(400).json({ error: "No mock matches this prompt." });
});

let server = null;
function startServer(port = 8089) {
  return new Promise((resolve) => {
    server = app.listen(port, () => {
      console.log(`Mock Gemini Server active on port ${port}`);
      resolve(server);
    });
  });
}

function stopServer() {
  if (server) {
    server.close();
  }
}

if (require.main === module) {
  startServer();
} else {
  module.exports = { startServer, stopServer };
}

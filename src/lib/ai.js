import pdfParse from 'pdf-parse';
import db from './db';
import { callLlm } from './gemini';

/**
 * Parse a PDF or text resume buffer and return raw text plus a structured representation.
 * Supports direct Gemini PDF parser and generic LLM-based structuring (OpenAI, Claude, Gemini).
 */
export async function parseResume(buffer, apiKey = null) {
  const isPdf = buffer.toString('utf8', 0, 4) === '%PDF';
  
  let provider = 'gemini';
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_provider');
    if (row && row.value) {
      try {
        provider = JSON.parse(row.value);
      } catch (e) {
        provider = row.value;
      }
    }
  } catch (e) {}

  // Resolve API key for Gemini if not passed but Gemini is the provider
  let activeApiKey = apiKey;
  if (!activeApiKey && provider === 'gemini') {
    try {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key');
      if (row && row.value) {
        try {
          activeApiKey = JSON.parse(row.value);
        } catch (e) {
          activeApiKey = row.value;
        }
      }
    } catch (e) {}
  }

  // 1. Direct PDF extraction with Gemini 2.5 Flash if selected and is PDF
  if (isPdf && provider === 'gemini' && activeApiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const base64Data = buffer.toString('base64');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeApiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              {
                text: "You are a professional resume parser. Please extract the full text content of this resume. Also, extract a structured JSON representation of the candidate's name, contact info, and major sections (Education, Experience, Skills, Projects). Return a JSON object with two fields: 'rawText' (string containing the clean extracted text) and 'structure' (a JSON object with keys 'name', 'contact', and 'sections' where 'sections' contains lists of items under keys 'education', 'experience', 'skills', 'projects'). Please keep any Chinese characters in Traditional Chinese."
              },
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        let content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          // Strip markdown blocks if returned
          content = content.replace(/```json/i, '').replace(/```/g, '').trim();
          const parsedRes = JSON.parse(content);
          return {
            rawText: parsedRes.rawText || '',
            structure: parsedRes.structure || { name: '', contact: '', sections: {} }
          };
        }
      } else {
        const errText = await response.text();
        console.warn(`Gemini direct PDF parser failed: ${response.status} - ${errText}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Gemini direct PDF parser threw error, falling back to pdf-parse:', err);
    }
  }

  // 2. Fallback / OpenAI / Claude path: Extract raw text using pdf-parse first
  let rawText = '';
  if (isPdf) {
    try {
      const data = await pdfParse(buffer);
      rawText = data.text || '';
      if (!rawText.trim()) {
        rawText = buffer.toString('utf8');
      }
    } catch (e) {
      console.warn('pdf-parse failed, treating buffer as plain text');
      rawText = buffer.toString('utf8');
    }
  } else {
    rawText = buffer.toString('utf8');
  }

  // 3. Extract structure using the active LLM
  let structure = { name: '', contact: '', sections: {} };
  try {
    if (rawText.trim()) {
      const prompt = `
You are a professional resume parser.
Analyze the following raw resume text and extract a structured JSON representation of the candidate's name, contact info, and major sections (Education, Experience, Skills, Projects).
Return a JSON object with the keys: "name", "contact", "sections" (where "sections" has keys "education", "experience", "skills", "projects" containing lists of string items).
Please keep any Chinese characters in Traditional Chinese.

Candidate Resume Text:
"""
${rawText}
"""
`;
      const jsonString = await callLlm(prompt, true);
      const cleanJson = jsonString.replace(/```json/i, '').replace(/```/g, '').trim();
      structure = JSON.parse(cleanJson);
      return { rawText, structure };
    }
  } catch (err) {
    console.error('LLM structure extraction failed, falling back to naive parsing:', err);
  }

  // 4. Naive structure extraction as final fallback
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  structure = {
    name: lines[0] || '',
    contact: lines[1] || '',
    sections: {}
  };
  let currentSection = null;
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (/^(education|experience|skills|projects|學歷|工作經歷|經歷|技能|專案)$/i.test(line)) {
      currentSection = line.toLowerCase();
      structure.sections[currentSection] = [];
    } else if (currentSection) {
      structure.sections[currentSection].push(line);
    }
  }
  return { rawText, structure };
}

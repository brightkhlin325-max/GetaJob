import db from './db';

// Helper to get settings from DB
function getSetting(key) {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (row && row.value) {
      try {
        return JSON.parse(row.value);
      } catch (e) {
        return row.value;
      }
    }
  } catch (err) {
    console.error(`Error fetching setting ${key}:`, err);
  }
  return '';
}

export async function callLlm(prompt, isJson = false) {
  const provider = getSetting('ai_provider') || 'gemini';

  if (provider === 'gemini') {
    const apiKey = getSetting('gemini_api_key');
    if (!apiKey) throw new Error('未配置 Gemini API Key。');
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }]
    };
    if (isJson) {
      payload.generationConfig = { responseMimeType: 'application/json' };
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API 呼叫失敗: ${response.status} - ${errText}`);
    }
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  } else if (provider === 'openai') {
    const apiKey = getSetting('openai_api_key');
    if (!apiKey) throw new Error('未配置 OpenAI API Key。');

    const url = 'https://api.openai.com/v1/chat/completions';
    const payload = {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }]
    };
    if (isJson) {
      payload.response_format = { type: 'json_object' };
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API 呼叫失敗: ${response.status} - ${errText}`);
    }
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || '';

  } else if (provider === 'anthropic') {
    const apiKey = getSetting('anthropic_api_key');
    if (!apiKey) throw new Error('未配置 Claude/Anthropic API Key。');

    const url = 'https://api.anthropic.com/v1/messages';
    // Claude JSON guidance instruction since Anthropic doesn't support response_format: 'json_object' natively in this schema
    const finalPrompt = isJson 
      ? `${prompt}\n\nIMPORTANT: Return ONLY a valid JSON object. Do not include any conversational preamble, explanations, or markdown code block formatting like \`\`\`json.`
      : prompt;

    const payload = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{ role: 'user', content: finalPrompt }]
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API 呼叫失敗: ${response.status} - ${errText}`);
    }
    const data = await response.json();
    return data?.content?.[0]?.text || '';
  }

  throw new Error(`未知的 AI 提供商: ${provider}`);
}

/**
 * Analyze matching fit between resume and job description.
 */
export async function analyzeJobFit(resumeText, jobDescription) {
  const prompt = `
You are an expert HR recruiter and career coach.
Analyze the fit between the candidate's resume and the job description.
Return a JSON object with the exact keys: "match_score", "matches", "gaps".
- "match_score": A number between 0 and 100 representing how well the candidate fits.
- "matches": An array of strings describing key strengths or matching qualifications.
- "gaps": An array of strings describing missing qualifications, skills, or experience areas.

Candidate Resume:
"""
${resumeText}
"""

Job Description:
"""
${jobDescription}
"""
`;

  const jsonString = await callLlm(prompt, true);
  // Clean markdown code blocks if the LLM returned it
  const cleanJson = jsonString.replace(/```json/i, '').replace(/```/g, '').trim();
  return JSON.parse(cleanJson);
}

/**
 * Generate a highly customized cover letter in Markdown.
 */
export async function generateCoverLetter(resumeText, jobDescription, company, title) {
  const prompt = `
You are a professional job seeker. Write a tailored, professional, and convincing cover letter (Cover Letter) based on the candidate's resume and target job description.
Highlight relevant experience and skills that directly align with the job requirements. Keep it professional, concise, and structured.
Return the cover letter in Markdown format.

Target Company: ${company}
Target Position: ${title}

Candidate Resume:
"""
${resumeText}
"""

Job Description:
"""
${jobDescription}
"""
`;

  return await callLlm(prompt, false);
}

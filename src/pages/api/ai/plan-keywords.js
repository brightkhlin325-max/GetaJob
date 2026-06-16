import { callLlm } from '../../../lib/gemini';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { query } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }

  try {
    const prompt = `
You are an expert recruitment consultant and career coach.
The candidate has provided their job search thoughts in natural language:
"""
${query}
"""

Analyze their request and help them clarify their target position. Provide:
1. An explanation/clarification in Traditional Chinese (繁體中文) helping them define specific industries, software vs hardware aspects, or role expectations.
2. A list of 3-5 highly optimized search keywords (繁體中文) that they can use to search on job platforms (e.g. 104, CakeResume).
3. Suggested location and industry filters.

Return a JSON object with the exact keys:
- "explanation": "Your guide/explanation string in Traditional Chinese."
- "keywords": ["keyword1", "keyword2", "keyword3"]
- "suggestedFilters": { "location": "Suggested location", "industry": "Suggested industry" }
`;

    const jsonString = await callLlm(prompt, true);
    const cleanJson = jsonString.replace(/```json/i, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJson);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('API Error /api/ai/plan-keywords:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

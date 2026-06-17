export async function formatJobDescription(rawDescription) {
  const prompt = `
You are an expert HR and recruitment assistant.
Your task is to take a raw, dense job description and extract its core information into a highly readable, structured Markdown format.

Instructions:
1. Output ONLY the structured Markdown. Do not add any conversational preamble or explanations.
2. Structure the output strictly using these sections (use the exact emojis and headings):
   - 🎯 主要職責 (Core Responsibilities)
   - 🛠️ 必備技能 (Key Requirements)
   - ✨ 加分條件 (Bonus / Preferred Qualifications)
   - 🏢 公司福利與其他 (Perks & Others) - Only include if explicitly mentioned.
3. Use bullet points for each section. Keep bullet points concise and easy to scan.
4. Translate the summary to Traditional Chinese (zh-TW) if the original text is in English, otherwise use the original language (but headings must remain as requested above).

Raw Job Description:
"""
${rawDescription}
"""
`;

  return await callLlm(prompt, false);
}

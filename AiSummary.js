import { Mistral } from '@mistralai/mistralai';
import dotenv from 'dotenv';
dotenv.config();

// Initialize with primary key
let client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY1 });

const BASIC_PROBLEMS = new Set([
  1, 20, 21, 70, 94, 104, 136, 141, 206
]);

function countRecentSubmissions(calendar) {
  if (!calendar) return 0;
  try {
    const parsed = typeof calendar === 'string' ? JSON.parse(calendar) : calendar;
    const now = Math.floor(Date.now() / 1000);
    const HundredDaysAgo = now - (90 * 24 * 60 * 60);
    return Object.entries(parsed)
      .filter(([timestamp]) => parseInt(timestamp) > HundredDaysAgo)
      .reduce((sum, [, count]) => sum + count, 0);
  } catch {
    return 0;
  }
}

async function tryWithFallback(fn) {
  try {
    return await fn();
  } catch (error) {
    console.log('Primary API key failed, trying fallback key...');
    client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY2 });
    return await fn();
  }
}

export async function GenerateAiSummary(req) {
  // Get pre-formatted data from middleware
  const userData = req.formattedData;
  
  const {
    username,
    totalSolved,
    easySolved,
    mediumSolved,
    hardSolved,
    skills,
    contestStats,
    submissionCalendar,
  } = userData;
  console.log("userdata is ", userData);

  const recentSubmissions = countRecentSubmissions(submissionCalendar);
  const experienceLevel = totalSolved > 300 ? "advanced" :
                         totalSolved > 150 ? "intermediate" : "beginner";

  const prompt = `You are a senior technical interviewer analyzing a LeetCode profile. Provide:

1. A 50-word detailed evaluation considering:
   - Problem distribution (${easySolved}E/${mediumSolved}M/${hardSolved}H)
   - Contest performance (${contestStats?.rating || 'no contest history'})
   - Skill distribution (strongest: ${skills?.advanced?.[0]?.tagName || 'none'})
   - Recent activity (last 90 days: ${recentSubmissions} submissions)

2. 3 specific technical weaknesses for interview preparation

3. 3 personalized problem recommendations:
   - Must be free problems
   - Should match user's experience level (${experienceLevel})
   - Avoid basic problems (${Array.from(BASIC_PROBLEMS).slice(0, 5).join(', ')}...)
   - Format: [Problem#] ProblemName (leetcode.com/problems/url-name)

Respond ONLY with valid JSON in this exact format:
{
  "summary": "detailed evaluation...",
  "weaknesses": ["specific technical gap", "...", "..."],
  "suggestions": ["[#] ProblemName (url)", "...", "..."]
}`;

  const analyzeProfile = async () => {
    const response = await client.chat.complete({
      model: 'mistral-medium',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    let content = response.choices[0]?.message?.content;
    console.log("Raw response content:", content);
    if (!content) throw new Error("Empty response from Mistral");

    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON found");

    const jsonString = content.slice(jsonStart, jsonEnd + 1);
    const result = JSON.parse(jsonString);

    const filteredSuggestions = (result.suggestions || [])
      .filter(s => {
        if (typeof s !== 'string') return false;
        const problemNum = parseInt(s.match(/\[(\d+)\]/)?.[1]);
        return problemNum && !BASIC_PROBLEMS.has(problemNum);
      })
      .slice(0, 3);

    return {
      summary: typeof result.summary === 'string' ? result.summary : `Analysis of ${username}'s profile`,
      weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses.slice(0, 3) : [],
      score: Math.min(100, Math.max(0, Number(result.score) || 0)),
      suggestions: filteredSuggestions
    };
  };

  try {
    return await tryWithFallback(analyzeProfile);
  } catch (err) {
    console.error("Analysis failed:", err.message);
    return {
      summary: `Technical analysis unavailable for ${username || 'unknown user'}`,
      weaknesses: ["System error"],
      score: 0,
      suggestions: []
    };
  }
}

export const aiSummaryHandler = async (req, res) => {
  try {
    const aiSummary = await GenerateAiSummary(req);

    // Destructure from the returned object
    const { summary, weaknesses, score, suggestions } = aiSummary;

    res.json({
      success: true,
      summary,
      weaknesses,
      suggestions,
      score,
      timestamp: req.leetcodeTimestamp
    });
  } catch (error) {
    console.error('AI Summary handler error:', error);
    res.status(500).json({
      success: false,
      error: "Failed to generate AI summary",
      fallbackData: req.formattedData
    });
  }
};

export default GenerateAiSummary;
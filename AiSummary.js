import { Mistral } from '@mistralai/mistralai';
import dotenv from 'dotenv';
dotenv.config();

let client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY1 });

const BASIC_PROBLEMS = new Set([
  1, 20, 21, 70, 94, 104, 136, 141, 206
]);

function countRecentSubmissions(calendar) {
  if (!calendar) return 0;
  try {
    const parsed = typeof calendar === 'string' ? JSON.parse(calendar) : calendar;
    const now = Math.floor(Date.now() / 1000);
    const HundredDaysAgo = now - (100 * 24 * 60 * 60);
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
    client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY2 });
    return await fn();
  }
}

export async function GenerateAiSummary(req) {
  const userData = req.formattedData;
  
  function extractWeakTopics(skills, experienceLevel) {
    const allTopics = [];
  
    for (const [level, tags] of Object.entries(skills)) {
      tags.forEach(tag => {
        allTopics.push({ ...tag, level });
      });
    }
  
    const filtered = allTopics.filter(t => t.problemsSolved < 15);
  
    const experienceFocus = {
      beginner: [
        "Recursion", "Sorting", "Matrix", "Stack", "Queue", "Hash Table", "Array",
        "String", "Two Pointers", "Sliding Window", "Binary Search", "Greedy"
      ],
      intermediate: [
        "Tree", "Binary Tree", "Linked List", "Graph", "BFS", "DFS", "Heap",
        "Backtracking", "Prefix Sum", "Bit Manipulation", "Top K Elements",
        "HashMap + DFS/BFS combos", "Intervals", "Priority Queue"
      ],
      advanced: [
        "Trie", "Union Find", "Segment Tree", "Binary Indexed Tree",
        "Shortest Path", "Topological Sort", "Game Theory", "Rolling Hash",
        "Quickselect", "Monotonic Stack", "Monotonic Queue", "Divide and Conquer",
        "KMP Algorithm", "Heavy-Light Decomposition", "Dynamic Programming on Trees",
        "Minimum Spanning Tree"
      ]
    };
    
  
    const targetSet = new Set(experienceFocus[experienceLevel] || []);
  
    // Pick matching weak topics for user level
    const matched = filtered
      .filter(t => targetSet.has(t.tagName))
      .sort((a, b) => a.problemsSolved - b.problemsSolved)
      .slice(0, 5);
  
    // Fallback: take 5 least solved advanced topics (even if >15)
    if (matched.length < 5) {
      const advancedTopics = allTopics
        .filter(t => experienceFocus.advanced.includes(t.tagName))
        .sort((a, b) => a.problemsSolved - b.problemsSolved)
        .slice(0, 5);
  
      return advancedTopics;
    }
  
    return matched;
  }
  function toTitleCase(str) {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  
  const {
    username,
    profile,
    totalSolved,
    easySolved,
    mediumSolved,
    hardSolved,
    skills,
    contestStats,
    submissionCalendar,
  } = userData;
  if (totalSolved === 0) {
    const rawName = profile.realName || username;
    const DisplayName = toTitleCase(rawName);
    return {
      summary: `${ DisplayName || "This user"} is just starting out on LeetCode. They haven’t solved any problems yet, but it’s a great time to begin the journey! Focus on understanding problem statements, solving Easy-level problems, and building consistent practice habits.`,
      weaknesses: [
        "Lack of exposure to basic data structures like Arrays and Strings.",
        "Unfamiliar with LeetCode’s problem-solving interface and workflow.",
        "No experience with problem-solving strategies or patterns yet.",
        "Needs to develop a daily or weekly problem-solving habit.",
        "Yet to attempt Easy-level problems to gain initial confidence."
      ],
      suggestions: [
        "[1][Easy] Two Sum (leetcode.com/problems/two-sum)",
        "[217][Easy] Contains Duplicate (leetcode.com/problems/contains-duplicate)",
        "[53][Medium] Maximum Subarray (leetcode.com/problems/maximum-subarray)",
        "[121][Easy] Best Time to Buy and Sell Stock (leetcode.com/problems/best-time-to-buy-and-sell-stock)",
        "[20][Easy] Valid Parentheses (leetcode.com/problems/valid-parentheses)"
      ],
    };
  }
  const recentSubmissions = countRecentSubmissions(submissionCalendar);
  const experienceLevel = totalSolved > 300 ? "advanced" :
                         totalSolved > 150 ? "intermediate" : "beginner";
  const weaknesses = skills ? extractWeakTopics(skills, experienceLevel) : [];
  

  const prompt = `  
You are a senior technical interviewer analyzing a LeetCode profile. Provide a JSON response with:

1. A 50-word professional evaluation. Consider:
  - Experience level: ${experienceLevel} (${totalSolved} total problems solved)
  - Problem distribution: ${easySolved} Easy / ${mediumSolved} Medium / ${hardSolved} Hard
  - Recent activity: ${recentSubmissions} submissions in last 100 days
  - Contest rating: ${contestStats?.rating || 'N/A'} (below 1500 = avg, <1600 = decent, >1600 = strong)
  - Skill breakdown (by tag): ${Object.entries(skills).map(([k, v]) => `${k}: ${v}`).join(", ")}

Mention key strengths if Hard/Medium problems or advanced tags (like Dynamic Programming, Backtracking, etc.) are solved often.

2. Rephrase the following list of technical weaknesses into 5 concise sentences, maintaining professional tone:
${weaknesses.map((w, i) => `${i + 1}. ${w.tagName} — ${w.problemsSolved} problems`).join('\n')}

Do not introduce new topics — strictly use only the five weaknesses above. Each sentence should begin with the topic name dont combine all sentence each must be individual string in array like ["sentence 1", "s2", "s3","s4","s5"].

3. Suggest 5 personalized and **free** LeetCode problems:
  - Match the user's experience level (${experienceLevel})
  - Avoid overly basic problems (avoid these: ${Array.from(BASIC_PROBLEMS).join(', ')})
  - Format strictly as: [#][difficulty in leetcode] Problem Name (leetcode.com/problems/url-name)
  - stritcly free problems only

Respond ONLY with valid JSON in this exact format:
{
  "summary": "....",
  "weaknesses": ["...", "...", "..."](strictly enclose individual weakness with "" and separate with commas),
  "suggestions": ["[#problem number inside square brackets][Difficulty level inside square brackets] Problem Name (url)", "...", "..."]
}
`;

  const analyzeProfile = async () => {
    const response = await client.chat.complete({
      model: 'mistral-small', 
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    let content = response.choices[0]?.message?.content;
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
      .slice(0, 5);

    return {
      summary: typeof result.summary === 'string' ? result.summary : `Analysis of ${username}'s profile`,
      weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses.slice(0, 5) : [],
      suggestions: filteredSuggestions
    };
  };

  try {
    return await tryWithFallback(analyzeProfile);
  } catch (err) {
    console.error("Analysis failed:", err.message);
    return; 
  }
}

export const aiSummaryHandler = async (req, res) => {
  try {
    const aiSummary = await GenerateAiSummary(req);

    const { summary, weaknesses, suggestions } = aiSummary;
    res.json({
      success: true,
      summary,
      weaknesses,
      suggestions,
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
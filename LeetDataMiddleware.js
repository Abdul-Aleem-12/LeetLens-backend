import fetch from "node-fetch";
import { pool, logToDB, updateLogStatus } from "./db.js";

const query = `
  query getUserProfile($username: String!) {
    allQuestionsCount {
      difficulty
      count
    }
    matchedUser(username: $username) {
      username
      contributions {
        points
      }
      profile {
        ranking
        realName
        userAvatar
        starRating
      }
      submissionCalendar
      submitStats {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
        totalSubmissionNum {
          difficulty
          count
          submissions
        }
      }
      tagProblemCounts {
        advanced {
          tagName
          problemsSolved
        }
        intermediate {
          tagName
          problemsSolved
        }
        fundamental {
          tagName
          problemsSolved
        }
      }
      badges {
        id
        displayName
        icon
      }
    }
    userContestRanking(username: $username) {
      attendedContestsCount
      rating
      globalRanking
      totalParticipants
      topPercentage
      badge {
        name
        icon
      }
    }
  }
`;

const formatData = (data) => {
  const matchedUser = data.matchedUser;
  return {
    username: matchedUser.username,
    profile: {
      realName: matchedUser.profile.realName,
      avatar: matchedUser.profile.userAvatar,
      starRating: matchedUser.profile.starRating,
      ranking: matchedUser.profile.ranking,
    },
    totalSolved: matchedUser.submitStats.acSubmissionNum[0].count,
    totalQuestions: data.allQuestionsCount[0].count,
    easySolved: matchedUser.submitStats.acSubmissionNum[1].count,
    mediumSolved: matchedUser.submitStats.acSubmissionNum[2].count,
    hardSolved: matchedUser.submitStats.acSubmissionNum[3].count,
    totalSubmissions: matchedUser.submitStats.totalSubmissionNum.reduce((acc, cur) => acc + cur.submissions, 0),
    contributionPoints: matchedUser.contributions.points,
    submissionCalendar: JSON.parse(matchedUser.submissionCalendar),
    badges: matchedUser.badges,
    contestStats: data.userContestRanking
      ? {
          attendedContestsCount: data.userContestRanking.attendedContestsCount,
          rating: data.userContestRanking.rating,
          globalRanking: data.userContestRanking.globalRanking,
          totalParticipants: data.userContestRanking.totalParticipants,
          topPercentage: data.userContestRanking.topPercentage,
          badge: data.userContestRanking.badge,
        }
      : null,
    skills: {
      advanced: matchedUser.tagProblemCounts.advanced,
      intermediate: matchedUser.tagProblemCounts.intermediate,
      fundamental: matchedUser.tagProblemCounts.fundamental,
    },
  };
};

async function fetchLeetCodeData(username) {
  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com",
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({
      query,
      variables: { username },
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch data from LeetCode");
  }

  const result = await response.json();
  
  if (result.errors || !result.data.matchedUser) {
    throw new Error("Username not found – check spelling");
  }

  return result.data;
}

// Cache setup (optional)
const leetcodeCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function leetDataMiddleware(req, res, next) {
  const rawUsername = req.params.username;
  const username = rawUsername.trim();
  const timestamp = new Date();

  // Validation
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    await logToDB(username, "BAD REQUEST (special chars)", timestamp);
    return res.status(400).json({ error: "Only letters, numbers and underscores allowed" });
  }

  if (username.length < 1 || username.length > 25) {
    await logToDB(username, "BAD REQUEST (length)", timestamp);
    return res.status(400).json({ error: "Username must be 1-25 characters" });
  }

  // Check cache
  if (leetcodeCache.has(username)) {
    const { data, timestamp: cacheTime } = leetcodeCache.get(username);
    if (Date.now() - cacheTime < CACHE_TTL) {
      req.leetcodeData = data;
      req.formattedData = formatData(data);
      return next();
    }
  }

  // Fetch fresh data
  await logToDB(username, "ATTEMPT", timestamp);

  try {
    const leetcodeData = await fetchLeetCodeData(username);
    const formatted = formatData(leetcodeData);

    // Update cache
    leetcodeCache.set(username, {
      data: leetcodeData,
      timestamp: Date.now()
    });

    // Attach to request
    req.leetcodeData = leetcodeData;
    req.formattedData = formatted;
    req.leetcodeTimestamp = timestamp;

    await updateLogStatus(username, 'SUCCESS', timestamp);
    next();
  } catch (error) {
    await updateLogStatus(username, 'FETCH FAILED', timestamp);
    console.error('Middleware fetch error:', error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: "Username not found" });
    }
    return res.status(500).json({ error: "Failed to fetch LeetCode data" });
  }
}

// In leetDataMiddleware.js - add this at the end
export const getFormattedUserData = (req) => {
  return {
    data: req.formattedData,
    timestamp: req.leetcodeTimestamp
  };
};
import fetch from "node-fetch";
import GenerateAiSummary from "./AiSummary.js";
import pool from "./db.js"; 

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

async function logToDB(username, status = 'ATTEMPT', timestamp = new Date()) {
  try {
    await pool.query(
      `INSERT INTO search_logs (username, search_time, status) VALUES ($1, $2, $3)`,
      [username, timestamp, status]
    );
  } catch (logErr) {
    console.error('Failed to log attempt:', logErr.message);
  }
}

async function updateLogStatus(username, status, timestamp) {
  try {
    await pool.query(
      `UPDATE search_logs SET status = $1 WHERE username = $2 AND attempted_at = $3`,
      [status, username, timestamp]
    );
  } catch (logUpdateErr) {
    console.warn(`Could not update log status to ${status}:`, logUpdateErr.message);
  }
}

export const fetchUserProfile = async (req, res) => {
  const rawUsername = req.params.username;
  const username = rawUsername.trim();
  const timestamp = new Date();

  // ─── 1. Validate ──────────────────────────────────────────────────────────────
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    await logToDB(username, "BAD REQUEST (special characters)", timestamp);
    return res.status(400).json({ error: "No special characters except '_'" });
  }

  if (username.length < 1 || username.length > 25) {
    await logToDB(username, "BAD REQUEST (size)", timestamp);
    return res.status(400).json({ error: "Username must be between 1 and 25 characters." });
  }

  if (!username || typeof username !== "string") {
    await logToDB(username, "BAD REQUEST", timestamp);
    return res.status(400).json({ error: "Invalid username format" });
  }

  // ─── 2. Log Attempt ────────────────────────────────────────────────────────────
  await logToDB(username, "ATTEMPT", timestamp);

  try {
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
      await updateLogStatus(username, 'LeetCode failure', timestamp);
      return res.status(response.status).json({ error: "Failed to fetch data from LeetCode" });
    }

    const result = await response.json();

    if (result.errors || !result.data.matchedUser) {
      await updateLogStatus(username, 'Cannot find user', timestamp);
      return res.status(400).json({ error: "Username not found – check spelling" });
    }

    const formatted = formatData(result.data);
    const aiSummary = await GenerateAiSummary(formatted);

    await updateLogStatus(username, 'SUCCESS', timestamp);
    return res.json({
      aiSummary,
      userData: formatted,
    });
    

  } catch (error) {
    console.error("Error fetching user profile:", error);
    await updateLogStatus(username, 'Network failure', timestamp);
    return res.status(500).json({ error: "Internal server error. Please try again later." });
  }
};

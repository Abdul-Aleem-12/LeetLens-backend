import fetch from "node-fetch";

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
      // weaknesses: calculateWeaknesses(matchedUser.tagProblemCounts),
      // strengths: calculateStrengths(matchedUser.tagProblemCounts),
    },
  };
};

export const fetchUserProfile = async (req, res) => {
  const username = req.params.username;

  // 1. Input Validation
  if (!username || typeof username !== "string" || username.trim().length === 0) {
    return res.status(400).json({ error: "Invalid username" });
  }

  try {
    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://leetcode.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      body: JSON.stringify({
        query,
        variables: { username: username.trim() },
      }),
    });

    if (!response.ok) {
      // Leetcode returned something other than 200
      return res.status(response.status).json({ error: "Failed to fetch data from LeetCode" });
    }

    const result = await response.json();

    if (result.errors || !result.data.matchedUser) {
      // User doesn't exist
      return res.status(400).json({ error: "Username not found" });
    }

    const formatted = formatData(result.data);
    return res.json(formatted);
  } catch (error) {
    // Could be network error, fetch failure, etc.
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ error: "Internal server error. Please try again later." });
  }
};
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
        reputation
        ranking
        userAvatar
      }
      submissionCalendar
      submitStats {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
      }
      tagProblemCounts {
        advanced {
          tagName
          tagSlug
          problemsSolved
        }
        intermediate {
          tagName
          tagSlug
          problemsSolved
        }
        fundamental {
          tagName
          tagSlug
          problemsSolved
        }
      }
    }
  }
`;

const formatData = (data) => {
  let sendData = {
    username: data.matchedUser.username,
    totalSolved: data.matchedUser.submitStats.acSubmissionNum[0].count,
    totalQuestions: data.allQuestionsCount[0].count,
    easySolved: data.matchedUser.submitStats.acSubmissionNum[1].count,
    totalEasy: data.allQuestionsCount[1].count,
    mediumSolved: data.matchedUser.submitStats.acSubmissionNum[2].count,
    totalMedium: data.allQuestionsCount[2].count,
    hardSolved: data.matchedUser.submitStats.acSubmissionNum[3].count,
    totalHard: data.allQuestionsCount[3].count,
    ranking: data.matchedUser.profile.ranking,
    contributionPoints: data.matchedUser.contributions.points,
    reputation: data.matchedUser.profile.reputation,
    submissionCalendar: JSON.parse(data.matchedUser.submissionCalendar),
    skills: {
      advanced: data.matchedUser.tagProblemCounts.advanced,
      intermediate: data.matchedUser.tagProblemCounts.intermediate,
      fundamental: data.matchedUser.tagProblemCounts.fundamental,
      weaknesses: calculateWeaknesses(data.matchedUser.tagProblemCounts),
      strengths: calculateStrengths(data.matchedUser.tagProblemCounts),
    }
  };
  return sendData;
};

function calculateWeaknesses(tagData) {
  const allTags = [...tagData.advanced, ...tagData.intermediate, ...tagData.fundamental]
    .sort((a, b) => a.problemsSolved - b.problemsSolved);
  return allTags.slice(0, 3).map(tag => tag.tagName);
}

function calculateStrengths(tagData) {
  const allTags = [...tagData.advanced, ...tagData.intermediate, ...tagData.fundamental]
    .sort((a, b) => b.problemsSolved - a.problemsSolved);
  return allTags.slice(0, 3).map(tag => tag.tagName);
}

export const fetchUserProfile = (req, res) => {
  let user = req.params.username;
  fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    body: JSON.stringify({ query: query, variables: { username: user } }),
  })
    .then((result) => result.json())
    .then((data) => {
      if (data.errors) {
        res.status(400).json({ error: "User not found" });
      } else {
        res.json(formatData(data.data));
      }
    })
    .catch((err) => {
      res.status(500).json({ error: "Internal server error" });
    });
};

export const fetchMultipleUserProfiles = async (req, res) => {
  const { usernames } = req.body;
  if (!Array.isArray(usernames) || usernames.length === 0) {
    return res.status(400).json({ error: "usernames must be a non-empty array" });
  }

  const results = await Promise.all(
    usernames.map(async (username) => {
      try {
        const response = await fetch("https://leetcode.com/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Referer: "https://leetcode.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          body: JSON.stringify({ query: query, variables: { username } }),
        });
        const json = await response.json();
        if (json.errors) {
          return { username, error: "Not found" };
        }
        return formatData(json.data);
      } catch (err) {
        return { username, error: "Error fetching data" };
      }
    })
  );

  res.json(results);
};

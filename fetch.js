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
        realName
        aboutMe
        userAvatar
        location
        skillTags
        websites
        company
        school
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
      badges {
        id
        displayName
        icon
        creationDate
      }
    }
    recentSubmissionList(username: $username, limit: 20) {
      title
      titleSlug
      timestamp
      statusDisplay
      lang
      runtime
      memory
      url
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
      aboutMe: matchedUser.profile.aboutMe,
      avatar: matchedUser.profile.userAvatar,
      location: matchedUser.profile.location,
      skills: matchedUser.profile.skillTags,
      websites: matchedUser.profile.websites,
      company: matchedUser.profile.company,
      school: matchedUser.profile.school,
      starRating: matchedUser.profile.starRating,
      reputation: matchedUser.profile.reputation,
      ranking: matchedUser.profile.ranking,
    },
    totalSolved: matchedUser.submitStats.acSubmissionNum[0].count,
    totalQuestions: data.allQuestionsCount[0].count,
    easySolved: matchedUser.submitStats.acSubmissionNum[1].count,
    totalEasy: data.allQuestionsCount[1].count,
    mediumSolved: matchedUser.submitStats.acSubmissionNum[2].count,
    totalMedium: data.allQuestionsCount[2].count,
    hardSolved: matchedUser.submitStats.acSubmissionNum[3].count,
    totalHard: data.allQuestionsCount[3].count,
    totalSubmissions: matchedUser.submitStats.totalSubmissionNum.reduce((acc, cur) => acc + cur.submissions, 0),
    contributionPoints: matchedUser.contributions.points,
    submissionCalendar: JSON.parse(matchedUser.submissionCalendar),
    badges: matchedUser.badges,
    recentSubmissions: data.recentSubmissionList,
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

// function calculateWeaknesses(tagData) {
//   const allTags = [...tagData.advanced, ...tagData.intermediate, ...tagData.fundamental]
//     .sort((a, b) => a.problemsSolved - b.problemsSolved);
//   return allTags.slice(0, 3).map(tag => tag.tagName);
// }

// function calculateStrengths(tagData) {
//   const allTags = [...tagData.advanced, ...tagData.intermediate, ...tagData.fundamental]
//     .sort((a, b) => b.problemsSolved - a.problemsSolved);
//   return allTags.slice(0, 3).map(tag => tag.tagName);
// }

export const fetchUserProfile = (req, res) => {
  const user = req.params.username;
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

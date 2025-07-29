import { leetDataMiddleware } from './leetDataMiddleware.js';

// This IS returning data - through Express response
export const fetchUserProfile = (req, res) => {
  // Simply returns the pre-formatted data from middleware
  res.json({
    userData: req.formattedData,  // Attached by middleware
    timestamp: req.leetcodeTimestamp
  });
  // No explicit 'return' needed - Express handles response
};

export { leetDataMiddleware };
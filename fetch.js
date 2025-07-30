import { leetDataMiddleware } from './leetDataMiddleware.js';

// This IS returning data - through Express response
export const fetchUserProfile = (req, res) => {
  // Simply returns the pre-formatted data from middleware
  console.log("Returning user profile data:", req.formattedData);
  res.json(req.formattedData);
  // No explicit 'return' needed - Express handles response
};

export { leetDataMiddleware };
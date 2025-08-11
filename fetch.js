import { leetDataMiddleware } from './DataMiddleware.js';

export const fetchUserProfile = (req, res) => {
  console.log("Returning user profile data:", req.formattedData);
  res.json(req.formattedData);
};

export { leetDataMiddleware };
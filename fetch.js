import { leetDataMiddleware } from './DataMiddleware.js';

export const fetchUserProfile = (req, res) => {
  res.json(req.formattedData);
};

export { leetDataMiddleware };
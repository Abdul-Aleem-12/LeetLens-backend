import request from 'supertest';
import app from "../server" 

jest.unstable_mockModule('../fetch.js', () => ({
    fetchUserProfile: async (req, res) => {
      res.status(200).json({
        username: req.params.username,
        problemsSolved: 400,
        ranking: 4567
      });
    }
  }));

describe('LeetLens API', () => {
  it('should return 200 for root route', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
  });
});
    
describe('LeetLens API - Mocked Username Route', () => {
    it('should return mocked profile data', async () => {
      const res = await request(app).get('/abdulaleem12');
  
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        username: 'abdulaleem12',
        problemsSolved: 123,
        ranking: 4567
      });
    });
  });
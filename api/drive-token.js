/**
 * Vercel Serverless Function: Menyediakan Google Drive Access Token
 * untuk request client-side jika diperlukan.
 */
const { getGoogleAccessToken } = require('./google-auth');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const token = await getGoogleAccessToken();
    return res.status(200).json({ access_token: token });
  } catch (error) {
    console.error('Error fetching drive token:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

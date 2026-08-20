// api/widget.js — Vercel serverless function
// Controls whether the ElevenLabs free widget is enabled sitewide.
// To disable: Set env var WIDGET_ENABLED=false in Vercel dashboard → Redeploy.
// To re-enable: Set WIDGET_ENABLED=true → Redeploy.

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://coachjeff.ai');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  const enabled = process.env.WIDGET_ENABLED !== 'false';

  res.status(200).json({
    enabled,
    message: enabled ? 'Widget active' : 'Widget temporarily disabled'
  });
};

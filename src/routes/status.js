/**
 * GET /ep/status — Service status
 */

export function statusRoute(req, res) {
  res.json({
    service: 'Execution Protocol',
    version: '1.0.0',
    status: 'operational',
    mode: process.env.EP_MODE || 'DRY_RUN',
    endpoints: {
      health: '/ep/health',
      status: '/ep/status',
      validate: '/ep/validate'
    },
    timestamp: new Date().toISOString()
  });
}

export default { statusRoute };

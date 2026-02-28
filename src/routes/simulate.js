/**
 * Stubs for future endpoints
 */

// POST /ep/simulate — Simulate execution (future)
export function simulateRoute(req, res) {
  res.status(501).json({
    error: 'Not implemented',
    message: 'Simulation endpoint coming in v1.1',
    timestamp: new Date().toISOString()
  });
}

// GET /ep/proof/:hash — Get verification proof (future)
export function proofRoute(req, res) {
  res.status(501).json({
    error: 'Not implemented',
    message: 'Proof retrieval coming in v1.1',
    timestamp: new Date().toISOString()
  });
}

// Session routes (future)
export function sessionRoute(req, res) {
  res.status(501).json({
    error: 'Not implemented',
    message: 'Session management coming in v1.1',
    timestamp: new Date().toISOString()
  });
}

export default { simulateRoute, proofRoute, sessionRoute };

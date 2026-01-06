// Simple authentication middleware
// Checks if user has a valid Authorization token
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Check if Authorization header exists
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in.'
      });
    }

    // Extract token from "Bearer <token>" format
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    // Basic token validation - check if it's a staff token format
    // Token format: staff_<id>_<timestamp>
    if (!token || token.trim() === '') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token'
      });
    }

    // Extract staff ID from token for potential use
    // Format: staff_<id>_<timestamp>
    if (token.startsWith('staff_')) {
      const parts = token.split('_');
      if (parts.length >= 2) {
        req.staffId = parts[1]; // Store staff ID for potential use
      }
    }

    // Attach token to request for use in controllers
    req.token = token;
    
    // Continue to next middleware/route handler
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Optional middleware - allows both authenticated and unauthenticated requests
// Use this for routes that should work for everyone but can provide user context if authenticated
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

      if (token && token.startsWith('staff_')) {
        const parts = token.split('_');
        if (parts.length >= 2) {
          req.staffId = parts[1];
        }
      }
      req.token = token;
    }
    
    next();
  } catch (error) {
    // Continue even if auth parsing fails
    next();
  }
};


const jwt = require("jsonwebtoken");
const config = require("../config");

/**
 * Sign a JWT token for a user payload.
 * @param {{ id: number, username: string }} payload
 * @returns {string} signed token
 */
function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/**
 * Verify a JWT token and return the decoded payload.
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = { signToken, verifyToken };

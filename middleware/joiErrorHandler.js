/**
 * joiErrorHandler.js - Joi Validation Error Formatter
 * 
 * This module provides utility functions to convert Joi validation errors
 * into a format suitable for display in EJS views.
 * 
 * Provides:
 * - Field-level error grouping for inline display
 * - General error list for summary display
 */

/**
 * formatJoiErrors
 * Converts Joi validation error object into view-friendly format
 * 
 * Takes a Joi validation error and transforms it into two structures:
 * 1. errors: Array of error messages for general display
 * 2. fieldErrors: Object mapping field names to their error messages
 * 
 * Example output:
 * {
 *   errors: [{ msg: 'Password must be at least 6 characters' }],
 *   fieldErrors: { 
 *     password: ['Password must be at least 6 characters']
 *   }
 * }
 * 
 * @param {Object} joiError - Joi validation error object with details array
 * @returns {Object} Formatted error object with errors array and fieldErrors map
 */
const formatJoiErrors = (joiError) => {
  if (!joiError || !joiError.details) {
    return { errors: [], fieldErrors: {} };
  }

  // Create general error list
  const errors = joiError.details.map(d => ({ msg: d.message }));
  
  // Create field-specific error map
  const fieldErrors = {};
  joiError.details.forEach(d => {
    const field = d.path.join('.');
    if (!fieldErrors[field]) {
      fieldErrors[field] = [];
    }
    fieldErrors[field].push(d.message);
  });

  return { errors, fieldErrors };
};

// Export formatter function
module.exports = { formatJoiErrors };

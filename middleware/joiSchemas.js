/**
 * joiSchemas.js - Validation Schemas
 * 
 * This module defines Joi validation schemas for all form inputs in the application.
 * Each schema specifies validation rules and custom error messages.
 * 
 * Schemas provided:
 * - settingsSchema: Site-wide settings validation
 * - eventSchema: Event creation/editing validation
 * - bookingSchema: Event booking validation
 * - userSchema: User registration validation
 * - changePasswordSchema: Password change validation
 */

const Joi = require('joi');

/**
 * settingsSchema
 * Validates site-wide settings form
 * 
 * Required fields: name, description
 * Optional fields: email (must be valid email format), contact_info
 */
const settingsSchema = Joi.object({
  name: Joi.string().trim().min(1).required().messages({ 'string.empty': 'Site name required' }),
  description: Joi.string().trim().min(1).required().messages({ 'string.empty': 'Description required' }),
  email: Joi.string().email().optional().allow('').messages({ 'string.email': 'Please enter a valid email address' }),
  contact_info: Joi.string().trim().optional().allow(''),
});

/**
 * eventSchema
 * Validates event creation and editing forms
 * 
 * Required fields: title, description, event_date (must be in future)
 * Optional fields: full_price, full_quantity, concession_price, concession_quantity
 * 
 * Custom validation: event_date must be a valid date in the future
 */
const eventSchema = Joi.object({
  title: Joi.string().trim().min(1).max(100).required().messages({ 'string.empty': 'Title required' }),
  description: Joi.string().trim().min(1).required().messages({ 'string.empty': 'Description required' }),
  event_date: Joi.string().required().custom((value, helpers) => {
    // Parse value into a Date and ensure it's valid and in the future
    const parsed = Date.parse(value);
    if (isNaN(parsed)) {
      return helpers.error('any.invalid');
    }
    const now = Date.now();
    if (parsed <= now) {
      return helpers.error('date.past');
    }
    return value;
  }).messages({ 'any.invalid': 'Invalid date', 'string.empty': 'Date required', 'date.past': 'Event date must be in the future' }),
  full_price: Joi.number().min(0).optional(),
  full_quantity: Joi.number().integer().min(0).optional(),
  concession_price: Joi.number().min(0).optional(),
  concession_quantity: Joi.number().integer().min(0).optional(),
});

/**
 * bookingSchema
 * Validates event booking form
 * 
 * Required fields: attendee_name
 * Optional fields: full_tickets, concession_tickets (must be non-negative integers)
 */
const bookingSchema = Joi.object({
  attendee_name: Joi.string().trim().min(1).required().messages({ 'string.empty': 'Attendee name required' }),
  full_tickets: Joi.number().integer().min(0).optional(),
  concession_tickets: Joi.number().integer().min(0).optional(),
});

/**
 * userSchema
 * Validates user registration form
 * 
 * Required fields: user_name, password (min 6 chars), confirm_password (must match password)
 * Optional fields: organiser (checkbox, value 'yes' if checked)
 */
const userSchema = Joi.object({
  user_name: Joi.string().trim().min(1).required().messages({ 'string.empty': 'User name required' }),
  password: Joi.string().min(6).required().messages({ 'string.min': 'Password must be at least 6 characters', 'string.empty': 'Password required' }),
  confirm_password: Joi.any().valid(Joi.ref('password')).required().messages({ 'any.only': 'Passwords must match', 'any.required': 'Please confirm password' }),
  organiser: Joi.string().valid('yes').optional().allow('') // Checkbox for organiser role
});

/**
 * changePasswordSchema
 * Validates password change form
 * 
 * Required fields: current_password, new_password (min 6 chars), confirm_password (must match new_password)
 */
const changePasswordSchema = Joi.object({
  current_password: Joi.string().required().messages({ 'string.empty': 'Current password required' }),
  new_password: Joi.string().min(6).required().messages({ 'string.min': 'New password must be at least 6 characters', 'string.empty': 'New password required' }),
  confirm_password: Joi.any().valid(Joi.ref('new_password')).required().messages({ 'any.only': 'Passwords must match', 'any.required': 'Please confirm new password' })
});

// Export all validation schemas
module.exports = { settingsSchema, eventSchema, bookingSchema, userSchema, changePasswordSchema };

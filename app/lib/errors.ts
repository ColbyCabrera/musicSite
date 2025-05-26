// src/errors.ts

/**
 * Custom error for invalid input parameters provided to a function.
 * Examples: Invalid key signature, meter format, or out-of-range values.
 */
export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
    // Ensure the prototype chain is correct for instanceof checks
    Object.setPrototypeOf(this, InvalidInputError.prototype);
  }
}

/**
 * Custom error for general problems encountered during the music generation process.
 * This can be used for issues that are not specifically input-related or music theory violations,
 * but rather unexpected states or failures within the generation logic.
 */
export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationError';
    Object.setPrototypeOf(this, GenerationError.prototype);
  }
}

/**
 * Custom error for issues related to music theory rules or inconsistencies.
 * Examples: Unresolvable Roman numeral, impossible chord voicing due to rule constraints,
 *           failure to apply a music theory concept correctly.
 */
export class MusicTheoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MusicTheoryError';
    Object.setPrototypeOf(this, MusicTheoryError.prototype);
  }
}

/**
 * Custom error for issues related to external API calls or interactions.
 * Example: Failure to get a response from the Gemini API.
 */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

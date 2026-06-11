/**
 * Core Utilities
 *
 * Essential utility functions used throughout the application.
 * - cn: Tailwind class name merging
 * - generateToken: Secure random token generation
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { randomBytes } from "crypto"

/**
 * Merge Tailwind CSS classes with clsx and tailwind-merge
 * Handles conditional classes and deduplicates conflicting Tailwind utilities
 * @param inputs - Class values to merge
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a cryptographically secure random token
 * Used for share links and sensitive identifiers
 * @returns 64-character hex string (256 bits of entropy)
 */
export function generateToken(): string {
  // Generate 32 bytes (256 bits) of random data
  // Convert to hex string (64 characters)
  return randomBytes(32).toString('hex');
}

/**
 * Subject Mapping Utilities
 *
 * Provides bidirectional mapping between UI subject names and database subject names.
 * This is critical for the Infinite Learn mode to correctly match subjects between
 * the frontend selection modal and the backend database queries.
 *
 * The mapping handles the difference between:
 * - UI names: "Math 20-1", "Math 30-1" (shorter, more user-friendly)
 * - DB names: "Mathematics 20-1", "Mathematics 30-1" (full formal names in database)
 */

/**
 * Complete bidirectional mapping for all 12 Alberta curriculum subjects.
 *
 * Key format: UI name (shown to user)
 * Value format: content-store name.
 */
const SUBJECT_MAPPINGS = {
  'Math 20-1': 'Mathematics 20-1',
  // Note: Database inconsistency - Math 20-1 is stored as "Mathematics 20-1" but Math 30-1 is stored as "Math 30-1"
  // This mapping reflects the content-store values.
  'Math 30-1': 'Math 30-1',
  'Biology 20': 'Biology 20',
  'Biology 30': 'Biology 30',
  'Chemistry 20': 'Chemistry 20',
  'Chemistry 30': 'Chemistry 30',
  'Physics 20': 'Physics 20',
  'Physics 30': 'Physics 30',
  'English Language Arts 20-1': 'English Language Arts 20-1',
  'English Language Arts 30-1': 'English Language Arts 30-1',
  'Social Studies 20-1': 'Social Studies 20-1',
  'Social Studies 30-1': 'Social Studies 30-1'
} as const;

/**
 * Converts a UI subject name to the corresponding database subject name.
 *
 * @param uiName - The user-facing subject name (e.g., "Math 20-1")
 * @returns The database subject name (e.g., "Mathematics 20-1")
 *
 * @example
 * toDBSubject('Math 20-1') // Returns 'Mathematics 20-1'
 * toDBSubject('Biology 20') // Returns 'Biology 20' (no change)
 * toDBSubject('Unknown') // Returns 'Unknown' (graceful fallback)
 */
export function toDBSubject(uiName: string): string {
  if (uiName in SUBJECT_MAPPINGS) {
    return SUBJECT_MAPPINGS[uiName as keyof typeof SUBJECT_MAPPINGS];
  }
  return uiName;
}

/**
 * Converts a database subject name to the corresponding UI subject name.
 *
 * @param dbName - The database subject name (e.g., "Mathematics 20-1")
 * @returns The user-facing subject name (e.g., "Math 20-1")
 *
 * @example
 * toUISubject('Mathematics 20-1') // Returns 'Math 20-1'
 * toUISubject('Biology 20') // Returns 'Biology 20' (no change)
 * toUISubject('Unknown') // Returns 'Unknown' (graceful fallback)
 */
export function toUISubject(dbName: string): string {
  const entry = Object.entries(SUBJECT_MAPPINGS)
    .find(([_, db]) => db === dbName);
  return entry ? entry[0] : dbName;
}

/**
 * Returns an array of all valid UI subject names.
 *
 * @returns Array of all 12 UI subject names
 *
 * @example
 * getAllUISubjects() // Returns ['Math 20-1', 'Math 30-1', ...]
 */
export function getAllUISubjects(): string[] {
  return Object.keys(SUBJECT_MAPPINGS);
}

/**
 * Returns an array of all valid database subject names.
 *
 * @returns Array of all 12 database subject names
 *
 * @example
 * getAllDBSubjects() // Returns ['Mathematics 20-1', 'Mathematics 30-1', ...]
 */
export function getAllDBSubjects(): string[] {
  return Object.values(SUBJECT_MAPPINGS);
}

// K2.5 OMEGA DIRECTIVE: Global Sanitize Utility
// JSON Stringify "Kill Switch" - Handles Python None strings and malformed data

/**
 * Sanitizes region names to prevent UI crashes from malformed data
 * Handles: JSON strings, Python None, null/undefined, objects, numbers
 * Returns: Clean string for UI display
 */
export const sanitizeRegionName = (name: any): string => {
  // K2.5: Handle non-string types (null, undefined, object, number, Python None)
  if (name === null || name === undefined) return "Secure Node";
  if (typeof name !== 'string') {
    // Handle Python None string or other non-string types
    const strName = String(name);
    if (strName === 'None' || strName === 'null' || strName === 'undefined') {
      return "Secure Node";
    }
    return strName === '[object Object]' ? "Secure Node" : strName;
  }
  
  if (!name || name.trim() === '') return "Global Corridor";
  
  // Handle Python None string explicitly
  if (name === 'None' || name === 'null') return "Secure Node";
  
  // K2.5: Try-catch block for JSON parsing safety
  if (name.includes('{')) {
    try {
      // Extract country from JSON-like strings
      const countryMatch = name.match(/['"]country['"]\s*:\s*['"]([^'"]+)['"]/);
      if (countryMatch) return countryMatch[1];
      
      // Fallback: try single quotes pattern
      const singleQuoteMatch = name.match(/'country':\s*'([^']+)'/);
      if (singleQuoteMatch) return singleQuoteMatch[1];
      
      return "International Node";
    } catch (e) {
      // K2.5: Return generic secure string on parse failure
      return "Secure Node";
    }
  }
  
  // Clean up internal tagging
  return name.replace('_blue', '').replace('_professional', '');
};

/**
 * Hard fallback for numeric values
 * Returns 0 if value is null, undefined, or not a number
 */
export const safeNumber = (value: any, fallback: number = 0): number => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return isNaN(parsed) ? fallback : parsed;
};

/**
 * Safe array check with fallback
 * Returns empty array if not a valid array
 */
export const safeArray = <T,>(arr: any): T[] => {
  if (!arr || !Array.isArray(arr)) return [];
  return arr;
};

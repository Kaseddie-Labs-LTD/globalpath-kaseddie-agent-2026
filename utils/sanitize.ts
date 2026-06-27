// K2.5 OMEGA DIRECTIVE: Global Sanitize Utility
// JSON Stringify "Kill Switch" - Handles Python None strings and malformed data

/**
 * Sanitizes region names to prevent UI crashes from malformed data
 * Handles: JSON strings, Python None, null/undefined, objects, numbers, raw dictionaries
 * Returns: Clean string for UI display
 */
export const sanitizeRegionName = (name: any): string => {
  // K2.5: Handle non-string types (null, undefined, object, number, Python None)
  if (name === null || name === undefined) return "Secure Node";
  if (typeof name !== 'string') {
    // Handle Python None string or other non-string types
    const strName = String(name);
    if (strName === 'None' || strName === 'null' || strName === 'undefined' || strName === '[object Object]') {
      return "Secure Node";
    }
    return strName;
  }
  
  if (!name || name.trim() === '') return "Global Corridor";
  
  // Handle Python None string explicitly
  if (name === 'None' || name === 'null') return "Secure Node";
  
  // Remove any raw dictionary text or JSON-like structures
  let cleanName = name
    .replace(/\{[\s\S]*\}/g, '') // Remove entire JSON objects
    .replace(/_blue/gi, '') // Remove any blue flags (case insensitive)
    .replace(/_professional/gi, '') // Remove professional tags
    .replace(/blue_/gi, '') // Remove blue prefixes
    .replace(/\[.*?\]/g, '') // Remove array brackets
    .replace(/[{}()\[\]]/g, '') // Remove any remaining brackets
    .replace(/['"]/g, '') // Remove quotes
    .trim();
  
  // K2.5: Try-catch block for JSON parsing safety
  if (cleanName.includes('{') || cleanName.includes('[')) {
    try {
      // Extract country from JSON-like strings
      const countryMatch = cleanName.match(/['"]country['"]\s*:\s*['"]([^'"]+)['"]/);
      if (countryMatch && countryMatch[1]) {
        cleanName = countryMatch[1];
      } else {
        // Fallback: try single quotes pattern
        const singleQuoteMatch = cleanName.match(/'country':\s*'([^']+)'/);
        if (singleQuoteMatch && singleQuoteMatch[1]) {
          cleanName = singleQuoteMatch[1];
        } else {
          return "International Node";
        }
      }
    } catch (e) {
      // K2.5: Return generic secure string on parse failure
      return "Secure Node";
    }
  }
  
  // Final cleanup: Ensure we have a valid region name
  cleanName = cleanName.trim();
  if (!cleanName) return "Global Corridor";
  
  // Normalize common region names
  const lowerCleanName = cleanName.toLowerCase();
  if (lowerCleanName.includes('uae') || lowerCleanName.includes('dubai')) return "Dubai Hub";
  if (lowerCleanName.includes('poland')) return "Western Corridor";
  if (lowerCleanName.includes('luxembourg')) return "Premium Node (LUX)";
  if (lowerCleanName.includes('germany') || lowerCleanName.includes('europe')) return "Western Medical/Tech Corridor";
  if (lowerCleanName.includes('canada')) return "Infrastructure Corridor";
  
  return cleanName;
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

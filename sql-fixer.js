/**
 * Fix common SQL generation issues
 * Adds quotes around string literals in WHERE clauses
 */
export function fixSQL(sql) {
  try {
    console.log('🔧 SQL Fixer: Fixing query:', sql);
    
    // Fix: where name = João Silva limit 10
    // To: where name = 'João Silva' limit 10
    sql = sql.replace(
      /where\s+(\w+)\s*=\s*([^'"][^=<>]*?)(\s+limit|\s+and|\s+or|$)/gi,
      (match, column, value, suffix) => {
        const trimmedValue = value.trim();
        
        // Check if value is already quoted
        if (trimmedValue.startsWith("'") || trimmedValue.startsWith('"')) {
          return match;
        }
        
        // Check if it's a number
        if (!isNaN(trimmedValue)) {
          return match;
        }
        
        // Add quotes
        return `where ${column} = '${trimmedValue}'${suffix}`;
      }
    );

    // Fix AND conditions: and column = value
    sql = sql.replace(
      /and\s+(\w+)\s*=\s*([^'"][^=<>]*?)(\s+limit|\s+and|\s+or|$)/gi,
      (match, column, value, suffix) => {
        const trimmedValue = value.trim();
        
        if (trimmedValue.startsWith("'") || trimmedValue.startsWith('"')) {
          return match;
        }
        
        if (!isNaN(trimmedValue)) {
          return match;
        }
        
        return `and ${column} = '${trimmedValue}'${suffix}`;
      }
    );

    // Fix LIKE clauses: where column like value
    sql = sql.replace(
      /like\s+([^'"][^=<>]*?)(\s+limit|\s+and|\s+or|$)/gi,
      (match, value, suffix) => {
        const trimmedValue = value.trim();
        
        if (trimmedValue.startsWith("'") || trimmedValue.startsWith('"')) {
          return match;
        }
        
        return `like '%${trimmedValue}%'${suffix}`;
      }
    );

    // Ensure lowercase keywords
    sql = sql
      .replace(/\bSELECT\b/g, 'select')
      .replace(/\bFROM\b/g, 'from')
      .replace(/\bWHERE\b/g, 'where')
      .replace(/\bAND\b/g, 'and')
      .replace(/\bOR\b/g, 'or')
      .replace(/\bLIKE\b/g, 'like')
      .replace(/\bLIMIT\b/g, 'limit')
      .replace(/\bORDER\s+BY\b/g, 'order by')
      .replace(/\bASC\b/g, 'asc')
      .replace(/\bDESC\b/g, 'desc');

    // Remove extra spaces
    sql = sql.replace(/\s+/g, ' ').trim();

    console.log('✅ Fixed SQL:', sql);
    return sql;
  } catch (error) {
    console.error('❌ SQL Fixer Error:', error.message);
    return sql;
  }
}

export default { fixSQL };

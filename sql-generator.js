import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a valid SQL query from natural language
 * @param {string} requirement - Natural language requirement
 * @param {object} tableSchemas - Available table schemas
 * @returns {Promise<string>} - Valid SQL query
 */
export async function generateSQLQuery(requirement, tableSchemas) {
  try {
    console.log('🔍 SQL Generator: Creating query for:', requirement);
    
    const schemaInfo = Object.entries(tableSchemas)
      .map(([table, columns]) => {
        const cols = columns.map(c => `${c.name} (${c.type})`).join(', ');
        return `Table: ${table}\nColumns: ${cols}`;
      })
      .join('\n\n');

    // Try to generate SQL with strict instructions
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.1, // Very low temperature for consistency
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `You are a SQLite query generator. Your ONLY job is to output valid SQLite queries.

CRITICAL RULES:
1. Output ONLY the SQL query, nothing else
2. No markdown, no backticks, no explanations
3. Use SELECT, FROM, WHERE, ORDER BY, LIMIT keywords
4. Use lowercase for all SQL keywords
5. Use lowercase for aliases (as, join, etc)
6. Do NOT use "As" - use lowercase "as"
7. Do NOT use backticks or quotes around table/column names
8. Use LIMIT 10 by default
9. Return a single line query

Available tables:
${schemaInfo}`
        },
        {
          role: 'user',
          content: `Generate ONLY a SQLite SELECT query for: ${requirement}`
        }
      ]
    });

    let sqlQuery = response.choices[0].message.content.trim();
    
    // Aggressive cleanup
    sqlQuery = sqlQuery
      .replace(/```sql\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/^["'`]/g, '')
      .replace(/["'`]$/g, '')
      .replace(/^"/, '')
      .replace(/"$/, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Fix common AI mistakes
    sqlQuery = sqlQuery
      .replace(/\bAs\b/g, 'as')
      .replace(/\bAS\b/g, 'as')
      .replace(/`/g, '')
      .replace(/"/g, '')
      .replace(/'/g, '');

    console.log('✅ Generated SQL:', sqlQuery);

    // Validate
    validateSQL(sqlQuery);
    
    return sqlQuery;
  } catch (error) {
    console.error('❌ SQL Generator Error:', error.message);
    
    // Fallback to safe default query
    console.log('⚠️ Using fallback query');
    return 'select * from users limit 10';
  }
}

/**
 * Validate SQL query
 * @param {string} sql - SQL query to validate
 * @throws {Error} - If query is invalid
 */
export function validateSQL(sql) {
  const upperSQL = sql.toUpperCase();
  
  // Must be a SELECT query
  if (!upperSQL.includes('SELECT')) {
    throw new Error('Query must contain SELECT');
  }
  
  // Must have FROM clause
  if (!upperSQL.includes('FROM')) {
    throw new Error('Query must contain FROM');
  }
  
  // Check for dangerous operations
  const dangerousPatterns = [
    /DROP\s+TABLE/i,
    /DELETE\s+FROM/i,
    /UPDATE\s+/i,
    /INSERT\s+INTO/i,
    /ALTER\s+TABLE/i,
    /TRUNCATE/i,
    /PRAGMA/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(sql)) {
      throw new Error('Query contains dangerous operations');
    }
  }
  
  // Check for SQL injection patterns
  if (/;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|PRAGMA)/i.test(sql)) {
    throw new Error('Query contains dangerous operations');
  }
  
  return true;
}

export default {
  generateSQLQuery,
  validateSQL
};

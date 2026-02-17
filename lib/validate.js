/**
 * Lightweight JSON Schema validation for MCP tool inputs (FOR-995).
 *
 * Validates required fields and basic types without external dependencies.
 * Catches common LLM errors (wrong types, missing fields) before they hit
 * the METRC API, producing clearer error messages.
 */

/**
 * Validate tool arguments against the tool's inputSchema.
 *
 * @param {string} toolName - Tool name (for error messages)
 * @param {object} args - Arguments to validate
 * @param {object} inputSchema - JSON Schema from the tool definition
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateToolInput(toolName, args, inputSchema) {
  const errors = [];
  const { required = [], properties = {} } = inputSchema;

  // Check required fields
  for (const field of required) {
    if (args[field] === undefined || args[field] === null) {
      const prop = properties[field];
      const hint = prop?.description ? ` (${prop.description})` : '';
      errors.push(`Missing required field: ${field}${hint}`);
    }
  }

  // Type-check provided fields
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    const schema = properties[key];
    if (!schema || !schema.type) continue;

    const err = checkType(key, value, schema.type);
    if (err) errors.push(err);
  }

  return { valid: errors.length === 0, errors };
}

function checkType(key, value, expectedType) {
  switch (expectedType) {
    case 'string':
      if (typeof value !== 'string')
        return `${key}: expected string, got ${typeof value}`;
      break;
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value))
        return `${key}: expected number, got ${typeof value}`;
      break;
    case 'boolean':
      if (typeof value !== 'boolean')
        return `${key}: expected boolean, got ${typeof value}`;
      break;
    case 'array':
      if (!Array.isArray(value))
        return `${key}: expected array, got ${typeof value}`;
      break;
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value))
        return `${key}: expected object, got ${Array.isArray(value) ? 'array' : typeof value}`;
      break;
  }
  return null;
}

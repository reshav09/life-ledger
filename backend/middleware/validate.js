/**
 * Versatile input validation middleware.
 * Supports:
 * 1. Schema objects with field rules (e.g. { amount: { type: 'number', required: true, min: 0 } })
 * 2. Zod schemas (if schema.safeParse is present)
 * 3. Custom validator functions (req) => { error?: string }
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source] || {};

    // 1. Zod schema support
    if (schema && typeof schema.safeParse === 'function') {
      const result = schema.safeParse(data);
      if (!result.success) {
        const issues = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        return res.status(400).json({
          error: `Validation failed: ${issues.join('; ')}`,
          code: 'VALIDATION_ERROR',
          details: issues
        });
      }
      req[source] = result.data;
      return next();
    }

    // 2. Custom validator function
    if (typeof schema === 'function') {
      const result = schema(data, req);
      if (result && result.error) {
        return res.status(400).json({
          error: result.error,
          code: 'VALIDATION_ERROR',
          details: result.details || [result.error]
        });
      }
      return next();
    }

    // 3. Declarative rules dictionary
    if (typeof schema === 'object' && schema !== null) {
      const errors = [];
      const sanitized = {};

      for (const [field, rules] of Object.entries(schema)) {
        let val = data[field];

        if (rules.required && (val === undefined || val === null || val === '')) {
          errors.push(`Field '${field}' is required`);
          continue;
        }

        if (val !== undefined && val !== null && val !== '') {
          if (rules.type === 'number') {
            const num = Number(val);
            if (isNaN(num)) {
              errors.push(`Field '${field}' must be a valid number`);
              continue;
            }
            if (rules.min !== undefined && num < rules.min) {
              errors.push(`Field '${field}' must be at least ${rules.min}`);
              continue;
            }
            if (rules.max !== undefined && num > rules.max) {
              errors.push(`Field '${field}' must be at most ${rules.max}`);
              continue;
            }
            if (rules.integer && !Number.isInteger(num)) {
              errors.push(`Field '${field}' must be an integer`);
              continue;
            }
            val = num;
          } else if (rules.type === 'string') {
            val = String(val).trim();
            if (rules.minLen && val.length < rules.minLen) {
              errors.push(`Field '${field}' must be at least ${rules.minLen} characters`);
              continue;
            }
            if (rules.maxLen && val.length > rules.maxLen) {
              errors.push(`Field '${field}' cannot exceed ${rules.maxLen} characters`);
              continue;
            }
            if (rules.enum && !rules.enum.includes(val)) {
              errors.push(`Field '${field}' must be one of: ${rules.enum.join(', ')}`);
              continue;
            }
            if (rules.pattern && !rules.pattern.test(val)) {
              errors.push(`Field '${field}' format is invalid`);
              continue;
            }
          } else if (rules.type === 'date') {
            const d = new Date(val);
            if (isNaN(d.getTime()) || !/^\d{4}-\d{2}-\d{2}/.test(String(val))) {
              errors.push(`Field '${field}' must be a valid date in YYYY-MM-DD format`);
              continue;
            }
            val = String(val).slice(0, 10);
          }
        } else if (rules.default !== undefined) {
          val = rules.default;
        }

        if (val !== undefined) {
          sanitized[field] = val;
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          error: errors[0],
          code: 'VALIDATION_ERROR',
          details: errors
        });
      }

      // Merge sanitized data back into req[source]
      req[source] = { ...data, ...sanitized };
      return next();
    }

    next();
  };
}

module.exports = { validate };

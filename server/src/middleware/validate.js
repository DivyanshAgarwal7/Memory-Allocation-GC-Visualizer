/**
 * Wraps a zod schema as Express middleware.
 * On failure: 400 with field-level messages (never a stack trace).
 * On success: parsed/coerced data is attached to req.validated (or
 * req.validatedParams when source is 'params').
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const input = source === 'params' ? req.params : req.body;
    const result = schema.safeParse(input);

    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid input.',
        details: result.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'value',
          message: issue.message,
        })),
      });
    }

    if (source === 'params') {
      req.validatedParams = result.data;
    } else {
      req.validated = result.data;
    }
    next();
  };
}

/**
 * Wraps a zod schema as Express middleware.
 * On failure: 400 with field-level messages (never a stack trace).
 * On success: parsed/coerced data is attached to req.validated.
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid input.',
        details: result.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'value',
          message: issue.message,
        })),
      });
    }

    req.validated = result.data;
    next();
  };
}

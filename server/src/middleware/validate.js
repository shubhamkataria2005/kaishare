/**
 * Validation middleware factory.
 *
 * validate({ body: schema, query: schema, params: schema }) returns
 * middleware that parses each part of the request with its Zod schema.
 * The cleaned values are stored on req.valid so controllers only ever use
 * validated data. (Express 5 makes req.query read-only, so the parsed values
 * cannot be written back onto it.)
 */
import { ValidationError } from '../utils/errors.js'

/**
 * Converts Zod issues into { field: message }, keeping the first message
 * for each field. Issues not tied to a field go under "_form".
 *
 * @param {import('zod').ZodError} error
 */
export function toFieldErrors(error) {
  const fieldErrors = {}
  for (const issue of error.issues) {
    const field = issue.path.length ? issue.path.join('.') : '_form'
    fieldErrors[field] ??= issue.message
  }
  return fieldErrors
}

/** @param {{ body?: import('zod').ZodType, query?: import('zod').ZodType, params?: import('zod').ZodType }} schemas */
export function validate(schemas) {
  return (req, _res, next) => {
    req.valid = req.valid ?? {}
    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part]
      if (!schema) continue

      const result = schema.safeParse(req[part] ?? {})
      if (!result.success) {
        const fieldErrors = toFieldErrors(result.error)
        const message = fieldErrors._form ?? 'Please correct the highlighted fields.'
        return next(new ValidationError(message, fieldErrors))
      }
      req.valid[part] = result.data
    }
    next()
  }
}

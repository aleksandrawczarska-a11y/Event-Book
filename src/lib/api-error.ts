export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    context: Record<string, unknown>;
  };
}

export function jsonError(
  code: string,
  message: string,
  status: number,
  context: Record<string, unknown> = {},
): Response {
  return Response.json({ error: { code, message, context } } satisfies ApiErrorBody, { status });
}

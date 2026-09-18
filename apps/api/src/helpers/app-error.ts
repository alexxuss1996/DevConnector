class AppError extends Error {
  /**
   * Creates an operational error that can be translated into an API response.
   *
   * @param statusCode - HTTP status code to return to the client.
   * @param code - Stable application-specific error code.
   * @param message - Human-readable error message.
   */
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options as ErrorOptions);
    this.name = "AppError";
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export default AppError;

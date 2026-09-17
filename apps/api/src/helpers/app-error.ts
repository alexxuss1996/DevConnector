class AppError extends Error {
  /**
   * Creates an operational error that can be translated into an API response.
   *
   * @param statusCode - HTTP status code to return to the client.
   * @param code - Stable application-specific error code.
   * @param message - Human-readable error message.
   */
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export default AppError;

export class HttpError extends Error {
  constructor(
    public status: 400 | 404 | 409 | 500,
    message: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends HttpError {
  constructor(resource: string, id: string) {
    super(404, `${resource} ${id} not found`);
  }
}

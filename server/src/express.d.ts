declare global {
  namespace Express {
    interface Request {
      /**
       * The unparsed request body, captured by express.json()'s verify hook in server.ts. Only the
       * Alexa custom skill needs it — its signature is over the exact bytes Amazon sent, which
       * JSON.parse followed by JSON.stringify would not reproduce.
       */
      rawBody?: Buffer;
    }
  }
}

export {};

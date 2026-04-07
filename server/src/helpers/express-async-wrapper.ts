import { RequestHandler } from "express";

// Express 5 natively handles async errors from route handlers, so this
// wrapper is now a no-op kept only for backwards compatibility.
export default function (func: RequestHandler) {
  return func;
}
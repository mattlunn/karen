import { RequestHandler, Request, Response, NextFunction } from "express";

export default function (func: RequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(func(req, res, next)).catch(next);
  };
}
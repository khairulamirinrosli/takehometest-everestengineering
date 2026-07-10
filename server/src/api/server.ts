import express from "express";
import type { ErrorRequestHandler } from "express";
import type { LockerBank } from "../domain/lockerBank.js";
import { createLockerRoutes } from "./routes.js";

const handleJsonErrors: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Malformed JSON body" });
    return;
  }
  next(err);
};

export function createServer(bank: LockerBank) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(createLockerRoutes(bank));

  app.use(handleJsonErrors);

  return app;
}

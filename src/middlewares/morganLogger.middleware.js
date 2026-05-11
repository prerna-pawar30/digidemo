import morgan from "morgan";
import chalk from "chalk";
import { getISTTime } from "../helpers/time.helper.js";

/**
 * @function morganMiddleware
 *
 * @description
 * Morgan HTTP request logger middleware with colored output and IST timestamps.
 * Logs request method, URL, status code, response time, and current IST time.
 *
 * @process
 * 1. Use `morgan` to intercept HTTP requests
 * 2. Colorize HTTP method, URL, status code, and response time
 * 3. Prepend logs with current IST timestamp
 * 4. Print formatted log line to console
 *
 * @example
 * 2026-03-26 18:15:32 | GET /api/users 200 - 12 ms
 */
const getColorStatus = (status) => {
  if (!status) return chalk.white("N/A");

  const code = parseInt(status, 10);

  if (code >= 500) return chalk.red(code);
  if (code >= 400) return chalk.magenta(code);
  if (code >= 300) return chalk.cyan(code);
  if (code >= 200) return chalk.green(code);
  return chalk.white(code);
};

export const morganMiddleware = morgan((tokens, req, res) => {
  const method = chalk.blue(tokens.method(req, res));
  const url = chalk.yellow(tokens.url(req, res));
  const status = getColorStatus(tokens.status(req, res));
  const responseTime = chalk.green(`${tokens["response-time"](req, res)} ms`);
  const date = chalk.gray(getISTTime());

  return `${date} | ${method} ${url} ${status} - ${responseTime}`;
});
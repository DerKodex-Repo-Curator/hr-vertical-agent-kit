type Level = "info" | "warn" | "error" | "debug";

function write(level: Level, message: string, meta?: Record<string, unknown>): void {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...meta,
  };
  process.stderr.write(JSON.stringify(entry) + "\n");
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => write("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write("error", msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => write("debug", msg, meta),
};

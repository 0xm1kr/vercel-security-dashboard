import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import { dirname } from "node:path";

/**
 * Write `data` to `path` atomically with the given mode bits applied
 * at file-creation time. Avoids two failure modes:
 *
 *  - A crash between truncate and end-of-write leaving a corrupted file.
 *  - The file briefly existing with a permissive mode (umask race) before
 *    a follow-up `chmod` runs.
 *
 * On POSIX, `rename(2)` is atomic when source and destination are on the
 * same filesystem.
 */
export const writeFileAtomic = (
  path: string,
  data: string | Uint8Array,
  options: { mode?: number } = {},
): void => {
  const mode = options.mode ?? 0o600;
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  let fd: number | null = null;
  try {
    fd = openSync(tmp, "wx", mode);
    const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    writeSync(fd, buf, 0, buf.byteLength, 0);
    fsyncSync(fd);
    closeSync(fd);
    fd = null;
    renameSync(tmp, path);
  } catch (err) {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        // best-effort
      }
    }
    try {
      rmSync(tmp, { force: true });
    } catch {
      // best-effort
    }
    throw err;
  }
};

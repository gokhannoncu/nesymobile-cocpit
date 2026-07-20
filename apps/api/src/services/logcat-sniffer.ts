/**
 * Logcat Sniffer
 *
 * Spawns `adb logcat -s NESY_AUTO_BRIDGE` and parses log lines
 * for VERIFY_BACKEND_STATE and other device-side events.
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { EventEmitter } from "node:events";

export interface LogcatEvent {
  action: string;
  status: string;
  key: string;
  value: string;
  /** TASK_ID extracted from the log line, if present. */
  taskId?: string;
  /** Parsed JSON DATA payload, if present. */
  data?: Record<string, unknown>;
  timestamp: number;
  raw: string;
}

/**
 * Matches two log formats:
 *  1) Original:  NESY_AUTO_BRIDGE: ACTION: <action> | STATUS: <status> | <key>: <value>
 *  2) Extended:  NESY_AUTO_BRIDGE: ACTION: <action> | STATUS: <status> | TASK_ID: <taskId> | DATA: <json>
 */
const LOGCAT_PATTERN =
  /NESY_AUTO_BRIDGE(?::|\b.*?)\s+ACTION:\s*(?<action>\w+)\s*\|\s*STATUS:\s*(?<status>\w+)\s*\|\s*(?<key>\w+):\s*(?<value>.+)/;

export function parseLogcatLine(line: string): LogcatEvent | null {
  const match = line.match(LOGCAT_PATTERN);
  if (!match?.groups) return null;

  const { action, status, key, value } = match.groups;
  if (!action || !status || !key || value === undefined) return null;

  const event: LogcatEvent = {
    action,
    status,
    key,
    value: value.trim(),
    timestamp: Date.now(),
    raw: line,
  };

  // Try to extract TASK_ID and DATA from the extended format.
  // TASK_ID can be empty, so use [^|]*? instead of .+.
  const extendedMatch = line.match(
    /TASK_ID:\s*(?<taskId>[^|]*?)\s*\|\s*DATA:\s*(?<data>\{.*\})/
  );
  if (extendedMatch?.groups) {
    event.taskId = (extendedMatch.groups.taskId ?? "").trim();
    try {
      if (extendedMatch.groups.data) {
        event.data = JSON.parse(extendedMatch.groups.data);
      }
    } catch {
      // DATA field isn't valid JSON — keep raw value.
    }
  }

  return event;
}

export class LogcatSniffer extends EventEmitter {
  private deviceId?: string;
  private process: ReturnType<typeof spawn> | null = null;
  private running = false;

  constructor(options?: { deviceId?: string }) {
    super();
    this.deviceId = options?.deviceId;
  }

  getProcess() {
    return this.process;
  }

  isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;

    const args: string[] = [];

    if (this.deviceId) {
      args.push("-s", this.deviceId);
    }

    args.push("logcat", "-T", "1", "-s", "NESY_AUTO_BRIDGE:D", "-v", "time");

    try {
      this.process = spawn("adb", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      console.warn("[LogcatSniffer] Failed to spawn adb, logcat monitoring disabled.");
      this.running = false;
      return;
    }

    this.running = true;

    const rl = createInterface({ input: this.process.stdout! });

    rl.on("line", (line: string) => {
      this.parseLine(line);
    });

    this.process.on("close", (code) => {
      this.running = false;
      rl.close();
      this.emit("close", code);
    });

    this.process.on("error", (err: NodeJS.ErrnoException) => {
      this.running = false;
      if (err.code === "ENOENT") {
        console.warn("[LogcatSniffer] adb not found in PATH, logcat monitoring disabled.");
      } else {
        console.warn("[LogcatSniffer] adb process error:", err.message);
      }
    });
  }

  stop(): void {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGTERM");
    }
    this.running = false;
  }

  private parseLine(line: string): void {
    const event = parseLogcatLine(line);
    if (!event) return;

    this.emit("event", event);

    if (event.action === "VERIFY_BACKEND") {
      this.emit("verify", event);
    } else if (event.action === "TASK_COMPLETED") {
      this.emit("task_completed", event);
    } else if (event.action === "ERROR") {
      this.emit("device_error", event);
    } else if (event.action === "VALIDATE_STOPLIST") {
      this.emit("validate_stoplist", event);
    } else if (event.action === "LOAD_TO_VEHICLE") {
      this.emit("load_to_vehicle", event);
    } else if (event.action === "SEARCH_STOP") {
      this.emit("search_stop", event);
    } else if (event.action === "OPEN_STOP") {
      this.emit("open_stop", event);
    } else if (event.action === "REQUEST_TOUR_START") {
      this.emit("request_tour_start", event);
    } else if (event.action === "DELIVER_PARCEL") {
      this.emit("deliver_parcel", event);
    } else if (event.action === "SCAN_PARCEL") {
      this.emit("scan_parcel", event);
    } else if (event.action === "CHECK_LOGIN") {
      this.emit("check_login", event);
    } else if (event.action === "LOGIN_STATUS") {
      this.emit("login_status", event);
    } else if (event.action === "CHECK_ROUTE") {
      this.emit("check_route", event);
    } else if (event.action === "ROUTE_STATUS") {
      this.emit("route_status", event);
    }
  }
}

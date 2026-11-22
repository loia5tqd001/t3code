import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeSqlite from "node:sqlite";
import * as NodeURL from "node:url";

const __dirname = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repoRoot = NodePath.resolve(__dirname, "..");
const detach = process.argv.includes("--detach");
// oxlint-disable-next-line t3code/no-global-process-runtime -- Standalone launcher script has no Effect runtime.
const isDarwin = NodeOS.platform() === "darwin";

// Production built launch: ensure dev/node-as-node overrides are unset and fork branding is set
// before importing electron-launcher.mjs, which evaluates these env vars at module load time.
delete process.env.VITE_DEV_SERVER_URL;
delete process.env.ELECTRON_RUN_AS_NODE;
process.env.T3CODE_DESKTOP_STAGE_LABEL = "Fork";

const logsDir = NodePath.join(NodeOS.homedir(), "Library", "Logs");
NodeFS.mkdirSync(logsDir, { recursive: true });
const pidFilePath = NodePath.join(logsDir, "t3code-fork-electron.pid");
const logPath = NodePath.join(logsDir, "t3code-fork.log");
const logFd = detach ? NodeFS.openSync(logPath, "a") : null;

const logMessage = (message) => {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  if (logFd !== null) {
    NodeFS.writeSync(logFd, line);
  } else {
    process.stdout.write(line);
  }
};

const showCriticalAlert = (message) => {
  if (!detach || !isDarwin) {
    return;
  }
  try {
    NodeChildProcess.execFileSync(
      "osascript",
      [
        "-e",
        'on run argv\n  display alert "T3 Code (Fork) failed to launch" message (item 1 of argv) as critical\nend run',
        "--",
        message,
      ],
      { stdio: "ignore" },
    );
  } catch {
    // Best-effort alert; log file already captured the error.
  }
};

const isProcessAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Boolean(error && typeof error === "object" && "code" in error && error.code === "EPERM");
  }
};

const readTrackedForkPid = () => {
  try {
    const raw = NodeFS.readFileSync(pidFilePath, "utf8").trim();
    if (!/^\d+$/.test(raw)) {
      return null;
    }
    const pid = Number.parseInt(raw, 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
};

const runningForkBundleId = (pid) => {
  if (!isProcessAlive(pid)) {
    return null;
  }
  const forkBin = NodePath.join(repoRoot, "apps/desktop/.electron-runtime/T3 Code (Fork).app");
  const betaBin = NodePath.join(repoRoot, "apps/desktop/.electron-runtime/T3 Code (Beta).app");
  const psResult = NodeChildProcess.spawnSync("ps", ["-p", String(pid), "-o", "command="], {
    encoding: "utf8",
  });
  if (psResult.status !== 0 || typeof psResult.stdout !== "string") {
    return null;
  }
  if (psResult.stdout.includes(forkBin)) {
    return "com.t3tools.t3code.fork";
  }
  if (psResult.stdout.includes(betaBin)) {
    return "com.t3tools.t3code";
  }
  return null;
};

const isHomeOwnershipLocked = (lockPath) => {
  if (!NodeFS.existsSync(lockPath)) {
    return false;
  }
  try {
    const db = new NodeSqlite.DatabaseSync(lockPath, { readOnly: true });
    try {
      db.exec("PRAGMA busy_timeout = 0");
      db.prepare("SELECT count(*) FROM sqlite_master").get();
      return false;
    } finally {
      db.close();
    }
  } catch (cause) {
    return Boolean(cause && typeof cause === "object" && "errcode" in cause && cause.errcode === 5);
  }
};

const promptQuitBetaAndSwitch = () => {
  try {
    const result = NodeChildProcess.execFileSync(
      "osascript",
      [
        "-e",
        'set r to display alert "T3 Code (Beta) is still running" message "T3 Code (Beta) is currently using ~/.t3/userdata. Quit T3 Code (Beta) and switch to T3 Code (Fork)?" buttons {"Cancel", "Quit Beta & Open Fork"} default button "Quit Beta & Open Fork"\nreturn button returned of r',
      ],
      { encoding: "utf8" },
    ).trim();
    return result === "Quit Beta & Open Fork";
  } catch {
    return false;
  }
};

const handleDarwinSingleDatabaseGuard = async () => {
  if (!isDarwin || process.env.T3CODE_HOME?.trim()) {
    return true;
  }

  const trackedPid = readTrackedForkPid();
  const activeBundleId = trackedPid !== null ? runningForkBundleId(trackedPid) : null;
  if (activeBundleId !== null) {
    logMessage(`T3 Code (Fork) is already running (PID ${trackedPid}); activating window.`);
    NodeChildProcess.spawnSync(
      "osascript",
      ["-e", `tell application id "${activeBundleId}" to activate`],
      {
        stdio: "ignore",
      },
    );
    return false;
  }

  const lockPath = NodePath.join(NodeOS.homedir(), ".t3", "userdata", "server-owner.sqlite");
  if (!isHomeOwnershipLocked(lockPath)) {
    return true;
  }

  logMessage("Detected ~/.t3/userdata lock held by another T3 Code instance.");
  if (!promptQuitBetaAndSwitch()) {
    logMessage("User cancelled switching from T3 Code (Beta) to T3 Code (Fork).");
    return false;
  }

  logMessage("Requesting T3 Code (Beta) to quit before launching T3 Code (Fork)...");
  NodeChildProcess.execFileSync("osascript", [
    "-e",
    'tell application id "com.t3tools.t3code" to quit',
  ]);
  for (let i = 0; i < 60 && isHomeOwnershipLocked(lockPath); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (isHomeOwnershipLocked(lockPath)) {
    throw new Error("T3 Code (Beta) did not release ~/.t3/userdata within 15s.");
  }
  logMessage("~/.t3/userdata lock released; proceeding with T3 Code (Fork) launch.");
  return true;
};

try {
  const requiredBuildOutputs = [
    "apps/desktop/dist-electron/main.cjs",
    "apps/server/dist/bin.mjs",
    "apps/server/dist/client/index.html",
  ];
  const missingOutputs = requiredBuildOutputs.filter(
    (relativePath) => !NodeFS.existsSync(NodePath.join(repoRoot, relativePath)),
  );
  if (missingOutputs.length > 0) {
    throw new Error(
      `Missing built fork outputs:\n${missingOutputs.map((file) => `  - ${file}`).join("\n")}\nRun ./scripts/rebuild-local-fork.sh --full first.`,
    );
  }

  const shouldLaunch = await handleDarwinSingleDatabaseGuard();
  if (!shouldLaunch) {
    if (logFd !== null) {
      NodeFS.closeSync(logFd);
    }
    process.exit(0);
  }

  if (isDarwin) {
    NodeChildProcess.execFileSync(
      process.execPath,
      [NodePath.join(repoRoot, "apps/desktop/scripts/build-apple-speech.mjs")],
      {
        stdio: logFd === null ? "inherit" : ["ignore", logFd, logFd],
      },
    );
  }

  const { desktopDir, resolveElectronLaunchCommand } =
    await import("../apps/desktop/scripts/electron-launcher.mjs");

  const childEnv = { ...process.env };
  delete childEnv.VITE_DEV_SERVER_URL;
  delete childEnv.ELECTRON_RUN_AS_NODE;
  childEnv.T3CODE_DESKTOP_STAGE_LABEL = "Fork";

  const electronCommand = resolveElectronLaunchCommand(["dist-electron/main.cjs"]);

  const writePidFile = (pid) => {
    if (typeof pid !== "number") {
      return;
    }
    NodeFS.writeFileSync(pidFilePath, `${pid}\n`);
  };

  const cleanupPidFile = (pid) => {
    if (typeof pid !== "number") {
      return;
    }
    try {
      const current = NodeFS.readFileSync(pidFilePath, "utf8").trim();
      if (current === String(pid)) {
        NodeFS.rmSync(pidFilePath, { force: true });
      }
    } catch {
      // Ignore missing or unreadable PID file on cleanup.
    }
  };

  if (detach) {
    const child = NodeChildProcess.spawn(electronCommand.electronPath, electronCommand.args, {
      cwd: desktopDir,
      env: childEnv,
      detached: true,
      stdio: ["ignore", logFd, logFd],
    });
    writePidFile(child.pid);
    logMessage(`Launched T3 Code built fork (PID ${child.pid ?? "unknown"}).`);
    if (logFd !== null) {
      NodeFS.closeSync(logFd);
    }
    child.unref();
    console.log(`Launched T3 Code built fork (PID ${child.pid ?? "unknown"}). Logs: ${logPath}`);
    process.exit(0);
  }

  const child = NodeChildProcess.spawn(electronCommand.electronPath, electronCommand.args, {
    cwd: desktopDir,
    env: childEnv,
    stdio: "inherit",
  });
  writePidFile(child.pid);

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };
  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  child.on("error", (error) => {
    cleanupPidFile(child.pid);
    console.error(error);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    cleanupPidFile(child.pid);
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (logFd !== null) {
    NodeFS.writeSync(logFd, `[${new Date().toISOString()}] ERROR: ${message}\n`);
    NodeFS.closeSync(logFd);
  } else {
    console.error(message);
  }
  showCriticalAlert(message);
  process.exit(1);
}

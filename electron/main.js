import { app, BrowserWindow } from "electron";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");
const PORT = 3001;

let serverProcess = null;
let mainWindow = null;

// Zwei Betriebsarten:
//  - Aus dem Quellcode gestartet (`npm run app`, dev/Mac): Server läuft als
//    eigener Kindprozess unter dem regulären System-Node. So müssen
//    better-sqlite3 & Co. nie für Electrons ABI neu gebaut werden.
//  - Gepackte Installer-App (app.isPackaged, z. B. der Windows-.exe-Build):
//    hier ist NICHT sichergestellt, dass die Zielperson überhaupt Node.js
//    installiert hat — der Server läuft deshalb direkt in Electrons eigenem
//    Prozess mit. Die dafür nötigen nativen Module werden im CI-Build via
//    @electron/rebuild gegen Electrons ABI gebaut (siehe .github/workflows).
function startServer() {
  if (app.isPackaged) {
    process.env.ERSCHLIESSUNG_DATA_DIR = app.getPath("userData");
    return import("../server/index.js");
  }

  serverProcess = spawn("node", ["server/index.js"], {
    cwd: PROJECT_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  serverProcess.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
  serverProcess.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
  serverProcess.on("exit", (code) => {
    if (code !== null && code !== 0) console.error(`[server] beendet mit Code ${code}`);
  });
  return Promise.resolve();
}

function waitForServer(retries = 40) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      http
        .get(`http://localhost:${PORT}/api/vocab`, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (n <= 0) return reject(new Error("Server antwortet nicht auf Port " + PORT));
          setTimeout(() => attempt(n - 1), 250);
        });
    };
    attempt(retries);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Erschließung",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(`http://localhost:${PORT}`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startServer();
  try {
    await waitForServer();
  } catch (err) {
    console.error(err);
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function stopServer() {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
}

app.on("before-quit", stopServer);
app.on("will-quit", stopServer);
process.on("exit", stopServer);

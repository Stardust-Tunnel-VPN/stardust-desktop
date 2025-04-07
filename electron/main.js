/**
 * Stardust VPN Client - Electron Main Process
 *
 * Description:
 * This file is the primary entry point for the Stardust VPN Client application,
 * built with Electron. It handles the following:
 * 1. Spawning a backend (main.exe / main) located in a folder alongside the main executable.
 * 2. Loading the frontend from the "dist" folder using file://.
 * 3. Intercepting file:///api/v1 requests and redirecting them to http://localhost:8000/api/v1.
 * 4. Disabling webSecurity to allow loading local files without CORS issues.
 *
 * Key Points:
 * - In development mode, backend executables are taken from ../release/backend/<platform>.
 * - In production mode, backend executables are taken from a folder adjacent to the
 *   Electron executable, usually placed there by electron-builder (backend/win/main.exe, etc.).
 * - Frontend files are similarly loaded from ../release/frontend/dist in development,
 *   or from dist/ adjacent to the installed executable in production.
 *
 * Workflow:
 * - When Electron is ready, we set up request interception, spawn the backend,
 *   and create the browser window.
 * - Requests matching file:///api/v1 are redirected to http://localhost:8000/api/v1.
 * - The backend runs silently and is killed on before-quit.
 * - The browser window uses file:// to load index.html from the dist folder.
 *
 * Created by: Roman Rudyi
 */

const { app, BrowserWindow, session, screen } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "1";

const isDev = process.defaultApp || process.env.NODE_ENV === "development";
let backendProcess;

/**
 * Spawns the backend executable depending on the current platform and build mode.
 * On Windows in dev mode, it takes the file from ../release/backend/win/main.exe;
 * in production, it uses the folder adjacent to the installed .exe (backend/win/main.exe).
 * Similar logic applies for macOS and Linux.
 */
function startBackend() {
  let backendPath;

  if (process.platform === "win32") {
    if (isDev) {
      backendPath = path.join(__dirname, "..", "release", "backend", "win", "main.exe");
    } else {
      const exeDir = path.dirname(process.execPath);
      backendPath = path.join(exeDir, "backend", "win", "main.exe");
    }
    console.log("Launching backend on Win:", backendPath);

    backendProcess = spawn(backendPath, [], {
      shell: false,
      detached: false,
      stdio: "ignore",
      windowsHide: true
    });
  } else if (process.platform === "darwin") {
    if (isDev) {
      backendPath = path.join(__dirname, "..", "release", "backend", "mac", "main");
    } else {
      const exeDir = path.dirname(process.execPath);
      backendPath = path.join(exeDir, "backend", "mac", "main");
    }
    console.log("Launching backend on macOS:", backendPath);

    backendProcess = spawn(backendPath, [], {
      shell: false,
      detached: false,
      stdio: "ignore"
    });
  } else {
    if (isDev) {
      backendPath = path.join(__dirname, "..", "release", "backend", "linux", "main");
    } else {
      const exeDir = path.dirname(process.execPath);
      backendPath = path.join(exeDir, "backend", "linux", "main");
    }
    backendProcess = spawn(backendPath, [], {
      shell: false,
      detached: false,
      stdio: "ignore"
    });
  }
}

/**
 * Intercepts file:/// requests for /api/v1 paths and redirects them to
 * http://localhost:8000/api/v1 in order to bypass CORS restrictions and
 * seamlessly connect to the local backend.
 */
function setupRequestInterception() {
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["file://*/*"] }, (details, callback) => {
    const url = details.url;
    const windowsRegex = /^file:\/\/\/[A-Za-z]:\/api\/v1/;

    if (windowsRegex.test(url)) {
      const newUrl = url.replace(windowsRegex, "http://localhost:8000/api/v1");
      console.log(`Redirect (Win): ${url} -> ${newUrl}`);
      return callback({ redirectURL: newUrl });
    }

    if (url.startsWith("file:///api/v1")) {
      const newUrl = url.replace("file:///api/v1", "http://localhost:8000/api/v1");
      console.log(`Redirect (mac/linux): ${url} -> ${newUrl}`);
      return callback({ redirectURL: newUrl });
    }

    return callback({});
  });
}

/**
 * Creates the main application window, loads index.html from the dist folder using file://,
 * and disables webSecurity to allow local resource loading.
 */
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = Math.round(width * 0.9);
  const winHeight = Math.round(height * 0.9);

  const mainWin = new BrowserWindow({
    title: "Stardust VPN Client",
    width: winWidth,
    height: winHeight,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  let indexPath;
  if (isDev) {
    indexPath = path.join(__dirname, "..", "release", "frontend", "dist", "index.html");
  } else {
    const exeDir = path.dirname(process.execPath);
    indexPath = path.join(exeDir, "dist", "index.html");
  }

  console.log("Loading index from:", indexPath);
  mainWin.loadFile(indexPath);

  if (isDev) {
    mainWin.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  setupRequestInterception();
  startBackend();
  createWindow();
});

app.on("before-quit", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill("SIGINT");
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

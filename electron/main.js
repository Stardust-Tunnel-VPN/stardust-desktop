/**
 * Stardust VPN Client - Electron Main Process
 * 
 * This file serves as the main entry point for the Stardust VPN Client application, 
 * which is built using Electron. The application provides a desktop client for 
 * managing VPN connections, with a backend service and a frontend interface.
 * 
 * Key Features:
 * - Cross-platform support (Windows, macOS, Linux(in the future)). -> we're also planning ioS/Android in the future!
 * - Backend service integration for handling API requests.
 * - Frontend interface served via Electron's BrowserWindow.
 * - Request interception to redirect API calls to the backend service.
 * - Dynamic window sizing based on the user's screen resolution.
 * - Application-specific branding with custom icons and titles.
 * 
 * Modules and Dependencies:
 * - `electron`: Core Electron modules for creating the desktop application.
 * - `child_process`: Used to spawn the backend process.
 * - `path`: Provides utilities for working with file and directory paths.
 * 
 * Environment Variables:
 * - `ELECTRON_DISABLE_SECURITY_WARNINGS`: Disables Electron's security warnings 
 *   during development.
 * 
 * Functions:
 * 
 * 1. `startBackend()`
 *    - Launches the backend service as a detached process.
 *    - Determines the backend executable path based on the operating system.
 *    - Ensures the backend process runs independently of the Electron process.
 * 
 * 2. `setupRequestInterception()`
 *    - Intercepts file protocol requests made by the frontend.
 *    - Redirects API requests (e.g., `file:///api/v1`) to the backend service 
 *      running on `http://localhost:8000/api/v1`.
 *    - Logs redirection details for debugging purposes.
 * 
 * 3. `createWindow()`
 *    - Creates the main application window with a size of 90% of the user's 
 *      screen resolution.
 *    - Loads the frontend interface from the `dist` directory.
 *    - Sets the application icon for macOS using the `app.dock.setIcon()` method.
 * 
 * Application Lifecycle:
 * - `app.whenReady()`: Initializes the application by setting up request 
 *   interception, starting the backend, and creating the main window.
 * - `app.on("activate")`: Recreates the main window if all windows are closed 
 *   (macOS-specific behavior).
 * - `app.on("window-all-closed")`: Quits the application when all windows are 
 *   closed, except on macOS where the application remains active.
 * 
 * File Structure:
 * - Backend Executables:
 *   - Windows: `release/backend/win/main.exe`
 *   - macOS: `release/backend/mac/main`
 *   - Linux: `release/backend/linux/main`
 * - Frontend Files:
 *   - `release/frontend/dist/index.html`
 * - Assets:
 *   - Application logo: `assets/app_logo.png`
 * 
 * Notes:
 * - The application disables Node.js integration in the renderer process for 
 *   security purposes (`nodeIntegration: false`).
 * - Context isolation is enabled to prevent potential security vulnerabilities 
 *   (`contextIsolation: true`).
 * - The backend process is launched in a detached mode to ensure it continues 
 *   running even if the Electron process is terminated.
 * 
 * Usage:
 * - This file is intended to be used as the main process script for the Electron 
 *   application. It should be executed using Electron's runtime.
 * 
 * Example Command:
 * ```
 * electron /path/to/main.js
 * ```
 * 
 * Created by Roman Rudyi
 */



const { app, BrowserWindow, session, screen } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = '1';

let backendProcess;

function startBackend() {
  let backendPath;
  if (process.platform === "win32") {
    backendPath = path.join(__dirname, "..", "release", "backend", "win", "main.exe");
  } else if (process.platform === "darwin") {
    backendPath = path.join(__dirname, "..", "release", "backend", "mac", "main");
  } else {
    backendPath = path.join(__dirname, "..", "release", "backend", "linux", "main");
  }

  console.log("Launching backend from:", backendPath);
  backendProcess = spawn(backendPath, [], {
    detached: true,
    stdio: "ignore",
    shell: true, 
  });
  backendProcess.unref();
}

function setupRequestInterception() {
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["file://*/*"] }, (details, callback) => {
    if (details.url.startsWith("file:///api/v1")) {
      const newUrl = details.url.replace("file:///api/v1", "http://localhost:8000/api/v1");
      console.log(`Redirecting: ${details.url} --> ${newUrl}`);
      return callback({ redirectURL: newUrl });
    }
    return callback({});
  });
}

function createWindow() {
const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  // 90% from screen size
  const winWidth = Math.round(width * 0.9);
  const winHeight = Math.round(height * 0.9);
  const win = new BrowserWindow({
    title: "Stardust VPN Client", 
    width: winWidth,
    height: winHeight,
    
    icon: path.join(__dirname, "assets", "app_logo.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile(path.join(__dirname, "..", "release", "frontend", "dist", "index.html"));

  if (process.platform === "darwin") {
    app.dock.setIcon(path.join(__dirname, "assets", "app_logo.png"));
  }
}

app.setName("Stardust VPN Client");

app.whenReady().then(() => {
  setupRequestInterception(); 
  startBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

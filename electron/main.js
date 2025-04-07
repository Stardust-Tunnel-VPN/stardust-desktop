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

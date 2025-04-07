const { app, BrowserWindow, session } = require("electron");
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
  const win = new BrowserWindow({
    title: "Stardust VPN Client", 
    width: 1024,
    height: 768,
    
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

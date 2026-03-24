const fs = require("fs")
const path = require("path")
const { app } = require("electron")

const stateFile = path.join(app.getPath("userData"), "window-state.json")

const defaults = { width: 1000, height: 800 }

function loadWindowState() {
    try {
        const data = JSON.parse(fs.readFileSync(stateFile, "utf-8"))
        return { ...defaults, ...data }
    } catch (_e) {
        return { ...defaults }
    }
}

function saveWindowState(win) {
    if (!win || win.isDestroyed()) return
    const bounds = win.isMaximized() ? win._savedBounds || win.getBounds() : win.getBounds()
    const state = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: win.isMaximized()
    }
    try {
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 4))
    } catch (_e) {
        // ignore write errors
    }
}

function attachWindowStateHandlers(win) {
    win.on("resize", () => {
        if (!win.isMaximized()) {
            win._savedBounds = win.getBounds()
        }
    })
    win.on("move", () => {
        if (!win.isMaximized()) {
            win._savedBounds = win.getBounds()
        }
    })
    win.on("close", () => saveWindowState(win))
}

module.exports = { loadWindowState, saveWindowState, attachWindowStateHandlers }

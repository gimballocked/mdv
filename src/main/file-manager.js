const fs = require("fs")
const path = require("path")
const { app } = require("electron")

const recentFilePath = path.join(app.getPath("userData"), "recent-files.json")
const watchers = new Map()

function readMarkdownFile(filePath) {
    const content = fs.readFileSync(filePath, "utf-8")
    return {
        filePath: path.resolve(filePath),
        title: path.basename(filePath),
        content
    }
}

function watchFile(filePath, callback) {
    unwatchFile(filePath)
    const resolved = path.resolve(filePath)
    let debounceTimer = null

    function startWatch() {
        try {
            const watcher = fs.watch(resolved, () => {
                if (debounceTimer) clearTimeout(debounceTimer)
                debounceTimer = setTimeout(() => {
                    try {
                        const content = fs.readFileSync(resolved, "utf-8")
                        callback(resolved, content)
                    } catch (_e) {
                        // file may have been deleted momentarily (vim-style save)
                    }
                }, 100)
            })
            watcher.on("error", () => {
                // re-establish watch after a delay (handles delete+recreate)
                setTimeout(() => {
                    if (watchers.has(resolved)) {
                        startWatch()
                    }
                }, 500)
            })
            watchers.set(resolved, { watcher, debounceTimer: null })
        } catch (_e) {
            // file may not exist yet
        }
    }

    startWatch()
}

function unwatchFile(filePath) {
    const resolved = path.resolve(filePath)
    const entry = watchers.get(resolved)
    if (entry) {
        entry.watcher.close()
        if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
        watchers.delete(resolved)
    }
}

function unwatchAll() {
    for (const [, entry] of watchers) {
        entry.watcher.close()
        if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
    }
    watchers.clear()
}

function getRecentFiles() {
    try {
        return JSON.parse(fs.readFileSync(recentFilePath, "utf-8"))
    } catch (_e) {
        return []
    }
}

function addRecentFile(filePath) {
    const resolved = path.resolve(filePath)
    let recent = getRecentFiles()
    recent = recent.filter((f) => f !== resolved)
    recent.unshift(resolved)
    recent = recent.slice(0, 10)
    try {
        fs.writeFileSync(recentFilePath, JSON.stringify(recent, null, 4))
    } catch (_e) {
        // ignore
    }
    return recent
}

function clearRecentFiles() {
    try {
        fs.writeFileSync(recentFilePath, "[]")
    } catch (_e) {
        // ignore
    }
}

module.exports = { readMarkdownFile, watchFile, unwatchFile, unwatchAll, getRecentFiles, addRecentFile, clearRecentFiles }

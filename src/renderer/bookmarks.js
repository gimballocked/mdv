let marginEl = null
// Pixel threshold for snapping to an existing bookmark when clicking/toggling
const SNAP_PX = 10

function ensureMargin() {
    if (marginEl) return
    marginEl = document.createElement("div")
    marginEl.id = "bookmark-margin"
    document.getElementById("content-area").appendChild(marginEl)

    marginEl.addEventListener("click", (e) => {
        const tab = Tabs.getActiveTab()
        if (!tab) return
        const area = document.getElementById("content-area")
        if (!area || area.scrollHeight === 0) return

        // Convert click to absolute pixel position in the document
        const areaRect = area.getBoundingClientRect()
        const pixelY = e.clientY - areaRect.top + area.scrollTop

        toggleAtPosition(tab, pixelY)
    })
}

function toggle() {
    const tab = Tabs.getActiveTab()
    if (!tab) return
    if (!tab.bookmarks) tab.bookmarks = loadBookmarks(tab.filePath)

    const pixelY = typeof Cursor !== "undefined" ? Cursor.getPixel() : document.getElementById("content-area").scrollTop

    toggleAtPosition(tab, pixelY)
}

function toggleAtPosition(tab, pixelY) {
    if (!tab.bookmarks) tab.bookmarks = loadBookmarks(tab.filePath)

    // Anchor the bookmark to the text of the line it lands on, and snap it to that line
    const body = Tabs.getMarkdownBody(tab.id)
    const index = body ? TextAnchor.buildIndex(body) : null
    const created = index ? TextAnchor.capture(index, pixelY) : null
    const y = created ? created.y : pixelY

    // Check if near an existing bookmark, before or after snapping
    const existing = tab.bookmarks.findIndex((b) => Math.abs(b.y - pixelY) < SNAP_PX || Math.abs(b.y - y) < SNAP_PX)
    if (existing !== -1) {
        tab.bookmarks.splice(existing, 1)
    } else {
        tab.bookmarks.push(created || { y })
        tab.bookmarks.sort((a, b) => a.y - b.y)
    }

    saveBookmarks(tab.filePath, tab.bookmarks)
    updateMarkers()
}

function next() {
    const tab = Tabs.getActiveTab()
    if (!tab || !tab.bookmarks || tab.bookmarks.length === 0) return

    const area = document.getElementById("content-area")
    if (!area) return
    const current = typeof Cursor !== "undefined" ? Cursor.getPixel() : area.scrollTop

    let target = tab.bookmarks.find((b) => b.y > current + SNAP_PX)
    if (target === undefined) {
        const wrap = typeof Settings !== "undefined" && Settings.getWrapNavigation()
        if (!wrap) return
        target = tab.bookmarks[0]
    }

    scrollToBookmark(area, target.y)
}

function prev() {
    const tab = Tabs.getActiveTab()
    if (!tab || !tab.bookmarks || tab.bookmarks.length === 0) return

    const area = document.getElementById("content-area")
    if (!area) return
    const current = typeof Cursor !== "undefined" ? Cursor.getPixel() : area.scrollTop

    let target = null
    for (let i = tab.bookmarks.length - 1; i >= 0; i--) {
        if (tab.bookmarks[i].y < current - SNAP_PX) {
            target = tab.bookmarks[i]
            break
        }
    }
    if (target === null) {
        const wrap = typeof Settings !== "undefined" && Settings.getWrapNavigation()
        if (!wrap) return
        target = tab.bookmarks[tab.bookmarks.length - 1]
    }

    scrollToBookmark(area, target.y)
}

function scrollToBookmark(area, pixelY) {
    area.scrollTo({ top: pixelY - area.clientHeight / 2, behavior: "smooth" })
    if (typeof Cursor !== "undefined") {
        Cursor.update(pixelY)
    }
}

function clearAll() {
    const tab = Tabs.getActiveTab()
    if (!tab) return
    tab.bookmarks = []
    saveBookmarks(tab.filePath, tab.bookmarks)
    updateMarkers()
}

function updateMarkers() {
    ensureMargin()
    marginEl.innerHTML = ""

    const area = document.getElementById("content-area")
    if (!area) return

    // Collapse margin before measuring so it doesn't inflate scrollHeight
    marginEl.style.height = "0"
    marginEl.style.height = area.scrollHeight + "px"

    const tab = Tabs.getActiveTab()
    if (!tab || !tab.bookmarks || tab.bookmarks.length === 0) return

    for (const b of tab.bookmarks) {
        const marker = document.createElement("div")
        marker.className = "bookmark-marker"
        marker.style.top = b.y + "px"
        marginEl.appendChild(marker)
    }
}

// Called when a file is hot-reloaded. The re-render invalidates every pixel position, but a
// background tab has no layout to measure, so the work is deferred until the tab is shown.
function markStale(tab) {
    tab.bookmarksStale = true
}

function refreshMarkers(sharedIndex) {
    const tab = Tabs.getActiveTab()
    if (!tab) return
    if (!tab.bookmarks) tab.bookmarks = loadBookmarks(tab.filePath)

    if (tab.bookmarksStale) reanchor(tab, sharedIndex)

    // Prune bookmarks beyond content after a hot-reload
    const area = document.getElementById("content-area")
    if (area && tab.bookmarks.length > 0) {
        const body = Tabs.getMarkdownBody(tab.id)
        if (body) {
            const lastChild = body.lastElementChild
            if (lastChild) {
                const contentBottom = lastChild.offsetTop + lastChild.offsetHeight
                tab.bookmarks = tab.bookmarks.filter((b) => b.y <= contentBottom)
                saveBookmarks(tab.filePath, tab.bookmarks)
            }
        }
    }

    updateMarkers()
}

// Re-derive pixel positions by searching the re-rendered document for each bookmark's stashed
// text. Bookmarks whose line no longer exists are dropped rather than left pointing at nothing.
function reanchor(tab, sharedIndex) {
    if (!tab.bookmarks.some((b) => b.text)) {
        tab.bookmarksStale = false
        return
    }

    const body = Tabs.getMarkdownBody(tab.id)
    if (!body) return
    const index = sharedIndex && sharedIndex.body === body ? sharedIndex : TextAnchor.buildIndex(body)
    if (!index) return // no layout yet; try again once the tab is visible

    // Editors that truncate before writing can hand us an empty file for one reload. That is no
    // reason to throw bookmarks away, so keep them and re-anchor when the content comes back.
    if (!index.text) return

    tab.bookmarksStale = false

    const kept = []
    for (const b of tab.bookmarks) {
        if (!b.text) {
            kept.push(b) // never anchored (an older bookmark); leave it to pruning
            continue
        }
        const y = TextAnchor.resolve(index, b)
        if (y !== null) {
            b.y = y
            kept.push(b)
        }
    }

    kept.sort((a, b) => a.y - b.y)
    tab.bookmarks = kept
    saveBookmarks(tab.filePath, tab.bookmarks)
}

function deleteBookmarks(filePath) {
    try {
        localStorage.removeItem("mdv-bookmarks-" + filePath)
    } catch (_e) {
        // ignore
    }
}

function saveBookmarks(filePath, bookmarks) {
    try {
        if (bookmarks.length === 0) {
            localStorage.removeItem("mdv-bookmarks-" + filePath)
        } else {
            localStorage.setItem("mdv-bookmarks-" + filePath, JSON.stringify(bookmarks))
        }
    } catch (_e) {
        // ignore
    }
}

function loadBookmarks(filePath) {
    try {
        const data = localStorage.getItem("mdv-bookmarks-" + filePath)
        if (data) {
            const parsed = JSON.parse(data)
            // Bookmarks used to be stored as bare pixel positions, with no anchor text
            return parsed.map((b) => (typeof b === "number" ? { y: b } : b))
        }
    } catch (_e) {
        // ignore
    }
    return []
}

// eslint-disable-next-line no-unused-vars
const Bookmarks = { toggle, next, prev, clearAll, markStale, refreshMarkers, deleteBookmarks }

const tabs = []
let activeTabId = null
let nextTabId = 1

const tabBar = () => document.getElementById("tab-bar")
const contentArea = () => document.getElementById("content-area")

function createTab(filePath, title) {
    const id = nextTabId++
    const tab = { id, filePath, title, scrollTop: 0, content: "" }
    tabs.push(tab)

    // Create tab button
    const btn = document.createElement("div")
    btn.className = "tab-button"
    btn.dataset.tabId = id
    btn.title = filePath
    btn.innerHTML = `<span class="tab-title">${escapeHtml(title)}</span><span class="tab-close">&times;</span>`
    btn.querySelector(".tab-title").addEventListener("click", () => switchTab(id))
    btn.querySelector(".tab-close").addEventListener("click", (e) => {
        e.stopPropagation()
        closeTab(id)
    })
    tabBar().appendChild(btn)

    // Create content div
    const div = document.createElement("div")
    div.className = "tab-content"
    div.id = `tab-content-${id}`
    div.innerHTML = '<div class="markdown-body"></div>'
    contentArea().appendChild(div)

    switchTab(id)
    updateEmptyState()
    return id
}

function switchTab(id) {
    // Save current scroll
    if (activeTabId !== null) {
        const current = findTab(activeTabId)
        const currentDiv = document.getElementById(`tab-content-${activeTabId}`)
        if (current && currentDiv) {
            current.scrollTop = currentDiv.scrollTop
        }
    }

    activeTabId = id

    // Update tab button styles
    for (const btn of tabBar().querySelectorAll(".tab-button")) {
        btn.classList.toggle("active", parseInt(btn.dataset.tabId) === id)
    }

    // Show/hide content divs
    for (const div of contentArea().querySelectorAll(".tab-content")) {
        div.classList.toggle("hidden", div.id !== `tab-content-${id}`)
    }

    // Restore scroll
    const tab = findTab(id)
    const div = document.getElementById(`tab-content-${id}`)
    if (tab && div) {
        div.scrollTop = tab.scrollTop
    }

    // Update window title
    if (tab) {
        document.title = `${tab.title} - Markdown Viewer`
    }
}

function closeTab(id) {
    const idx = tabs.findIndex((t) => t.id === id)
    if (idx === -1) return

    const tab = tabs[idx]

    // Unwatch the file
    if (tab.filePath) {
        window.mdv.unwatchFile(tab.filePath)
    }

    // Remove DOM elements
    const btn = tabBar().querySelector(`[data-tab-id="${id}"]`)
    if (btn) btn.remove()
    const div = document.getElementById(`tab-content-${id}`)
    if (div) div.remove()

    tabs.splice(idx, 1)

    // Switch to adjacent tab if closing active
    if (activeTabId === id) {
        if (tabs.length > 0) {
            const newIdx = Math.min(idx, tabs.length - 1)
            switchTab(tabs[newIdx].id)
        } else {
            activeTabId = null
            document.title = "Markdown Viewer"
        }
    }

    updateEmptyState()
}

function getActiveTab() {
    return findTab(activeTabId)
}

function findTab(id) {
    return tabs.find((t) => t.id === id) || null
}

function findTabByPath(filePath) {
    return tabs.find((t) => t.filePath === filePath) || null
}

function getMarkdownBody(tabId) {
    const div = document.getElementById(`tab-content-${tabId || activeTabId}`)
    return div ? div.querySelector(".markdown-body") : null
}

function getTabContentDiv(tabId) {
    return document.getElementById(`tab-content-${tabId}`)
}

function updateEmptyState() {
    const empty = document.getElementById("empty-state")
    if (empty) {
        empty.classList.toggle("hidden", tabs.length > 0)
    }
    tabBar().classList.toggle("hidden", tabs.length === 0)
}


function escapeHtml(str) {
    const div = document.createElement("div")
    div.textContent = str
    return div.innerHTML
}

// eslint-disable-next-line no-unused-vars
const Tabs = { createTab, switchTab, closeTab, getActiveTab, findTabByPath, getMarkdownBody, getTabContentDiv }

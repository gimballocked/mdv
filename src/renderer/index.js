document.addEventListener("DOMContentLoaded", () => {
    Themes.loadSavedTheme()
    TOC.loadTocState()

    // Set up drag-and-drop
    document.addEventListener("dragover", (e) => {
        e.preventDefault()
        e.stopPropagation()
    })

    document.addEventListener("drop", async (e) => {
        e.preventDefault()
        e.stopPropagation()
        for (const file of e.dataTransfer.files) {
            const filePath = window.mdv.getPathForFile(file)
            if (filePath) {
                await openFile(filePath)
            }
        }
    })

    // Wire up IPC events from main process
    window.mdv.onOpenFile(async (filePath) => {
        await openFile(filePath)
    })

    window.mdv.onFileChanged(async (data) => {
        const tab = Tabs.findTabByPath(data.filePath)
        if (!tab) return

        const body = Tabs.getMarkdownBody(tab.id)
        if (!body) return

        // Save scroll position
        const contentDiv = Tabs.getTabContentDiv(tab.id)
        const scrollTop = contentDiv ? contentDiv.scrollTop : 0

        await Markdown.renderToContainer(data.content, body)
        Links.setupLinkHandling(body)
        TOC.generateTOC(body)

        // Restore scroll position
        if (contentDiv) {
            contentDiv.scrollTop = scrollTop
        }
    })

    window.mdv.onSetTheme((theme) => {
        Themes.setTheme(theme)
    })

    window.mdv.onToggleToc(() => {
        TOC.toggleTOC()
    })

    window.mdv.onCloseTab(() => {
        const tab = Tabs.getActiveTab()
        if (tab) Tabs.closeTab(tab.id)
    })

    // Empty state click opens file dialog
    document.getElementById("empty-state").addEventListener("click", async () => {
        const filePath = await window.mdv.openFileDialog()
        if (filePath) await openFile(filePath)
    })

    // Set up Prism autoloader path
    if (typeof Prism !== "undefined" && Prism.plugins && Prism.plugins.autoloader) {
        Prism.plugins.autoloader.languages_path = "../vendor/prism-components/"
    }

    // Open any files passed via CLI args
    window.mdv.getInitialFiles().then(async (files) => {
        for (const f of files) {
            await openFile(f)
        }
    })
})

async function openFile(filePath) {
    // Check if already open
    const existing = Tabs.findTabByPath(filePath)
    if (existing) {
        Tabs.switchTab(existing.id)
        return
    }

    const data = await window.mdv.readFile(filePath)
    if (data.error) {
        console.error("Failed to open file:", data.error)
        return
    }

    const tabId = Tabs.createTab(data.filePath, data.title)
    const body = Tabs.getMarkdownBody(tabId)
    if (body) {
        await Markdown.renderToContainer(data.content, body)
        Links.setupLinkHandling(body)
        TOC.generateTOC(body)
    }

    // Start watching for changes
    await window.mdv.watchFile(data.filePath)
}

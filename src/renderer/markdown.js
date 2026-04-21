let mermaidInitialized = false
let mermaidCounter = 0

function initMermaid() {
    if (mermaidInitialized) return
    mermaid.initialize({ startOnLoad: false, theme: "default" })
    mermaidInitialized = true
}

async function renderToContainer(source, container) {
    // Step 1: markdown-it rendering (via main process IPC)
    const html = await window.mdv.renderMarkdown(source)
    container.innerHTML = html

    // Step 2: Prism syntax highlighting
    Prism.highlightAllUnder(container)

    // Step 3: Mermaid diagrams
    initMermaid()
    const mermaidBlocks = container.querySelectorAll('pre > code[class*="language-mermaid"], pre > code[class*="language-mmd"]')
    for (const block of mermaidBlocks) {
        const pre = block.parentElement
        const code = block.textContent
        const id = `mermaid-${mermaidCounter++}`
        try {
            const { svg } = await mermaid.render(id, code)
            const div = document.createElement("div")
            div.className = "mermaid-diagram"
            div.innerHTML = svg
            pre.replaceWith(div)
        } catch (_e) {
            // Leave the code block as-is if mermaid fails
        }
    }

    // Step 4: Wrap tables in scrollable divs so wide tables get horizontal scrollbars
    for (const table of container.querySelectorAll("table")) {
        if (table.parentElement && table.parentElement.classList.contains("table-wrapper")) continue
        const wrapper = document.createElement("div")
        wrapper.className = "table-wrapper"
        table.parentNode.insertBefore(wrapper, table)
        wrapper.appendChild(table)
    }

    // Step 5: Sortable tables
    TableSort.init(container)

    // Step 5: KaTeX math rendering
    if (typeof renderMathInElement === "function") {
        renderMathInElement(container, {
            delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false },
                { left: "\\[", right: "\\]", display: true },
                { left: "\\(", right: "\\)", display: false }
            ],
            throwOnError: false
        })
    }
}

// eslint-disable-next-line no-unused-vars
const Markdown = { renderToContainer }

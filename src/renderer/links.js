function setupLinkHandling(container) {
    container.addEventListener("click", (e) => {
        const link = e.target.closest("a")
        if (!link) return

        const href = link.getAttribute("href")
        if (!href) return

        e.preventDefault()

        if (href.startsWith("#")) {
            // Internal anchor link — scroll to it
            const targetId = href.slice(1)
            const body = Tabs.getMarkdownBody()
            if (!body) return
            let target = body.querySelector(`[id="${CSS.escape(targetId)}"]`) || body.querySelector(`[name="${CSS.escape(targetId)}"]`)
            if (target) {
                // For empty anchors inside headings, scroll to the heading instead
                const heading = target.closest("h1, h2, h3, h4, h5, h6")
                if (heading) target = heading
                target.scrollIntoView({ behavior: "smooth" })
            }
        } else if (href.startsWith("http://") || href.startsWith("https://")) {
            // External link — open in default browser
            window.mdv.openExternalLink(href)
        }
        // All other links: do nothing (prevent navigation)
    })
}

// eslint-disable-next-line no-unused-vars
const Links = { setupLinkHandling }

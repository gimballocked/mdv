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
            const target = document.getElementById(targetId)
            if (target) {
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

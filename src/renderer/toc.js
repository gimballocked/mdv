let tocObserver = null
let tocVisible = false

function generateTOC(container) {
    const sidebar = document.getElementById("toc-sidebar")
    if (!sidebar) return

    const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6")
    if (headings.length === 0) {
        sidebar.innerHTML = ""
        return
    }

    // Ensure headings have ids
    const usedIds = new Set()
    for (const h of headings) {
        if (!h.id) {
            let id = h.textContent
                .toLowerCase()
                .replace(/[^\w\s-]/g, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-")
                .trim()
            while (usedIds.has(id)) {
                id += "-1"
            }
            h.id = id
        }
        usedIds.add(h.id)
    }

    // Build TOC list
    const list = document.createElement("ul")
    list.className = "toc-list"
    for (const h of headings) {
        const level = parseInt(h.tagName[1])
        const li = document.createElement("li")
        li.className = `toc-item toc-level-${level}`
        const a = document.createElement("a")
        a.href = `#${h.id}`
        a.textContent = h.textContent
        a.addEventListener("click", (e) => {
            e.preventDefault()
            h.scrollIntoView({ behavior: "smooth" })
        })
        li.appendChild(a)
        list.appendChild(li)
    }

    sidebar.innerHTML = '<div class="toc-header">Table of Contents</div>'
    sidebar.appendChild(list)

    // Set up scroll tracking
    setupScrollTracking(container, headings)
}

function setupScrollTracking(container, headings) {
    if (tocObserver) {
        tocObserver.disconnect()
    }

    // Find the scrollable parent (tab-content div)
    const scrollParent = container.closest(".tab-content") || container

    tocObserver = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    highlightTocItem(entry.target.id)
                }
            }
        },
        {
            root: scrollParent,
            rootMargin: "0px 0px -80% 0px",
            threshold: 0
        }
    )

    for (const h of headings) {
        tocObserver.observe(h)
    }
}

function highlightTocItem(id) {
    const sidebar = document.getElementById("toc-sidebar")
    if (!sidebar) return
    for (const a of sidebar.querySelectorAll("a")) {
        a.classList.toggle("active", a.getAttribute("href") === `#${id}`)
    }
}

function toggleTOC() {
    const sidebar = document.getElementById("toc-sidebar")
    if (!sidebar) return
    tocVisible = !tocVisible
    sidebar.classList.toggle("hidden", !tocVisible)
    try {
        localStorage.setItem("mdv-toc-visible", tocVisible ? "1" : "0")
    } catch (_e) {
        // ignore
    }
}

function loadTocState() {
    try {
        tocVisible = localStorage.getItem("mdv-toc-visible") === "1"
    } catch (_e) {
        tocVisible = false
    }
    const sidebar = document.getElementById("toc-sidebar")
    if (sidebar) {
        sidebar.classList.toggle("hidden", !tocVisible)
    }
}

function isTocVisible() {
    return tocVisible
}

// eslint-disable-next-line no-unused-vars
const TOC = { generateTOC, toggleTOC, isTocVisible, loadTocState }

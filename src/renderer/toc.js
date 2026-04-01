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

    const scrollParent = document.getElementById("content-area")
    const visibleHeadings = new Set()

    tocObserver = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    visibleHeadings.add(entry.target)
                } else {
                    visibleHeadings.delete(entry.target)
                }
            }
            // Highlight the topmost visible heading
            let topmost = null
            for (const h of visibleHeadings) {
                if (!topmost || h.offsetTop < topmost.offsetTop) {
                    topmost = h
                }
            }
            if (topmost) {
                highlightTocItem(topmost.id)
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
    let activeLink = null
    for (const a of sidebar.querySelectorAll("a")) {
        const isActive = a.getAttribute("href") === `#${id}`
        a.classList.toggle("active", isActive)
        if (isActive) activeLink = a
    }
    // Scroll the TOC sidebar so the active item is visible
    if (activeLink) {
        activeLink.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
}

function toggleTOC() {
    const sidebar = document.getElementById("toc-sidebar")
    const handle = document.getElementById("toc-resize-handle")
    if (!sidebar) return
    tocVisible = !tocVisible
    sidebar.classList.toggle("hidden", !tocVisible)
    if (handle) handle.classList.toggle("hidden", !tocVisible)
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
    const handle = document.getElementById("toc-resize-handle")
    if (sidebar) {
        sidebar.classList.toggle("hidden", !tocVisible)
        // Restore saved width
        try {
            const savedWidth = localStorage.getItem("mdv-toc-width")
            if (savedWidth) {
                sidebar.style.width = savedWidth + "px"
            }
        } catch (_e) {
            // ignore
        }
    }
    if (handle) {
        handle.classList.toggle("hidden", !tocVisible)
        setupResizeHandle(sidebar, handle)
    }
}

function setupResizeHandle(sidebar, handle) {
    let startX = 0
    let startWidth = 0

    handle.addEventListener("mousedown", (e) => {
        e.preventDefault()
        startX = e.clientX
        startWidth = sidebar.getBoundingClientRect().width
        handle.classList.add("dragging")
        document.body.style.cursor = "col-resize"
        document.body.style.userSelect = "none"

        function onMouseMove(e) {
            const newWidth = Math.max(120, Math.min(window.innerWidth / 2, startWidth + (e.clientX - startX)))
            sidebar.style.width = newWidth + "px"
        }

        function onMouseUp() {
            handle.classList.remove("dragging")
            document.body.style.cursor = ""
            document.body.style.userSelect = ""
            document.removeEventListener("mousemove", onMouseMove)
            document.removeEventListener("mouseup", onMouseUp)
            try {
                localStorage.setItem("mdv-toc-width", Math.round(sidebar.getBoundingClientRect().width))
            } catch (_e) {
                // ignore
            }
        }

        document.addEventListener("mousemove", onMouseMove)
        document.addEventListener("mouseup", onMouseUp)
    })
}

function isTocVisible() {
    return tocVisible
}

// eslint-disable-next-line no-unused-vars
const TOC = { generateTOC, toggleTOC, isTocVisible, loadTocState }

let findBarEl = null
let findInput = null
let matchCountEl = null
let currentIndex = -1
let matches = []
let matchPositions = [] // absolute document positions, computed once at search time
let matchCase = false
let wholeWord = false
let debounceTimer = null

// Search history FIFO (max 3)
const MAX_HISTORY = 3
let searchHistory = []
let historyIndex = -1 // -1 = current (new) input, 0 = most recent, etc.
let currentInput = "" // holds the user's in-progress text when navigating history

try {
    const saved = localStorage.getItem("mdv-find-history")
    if (saved) searchHistory = JSON.parse(saved)
} catch (_e) {
    // ignore
}

function addToHistory(query) {
    if (!query) return
    // Remove duplicate if already in history
    const idx = searchHistory.indexOf(query)
    if (idx !== -1) searchHistory.splice(idx, 1)
    searchHistory.unshift(query)
    if (searchHistory.length > MAX_HISTORY) searchHistory.pop()
    try { localStorage.setItem("mdv-find-history", JSON.stringify(searchHistory)) } catch (_e) { /* ignore */ }
}

function resetHistoryNavigation() {
    historyIndex = -1
    currentInput = ""
}

function createFindBar() {
    if (findBarEl) return

    // Restore persisted options
    try {
        matchCase = localStorage.getItem("mdv-find-match-case") === "1"
        wholeWord = localStorage.getItem("mdv-find-whole-word") === "1"
    } catch (_e) {
        // ignore
    }

    findBarEl = document.createElement("div")
    findBarEl.id = "find-bar"
    findBarEl.classList.add("hidden")

    findBarEl.innerHTML = `
        <div id="find-input-wrapper">
            <input type="text" id="find-input" placeholder="Find..." />
            <button id="find-clear" title="Clear">&times;</button>
        </div>
        <span id="find-match-count"></span>
        <button id="find-prev" title="Previous match (Shift+Enter)">&#x25B2;</button>
        <button id="find-next" title="Next match (Enter)">&#x25BC;</button>
        <label class="find-option" title="Match case">
            <input type="checkbox" id="find-match-case" ${matchCase ? "checked" : ""} />
            <span>Aa</span>
        </label>
        <label class="find-option" title="Whole word">
            <input type="checkbox" id="find-whole-word" ${wholeWord ? "checked" : ""} />
            <span class="find-whole-word-icon">ab</span>
        </label>
        <button id="find-close" title="Close (Escape)">&times;</button>
    `

    document.getElementById("main-container").appendChild(findBarEl)

    findInput = document.getElementById("find-input")
    matchCountEl = document.getElementById("find-match-count")

    findInput.addEventListener("input", () => {
        resetHistoryNavigation()
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => performSearch(), 200)
    })

    findInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault()
            addToHistory(findInput.value)
            resetHistoryNavigation()
            if (e.shiftKey) {
                navigateMatch(-1)
            } else {
                navigateMatch(1)
            }
        } else if (e.key === "Escape") {
            closeFindBar()
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            if (searchHistory.length === 0) return
            if (historyIndex === -1) currentInput = findInput.value
            const nextIdx = historyIndex + 1
            if (nextIdx >= searchHistory.length) return
            historyIndex = nextIdx
            findInput.value = searchHistory[historyIndex]
            performSearch()
        } else if (e.key === "ArrowDown") {
            e.preventDefault()
            if (historyIndex <= 0) return
            historyIndex--
            if (historyIndex === -1) {
                findInput.value = currentInput
            } else {
                findInput.value = searchHistory[historyIndex]
            }
            performSearch()
        }
    })

    document.getElementById("find-clear").addEventListener("click", () => {
        findInput.value = ""
        findInput.focus()
        clearHighlights()
        matches = []
        currentIndex = -1
        matchCountEl.textContent = ""
    })
    document.getElementById("find-prev").addEventListener("click", () => navigateMatch(-1))
    document.getElementById("find-next").addEventListener("click", () => navigateMatch(1))
    document.getElementById("find-close").addEventListener("click", () => closeFindBar())

    document.getElementById("find-match-case").addEventListener("change", (e) => {
        matchCase = e.target.checked
        try { localStorage.setItem("mdv-find-match-case", matchCase ? "1" : "0") } catch (_e) { /* ignore */ }
        performSearch()
    })

    document.getElementById("find-whole-word").addEventListener("change", (e) => {
        wholeWord = e.target.checked
        try { localStorage.setItem("mdv-find-whole-word", wholeWord ? "1" : "0") } catch (_e) { /* ignore */ }
        performSearch()
    })
}

function toggleFind() {
    createFindBar()
    if (findBarEl.classList.contains("hidden")) {
        openFindBar()
    } else {
        closeFindBar()
    }
}

function openFindBar() {
    createFindBar()
    findBarEl.classList.remove("hidden")
    findInput.focus()
    findInput.select()
    if (findInput.value) {
        performSearch()
    }
}

function closeFindBar() {
    if (!findBarEl) return
    findBarEl.classList.add("hidden")
    findInput.value = ""
    resetHistoryNavigation()
    clearHighlights()
    matchCountEl.textContent = ""
    currentIndex = -1
    matches = []
}

function getActiveBody() {
    const tab = Tabs.getActiveTab()
    if (!tab) return null
    return Tabs.getMarkdownBody(tab.id)
}

// Normalize typographic characters to ASCII equivalents for search matching.
// All replacements must be 1-to-1 to preserve string length alignment with the original text.
function normalizeQuotes(str) {
    return str
        .replace(/[\u2018\u2019\u201A\u2039\u203A]/g, "'")
        .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/[\u2026]/g, ".")
}

function performSearch() {
    clearHighlights()
    matches = []
    currentIndex = -1

    const query = findInput.value
    if (!query) {
        matchCountEl.textContent = ""
        return
    }

    const body = getActiveBody()
    if (!body) return

    // Build regex from query, normalizing smart quotes
    const normalizedQuery = normalizeQuotes(query)
    let pattern
    try {
        const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const wrapped = wholeWord ? `\\b${escaped}\\b` : escaped
        const flags = matchCase ? "g" : "gi"
        pattern = new RegExp(wrapped, flags)
    } catch (_e) {
        matchCountEl.textContent = "0 of 0"
        return
    }

    // Walk text nodes and find matches
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null)
    const textNodes = []
    let node
    while ((node = walker.nextNode())) {
        textNodes.push(node)
    }

    for (const textNode of textNodes) {
        // Normalize text for matching but use original text for display
        const originalText = textNode.textContent
        const text = normalizeQuotes(originalText)
        let match
        const fragments = []
        let lastIndex = 0

        pattern.lastIndex = 0
        while ((match = pattern.exec(text)) !== null) {
            if (match.index > lastIndex) {
                fragments.push({ text: originalText.slice(lastIndex, match.index), highlight: false })
            }
            fragments.push({ text: originalText.slice(match.index, match.index + match[0].length), highlight: true })
            lastIndex = pattern.lastIndex
            // Prevent infinite loop on zero-length matches
            if (match[0].length === 0) {
                pattern.lastIndex++
            }
        }

        if (fragments.length === 0) continue

        if (lastIndex < originalText.length) {
            fragments.push({ text: originalText.slice(lastIndex), highlight: false })
        }

        const parent = textNode.parentNode
        for (const frag of fragments) {
            if (frag.highlight) {
                const mark = document.createElement("mark")
                mark.className = "search-highlight"
                mark.textContent = frag.text
                matches.push(mark)
                parent.insertBefore(mark, textNode)
            } else {
                parent.insertBefore(document.createTextNode(frag.text), textNode)
            }
        }
        parent.removeChild(textNode)
    }

    // Compute absolute document positions with bookmark margin collapsed
    // so positions are relative to the true content height (matching the gradient)
    const area = document.getElementById("content-area")
    const bookmarkMargin = document.getElementById("bookmark-margin")
    if (bookmarkMargin) bookmarkMargin.style.height = "0"
    const areaRect = area.getBoundingClientRect()
    matchPositions = matches.map((m) => m.getBoundingClientRect().top - areaRect.top + area.scrollTop)
    const scrollHeight = area.scrollHeight
    if (bookmarkMargin) bookmarkMargin.style.height = scrollHeight + "px"

    updateMatchCount()
    updateScrollMarkers()
}

function navigateMatch(direction) {
    if (matches.length === 0) return

    const wrap = typeof Settings !== "undefined" && Settings.getWrapNavigation()
    const cursorPx = typeof Cursor !== "undefined" ? Cursor.getPixel() : null

    let newIndex
    // No active match yet — find the first match relative to cursor
    if (currentIndex === -1 || (cursorPx !== null && currentIndex >= 0 && Math.abs(matches[currentIndex].offsetTop - cursorPx) > 20)) {
        const refPx = cursorPx !== null ? cursorPx : document.getElementById("content-area").scrollTop
        if (direction > 0) {
            newIndex = matches.findIndex((m) => m.offsetTop >= refPx)
            if (newIndex === -1) newIndex = wrap ? 0 : -1
        } else {
            newIndex = -1
            for (let i = matches.length - 1; i >= 0; i--) {
                if (matches[i].offsetTop <= refPx) { newIndex = i; break }
            }
            if (newIndex === -1) newIndex = wrap ? matches.length - 1 : -1
        }
        if (newIndex === -1) return
    } else {
        newIndex = currentIndex + direction
        if (!wrap && (newIndex < 0 || newIndex >= matches.length)) return
        newIndex = (newIndex + matches.length) % matches.length
    }

    if (currentIndex >= 0) matches[currentIndex].classList.remove("active")
    currentIndex = newIndex
    matches[currentIndex].classList.add("active")
    matches[currentIndex].scrollIntoView({ block: "center", behavior: "smooth" })
    if (typeof Cursor !== "undefined") {
        Cursor.update(matches[currentIndex].offsetTop)
    }
    updateMatchCount()

    // Update scrollbar markers to reflect active match
    updateScrollMarkers()
}

function updateMatchCount() {
    if (matches.length === 0) {
        matchCountEl.textContent = findInput.value ? "0 results" : ""
    } else if (currentIndex === -1) {
        matchCountEl.textContent = `${matches.length} results`
    } else {
        matchCountEl.textContent = `${currentIndex + 1} of ${matches.length}`
    }
}

function updateScrollMarkers() {
    let track = document.getElementById("find-scroll-markers")
    if (!track) {
        track = document.createElement("div")
        track.id = "find-scroll-markers"
        document.getElementById("main-container").appendChild(track)
    }

    track.innerHTML = ""

    if (matchPositions.length === 0) {
        track.classList.add("hidden")
        return
    }

    track.classList.remove("hidden")

    const area = document.getElementById("content-area")
    if (!area) return

    // Collapse bookmark margin before measuring so it doesn't inflate scrollHeight
    const bookmarkMargin = document.getElementById("bookmark-margin")
    if (bookmarkMargin) bookmarkMargin.style.height = "0"
    const scrollHeight = area.scrollHeight
    if (bookmarkMargin) bookmarkMargin.style.height = scrollHeight + "px"

    // Use pre-computed positions and area.clientHeight as track height
    const trackHeight = area.clientHeight
    for (let i = 0; i < matchPositions.length; i++) {
        const marker = document.createElement("div")
        marker.className = "find-scroll-marker"
        if (i === currentIndex) marker.classList.add("active")
        const top = scrollHeight > 0 ? (matchPositions[i] / scrollHeight) * trackHeight : 0
        marker.style.top = top + "px"
        track.appendChild(marker)
    }
}

function clearHighlights() {
    const body = getActiveBody()
    if (!body) return

    const marks = body.querySelectorAll("mark.search-highlight")
    for (const mark of marks) {
        const parent = mark.parentNode
        parent.replaceChild(document.createTextNode(mark.textContent), mark)
        parent.normalize()
    }
    matches = []
    matchPositions = []
    currentIndex = -1

    const track = document.getElementById("find-scroll-markers")
    if (track) {
        track.innerHTML = ""
        track.classList.add("hidden")
    }
}

function refreshSearch() {
    clearHighlights()
    if (findBarEl && !findBarEl.classList.contains("hidden") && findInput.value) {
        performSearch()
    }
}

// eslint-disable-next-line no-unused-vars
function isOpen() {
    return findBarEl && !findBarEl.classList.contains("hidden")
}

const Find = { toggleFind, closeFindBar, clearHighlights, refreshSearch, isOpen }

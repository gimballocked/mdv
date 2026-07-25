// Text anchors pin a document position to the text that sits at it, so the position can be
// recovered after the file is re-rendered (hot-reload) and every pixel offset has changed.
//
// An anchor is a plain object:
//   y       absolute pixel position of the anchored line, as of the last resolve
//   text    document text starting at that line, normalized and length-capped
//   before  the text immediately preceding it, used to tell repeated lines apart
//   occ     which occurrence of `text` in the document was anchored
//   ratio   anchored offset / document text length, a last-resort tiebreaker

const ANCHOR_LEN = 120 // chars of text stashed to identify the line
const ANCHOR_CONTEXT_LEN = 64 // chars of preceding text stashed alongside it
const ANCHOR_MIN_LEN = 24 // shortest prefix of `text` accepted when the line was edited
const ANCHOR_MIN_CONTEXT = 4 // shorter context matches than this are coincidence
const ANCHOR_LINE_EPS = 2 // px tolerance when deciding two characters share a visual line
const ANCHOR_NUDGE = 8 // chars to search outward for a measurable character
const ANCHOR_LINE_SCAN = 600 // cap on the walk back to the start of a visual line
const ANCHOR_MAX_HITS = 2000 // cap on occurrences considered for one anchor

// Tags that start a new line in the flattened document text
const ANCHOR_BLOCK_TAGS = new Set([
    "ADDRESS",
    "ARTICLE",
    "ASIDE",
    "BLOCKQUOTE",
    "BR",
    "DD",
    "DETAILS",
    "DIV",
    "DL",
    "DT",
    "FIGCAPTION",
    "FIGURE",
    "FOOTER",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "HEADER",
    "HR",
    "LI",
    "MAIN",
    "NAV",
    "OL",
    "P",
    "PRE",
    "SECTION",
    "SUMMARY",
    "TABLE",
    "TBODY",
    "TD",
    "TFOOT",
    "TH",
    "THEAD",
    "TR",
    "UL"
])

// Flatten the rendered document into a single searchable string, keeping a mapping from
// string offsets back to DOM positions so any offset can be measured on screen.
//
// Runs of whitespace collapse to one space and block boundaries become newlines, so the
// text survives cosmetic source changes (re-wrapping, re-indenting) unchanged. Returns
// null when the body has no layout (a background tab), since nothing can be measured then.
//
// Indexing a large document costs tens of milliseconds, so callers that anchor several things at
// once (a reload re-anchors the scroll position, the cursor and every bookmark) build one index
// and pass it to each of them. An index is only valid until the document is next touched —
// including by search highlighting, which replaces the text nodes it matches inside.
function buildAnchorIndex(body) {
    const area = document.getElementById("content-area")
    if (!area || !body || !body.offsetParent) return null

    const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName
                // Skip non-content and the invisible MathML copy KaTeX renders alongside its output
                if (tag === "SCRIPT" || tag === "STYLE" || node.classList.contains("katex-mathml")) {
                    return NodeFilter.FILTER_REJECT
                }
            }
            return NodeFilter.FILTER_ACCEPT
        }
    })

    const segments = []
    const parts = []
    let length = 0
    let pending = "" // separator owed to the next character emitted: "" | " " | "\n"
    let preRoot = null // innermost <pre> being walked, where newlines are hard breaks

    let node
    while ((node = walker.nextNode())) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === "PRE") preRoot = node
            if (ANCHOR_BLOCK_TAGS.has(node.tagName)) pending = "\n"
            continue
        }

        const raw = node.nodeValue
        if (!raw) continue
        if (preRoot && !preRoot.contains(node)) preRoot = null

        let text = ""
        const offsets = [] // offsets[i] is the position of text[i] within raw
        let mapped = false // whether offsets diverges from a 1:1 mapping

        for (let i = 0; i < raw.length; i++) {
            const ch = raw[i]
            if (/\s/.test(ch)) {
                // A hard break outranks a space, so never downgrade one
                if (pending !== "\n") pending = preRoot && (ch === "\n" || ch === "\r") ? "\n" : " "
                continue
            }
            if (pending) {
                if (length + text.length > 0) {
                    text += pending
                    offsets.push(i)
                }
                pending = ""
            }
            text += ch
            offsets.push(i)
            if (offsets.length - 1 !== i) mapped = true
        }

        if (!text) continue
        segments.push({ node, start: length, end: length + text.length, map: mapped ? Int32Array.from(offsets) : null })
        parts.push(text)
        length += text.length
    }

    return { body, text: parts.join(""), segments, area, areaTop: area.getBoundingClientRect().top }
}

// Stash the text at a pixel position, snapped to the start of the visual line it lands on.
function captureAnchor(index, pixelY) {
    if (!index.text) return null

    const start = anchorOffsetAtY(index, pixelY)
    if (start === null) return null

    let text = index.text.slice(start, start + ANCHOR_LEN)
    const brk = text.indexOf("\n")
    if (brk !== -1) text = text.slice(0, brk)
    text = text.trimEnd()
    if (!text) return null

    const box = anchorBoxNear(index, start)
    return {
        y: box ? box.top : pixelY,
        text,
        before: index.text.slice(Math.max(0, start - ANCHOR_CONTEXT_LEN), start),
        occ: countOccurrencesBefore(index.text, text, start),
        ratio: start / index.text.length
    }
}

// Find where an anchor's text lives now and return its pixel position, or null if it is gone.
function resolveAnchor(index, anchor) {
    if (!anchor || !anchor.text || !index.text) return null

    let needle = anchor.text
    let hits = findAllOccurrences(index.text, needle)
    // The line itself may have been edited, so retry with shorter and shorter prefixes of it
    while (hits.length === 0 && needle.length > ANCHOR_MIN_LEN) {
        needle = needle.slice(0, Math.max(ANCHOR_MIN_LEN, needle.length >> 1))
        hits = findAllOccurrences(index.text, needle)
    }

    if (hits.length > 0) {
        const start = hits.length === 1 ? hits[0] : pickBestOccurrence(index.text, hits, anchor)
        const box = anchorBoxNear(index, start)
        if (box) return box.top
        return null
    }

    // Nothing of the line is left. If the text leading up to it survived, the position right
    // after that text is still exactly where the bookmark belongs. Whenever a suffix of that
    // text is still in the document so is every shorter one, so the longest surviving suffix
    // can be binary searched for.
    const before = anchor.before || ""
    let lo = ANCHOR_MIN_LEN
    let hi = before.length
    let tail = ""
    while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const candidate = before.slice(before.length - mid)
        if (index.text.includes(candidate)) {
            tail = candidate
            lo = mid + 1
        } else {
            hi = mid - 1
        }
    }
    if (!tail) return null

    const start = closestToRatio(index.text, findAllOccurrences(index.text, tail), anchor.ratio)
    const box = anchorBoxNear(index, start + tail.length)
    return box ? box.top : null
}

// Offset of the first character of the visual line at a pixel position. Character positions
// increase down the document, so the line can be found with a binary search.
function anchorOffsetAtY(index, pixelY) {
    const count = index.text.length
    if (count === 0) return null

    let lo = 0
    let hi = count - 1
    let found = null
    while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const box = anchorBoxNear(index, mid)
        if (box && box.bottom > pixelY) {
            found = mid
            hi = mid - 1
        } else {
            lo = mid + 1
        }
    }
    if (found === null) found = count - 1 // the position is past the end of the text

    // Characters of the same line can end at different depths (subscripts, mixed font sizes),
    // so walk back over everything that starts on the line the search landed on
    const base = anchorBoxNear(index, found)
    if (base) {
        for (let scanned = 0; found > 0 && scanned < ANCHOR_LINE_SCAN; scanned++) {
            const prev = anchorBoxAt(index, found - 1)
            if (!prev || prev.top < base.top - ANCHOR_LINE_EPS) break
            found--
        }
    }

    // Start on the line's text rather than on the whitespace that separates it from the line above
    while (found < count - 1 && /\s/.test(index.text[found])) found++
    return found
}

// Pixel box of a single character, in the same absolute document space as bookmark positions.
function anchorBoxAt(index, offset) {
    const pos = anchorDomPosition(index, offset)
    if (!pos) return null

    const range = document.createRange()
    range.setStart(pos.node, pos.offset)
    range.setEnd(pos.node, pos.offset + 1)
    const rect = range.getBoundingClientRect()
    if (rect.height === 0) return null // not rendered (hidden, or collapsed at a line break)

    const shift = index.area.scrollTop - index.areaTop
    return { top: rect.top + shift, bottom: rect.bottom + shift }
}

// As anchorBoxAt, but tolerates unmeasurable characters by looking at their neighbours.
function anchorBoxNear(index, offset) {
    for (let d = 0; d <= ANCHOR_NUDGE; d++) {
        const box = anchorBoxAt(index, offset + d) || (d > 0 ? anchorBoxAt(index, offset - d) : null)
        if (box) return box
    }
    return null
}

function anchorDomPosition(index, offset) {
    const segments = index.segments
    let lo = 0
    let hi = segments.length - 1
    while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const seg = segments[mid]
        if (offset < seg.start) {
            hi = mid - 1
        } else if (offset >= seg.end) {
            lo = mid + 1
        } else {
            const local = offset - seg.start
            const nodeOffset = seg.map ? seg.map[local] : local
            if (nodeOffset >= seg.node.nodeValue.length) return null
            return { node: seg.node, offset: nodeOffset }
        }
    }
    return null
}

function findAllOccurrences(haystack, needle) {
    const hits = []
    let i = haystack.indexOf(needle)
    while (i !== -1 && hits.length < ANCHOR_MAX_HITS) {
        hits.push(i)
        i = haystack.indexOf(needle, i + 1)
    }
    return hits
}

function countOccurrencesBefore(haystack, needle, limit) {
    let count = 0
    let i = haystack.indexOf(needle)
    while (i !== -1 && i < limit) {
        count++
        i = haystack.indexOf(needle, i + 1)
    }
    return count
}

// Repeated lines ("### Notes", "}") match in several places. Trust the surrounding text
// first, then the occurrence number, then how far the match moved within the document.
function pickBestOccurrence(haystack, hits, anchor) {
    let best = hits[0]
    let bestContext = -1
    let bestOcc = Infinity
    let bestRatio = Infinity

    for (let i = 0; i < hits.length; i++) {
        const preceding = haystack.slice(Math.max(0, hits[i] - ANCHOR_CONTEXT_LEN), hits[i])
        let context = commonSuffixLength(anchor.before || "", preceding)
        if (context < ANCHOR_MIN_CONTEXT) context = 0
        const occ = Math.abs(i - (anchor.occ || 0))
        const ratio = Math.abs(hits[i] / haystack.length - (anchor.ratio || 0))

        if (context > bestContext || (context === bestContext && (occ < bestOcc || (occ === bestOcc && ratio < bestRatio)))) {
            best = hits[i]
            bestContext = context
            bestOcc = occ
            bestRatio = ratio
        }
    }
    return best
}

function closestToRatio(haystack, hits, ratio) {
    let best = hits[0]
    let bestDistance = Infinity
    for (const hit of hits) {
        const distance = Math.abs(hit / haystack.length - (ratio || 0))
        if (distance < bestDistance) {
            best = hit
            bestDistance = distance
        }
    }
    return best
}

function commonSuffixLength(a, b) {
    let n = 0
    while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
    return n
}

// eslint-disable-next-line no-unused-vars
const TextAnchor = { buildIndex: buildAnchorIndex, capture: captureAnchor, resolve: resolveAnchor }

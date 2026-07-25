let cursorY = 0 // absolute pixel position in the document
let lockedUntil = 0 // timestamp: suppress clamping during smooth scrolls
let anchor = null // text the cursor sat on, held across a re-render

function clampToViewport() {
    if (Date.now() < lockedUntil) return
    const area = document.getElementById("content-area")
    if (!area) return
    const top = area.scrollTop
    const bottom = top + area.clientHeight
    if (cursorY < top) cursorY = top
    if (cursorY > bottom) cursorY = bottom
}

function setFromClick(clientY) {
    const area = document.getElementById("content-area")
    if (!area) return
    cursorY = clientY - area.getBoundingClientRect().top + area.scrollTop
    lockedUntil = 0
}

function update(pixelY) {
    cursorY = pixelY
    // Suppress clamping while the smooth scroll animation settles
    lockedUntil = Date.now() + 2000
}

function getPixel() {
    return cursorY
}

function getRatio() {
    const area = document.getElementById("content-area")
    if (!area || area.scrollHeight === 0) return 0
    return cursorY / area.scrollHeight
}

// Remember the text the cursor is sitting on, so that after the document is re-rendered the
// cursor can go back to the same line instead of to the same (now unrelated) pixel offset.
function captureAnchor(index) {
    anchor = null
    if (!index) return
    const captured = TextAnchor.capture(index, cursorY)
    if (captured) anchor = { body: index.body, captured, offset: cursorY - captured.y }
}

function restoreAnchor(index) {
    if (!anchor) return
    const held = anchor
    anchor = null
    if (!index || index.body !== held.body) return

    const y = TextAnchor.resolve(index, held.captured)
    if (y !== null) cursorY = y + held.offset
}

// eslint-disable-next-line no-unused-vars
const Cursor = { clampToViewport, setFromClick, update, getPixel, getRatio, captureAnchor, restoreAnchor }

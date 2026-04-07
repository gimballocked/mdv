// eslint-disable-next-line no-unused-vars
const TableSort = {
    init(container) {
        for (const table of container.querySelectorAll("table")) {
            const thead = table.querySelector("thead")
            if (!thead) continue

            const headers = thead.querySelectorAll("th")
            if (headers.length === 0) continue

            // Store original row order for reset
            const tbody = table.querySelector("tbody")
            if (!tbody) continue

            const originalRows = Array.from(tbody.rows)

            for (let colIndex = 0; colIndex < headers.length; colIndex++) {
                const th = headers[colIndex]
                th.classList.add("sortable")
                th.addEventListener("click", () => {
                    this._sortColumn(table, thead, tbody, originalRows, th, colIndex)
                })
            }
        }
    },

    _sortColumn(table, thead, tbody, originalRows, th, colIndex) {
        const currentDir = th.getAttribute("data-sort-dir")
        // Cycle: none -> asc -> desc -> none
        let newDir
        if (!currentDir) {
            newDir = "asc"
        } else if (currentDir === "asc") {
            newDir = "desc"
        } else {
            newDir = null
        }

        // Clear all headers in this table
        for (const h of thead.querySelectorAll("th")) {
            h.removeAttribute("data-sort-dir")
            h.classList.remove("sort-asc", "sort-desc")
        }

        if (!newDir) {
            // Reset to original order
            for (const row of originalRows) {
                tbody.appendChild(row)
            }
            return
        }

        th.setAttribute("data-sort-dir", newDir)
        th.classList.add(newDir === "asc" ? "sort-asc" : "sort-desc")

        const rows = Array.from(tbody.rows)
        rows.sort((a, b) => {
            const aText = a.cells[colIndex]?.textContent.trim() ?? ""
            const bText = b.cells[colIndex]?.textContent.trim() ?? ""

            // Try numeric comparison
            const aNum = parseFloat(aText)
            const bNum = parseFloat(bText)
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return newDir === "asc" ? aNum - bNum : bNum - aNum
            }

            // Fall back to locale string comparison
            const cmp = aText.localeCompare(bText, undefined, { numeric: true, sensitivity: "base" })
            return newDir === "asc" ? cmp : -cmp
        })

        for (const row of rows) {
            tbody.appendChild(row)
        }
    }
}

const fs = require("fs")
const path = require("path")

const vendorDir = path.join(__dirname, "..", "src", "vendor")

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

function copyFile(src, dest) {
    const destDir = path.dirname(dest)
    ensureDir(destDir)
    fs.copyFileSync(src, dest)
    console.log(`  ${path.relative(vendorDir, dest)}`)
}

function copyDir(src, dest) {
    ensureDir(dest)
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath)
        } else {
            copyFile(srcPath, destPath)
        }
    }
}

function resolve(pkg) {
    return path.join(__dirname, "..", "node_modules", pkg)
}

console.log("Copying vendor files to src/vendor/...")
ensureDir(vendorDir)

// Prism.js
copyFile(resolve("prismjs/prism.js"), path.join(vendorDir, "prism.js"))
copyFile(resolve("prismjs/themes/prism.css"), path.join(vendorDir, "prism.css"))
// Copy Prism autoloader and language components for on-demand loading
copyFile(resolve("prismjs/plugins/autoloader/prism-autoloader.min.js"), path.join(vendorDir, "prism-autoloader.min.js"))
copyDir(resolve("prismjs/components"), path.join(vendorDir, "prism-components"))

// Mermaid
copyFile(resolve("mermaid/dist/mermaid.min.js"), path.join(vendorDir, "mermaid.min.js"))

// KaTeX
copyFile(resolve("katex/dist/katex.min.js"), path.join(vendorDir, "katex.min.js"))
copyFile(resolve("katex/dist/katex.min.css"), path.join(vendorDir, "katex.min.css"))
copyFile(resolve("katex/dist/contrib/auto-render.min.js"), path.join(vendorDir, "auto-render.min.js"))
copyDir(resolve("katex/dist/fonts"), path.join(vendorDir, "fonts"))

// GitHub Markdown CSS
copyFile(resolve("github-markdown-css/github-markdown-light.css"), path.join(vendorDir, "github-markdown-light.css"))
copyFile(resolve("github-markdown-css/github-markdown-dark.css"), path.join(vendorDir, "github-markdown-dark.css"))

console.log("Done!")

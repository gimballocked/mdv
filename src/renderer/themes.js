const defaultTheme = "github-light"

function setTheme(themeName) {
    const link = document.getElementById("theme-link")
    if (link) {
        link.href = `../themes/${themeName}.css`
    }
    try {
        localStorage.setItem("mdv-theme", themeName)
    } catch (_e) {
        // ignore
    }
}

function loadSavedTheme() {
    let theme = defaultTheme
    try {
        theme = localStorage.getItem("mdv-theme") || defaultTheme
    } catch (_e) {
        // ignore
    }
    setTheme(theme)
    return theme
}

// eslint-disable-next-line no-unused-vars
const Themes = { setTheme, loadSavedTheme }

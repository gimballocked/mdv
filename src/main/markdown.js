const markdownit = require("markdown-it")
const footnote = require("markdown-it-footnote")
const taskLists = require("markdown-it-task-lists")
const abbr = require("markdown-it-abbr")
const deflist = require("markdown-it-deflist")
const sub = require("markdown-it-sub")
const sup = require("markdown-it-sup")
const ins = require("markdown-it-ins")
const mark = require("markdown-it-mark")
const emoji = require("markdown-it-emoji").full
const attrs = require("markdown-it-attrs")

const md = markdownit({
    html: true,
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
        const escaped = md.utils.escapeHtml(str)
        if (lang) {
            return `<pre class="language-${lang}"><code class="language-${lang}">${escaped}</code></pre>`
        }
        return `<pre><code>${escaped}</code></pre>`
    }
})
    .use(footnote)
    .use(taskLists, { enabled: true, label: true })
    .use(abbr)
    .use(deflist)
    .use(sub)
    .use(sup)
    .use(ins)
    .use(mark)
    .use(emoji)
    .use(attrs)

function renderMarkdown(source) {
    return md.render(source)
}

module.exports = { renderMarkdown }

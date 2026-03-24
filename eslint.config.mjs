import js from "@eslint/js"
import globals from "globals"

export default [
    {
        ignores: ["src/vendor/**"]
    },
    js.configs.recommended,
    {
        files: ["src/renderer/**/*.{js,mjs,cjs}"],
        languageOptions: {
            globals: {
                ...globals.browser,
                Prism: "readonly",
                mermaid: "readonly",
                katex: "readonly",
                renderMathInElement: "readonly",
                Tabs: "readonly",
                Markdown: "readonly",
                TOC: "readonly",
                Themes: "readonly",
                Links: "readonly"
            }
        },
        rules: {
            "no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_"
                }
            ]
        }
    },
    {
        files: ["src/main/**/*.{js,mjs,cjs}", "src/preload/**/*.{js,mjs,cjs}", "scripts/**/*.{js,mjs,cjs}"],
        languageOptions: {
            globals: {
                ...globals.node
            }
        },
        rules: {
            "no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_"
                }
            ]
        }
    }
]

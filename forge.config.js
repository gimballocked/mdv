const path = require("path")
const fs = require("fs")

function getOsRelease() {
    try {
        return fs.readFileSync("/etc/os-release", "utf-8").toLowerCase()
    } catch (_e) {
        return ""
    }
}

function isDebDistro() {
    const release = getOsRelease()
    return /\b(ubuntu|debian|mint|pop|elementary|zorin|kali|raspbian|mx\b|antix|deepin|lmde)/.test(release)
}

function isRpmDistro() {
    const release = getOsRelease()
    return /\b(fedora|rhel|centos|rocky|alma|opensuse|suse|amzn|ol)\b/.test(release)
}

function getLinuxMaker() {
    if (process.platform !== "linux") return null

    const iconPath = path.join(__dirname, "assets", "icon.png")
    if (isDebDistro()) {
        return {
            name: "@electron-forge/maker-deb",
            config: {
                mimeType: ["text/markdown"],
                desktopTemplate: path.join(__dirname, "assets", "desktop.ejs"),
                options: { name: "mdv", icon: iconPath }
            }
        }
    }
    if (isRpmDistro()) {
        return {
            name: "@electron-forge/maker-rpm",
            config: { mimeType: ["text/markdown"], options: { name: "mdv", icon: iconPath } }
        }
    }
    throw new Error(
        "Unsupported Linux distribution: could not detect a deb or rpm based distro from /etc/os-release. " +
            "Please add your distro to forge.config.js."
    )
}

const linuxMaker = getLinuxMaker()

module.exports = {
    packagerConfig: {
        asar: true,
        name: "Markdown Viewer",
        executableName: "mdv",
        appBundleId: "com.joedrago.mdv",
        icon: path.join(__dirname, "assets", "icon"),
        extendInfo: {
            CFBundleDocumentTypes: [
                {
                    CFBundleTypeName: "Markdown File",
                    CFBundleTypeExtensions: ["md", "markdown", "mdown", "mkd", "mkdn"],
                    CFBundleTypeRole: "Viewer",
                    LSHandlerRank: "Alternate"
                }
            ]
        }
    },
    rebuildConfig: {},
    makers: [
        {
            name: "@electron-forge/maker-squirrel",
            config: {
                name: "mdv"
            }
        },
        {
            name: "@electron-forge/maker-zip",
            platforms: ["darwin"]
        },
        ...(linuxMaker ? [linuxMaker] : []),
        {
            name: "@electron-forge/maker-zip",
            platforms: ["linux"]
        }
    ]
}

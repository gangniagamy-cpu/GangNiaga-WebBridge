// Research: Connect to Chrome via CDP without extension
const http = require('http');

// Try common CDP ports
const ports = [9222, 9223, 9224, 9225, 9333]

function tryPort(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/json`, (res) => {
            let data = ''
            res.on('data', d => data += d)
            res.on('end', () => {
                try {
                    const tabs = JSON.parse(data)
                    if (tabs.length > 0) {
                        tabs.forEach(t => console.log(`  ${t.url.substring(0, 80)}`))
                    }
                } catch (e) { /* ignore parse errors */ }
                resolve(true)
            })
        })
        req.on('error', () => resolve(false))
        req.setTimeout(500, () => { req.destroy(); resolve(false) })
    })
}

async function main() {
    let found = false
    for (const port of ports) {
        const ok = await tryPort(port)
        if (ok) {
            console.log(`Chrome CDP found on port ${port}`)
            found = true
        }
    }
    if (!found) {
        console.log('No Chrome CDP found on any port')
        console.log('Chrome must be started with --remote-debugging-port=9222')
    }
}

main()

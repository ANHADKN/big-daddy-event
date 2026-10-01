const { spawn } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const PAGES = [
    'http://localhost:3000/index.html',
    'http://localhost:3000/packages.html',
    'http://localhost:3000/gallery.html',
    'http://localhost:3000/about.html',
    'http://localhost:3000/contact.html'
];

async function checkConsole() {
    const port = 9988;
    const edge = spawn(edgePath, [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--disable-extensions',
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1600));

    try {
        const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await listRes.json();
        const page = list.find(t => t.type === 'page');

        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise(r => ws.onopen = r);

        let id = 1;
        const send = (method, params = {}) => new Promise((resolve) => {
            const reqId = id++;
            const handler = (evt) => {
                const msg = JSON.parse(evt.data);
                if (msg.id === reqId) {
                    ws.removeEventListener('message', handler);
                    resolve(msg.result);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id: reqId, method, params }));
        });

        const consoleMsgs = [];
        ws.addEventListener('message', (evt) => {
            const msg = JSON.parse(evt.data);
            if (msg.method === 'Runtime.consoleAPICalled') {
                consoleMsgs.push({
                    type: msg.params.type,
                    text: msg.params.args.map(a => a.value || a.description).join(' ')
                });
            } else if (msg.method === 'Runtime.exceptionThrown') {
                consoleMsgs.push({
                    type: 'exception',
                    text: msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception ? msg.params.exceptionDetails.exception.description : '')
                });
            }
        });

        await send('Page.enable');
        await send('Runtime.enable');

        for (const url of PAGES) {
            console.log(`Checking Console for ${url.split('/').pop()}...`);
            consoleMsgs.length = 0;
            await send('Page.navigate', { url });
            await new Promise(r => setTimeout(r, 1200));

            const errors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'exception');
            const warnings = consoleMsgs.filter(m => m.type === 'warning');

            console.log(`  Errors: ${errors.length}, Warnings: ${warnings.length}`);
            if (errors.length > 0) {
                console.log(`  Error details:`, errors);
            }
        }

        ws.close();
    } finally {
        edge.kill();
    }
}

checkConsole();

const http = require('http');
const { spawn } = require('child_process');

// Start msedge with remote debugging to query the DOM
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const args = [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--window-size=390,844',
    'http://localhost:3000/packages.html'
];

const proc = spawn(edgePath, args);

setTimeout(async () => {
    try {
        const listRes = await fetch('http://127.0.0.1:9222/json');
        const list = await listRes.json();
        const page = list.find(p => p.type === 'page');
        if (!page) {
            console.log('No page found');
            proc.kill();
            return;
        }

        const WebSocket = require('ws'); // check if available or use raw fetch
        console.log('Page target:', page.webSocketDebuggerUrl);
    } catch (e) {
        console.log('Direct test error:', e.message);
    }
    proc.kill();
}, 2000);

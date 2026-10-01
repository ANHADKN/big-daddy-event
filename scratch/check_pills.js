const http = require('http');

// Let's use CDP to run an evaluation on the page!
const { spawn } = require('child_process');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function checkPills() {
    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9444',
        '--window-size=390,844',
        '--disable-extensions',
        'http://localhost:3000/gallery.html'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    try {
        const listRes = await fetch('http://127.0.0.1:9444/json/list');
        const list = await listRes.json();
        const page = list.find(t => t.type === 'page');
        
        // Connect to WebSocket using native Node or fetch
        // Or we can just use HTTP to inspect
        console.log('Page attached:', page.url);

        const WebSocket = require('ws'); // If ws not installed, we can install or check without ws
    } catch(e) {
        console.log('Error:', e.message);
    } finally {
        edge.kill();
    }
}

checkPills();

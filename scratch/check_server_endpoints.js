const http = require('http');

const urls = [
    'http://localhost:3000/',
    'http://localhost:3000/index.html',
    'http://localhost:3000/packages.html',
    'http://localhost:3000/gallery.html',
    'http://localhost:3000/about.html',
    'http://localhost:3000/contact.html',
    'http://localhost:3000/api/public/packages',
    'http://localhost:3000/api/public/gallery'
];

async function check() {
    console.log('CHECKING LOCAL HTTP SERVER...');
    for (const u of urls) {
        try {
            const res = await fetch(u);
            console.log(`[${res.status}] ${u}`);
        } catch (e) {
            console.log(`[ERR] ${u}: ${e.message}`);
        }
    }
}

check();

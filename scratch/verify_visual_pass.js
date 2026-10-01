const { execSync } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const pages = [
    { name: 'home', path: 'index.html' },
    { name: 'packages', path: 'packages.html' },
    { name: 'gallery', path: 'gallery.html' },
    { name: 'about', path: 'about.html' },
    { name: 'contact', path: 'contact.html' }
];

console.log('--- CAPTURING REQUIRED 390PX AFTER SCREENSHOTS ---');
for (const p of pages) {
    const out = `D:\\BIG BADDY\\big daddy\\big daddy\\scratch\\device_${p.name}_390_after.png`;
    const cmd = `"${edgePath}" --headless=new --window-size=390,844 --hide-scrollbars --screenshot="${out}" "http://localhost:3000/${p.path}"`;
    try {
        execSync(cmd);
        console.log(`Saved: device_${p.name}_390_after.png`);
    } catch (e) {
        console.error(`Failed ${p.name}:`, e.message);
    }
}

console.log('\n--- CAPTURING DESKTOP REGRESSION VERIFICATION SCREENSHOTS ---');
const desktopViewports = [
    { w: 1280, h: 800, label: '1280' },
    { w: 1366, h: 768, label: '1366' },
    { w: 1440, h: 900, label: '1440' },
    { w: 1920, h: 1080, label: '1920' }
];

for (const v of desktopViewports) {
    const out = `D:\\BIG BADDY\\big daddy\\big daddy\\scratch\\desktop_home_${v.label}.png`;
    const cmd = `"${edgePath}" --headless=new --window-size=${v.w},${v.h} --hide-scrollbars --screenshot="${out}" "http://localhost:3000/index.html"`;
    try {
        execSync(cmd);
        console.log(`Saved: desktop_home_${v.label}.png (${v.w}x${v.h})`);
    } catch (e) {
        console.error(`Failed desktop ${v.label}:`, e.message);
    }
}

console.log('\n--- CAPTURING TARGET TABLET / INTERMEDIATE DEVICES ---');
const targetDevices = [
    { w: 412, h: 915, label: '412' },
    { w: 480, h: 900, label: '480' },
    { w: 768, h: 1024, label: '768' },
    { w: 820, h: 1180, label: '820' },
    { w: 1024, h: 1366, label: '1024' }
];

for (const d of targetDevices) {
    const out = `D:\\BIG BADDY\\big daddy\\big daddy\\scratch\\device_home_${d.label}.png`;
    const cmd = `"${edgePath}" --headless=new --window-size=${d.w},${d.h} --hide-scrollbars --screenshot="${out}" "http://localhost:3000/index.html"`;
    try {
        execSync(cmd);
        console.log(`Saved: device_home_${d.label}.png (${d.w}x${d.h})`);
    } catch (e) {
        console.error(`Failed device ${d.label}:`, e.message);
    }
}

console.log('\nAll captures completed.');

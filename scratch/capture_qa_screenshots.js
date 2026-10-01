const { execSync } = require('child_process');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const captures = [
    { name: 'qa_home_390', url: 'http://localhost:3000/index.html', w: 390, h: 844 },
    { name: 'qa_packages_390', url: 'http://localhost:3000/packages.html', w: 390, h: 844 },
    { name: 'qa_gallery_390', url: 'http://localhost:3000/gallery.html', w: 390, h: 844 },
    { name: 'qa_about_390', url: 'http://localhost:3000/about.html', w: 390, h: 844 },
    { name: 'qa_contact_390', url: 'http://localhost:3000/contact.html', w: 390, h: 844 },
    { name: 'qa_home_768', url: 'http://localhost:3000/index.html', w: 768, h: 1024 },
    { name: 'qa_home_1440', url: 'http://localhost:3000/index.html', w: 1440, h: 900 }
];

console.log('Capturing QA verification screenshots...');
for (const c of captures) {
    try {
        const outPath = `D:\\BIG BADDY\\big daddy\\big daddy\\scratch\\${c.name}.png`;
        const cmd = `"${edgePath}" --headless=new --window-size=${c.w},${c.h} --hide-scrollbars --screenshot="${outPath}" "${c.url}"`;
        execSync(cmd);
        console.log(`Saved: ${c.name}.png (${c.w}x${c.h})`);
    } catch (e) {
        console.error(`Failed ${c.name}:`, e.message);
    }
}
console.log('Screenshots complete.');

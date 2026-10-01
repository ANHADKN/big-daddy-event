const { execSync } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const positions = [
    { name: 'center', pos: '50% 50%' },
    { name: 'shift70', pos: '70% 50%' },
    { name: 'shift85', pos: '85% 50%' },
    { name: 'shift95', pos: '95% 50%' }
];

for (const p of positions) {
    const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="style.css">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
.hero { width: 100%; height: 100vh; position: relative; overflow: hidden; }
.hero-image { width: 100%; height: 100%; object-fit: cover; object-position: ${p.pos}; }
</style>
</head>
<body>
<section class="hero">
  <img src="assets/images/hero/home-page.webp" class="hero-image">
</section>
</body>
</html>`;
    fs.writeFileSync('public/test_pos.html', html);
    const outPath = `D:\\BIG BADDY\\big daddy\\big daddy\\scratch\\pos_${p.name}.png`;
    execSync(`"${edgePath}" --headless=new --window-size=390,844 --hide-scrollbars --screenshot="${outPath}" "http://localhost:3000/test_pos.html"`);
    console.log(`Captured pos_${p.name}.png`);
}

const http = require('http');

// Let's add a small console.log snippet into a temporary test page or check directly
const fs = require('fs');

// We can read packages.html, temporarily insert a debug script at the end of body, run headless edge to load it, and output to a file or stdout
const html = fs.readFileSync('D:/BIG BADDY/big daddy/big daddy/public/packages.html', 'utf8');

const debugScript = `
<script>
window.addEventListener('load', () => {
    const wide = [];
    document.querySelectorAll('*').forEach(el => {
        if (el.getBoundingClientRect().right > window.innerWidth || el.scrollWidth > window.innerWidth) {
            wide.push({
                tag: el.tagName,
                cls: el.className,
                id: el.id,
                rectRight: el.getBoundingClientRect().right,
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
                innerWidth: window.innerWidth
            });
        }
    });
    console.log('OVERFLOW_ELEMENTS:', JSON.stringify(wide, null, 2));
    const div = document.createElement('div');
    div.id = 'overflow-debug';
    div.textContent = JSON.stringify(wide);
    document.body.appendChild(div);
});
</script>
`;

fs.writeFileSync('D:/BIG BADDY/big daddy/big daddy/public/packages_debug.html', html.replace('</body>', debugScript + '</body>'));
console.log('packages_debug.html written');

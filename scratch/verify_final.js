const fs = require('fs');

const html = fs.readFileSync('D:/BIG BADDY/big daddy/big daddy/public/packages.html', 'utf8');

// Check key elements
const checks = [
    { name: 'Bronze tab exists', pass: html.includes('data-tab="bronze"') },
    { name: 'Silver tab exists', pass: html.includes('data-tab="silver"') },
    { name: 'Gold tab exists', pass: html.includes('data-tab="gold"') },
    { name: 'Premium tab exists', pass: html.includes('data-tab="premium"') },
    { name: 'Premium Plus tab exists', pass: html.includes('data-tab="premium-plus"') },
    { name: 'All Packages tab exists', pass: html.includes('data-tab="all"') },
    { name: 'View Details button exists', pass: html.includes('btn-editorial--details') },
    { name: 'WhatsApp button exists', pass: html.includes('btn-editorial--whatsapp') },
    { name: 'WhatsApp phone 917034252988 present', pass: html.includes('917034252988') },
    { name: 'Inline details panel logic preserved', pass: html.includes('toggleDetails') },
    { name: 'No redundant Package Services heading on card', pass: !html.includes('Package Services') }
];

console.log('PACKAGES HTML VERIFICATION:');
checks.forEach(c => console.log(`[${c.pass ? 'PASS' : 'FAIL'}] ${c.name}`));

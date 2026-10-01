const fs = require('fs');

const html = `
<!DOCTYPE html>
<html>
<body>
<script>
window.addEventListener('load', () => {
    fetch('http://localhost:3000/packages.html')
        .then(r => r.text())
        .then(t => {
            console.log('Done');
        });
});
</script>
</body>
</html>
`;

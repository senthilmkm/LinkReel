const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'certs');
const dest = path.join(__dirname, '..', 'dist', 'certs');
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });

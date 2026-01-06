const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'lib', 'server-external-packages.json');
const targetDir = path.dirname(targetFile);

// Create directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Create file if it doesn't exist
if (!fs.existsSync(targetFile)) {
  fs.writeFileSync(targetFile, '{}', 'utf8');
  console.log('Created missing server-external-packages.json file');
}

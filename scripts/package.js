const { exec } = require('child_process');

console.log('Packaging app...');
exec('electron-builder', (err) => {
  if (err) console.error(err);
  else console.log('Packaging complete.');
});

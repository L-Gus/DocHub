const { exec } = require('child_process');

console.log('Starting dev mode...');
exec('npm run build && npm start', (err) => {
  if (err) console.error(err);
});

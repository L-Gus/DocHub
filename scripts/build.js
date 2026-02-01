const { exec } = require('child_process');

console.log('Building Rust backend...');
exec('cd core-backend && cargo build --release', (err) => {
  if (err) console.error(err);
  else console.log('Rust build complete.');
});

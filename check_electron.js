const electron = require('electron');
console.log('Versions:', process.versions);
console.log('Env ELECTRON_RUN_AS_NODE:', process.env.ELECTRON_RUN_AS_NODE);
console.log('Type of electron:', typeof electron);
console.log('Value:', electron);
if (electron.app) {
  console.log('App version:', electron.app.getVersion());
  electron.app.quit();
} else {
  console.log('App is undefined');
  process.exit(1);
}

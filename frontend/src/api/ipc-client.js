const { ipcRenderer } = require('electron');

export class IpcClient {
  static send(channel, data) {
    ipcRenderer.send(channel, data);
  }

  static on(channel, callback) {
    ipcRenderer.on(channel, callback);
  }
}

import { DropZone } from '../components/forms/drop-zone.js';
import { FileInput } from '../components/forms/file-input.js';

export class MergeView {
  constructor() {
    this.files = [];
  }

  render() {
    const view = document.getElementById('router-view');
    view.innerHTML = `
      <div class="merge-view">
        <h2>Mesclar PDFs</h2>
        <div id="drop-zone"></div>
        <button id="merge-btn">Mesclar</button>
        <div id="output"></div>
      </div>
    `;
    const dropZone = new DropZone('drop-zone');
    dropZone.onFilesSelected = (files) => {
      this.files = files;
    };
    document.getElementById('merge-btn').addEventListener('click', this.merge.bind(this));

    // Listen for response
    const { ipcRenderer } = require('electron');
    ipcRenderer.on('from-rust', (event, response) => {
      document.getElementById('output').textContent = JSON.stringify(response);
    });
  }

  merge() {
    if (this.files.length === 0) {
      alert('Selecione arquivos primeiro');
      return;
    }
    const filePaths = this.files.map(f => f.path);
    const output = 'merged.pdf'; // Or prompt for name
    const { ipcRenderer } = require('electron');
    ipcRenderer.send('to-rust', { action: 'merge', data: { files: filePaths, output } });
  }

  destroy() {
    // Cleanup
  }
}

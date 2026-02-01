export class SplitView {
  constructor() {
    this.file = null;
  }

  render() {
    const view = document.getElementById('router-view');
    view.innerHTML = `
      <div class="split-view">
        <h2>Dividir PDF</h2>
        <input type="file" id="file-input" accept=".pdf">
        <input type="text" id="ranges" placeholder="Ex: 1-3,5-10">
        <button id="split-btn">Dividir</button>
        <div id="output"></div>
      </div>
    `;
    document.getElementById('file-input').addEventListener('change', (e) => {
      this.file = e.target.files[0];
    });
    document.getElementById('split-btn').addEventListener('click', this.split.bind(this));

    // Listen for response
    const { ipcRenderer } = require('electron');
    ipcRenderer.on('from-rust', (event, response) => {
      document.getElementById('output').textContent = JSON.stringify(response);
    });
  }

  split() {
    if (!this.file) {
      alert('Selecione um arquivo');
      return;
    }
    const ranges = this.parseRanges(document.getElementById('ranges').value);
    const output_dir = './output'; // Or choose dir
    const { ipcRenderer } = require('electron');
    ipcRenderer.send('to-rust', { action: 'split', data: { file: this.file.path, ranges, output_dir } });
  }

  parseRanges(str) {
    return str.split(',').map(r => {
      const [start, end] = r.split('-').map(Number);
      return [start, end];
    });
  }

  destroy() {
    // Cleanup
  }
}

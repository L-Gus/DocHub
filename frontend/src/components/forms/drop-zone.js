export class DropZone {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.files = [];
    this.onFilesSelected = null;
    this.init();
  }

  init() {
    this.container.innerHTML = '<div class="drop-zone">Arraste arquivos aqui</div>';
    this.container.addEventListener('dragover', this.handleDragOver.bind(this));
    this.container.addEventListener('drop', this.handleDrop.bind(this));
  }

  handleDragOver(e) {
    e.preventDefault();
  }

  handleDrop(e) {
    e.preventDefault();
    this.files = Array.from(e.dataTransfer.files);
    if (this.onFilesSelected) {
      this.onFilesSelected(this.files);
    }
    console.log(this.files);
  }
}

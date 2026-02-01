export class FileInput {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.init();
  }

  init() {
    this.container.innerHTML = '<input type="file" multiple>';
  }
}

export class RangeInput {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.init();
  }

  init() {
    this.container.innerHTML = '<input type="text" placeholder="1-5,7-10">';
  }
}

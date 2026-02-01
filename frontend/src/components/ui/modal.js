export class Modal {
  constructor(content) {
    this.element = document.createElement('div');
    this.element.className = 'modal';
    this.element.innerHTML = content;
  }

  show() {
    document.body.appendChild(this.element);
  }

  hide() {
    this.element.remove();
  }
}

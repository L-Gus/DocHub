export class Toast {
  constructor(message) {
    this.element = document.createElement('div');
    this.element.className = 'toast';
    this.element.textContent = message;
    setTimeout(() => this.hide(), 3000);
  }

  show() {
    document.body.appendChild(this.element);
  }

  hide() {
    this.element.remove();
  }
}

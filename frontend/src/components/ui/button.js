export class Button {
  constructor(text, onClick) {
    this.element = document.createElement('button');
    this.element.textContent = text;
    this.element.addEventListener('click', onClick);
  }

  render() {
    return this.element;
  }
}

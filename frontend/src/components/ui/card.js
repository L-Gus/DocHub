export class Card {
  constructor(content) {
    this.element = document.createElement('div');
    this.element.className = 'card';
    this.element.innerHTML = content;
  }

  render() {
    return this.element;
  }
}

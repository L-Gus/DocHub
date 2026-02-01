export class PdfCard {
  constructor(pdf) {
    this.pdf = pdf;
  }

  render() {
    return `<div class="pdf-card">${this.pdf.name}</div>`;
  }
}

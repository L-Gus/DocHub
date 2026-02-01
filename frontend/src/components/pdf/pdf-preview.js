export class PdfPreview {
  constructor(pdf) {
    this.pdf = pdf;
  }

  render() {
    return `<div class="pdf-preview">Preview of ${this.pdf.name}</div>`;
  }
}

export class PdfStore {
  constructor() {
    this.pdfs = [];
  }

  addPdf(pdf) {
    this.pdfs.push(pdf);
  }
}

import { PdfCard } from './pdf-card.js';

export class PdfList {
  constructor(pdfs) {
    this.pdfs = pdfs;
  }

  render() {
    return this.pdfs.map(pdf => new PdfCard(pdf).render()).join('');
  }
}

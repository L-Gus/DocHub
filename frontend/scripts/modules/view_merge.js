// No view_merge.js
import { createMergeCard } from './pdf_card.js';

// Adicionar um novo card
const pdfData = {
  id: 'unique_id',
  name: 'documento.pdf',
  path: '/caminho/arquivo.pdf',
  pages: 10,
  size: '2.4 MB',
  thumbnail: 'data:image/png;base64,...' // opcional
};

const card = createMergeCard(pdfData);
document.getElementById('pdf-cards-container').appendChild(card);
export class PdfCard {
  constructor(pdf, type = 'default') {
    this.pdf = pdf;
    this.type = type;
    this.element = null;
    this.render();
  }

  render() {
    // Cria elemento do card
    this.element = document.createElement('div');
    this.element.className = `pdf-card pdf-card-${this.type}`;
    this.element.setAttribute('data-pdf-id', this.pdf.id);

    // Template do card
    this.element.innerHTML = `
      <div class="pdf-card-header">
        <div class="pdf-card-icon">📄</div>
        <div class="pdf-card-info">
          <div class="pdf-card-name" title="${this.pdf.name}">${this.pdf.name}</div>
          <div class="pdf-card-meta">
            <span class="pdf-card-size">${this.formatSize(this.pdf.size)}</span>
            ${this.pdf.pages ? `<span class="pdf-card-pages">${this.pdf.pages} páginas</span>` : ''}
          </div>
        </div>
        <button class="pdf-card-remove" title="Remover PDF" data-action="remove">
          <span>×</span>
        </button>
      </div>

      ${this.pdf.thumbnail ? `
        <div class="pdf-card-preview">
          <img src="${this.pdf.thumbnail}" alt="Preview ${this.pdf.name}" />
        </div>
      ` : ''}

      <div class="pdf-card-actions">
        <button class="pdf-card-action" data-action="preview" title="Visualizar">
          <span>👁</span>
        </button>
        <button class="pdf-card-action" data-action="info" title="Informações">
          <span>ℹ</span>
        </button>
      </div>
    `;

    // Adiciona event listeners
    this.bindEvents();

    return this.element;
  }

  bindEvents() {
    // Botão remover
    const removeBtn = this.element.querySelector('[data-action="remove"]');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        this.element.dispatchEvent(new CustomEvent('pdf-remove', {
          detail: { pdfId: this.pdf.id },
          bubbles: true
        }));
      });
    }

    // Botão preview
    const previewBtn = this.element.querySelector('[data-action="preview"]');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        this.element.dispatchEvent(new CustomEvent('pdf-preview', {
          detail: { pdf: this.pdf },
          bubbles: true
        }));
      });
    }

    // Botão info
    const infoBtn = this.element.querySelector('[data-action="info"]');
    if (infoBtn) {
      infoBtn.addEventListener('click', () => {
        this.element.dispatchEvent(new CustomEvent('pdf-info', {
          detail: { pdf: this.pdf },
          bubbles: true
        }));
      });
    }
  }

  formatSize(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  update(pdf) {
    this.pdf = { ...this.pdf, ...pdf };
    this.render();
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

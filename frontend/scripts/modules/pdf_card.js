// frontend/scripts/modules/pdf_card.js
/**
 * PDF Card – Fábrica de Componentes PDF (Refatorado)
 * Foco: Modularidade, Interatividade e Estados Visuais
 */

import { showToast, removePdf } from '../../app.js';

// ===============================
// CONFIGURAÇÕES E PRESETS
// ===============================
const CARD_PRESETS = Object.freeze({
  merge: {
    className: 'pdf-card merge-card',
    icon: '📄',
    showRemove: true,
    showDragHandle: true,
    interactive: true,
    ariaLabel: 'Arquivo PDF para unir'
  },
  splitMain: {
    className: 'pdf-card split-main-card',
    icon: '✂️',
    showRemove: true,
    showDragHandle: false,
    interactive: true,
    ariaLabel: 'Arquivo PDF para dividir'
  },
  splitPreview: {
    className: 'pdf-card split-preview-card',
    icon: '📋',
    showRemove: false,
    showDragHandle: false,
    interactive: false,
    ariaLabel: 'Pré-visualização da divisão'
  }
});

// ===============================
// UTILITÁRIOS
// ===============================

/**
 * Formata tamanho de arquivo para leitura humana
 * @param {number} bytes - Tamanho em bytes
 * @returns {string} - Tamanho formatado
 */
function _formatFileSize(bytes) {
  if (typeof bytes !== 'number' || bytes <= 0) return '—';
  
  const units = ['Bytes', 'KB', 'MB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  // Limitar a MB (como no MVP)
  const index = Math.min(i, 2);
  return `${(bytes / Math.pow(k, index)).toFixed(2)} ${units[index]}`;
}

/**
 * Valida dados do PDF
 * @param {Object} pdfData - Dados do PDF
 * @returns {boolean} - Se os dados são válidos
 */
function _validatePdfData(pdfData) {
  return pdfData && 
         typeof pdfData === 'object' &&
         pdfData.id && 
         typeof pdfData.id === 'string' &&
         pdfData.name && 
         typeof pdfData.name === 'string';
}

// ===============================
// FÁBRICA PRINCIPAL
// ===============================

/**
 * Cria um card de PDF com base no modo especificado
 * @param {Object} pdfData - Dados do PDF
 * @param {string} mode - Modo: 'merge', 'splitMain', 'splitPreview'
 * @returns {HTMLElement} - Elemento do card
 */
export function createPdfCard(pdfData, mode = 'merge') {
  const preset = CARD_PRESETS[mode] || CARD_PRESETS.merge;
  
  // Validação rigorosa
  if (!_validatePdfData(pdfData)) {
    console.warn('Dados de PDF inválidos para criação de card:', pdfData);
    return _createFallbackCard(preset);
  }
  
  // Criar elemento base
  const card = document.createElement('div');
  card.className = preset.className;
  card.dataset.pdfId = pdfData.id;
  card.draggable = preset.interactive;
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-label', `${preset.ariaLabel}: ${pdfData.name}`);
  
  // Configurar atributos de acessibilidade
  if (preset.interactive) {
    card.setAttribute('tabindex', '0');
  }
  
  // Renderizar conteúdo
  _renderCardContent(card, pdfData, preset);
  
  // Configurar interatividade
  if (preset.interactive) {
    _setupCardInteractivity(card, pdfData, preset);
  }
  
  // Aplicar estado inicial
  _applyInitialCardState(card, pdfData);
  
  return card;
}

/**
 * Renderiza o conteúdo do card
 * @param {HTMLElement} card - Elemento do card
 * @param {Object} pdfData - Dados do PDF
 * @param {Object} preset - Configurações do preset
 */
function _renderCardContent(card, pdfData, preset) {
  const fileSize = _formatFileSize(pdfData.size);
  const pagesText = pdfData.pages ? `${pdfData.pages} pág.` : '';
  const statusText = pdfData.status ? pdfData.status : '';
  
  card.innerHTML = `
    <div class="pdf-card-body">
      ${preset.showDragHandle ? 
        `<div class="pdf-drag-handle" aria-label="Arrastar para reordenar" title="Arrastar">
          <span class="drag-dots">⋮⋮</span>
        </div>` : ''}
      
      <div class="pdf-thumb" aria-hidden="true">
        <div class="pdf-thumb-placeholder">${preset.icon}</div>
        ${pdfData.thumbnail ? 
          `<img src="${pdfData.thumbnail}" alt="${pdfData.name}" class="pdf-thumb-image" />` : ''}
      </div>

      <div class="pdf-info">
        <div class="pdf-name card-title" title="${pdfData.name}">
          ${pdfData.name}
        </div>
        <div class="pdf-meta">
          ${fileSize !== '—' ? `<span class="pdf-size">${fileSize}</span>` : ''}
          ${pagesText ? `<span class="pdf-pages">• ${pagesText}</span>` : ''}
          ${statusText ? `<span class="pdf-status">• ${statusText}</span>` : ''}
        </div>
      </div>

      ${preset.showRemove ? 
        `<button class="pdf-remove-btn" title="Remover" aria-label="Remover ${pdfData.name}">
          <span aria-hidden="true">×</span>
        </button>` : ''}
    </div>
  `;
}

/**
 * Configura a interatividade do card
 * @param {HTMLElement} card - Elemento do card
 * @param {Object} pdfData - Dados do PDF
 * @param {Object} preset - Configurações do preset
 */
function _setupCardInteractivity(card, pdfData, preset) {
  // Evento de remoção
  const removeBtn = card.querySelector('.pdf-remove-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _handleCardRemoval(card, pdfData);
    });
    
    // Suporte a teclado (Enter/Space)
    removeBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        _handleCardRemoval(card, pdfData);
      }
    });
  }
  
  // Suporte a drag-and-drop (modo merge)
  if (preset.showDragHandle) {
    _setupDragAndDrop(card, pdfData);
  }
  
  // Estados de hover
  _setupHoverStates(card);
  
  // Foco e acessibilidade
  _setupFocusStates(card);
}

/**
 * Aplica o estado inicial do card
 * @param {HTMLElement} card - Elemento do card
 * @param {Object} pdfData - Dados do PDF
 */
function _applyInitialCardState(card, pdfData) {
  // Aplicar estado de erro se necessário
  if (pdfData.error) {
    card.classList.add('state-error');
    card.setAttribute('title', pdfData.error);
    card.setAttribute('aria-invalid', 'true');
  }
  
  // Aplicar estado de carregamento
  if (pdfData.status === 'processing') {
    card.classList.add('state-processing');
  }
}

/**
 * Configura drag-and-drop para o card
 * @param {HTMLElement} card - Elemento do card
 * @param {Object} pdfData - Dados do PDF
 */
function _setupDragAndDrop(card, pdfData) {
  card.addEventListener('dragstart', (e) => {
    card.classList.add('state-dragging');
    e.dataTransfer.setData('text/plain', pdfData.id);
    e.dataTransfer.effectAllowed = 'move';
    card.setAttribute('aria-grabbed', 'true');
  });
  
  card.addEventListener('dragend', () => {
    card.classList.remove('state-dragging');
    card.setAttribute('aria-grabbed', 'false');
  });
  
  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    card.classList.add('state-drag-over');
  });
  
  card.addEventListener('dragleave', () => {
    card.classList.remove('state-drag-over');
  });
  
  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('state-drag-over');
  });
}

/**
 * Configura estados de hover
 * @param {HTMLElement} card - Elemento do card
 */
function _setupHoverStates(card) {
  card.addEventListener('mouseenter', () => {
    card.classList.add('state-hover');
  });
  
  card.addEventListener('mouseleave', () => {
    card.classList.remove('state-hover');
  });
}

/**
 * Configura estados de foco
 * @param {HTMLElement} card - Elemento do card
 */
function _setupFocusStates(card) {
  card.addEventListener('focus', () => {
    card.classList.add('state-focused');
  });
  
  card.addEventListener('blur', () => {
    card.classList.remove('state-focused');
  });
}

/**
 * Manipula a remoção do card
 * @param {HTMLElement} card - Elemento do card
 * @param {Object} pdfData - Dados do PDF
 */
function _handleCardRemoval(card, pdfData) {
  const success = removePdf(pdfData.id);
  
  if (success) {
    // Animar remoção
    card.style.opacity = '0';
    card.style.transform = 'translateX(-20px)';
    
    setTimeout(() => {
      card.remove();
    }, 300);
    
    showToast(`"${pdfData.name}" removido`, 'info', 2000);
  } else {
    showToast('Erro ao remover arquivo', 'error', 3000);
  }
}

/**
 * Cria um card de fallback
 * @param {Object} preset - Configurações do preset
 * @returns {HTMLElement} - Elemento do card
 */
function _createFallbackCard(preset) {
  const card = document.createElement('div');
  card.className = `${preset.className} state-error`;
  card.innerHTML = `
    <div class="pdf-card-body">
      <div class="pdf-thumb" aria-hidden="true">
        <div class="pdf-thumb-placeholder">❌</div>
      </div>
      <div class="pdf-info">
        <div class="pdf-name card-title">Arquivo inválido</div>
        <div class="pdf-meta">
          <span class="pdf-size">—</span>
        </div>
      </div>
    </div>
  `;
  return card;
}

// ===============================
// FUNÇÕES AUXILIARES EXPORTADAS
// ===============================

/**
 * Cria um card para modo Merge
 * @param {Object} pdfData - Dados do PDF
 * @returns {HTMLElement} - Elemento do card
 */
export function createMergeCard(pdfData) {
  return createPdfCard(pdfData, 'merge');
}

/**
 * Cria um card para modo Split (arquivo principal)
 * @param {Object} pdfData - Dados do PDF
 * @returns {HTMLElement} - Elemento do card
 */
export function createSplitMainCard(pdfData) {
  return createPdfCard(pdfData, 'splitMain');
}

/**
 * Cria um card para modo Split (pré-visualização)
 * @param {Object} pdfData - Dados do PDF
 * @returns {HTMLElement} - Elemento do card
 */
export function createSplitPreviewCard(pdfData) {
  return createPdfCard(pdfData, 'splitPreview');
}

/**
 * Atualiza o status de um card existente
 * @param {HTMLElement} cardElement - Elemento do card
 * @param {string} status - Novo status
 * @param {string|null} error - Mensagem de erro (opcional)
 */
export function updateCardStatus(cardElement, status, error = null) {
  if (!cardElement || !cardElement.classList.contains('pdf-card')) {
    console.warn('Elemento de card inválido');
    return;
  }
  
  // Atualizar elemento de status
  let statusElement = cardElement.querySelector('.pdf-status');
  if (!statusElement) {
    const metaElement = cardElement.querySelector('.pdf-meta');
    if (metaElement) {
      statusElement = document.createElement('span');
      statusElement.className = 'pdf-status';
      metaElement.appendChild(statusElement);
    }
  }
  
  if (statusElement) {
    statusElement.textContent = `• ${status}`;
  }
  
  // Gerenciar estados visuais
  if (error) {
    cardElement.classList.add('state-error');
    cardElement.classList.remove('state-processing');
    cardElement.setAttribute('title', error);
    cardElement.setAttribute('aria-invalid', 'true');
  } else {
    cardElement.classList.remove('state-error');
    cardElement.removeAttribute('title');
    cardElement.removeAttribute('aria-invalid');
    
    // Estado de processamento
    if (status === 'processing') {
      cardElement.classList.add('state-processing');
    } else {
      cardElement.classList.remove('state-processing');
    }
  }
}

/**
 * Remove todos os cards da interface
 * @param {string} containerSelector - Seletor do container (opcional)
 */
export function clearAllCards(containerSelector = null) {
  const cards = containerSelector 
    ? document.querySelectorAll(`${containerSelector} .pdf-card`)
    : document.querySelectorAll('.pdf-card');
  
  cards.forEach(card => {
    // Animar remoção
    card.style.opacity = '0';
    card.style.transform = 'scale(0.9)';
    
    setTimeout(() => {
      if (card.parentNode) {
        card.parentNode.removeChild(card);
      }
    }, 200);
  });
}

/**
 * Obtém o ID do PDF de um card
 * @param {HTMLElement} cardElement - Elemento do card
 * @returns {string|null} - ID do PDF
 */
export function getCardPdfId(cardElement) {
  return cardElement?.dataset?.pdfId || null;
}

/**
 * Verifica se um card está em estado de erro
 * @param {HTMLElement} cardElement - Elemento do card
 * @returns {boolean} - Se o card está em erro
 */
export function isCardInErrorState(cardElement) {
  return cardElement?.classList?.contains('state-error') || false;
}

// ===============================
// EXPORTAÇÕES PRINCIPAIS
// ===============================

export default {
  // Fábrica principal
  createPdfCard,
  
  // Fábricas específicas
  createMergeCard,
  createSplitMainCard,
  createSplitPreviewCard,
  
  // Manipulação de cards
  updateCardStatus,
  clearAllCards,
  getCardPdfId,
  isCardInErrorState,
  
  // Utilitários
  formatFileSize: _formatFileSize
};
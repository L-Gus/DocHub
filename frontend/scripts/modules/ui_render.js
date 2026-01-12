// frontend/scripts/modules/ui_render.js
/**
 * Gus Docs - Sistema de Renderização de UI
 * 
 * Responsabilidades:
 * - Renderização dinâmica de elementos UI
 * - Gerenciamento de estados visuais
 * - Sistema de modais e overlays
 * - Feedback visual para o usuário
 */

import { app } from '../app.js';

// ============================================
// 1. CONSTANTES E CONFIGURAÇÕES
// ============================================
const UI_CONFIG = {
  // Classes CSS
  classes: {
    active: 'active',
    loading: 'loading',
    error: 'error',
    success: 'success',
    hidden: 'hidden',
    visible: 'visible',
    disabled: 'disabled',
    dropActive: 'drop-active',
    dropValid: 'drop-valid',
    dropInvalid: 'drop-invalid'
  },
  
  // IDs de elementos
  ids: {
    dropZone: 'merge-drop-zone',
    splitDropZone: 'split-drop-zone',
    pdfCardsContainer: 'pdf-cards-container',
    splitPdfContainer: 'split-pdf-container',
    emptyState: 'empty-state',
    splitEmptyState: 'split-empty-state',
    filenamePreview: 'filename-preview',
    previewSize: 'preview-size',
    previewPages: 'preview-pages',
    toastContainer: 'toast-container',
    modalContainer: 'modal-container'
  },
  
  // Tempos de animação (ms)
  animations: {
    fadeIn: 200,
    fadeOut: 150,
    slideIn: 250,
    slideOut: 200,
    bounce: 300
  },
  
  // Mensagens padrão
  messages: {
    dropFiles: 'Solte os arquivos PDF aqui',
    processing: 'Processando...',
    loading: 'Carregando...',
    success: 'Sucesso!',
    error: 'Erro!',
    noFiles: 'Nenhum arquivo carregado'
  }
};

// ============================================
// 2. SISTEMA DE DROP ZONES
// ============================================

/**
 * Configura uma drop zone para drag & drop
 */
export function setupDropZone(dropZoneId, options = {}) {
  const dropZone = document.getElementById(dropZoneId);
  if (!dropZone) {
    console.warn(`Drop zone não encontrada: ${dropZoneId}`);
    return null;
  }
  
  const config = {
    maxFiles: options.maxFiles || 10,
    accept: options.accept || '.pdf',
    onDrop: options.onDrop || null,
    onDragEnter: options.onDragEnter || null,
    onDragLeave: options.onDragLeave || null,
    onDragOver: options.onDragOver || null
  };
  
  // Adicionar classes iniciais
  dropZone.classList.add('drop-zone-configured');
  
  // Configurar event listeners
  dropZone.addEventListener('dragover', handleDragOver);
  dropZone.addEventListener('dragenter', handleDragEnter);
  dropZone.addEventListener('dragleave', handleDragLeave);
  dropZone.addEventListener('drop', handleDrop);
  
  // Armazenar configuração no elemento
  dropZone.dataset.dropConfig = JSON.stringify(config);
  
  // Criar overlay de feedback
  createDropFeedbackOverlay(dropZone);
  
  console.log(`✅ Drop zone configurada: ${dropZoneId}`);
  return dropZone;
  
  // Handlers internos
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    
    dropZone.classList.add(UI_CONFIG.classes.dropActive);
    
    if (config.onDragOver) {
      config.onDragOver(e);
    }
  }
  
  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    
    dropZone.classList.add(UI_CONFIG.classes.dropActive);
    showDropFeedback(dropZone, UI_CONFIG.messages.dropFiles, 'valid');
    
    if (config.onDragEnter) {
      config.onDragEnter(e);
    }
  }
  
  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Só remove a classe se o mouse saiu completamente da drop zone
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove(UI_CONFIG.classes.dropActive);
      hideDropFeedback(dropZone);
    }
    
    if (config.onDragLeave) {
      config.onDragLeave(e);
    }
  }
  
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    dropZone.classList.remove(UI_CONFIG.classes.dropActive);
    hideDropFeedback(dropZone);
    
    const files = Array.from(e.dataTransfer.files);
    
    // Validar arquivos
    const validation = validateDroppedFiles(files, config);
    if (!validation.valid) {
      showDropFeedback(dropZone, validation.message, 'invalid');
      setTimeout(() => hideDropFeedback(dropZone), 2000);
      return;
    }
    
    // Feedback de sucesso
    showDropFeedback(dropZone, `${files.length} arquivo(s) pronto(s)`, 'success');
    setTimeout(() => hideDropFeedback(dropZone), 1500);
    
    // Chamar callback
    if (config.onDrop) {
      config.onDrop(files, validation.validFiles);
    }
  }
}

/**
 * Valida arquivos arrastados
 */
function validateDroppedFiles(files, config) {
  if (!files || files.length === 0) {
    return { valid: false, message: 'Nenhum arquivo encontrado' };
  }
  
  // Verificar quantidade máxima
  if (files.length > config.maxFiles) {
    return { 
      valid: false, 
      message: `Máximo ${config.maxFiles} arquivos por vez`,
      validFiles: []
    };
  }
  
  // Filtrar arquivos válidos
  const validFiles = files.filter(file => {
    const fileName = file.name.toLowerCase();
    return fileName.endsWith('.pdf');
  });
  
  if (validFiles.length === 0) {
    return { 
      valid: false, 
      message: 'Apenas arquivos PDF são suportados',
      validFiles: []
    };
  }
  
  if (validFiles.length < files.length) {
    const invalidCount = files.length - validFiles.length;
    return { 
      valid: true, 
      message: `${invalidCount} arquivo(s) ignorado(s) - apenas PDF`,
      validFiles
    };
  }
  
  return { 
    valid: true, 
    message: `${validFiles.length} arquivo(s) válido(s)`,
    validFiles
  };
}

/**
 * Cria overlay de feedback para drop zone
 */
function createDropFeedbackOverlay(dropZone) {
  if (dropZone.querySelector('.drop-feedback-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.className = 'drop-feedback-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(var(--color-primary-rgb, 0, 123, 255), 0.9);
    display: none;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    color: white;
    font-size: 1.2rem;
    font-weight: 600;
    z-index: 10;
    border-radius: inherit;
    border: 3px dashed white;
  `;
  
  const icon = document.createElement('div');
  icon.className = 'drop-feedback-icon';
  icon.textContent = '📄';
  icon.style.cssText = `
    font-size: 3rem;
    margin-bottom: 1rem;
    animation: bounce 1s infinite;
  `;
  
  const text = document.createElement('div');
  text.className = 'drop-feedback-text';
  text.style.cssText = `
    text-align: center;
    padding: 0 2rem;
  `;
  
  overlay.appendChild(icon);
  overlay.appendChild(text);
  dropZone.appendChild(overlay);
  
  // Adicionar animação
  const style = document.createElement('style');
  style.textContent = `
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Mostra feedback na drop zone
 */
function showDropFeedback(dropZone, message, type = 'valid') {
  const overlay = dropZone.querySelector('.drop-feedback-overlay');
  if (!overlay) return;
  
  const text = overlay.querySelector('.drop-feedback-text');
  if (text) {
    text.textContent = message;
  }
  
  // Aplicar estilo baseado no tipo
  overlay.style.background = type === 'valid' 
    ? 'rgba(var(--color-success-rgb, 16, 185, 129), 0.9)'
    : 'rgba(var(--color-danger-rgb, 239, 68, 68), 0.9)';
  
  overlay.style.display = 'flex';
  overlay.style.animation = 'fadeIn 0.2s ease';
}

/**
 * Esconde feedback da drop zone
 */
function hideDropFeedback(dropZone) {
  const overlay = dropZone.querySelector('.drop-feedback-overlay');
  if (overlay) {
    overlay.style.animation = 'fadeOut 0.15s ease';
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 150);
  }
}

// ============================================
// 3. SISTEMA DE PREVIEW EM TEMPO REAL
// ============================================

/**
 * Atualiza o preview do nome do arquivo
 */
export function updateFilenamePreview(baseName, prefix = '', suffix = '') {
  const previewElement = document.getElementById(UI_CONFIG.ids.filenamePreview);
  if (!previewElement) return;
  
  let filename = '';
  
  if (prefix) filename += `${prefix}`;
  if (baseName) filename += `${baseName}`;
  if (suffix) filename += `${suffix}`;
  
  if (!filename) filename = 'documento';
  
  filename += '.pdf';
  
  previewElement.textContent = filename;
  previewElement.title = filename;
  
  // Adicionar classe de animação
  previewElement.classList.add('preview-updated');
  setTimeout(() => {
    previewElement.classList.remove('preview-updated');
  }, 300);
}

/**
 * Atualiza o preview do tamanho estimado
 */
export function updateSizePreview(sizeInBytes) {
  const sizeElement = document.getElementById(UI_CONFIG.ids.previewSize);
  if (!sizeElement) return;
  
  const sizeFormatted = app.formatFileSize(sizeInBytes);
  sizeElement.textContent = `~${sizeFormatted}`;
  
  // Destaque visual para mudanças significativas
  sizeElement.classList.add('size-updated');
  setTimeout(() => {
    sizeElement.classList.remove('size-updated');
  }, 500);
}

/**
 * Atualiza o preview da contagem de páginas
 */
export function updatePagesPreview(pageCount) {
  const pagesElement = document.getElementById(UI_CONFIG.ids.previewPages);
  if (!pagesElement) return;
  
  pagesElement.textContent = `${pageCount} página${pageCount !== 1 ? 's' : ''}`;
}

/**
 * Atualiza todos os previews de uma vez
 */
export function updateAllPreviews(data) {
  const {
    filename = '',
    prefix = '',
    suffix = '',
    size = 0,
    pages = 0
  } = data;
  
  updateFilenamePreview(filename, prefix, suffix);
  updateSizePreview(size);
  updatePagesPreview(pages);
}

// ============================================
// 4. SISTEMA DE MODAIS E DIALOGS
// ============================================

/**
 * Cria um modal
 */
export function createModal(options = {}) {
  const {
    title = 'Atenção',
    message = '',
    type = 'info',
    buttons = ['OK'],
    onClose = null,
    onButtonClick = null,
    width = '400px',
    height = 'auto'
  } = options;
  
  const modalId = `modal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const modalContainer = document.getElementById(UI_CONFIG.ids.modalContainer) || document.body;
  
  // Criar overlay de fundo
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal, 1000);
    animation: fadeIn ${UI_CONFIG.animations.fadeIn}ms ease;
  `;
  
  // Criar modal
  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = `modal modal-${type}`;
  modal.style.cssText = `
    background: var(--color-surface-1, white);
    border-radius: var(--radius-lg, 12px);
    padding: var(--spacing-xl, 24px);
    width: ${width};
    height: ${height};
    max-width: 90vw;
    max-height: 90vh;
    overflow: auto;
    box-shadow: var(--shadow-2xl, 0 25px 50px -12px rgba(0, 0, 0, 0.25));
    animation: slideIn ${UI_CONFIG.animations.slideIn}ms ease;
  `;
  
  // Ícone baseado no tipo
  const icons = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    success: '✅',
    question: '❓'
  };
  
  // Conteúdo do modal
  modal.innerHTML = `
    <div class="modal-header" style="
      display: flex;
      align-items: center;
      margin-bottom: var(--spacing-lg, 16px);
      gap: var(--spacing-md, 12px);
    ">
      <div class="modal-icon" style="font-size: 1.5rem;">${icons[type] || icons.info}</div>
      <h3 class="modal-title" style="
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--color-text-primary, #1f2937);
      ">${title}</h3>
      <button class="modal-close" style="
        margin-left: auto;
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: var(--color-text-secondary, #6b7280);
        padding: 4px;
        line-height: 1;
      ">×</button>
    </div>
    
    <div class="modal-body" style="
      margin-bottom: var(--spacing-xl, 24px);
      color: var(--color-text-primary, #1f2937);
      line-height: 1.6;
    ">
      ${message}
    </div>
    
    <div class="modal-footer" style="
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-md, 12px);
    ">
      ${buttons.map((text, index) => `
        <button class="modal-btn modal-btn-${index === 0 ? 'primary' : 'secondary'}" 
                data-index="${index}"
                style="
          padding: var(--spacing-sm, 8px) var(--spacing-lg, 16px);
          border: none;
          border-radius: var(--radius-md, 6px);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          ${index === 0 ? `
            background: var(--color-primary, #3b82f6);
            color: white;
          ` : `
            background: var(--color-surface-2, #f3f4f6);
            color: var(--color-text-primary, #1f2937);
          `}
        ">${text}</button>
      `).join('')}
    </div>
  `;
  
  overlay.appendChild(modal);
  modalContainer.appendChild(overlay);
  
  // Event listeners
  const closeBtn = modal.querySelector('.modal-close');
  closeBtn.addEventListener('click', closeModal);
  
  const modalBtns = modal.querySelectorAll('.modal-btn');
  modalBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      if (onButtonClick) {
        onButtonClick(index, buttons[index]);
      }
      closeModal();
    });
  });
  
  // Fechar ao clicar no overlay
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });
  
  // Fechar com ESC
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };
  document.addEventListener('keydown', handleEsc);
  
  function closeModal() {
    modal.style.animation = `slideOut ${UI_CONFIG.animations.slideOut}ms ease`;
    overlay.style.animation = `fadeOut ${UI_CONFIG.animations.fadeOut}ms ease`;
    
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      document.removeEventListener('keydown', handleEsc);
      
      if (onClose) {
        onClose();
      }
    }, UI_CONFIG.animations.slideOut);
  }
  
  // Focar no primeiro botão
  setTimeout(() => {
    const firstBtn = modal.querySelector('.modal-btn');
    if (firstBtn) firstBtn.focus();
  }, 100);
  
  return {
    id: modalId,
    close: closeModal,
    element: modal
  };
}

/**
 * Modal de confirmação
 */
export function showConfirm(options = {}) {
  return new Promise((resolve) => {
    const modal = createModal({
      title: options.title || 'Confirmação',
      message: options.message || 'Tem certeza que deseja continuar?',
      type: options.type || 'question',
      buttons: options.buttons || ['Confirmar', 'Cancelar'],
      onButtonClick: (index) => {
        resolve(index === 0); // true para primeiro botão (Confirmar)
      }
    });
  });
}

/**
 * Modal de erro
 */
export function showError(message, title = 'Erro') {
  return createModal({
    title,
    message,
    type: 'error',
    buttons: ['OK']
  });
}

/**
 * Modal de sucesso
 */
export function showSuccess(message, title = 'Sucesso') {
  return createModal({
    title,
    message,
    type: 'success',
    buttons: ['OK']
  });
}

// ============================================
// 5. GERENCIAMENTO DE ESTADOS VISUAIS
// ============================================

/**
 * Atualiza o estado de um elemento
 */
export function setElementState(element, state, options = {}) {
  if (!element) return;
  
  const states = ['loading', 'success', 'error', 'disabled', 'hidden', 'active'];
  const allStates = [...states, ...Object.keys(UI_CONFIG.classes)];
  
  // Remover todos os estados anteriores
  allStates.forEach(stateClass => {
    element.classList.remove(stateClass);
  });
  
  // Aplicar novo estado
  if (state && UI_CONFIG.classes[state]) {
    element.classList.add(UI_CONFIG.classes[state]);
  } else if (state) {
    element.classList.add(state);
  }
  
  // Aplicar opções adicionais
  if (options.text) {
    element.textContent = options.text;
  }
  
  if (options.title) {
    element.title = options.title;
  }
  
  if (options.disabled !== undefined) {
    element.disabled = options.disabled;
  }
  
  if (options.style) {
    Object.assign(element.style, options.style);
  }
  
  // Disparar evento de mudança de estado
  const event = new CustomEvent('uiStateChanged', {
    detail: { element, state, options }
  });
  element.dispatchEvent(event);
}

/**
 * Mostra estado de vazio
 */
export function showEmptyState(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const emptyStateId = containerId.includes('split') 
    ? UI_CONFIG.ids.splitEmptyState 
    : UI_CONFIG.ids.emptyState;
  
  const emptyState = document.getElementById(emptyStateId);
  if (emptyState) {
    setElementState(emptyState, 'visible');
    
    if (options.message) {
      const messageEl = emptyState.querySelector('p');
      if (messageEl) messageEl.textContent = options.message;
    }
    
    if (options.icon) {
      const iconEl = emptyState.querySelector('.empty-icon');
      if (iconEl) iconEl.textContent = options.icon;
    }
  }
}

/**
 * Esconde estado de vazio
 */
export function hideEmptyState(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const emptyStateId = containerId.includes('split') 
    ? UI_CONFIG.ids.splitEmptyState 
    : UI_CONFIG.ids.emptyState;
  
  const emptyState = document.getElementById(emptyStateId);
  if (emptyState) {
    setElementState(emptyState, 'hidden');
  }
}

/**
 * Atualiza contadores e estatísticas
 */
export function updateCounters(counters = {}) {
  const {
    files = 0,
    pages = 0,
    size = 0,
    estimatedTime = '0s'
  } = counters;
  
  // Atualizar contador de arquivos
  const fileElements = document.querySelectorAll('.file-count');
  fileElements.forEach(el => {
    el.textContent = `${files} arquivo${files !== 1 ? 's' : ''}`;
  });
  
  // Atualizar contador de páginas
  const pageElements = document.querySelectorAll('.page-count');
  pageElements.forEach(el => {
    el.textContent = `${pages} página${pages !== 1 ? 's' : ''}`;
  });
  
  // Atualizar tamanho total
  const sizeElements = document.querySelectorAll('.size-total');
  sizeElements.forEach(el => {
    el.textContent = app.formatFileSize(size);
  });
  
  // Atualizar tempo estimado
  const timeElements = document.querySelectorAll('.estimated-time');
  timeElements.forEach(el => {
    el.textContent = `~${estimatedTime}`;
  });
}

// ============================================
// 6. ANIMAÇÕES E FEEDBACK VISUAL
// ============================================

/**
 * Aplica efeito de "shake" a um elemento
 */
export function shakeElement(element, intensity = 5) {
  if (!element) return;
  
  const originalTransform = element.style.transform || '';
  
  // Animar shake
  element.animate([
    { transform: 'translateX(0)' },
    { transform: `translateX(-${intensity}px)` },
    { transform: `translateX(${intensity}px)` },
    { transform: `translateX(-${intensity/2}px)` },
    { transform: `translateX(${intensity/2}px)` },
    { transform: 'translateX(0)' }
  ], {
    duration: 300,
    easing: 'ease-in-out'
  });
}

/**
 * Aplica efeito de "pulse" a um elemento
 */
export function pulseElement(element, times = 2) {
  if (!element) return;
  
  const originalOpacity = element.style.opacity || '';
  
  element.animate([
    { opacity: 1 },
    { opacity: 0.5 },
    { opacity: 1 }
  ], {
    duration: 500,
    iterations: times,
    easing: 'ease-in-out'
  });
}

/**
 * Aplica efeito de "fade in"
 */
export function fadeIn(element, duration = UI_CONFIG.animations.fadeIn) {
  if (!element) return;
  
  element.style.opacity = '0';
  element.style.display = '';
  
  requestAnimationFrame(() => {
    element.style.transition = `opacity ${duration}ms ease`;
    element.style.opacity = '1';
    
    setTimeout(() => {
      element.style.transition = '';
    }, duration);
  });
}

/**
 * Aplica efeito de "fade out"
 */
export function fadeOut(element, duration = UI_CONFIG.animations.fadeOut) {
  if (!element) return;
  
  return new Promise((resolve) => {
    element.style.transition = `opacity ${duration}ms ease`;
    element.style.opacity = '0';
    
    setTimeout(() => {
      element.style.display = 'none';
      element.style.transition = '';
      element.style.opacity = '';
      resolve();
    }, duration);
  });
}

/**
 * Feedback visual para ação bem-sucedida
 */
export function showSuccessFeedback(element, message = '') {
  if (!element) return;
  
  const originalBg = element.style.backgroundColor;
  const originalContent = element.innerHTML;
  
  // Mudar para cor de sucesso
  element.style.backgroundColor = 'var(--color-success, #10b981)';
  element.style.color = 'white';
  
  if (message) {
    element.innerHTML = `✓ ${message}`;
  }
  
  // Restaurar após 1.5s
  setTimeout(() => {
    element.style.backgroundColor = originalBg;
    element.style.color = '';
    element.innerHTML = originalContent;
    
    // Efeito de pulse
    pulseElement(element);
  }, 1500);
}

// ============================================
// 7. SISTEMA DE TOOLTIPS
// ============================================

/**
 * Cria um tooltip para um elemento
 */
export function createTooltip(element, text, options = {}) {
  if (!element || !text) return null;
  
  const tooltipId = `tooltip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Remover tooltip existente
  const existingTooltip = element.querySelector('.ui-tooltip');
  if (existingTooltip) {
    existingTooltip.remove();
  }
  
  // Criar tooltip
  const tooltip = document.createElement('div');
  tooltip.id = tooltipId;
  tooltip.className = 'ui-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.style.cssText = `
    position: absolute;
    background: var(--color-surface-3, #374151);
    color: white;
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    border-radius: var(--radius-sm, 4px);
    font-size: 0.875rem;
    white-space: nowrap;
    z-index: var(--z-tooltip, 1100);
    pointer-events: none;
    opacity: 0;
    transform: translateY(-10px);
    transition: opacity 0.2s ease, transform 0.2s ease;
    max-width: 300px;
    word-wrap: break-word;
    white-space: normal;
    text-align: center;
    ${options.position === 'top' ? 'bottom: 100%; left: 50%; transform: translateX(-50%) translateY(-10px);' : ''}
    ${options.position === 'bottom' ? 'top: 100%; left: 50%; transform: translateX(-50%) translateY(10px);' : ''}
    ${options.position === 'left' ? 'right: 100%; top: 50%; transform: translateX(-10px) translateY(-50%);' : ''}
    ${options.position === 'right' ? 'left: 100%; top: 50%; transform: translateX(10px) translateY(-50%);' : ''}
  `;
  
  tooltip.textContent = text;
  element.appendChild(tooltip);
  
  // Posição padrão se não especificada
  if (!options.position) {
    tooltip.style.bottom = '100%';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translateX(-50%) translateY(-10px)';
  }
  
  // Mostrar/ocultar tooltip
  element.addEventListener('mouseenter', showTooltip);
  element.addEventListener('mouseleave', hideTooltip);
  element.addEventListener('focus', showTooltip);
  element.addEventListener('blur', hideTooltip);
  
  function showTooltip() {
    tooltip.style.opacity = '1';
    tooltip.style.transform = options.position === 'top' 
      ? 'translateX(-50%) translateY(-5px)'
      : options.position === 'bottom'
      ? 'translateX(-50%) translateY(5px)'
      : options.position === 'left'
      ? 'translateX(-5px) translateY(-50%)'
      : options.position === 'right'
      ? 'translateX(5px) translateY(-50%)'
      : 'translateX(-50%) translateY(-5px)';
  }
  
  function hideTooltip() {
    tooltip.style.opacity = '0';
    tooltip.style.transform = options.position === 'top' 
      ? 'translateX(-50%) translateY(-10px)'
      : options.position === 'bottom'
      ? 'translateX(-50%) translateY(10px)'
      : options.position === 'left'
      ? 'translateX(-10px) translateY(-50%)'
      : options.position === 'right'
      ? 'translateX(10px) translateY(-50%)'
      : 'translateX(-50%) translateY(-10px)';
  }
  
  return {
    id: tooltipId,
    show: showTooltip,
    hide: hideTooltip,
    remove: () => {
      element.removeEventListener('mouseenter', showTooltip);
      element.removeEventListener('mouseleave', hideTooltip);
      element.removeEventListener('focus', showTooltip);
      element.removeEventListener('blur', hideTooltip);
      if (tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
    }
  };
}

// ============================================
// 8. UTILITÁRIOS DE TEMAS
// ============================================

/**
 * Aplica classes de tema a elementos dinâmicos
 */
export function applyThemeClasses() {
  const theme = app.state.theme || 'dark';
  
  // Aplicar classes baseadas no tema
  document.querySelectorAll('[data-theme-sensitive]').forEach(el => {
    el.classList.remove('theme-dark', 'theme-light');
    el.classList.add(`theme-${theme}`);
  });
  
  // Atualizar variáveis CSS se necessário
  if (window.gusThemeManager) {
    const colors = window.gusThemeManager.generateThemeShades('#3b82f6');
    Object.entries(colors).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--theme-${key}`, value);
    });
  }
}

/**
 * Atualiza elementos sensíveis ao tema
 */
export function updateThemeSensitiveElements() {
  // Atualizar botões
  document.querySelectorAll('.btn-outline, .btn-ghost').forEach(btn => {
    btn.style.borderColor = `var(--color-${app.state.theme === 'dark' ? 'primary' : 'border-primary'})`;
  });
  
  // Atualizar cards
  document.querySelectorAll('.pdf-card').forEach(card => {
    if (window.gusThemeManager?.needsContrastAdjustment(card)) {
      const optimalColor = window.gusThemeManager.getOptimalTextColor();
      card.style.setProperty('--card-text-color', optimalColor);
    }
  });
}

// ============================================
// 9. INICIALIZAÇÃO
// ============================================

/**
 * Inicializa o sistema de renderização
 */
export function initUIRender() {
  console.log('🎨 Inicializando sistema de renderização UI...');
  
  try {
    // Aplicar classes de tema
    applyThemeClasses();
    
    // Configurar tooltips globais
    setupGlobalTooltips();
    
    // Adicionar estilos CSS dinâmicos
    addDynamicStyles();
    
    // Ouvir mudanças de tema
    document.addEventListener('themeChanged', updateThemeSensitiveElements);
    document.addEventListener('viewChanged', handleViewChange);
    
    console.log('✅ Sistema de renderização UI inicializado');
  } catch (error) {
    console.error('❌ Erro ao inicializar sistema de renderização UI:', error);
  }
}

/**
 * Configura tooltips globais
 */
function setupGlobalTooltips() {
  // Tooltips para elementos com data-tooltip
  document.querySelectorAll('[data-tooltip]').forEach(el => {
    const text = el.getAttribute('data-tooltip');
    const position = el.getAttribute('data-tooltip-position') || 'top';
    createTooltip(el, text, { position });
  });
}

/**
 * Adiciona estilos CSS dinâmicos
 */
function addDynamicStyles() {
  const styleId = 'ui-render-dynamic-styles';
  if (document.getElementById(styleId)) return;
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* Animações */
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    
    @keyframes slideIn {
      from { 
        opacity: 0;
        transform: translateY(-20px);
      }
      to { 
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes slideOut {
      from { 
        opacity: 1;
        transform: translateY(0);
      }
      to { 
        opacity: 0;
        transform: translateY(20px);
      }
    }
    
    /* Classes de estado */
    .state-loading {
      opacity: 0.7;
      pointer-events: none;
    }
    
    .state-disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }
    
    .state-hidden {
      display: none !important;
    }
    
    .state-visible {
      display: block !important;
    }
    
    /* Preview animations */
    .preview-updated {
      animation: pulse 0.5s ease;
    }
    
    .size-updated {
      color: var(--color-primary);
      font-weight: 600;
    }
    
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Manipula mudanças de view
 */
function handleViewChange(e) {
  const { view } = e.detail;
  console.log(`🔄 Atualizando UI para view: ${view}`);
  
  // Resetar estados visuais se necessário
  if (view === 'merge') {
    // Resetar drop zones do merge
    const dropZone = document.getElementById(UI_CONFIG.ids.dropZone);
    if (dropZone) {
      dropZone.classList.remove(UI_CONFIG.classes.dropActive);
      hideDropFeedback(dropZone);
    }
  } else if (view === 'split') {
    // Resetar drop zones do split
    const splitDropZone = document.getElementById(UI_CONFIG.ids.splitDropZone);
    if (splitDropZone) {
      splitDropZone.classList.remove(UI_CONFIG.classes.dropActive);
      hideDropFeedback(splitDropZone);
    }
  }
}

// ============================================
// 10. EXPORTS
// ============================================

export default {
  // Drop Zones
  setupDropZone,
  
  // Previews
  updateFilenamePreview,
  updateSizePreview,
  updatePagesPreview,
  updateAllPreviews,
  
  // Modals
  createModal,
  showConfirm,
  showError,
  showSuccess,
  
  // State Management
  setElementState,
  showEmptyState,
  hideEmptyState,
  updateCounters,
  
  // Animations
  shakeElement,
  pulseElement,
  fadeIn,
  fadeOut,
  showSuccessFeedback,
  
  // Tooltips
  createTooltip,
  
  // Theme
  applyThemeClasses,
  updateThemeSensitiveElements,
  
  // Initialization
  initUIRender
};

// Disponibilizar globalmente
window.uiRender = {
  ...uiRender,
  init: initUIRender
};

// Inicializar automaticamente
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUIRender);
} else {
  setTimeout(initUIRender, 0);
}
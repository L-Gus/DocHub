// frontend/src/services/ui-render.js
/**
 * UI Render Service - DocHub
 * Sistema de renderização de UI com utilitários avançados
 */

import themeManager from './theme-manager.js';

// ============================================
// 1. CONSTANTES E CONFIGURAÇÕES
// ============================================
const UI_CONFIG = {
  animations: {
    fadeIn: '0.3s',
    fadeOut: '0.3s',
    slideIn: '0.3s',
    slideOut: '0.3s',
    scaleIn: '0.2s',
    scaleOut: '0.2s'
  },
  zIndex: {
    dropdown: 1000,
    modal: 1050,
    tooltip: 1070,
    toast: 1100,
    loading: 1200
  },
  breakpoints: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280
  }
};

// ============================================
// 2. SISTEMA DE DROP ZONES
// ============================================

/**
 * Configura uma drop zone avançada com drag & drop
 */
export function setupDropZone(dropZoneId, options = {}) {
  const config = {
    accept: options.accept || ['.pdf'],
    maxFiles: options.maxFiles || 10,
    maxSize: options.maxSize || 50 * 1024 * 1024, // 50MB
    onFileSelect: options.onFileSelect || (() => {}),
    onError: options.onError || (() => {}),
    validateFiles: options.validateFiles || (() => true),
    ...options
  };

  const dropZone = document.getElementById(dropZoneId);
  if (!dropZone) {
    console.warn(`Drop zone ${dropZoneId} não encontrada`);
    return;
  }

  let dragCounter = 0;
  let isProcessing = false;

  // Elementos
  const fileInput = createFileInput(dropZoneId, config);
  dropZone.appendChild(fileInput);

  // Eventos
  dropZone.addEventListener('click', () => {
    if (!isProcessing) fileInput.click();
  });

  dropZone.addEventListener('dragenter', handleDragEnter);
  dropZone.addEventListener('dragover', handleDragOver);
  dropZone.addEventListener('dragleave', handleDragLeave);
  dropZone.addEventListener('drop', handleDrop);

  fileInput.addEventListener('change', (e) => handleFileSelection(e.target.files, config));

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    if (dragCounter === 1) {
      dropZone.classList.add('drag-over');
      showDropFeedback(dropZone, 'Solte os arquivos aqui', 'valid');
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) {
      dropZone.classList.remove('drag-over');
      hideDropFeedback(dropZone);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    dropZone.classList.remove('drag-over');
    hideDropFeedback(dropZone);

    const files = Array.from(e.dataTransfer.files);
    handleFileSelection(files, config);
  }

  function handleFileSelection(files, config) {
    if (isProcessing) return;
    isProcessing = true;

    try {
      const validFiles = validateDroppedFiles(files, config);
      if (validFiles.length > 0) {
        config.onFileSelect(validFiles);
        showSuccessFeedback(dropZone, `${validFiles.length} arquivo(s) selecionado(s)`);
      }
    } catch (error) {
      config.onError(error);
      showDropFeedback(dropZone, error.message, 'error');
    } finally {
      setTimeout(() => {
        isProcessing = false;
        hideDropFeedback(dropZone);
      }, 2000);
    }
  }

  return {
    updateConfig: (newConfig) => Object.assign(config, newConfig),
    destroy: () => {
      dropZone.removeEventListener('click', handleClick);
      dropZone.removeEventListener('dragenter', handleDragEnter);
      dropZone.removeEventListener('dragover', handleDragOver);
      dropZone.removeEventListener('dragleave', handleDragLeave);
      dropZone.removeEventListener('drop', handleDrop);
      fileInput.remove();
    }
  };
}

/**
 * Valida arquivos soltos
 */
function validateDroppedFiles(files, config) {
  if (!files || files.length === 0) {
    throw new Error('Nenhum arquivo selecionado');
  }

  if (files.length > config.maxFiles) {
    throw new Error(`Máximo de ${config.maxFiles} arquivos permitido`);
  }

  const validFiles = [];
  const errors = [];

  for (const file of files) {
    try {
      // Verifica tipo
      const isValidType = config.accept.some(type =>
        file.name.toLowerCase().endsWith(type.replace('.', '')) ||
        file.type.includes(type.replace('.', ''))
      );

      if (!isValidType) {
        errors.push(`${file.name}: Tipo de arquivo não suportado`);
        continue;
      }

      // Verifica tamanho
      if (file.size > config.maxSize) {
        errors.push(`${file.name}: Arquivo muito grande (máx. ${formatFileSize(config.maxSize)})`);
        continue;
      }

      // Validação customizada
      if (config.validateFiles && !config.validateFiles(file)) {
        errors.push(`${file.name}: Arquivo inválido`);
        continue;
      }

      validFiles.push(file);
    } catch (error) {
      errors.push(`${file.name}: Erro ao processar arquivo`);
    }
  }

  if (validFiles.length === 0) {
    throw new Error('Nenhum arquivo válido encontrado:\n' + errors.join('\n'));
  }

  if (errors.length > 0) {
    console.warn('Arquivos com erro:', errors);
  }

  return validFiles;
}

/**
 * Cria overlay de feedback para drop
 */
function createDropFeedbackOverlay(dropZone) {
  const overlay = document.createElement('div');
  overlay.className = 'drop-feedback-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(37, 99, 235, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    pointer-events: none;
    z-index: 10;
  `;

  const message = document.createElement('div');
  message.className = 'drop-feedback-message';
  message.style.cssText = `
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--primary-color);
    text-align: center;
  `;

  overlay.appendChild(message);
  dropZone.style.position = 'relative';
  dropZone.appendChild(overlay);

  return { overlay, message };
}

/**
 * Mostra feedback visual no drop zone
 */
function showDropFeedback(dropZone, message, type = 'valid') {
  let feedback = dropZone.querySelector('.drop-feedback-overlay');
  if (!feedback) {
    feedback = createDropFeedbackOverlay(dropZone).overlay;
  }

  const messageEl = feedback.querySelector('.drop-feedback-message');
  if (messageEl) {
    messageEl.textContent = message;
    messageEl.style.color = type === 'error' ? 'var(--error-color)' : 'var(--primary-color)';
  }

  feedback.style.display = 'flex';
  fadeIn(feedback, 0.2);
}

/**
 * Esconde feedback do drop zone
 */
function hideDropFeedback(dropZone) {
  const feedback = dropZone.querySelector('.drop-feedback-overlay');
  if (feedback) {
    fadeOut(feedback, 0.2, () => {
      feedback.style.display = 'none';
    });
  }
}

// ============================================
// 3. SISTEMA DE PREVIEW EM TEMPO REAL
// ============================================

/**
 * Atualiza preview do nome do arquivo
 */
export function updateFilenamePreview(baseName, prefix = '', suffix = '') {
  const previewElements = document.querySelectorAll('[data-preview="filename"]');
  const finalName = `${prefix}${baseName}${suffix}`.replace(/\.pdf$/i, '') + '.pdf';

  previewElements.forEach(el => {
    el.textContent = finalName;
    el.title = finalName;
  });

  return finalName;
}

/**
 * Atualiza preview do tamanho
 */
export function updateSizePreview(sizeInBytes) {
  const previewElements = document.querySelectorAll('[data-preview="size"]');
  const formattedSize = formatFileSize(sizeInBytes);

  previewElements.forEach(el => {
    el.textContent = formattedSize;
  });

  return formattedSize;
}

/**
 * Atualiza preview de páginas
 */
export function updatePagesPreview(pageCount) {
  const previewElements = document.querySelectorAll('[data-preview="pages"]');

  previewElements.forEach(el => {
    el.textContent = `${pageCount} página${pageCount !== 1 ? 's' : ''}`;
  });

  return pageCount;
}

/**
 * Atualiza todos os previews
 */
export function updateAllPreviews(data) {
  if (data.filename) updateFilenamePreview(data.filename, data.prefix, data.suffix);
  if (data.size) updateSizePreview(data.size);
  if (data.pages) updatePagesPreview(data.pages);
}

// ============================================
// 4. SISTEMA DE MODAIS E DIALOGS
// ============================================

/**
 * Cria um modal avançado
 */
export function createModal(options = {}) {
  const config = {
    title: options.title || '',
    content: options.content || '',
    size: options.size || 'md', // sm, md, lg, xl
    closable: options.closable !== false,
    backdrop: options.backdrop !== false,
    buttons: options.buttons || [],
    onOpen: options.onOpen || (() => {}),
    onClose: options.onClose || (() => {}),
    ...options
  };

  // Container do modal
  const modal = document.createElement('div');
  modal.className = `modal modal-${config.size}`;
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: ${UI_CONFIG.zIndex.modal};
    padding: 1rem;
  `;

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  `;

  // Dialog
  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';
  dialog.style.cssText = `
    background: var(--bg-primary);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    max-width: ${getModalMaxWidth(config.size)};
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  `;

  // Header
  if (config.title || config.closable) {
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.style.cssText = `
      padding: 1.5rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    `;

    if (config.title) {
      const title = document.createElement('h3');
      title.className = 'modal-title';
      title.textContent = config.title;
      title.style.cssText = `
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-primary);
      `;
      header.appendChild(title);
    }

    if (config.closable) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'modal-close';
      closeBtn.innerHTML = '×';
      closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 1.5rem;
        color: var(--text-muted);
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 4px;
        transition: all 0.2s ease;
      `;
      closeBtn.onmouseover = () => closeBtn.style.background = 'var(--bg-tertiary)';
      closeBtn.onmouseout = () => closeBtn.style.background = 'none';
      closeBtn.onclick = () => closeModal(modal);
      header.appendChild(closeBtn);
    }

    dialog.appendChild(header);
  }

  // Body
  const body = document.createElement('div');
  body.className = 'modal-body';
  body.style.cssText = `
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  `;

  if (typeof config.content === 'string') {
    body.innerHTML = config.content;
  } else if (config.content instanceof HTMLElement) {
    body.appendChild(config.content);
  }

  dialog.appendChild(body);

  // Footer
  if (config.buttons.length > 0) {
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.style.cssText = `
      padding: 1.5rem;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    `;

    config.buttons.forEach(btnConfig => {
      const btn = document.createElement('button');
      btn.className = `btn ${btnConfig.class || 'btn-secondary'}`;
      btn.textContent = btnConfig.text;
      if (btnConfig.primary) btn.classList.add('btn-primary');

      btn.onclick = () => {
        if (btnConfig.action) btnConfig.action();
        if (btnConfig.close !== false) closeModal(modal);
      };

      footer.appendChild(btn);
    });

    dialog.appendChild(footer);
  }

  // Monta modal
  modal.appendChild(backdrop);
  modal.appendChild(dialog);

  // Eventos
  if (config.backdrop) {
    backdrop.onclick = () => closeModal(modal);
  }

  // Funções de controle
  function openModal() {
    document.body.appendChild(modal);
    fadeIn(modal, 0.3);
    config.onOpen(modal);
  }

  function closeModal() {
    fadeOut(modal, 0.3, () => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
      config.onClose(modal);
    });
  }

  // Abre automaticamente
  openModal();

  return {
    element: modal,
    open: openModal,
    close: closeModal,
    updateContent: (newContent) => {
      if (typeof newContent === 'string') {
        body.innerHTML = newContent;
      } else if (newContent instanceof HTMLElement) {
        body.innerHTML = '';
        body.appendChild(newContent);
      }
    }
  };
}

/**
 * Mostra confirmação
 */
export function showConfirm(options = {}) {
  return createModal({
    title: options.title || 'Confirmar',
    content: options.message || 'Tem certeza?',
    buttons: [
      {
        text: options.cancelText || 'Cancelar',
        action: options.onCancel || (() => {})
      },
      {
        text: options.confirmText || 'Confirmar',
        class: 'btn-primary',
        action: options.onConfirm || (() => {})
      }
    ],
    ...options
  });
}

/**
 * Mostra erro
 */
export function showError(message, title = 'Erro') {
  return createModal({
    title,
    content: `<div style="color: var(--error-color);">${message}</div>`,
    buttons: [
      {
        text: 'Fechar',
        class: 'btn-primary'
      }
    ]
  });
}

/**
 * Mostra sucesso
 */
export function showSuccess(message, title = 'Sucesso') {
  return createModal({
    title,
    content: `<div style="color: var(--success-color);">${message}</div>`,
    buttons: [
      {
        text: 'Fechar',
        class: 'btn-primary'
      }
    ]
  });
}

// ============================================
// 5. GERENCIAMENTO DE ESTADOS VISUAIS
// ============================================

/**
 * Define estado visual de um elemento
 */
export function setElementState(element, state, options = {}) {
  if (!element) return;

  // Remove estados anteriores
  element.classList.remove('state-normal', 'state-hover', 'state-active', 'state-disabled', 'state-loading', 'state-error', 'state-success');

  // Adiciona novo estado
  if (state) {
    element.classList.add(`state-${state}`);
  }

  // Propriedades específicas
  switch (state) {
    case 'disabled':
      element.disabled = true;
      element.setAttribute('aria-disabled', 'true');
      break;
    case 'loading':
      element.classList.add('btn-loading');
      element.disabled = true;
      break;
    case 'error':
      element.setAttribute('aria-invalid', 'true');
      break;
    default:
      element.disabled = false;
      element.removeAttribute('aria-disabled');
      element.removeAttribute('aria-invalid');
  }

  // Feedback adicional
  if (options.feedback) {
    showToast(options.feedback.message, options.feedback.type, options.feedback.duration);
  }
}

/**
 * Mostra estado vazio
 */
export function showEmptyState(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const config = {
    icon: options.icon || '📄',
    title: options.title || 'Nenhum item encontrado',
    description: options.description || 'Adicione alguns arquivos para começar.',
    action: options.action || null,
    ...options
  };

  // Remove empty state anterior
  hideEmptyState(containerId);

  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.id = `empty-state-${containerId}`;
  emptyState.innerHTML = `
    <div class="empty-state-icon">${config.icon}</div>
    <div class="empty-state-title">${config.title}</div>
    <div class="empty-state-text">${config.description}</div>
    ${config.action ? `<button class="btn btn-primary">${config.action.text}</button>` : ''}
  `;

  container.appendChild(emptyState);

  // Evento do botão
  if (config.action) {
    const actionBtn = emptyState.querySelector('.btn');
    actionBtn.onclick = config.action.handler;
  }

  return emptyState;
}

/**
 * Esconde estado vazio
 */
export function hideEmptyState(containerId) {
  const emptyState = document.getElementById(`empty-state-${containerId}`);
  if (emptyState) {
    emptyState.remove();
  }
}

/**
 * Atualiza contadores
 */
export function updateCounters(counters = {}) {
  Object.entries(counters).forEach(([key, value]) => {
    const elements = document.querySelectorAll(`[data-counter="${key}"]`);
    elements.forEach(el => {
      el.textContent = value;
      el.setAttribute('data-count', value);
    });
  });
}

// ============================================
// 6. ANIMAÇÕES E FEEDBACK VISUAL
// ============================================

/**
 * Shake animation
 */
export function shakeElement(element, intensity = 5) {
  if (!element) return;

  const originalTransform = element.style.transform || '';
  let shakeCount = 0;
  const maxShakes = 6;

  const shake = () => {
    const offset = shakeCount % 2 === 0 ? intensity : -intensity;
    element.style.transform = `${originalTransform} translateX(${offset}px)`;

    shakeCount++;
    if (shakeCount < maxShakes) {
      setTimeout(shake, 50);
    } else {
      element.style.transform = originalTransform;
    }
  };

  shake();
}

/**
 * Pulse animation
 */
export function pulseElement(element, times = 2) {
  if (!element) return;

  let pulseCount = 0;
  const originalScale = element.style.transform || '';

  const pulse = () => {
    const scale = pulseCount % 2 === 0 ? 1.05 : 1;
    element.style.transform = `${originalScale} scale(${scale})`;
    element.style.transition = 'transform 0.2s ease';

    pulseCount++;
    if (pulseCount < times * 2) {
      setTimeout(pulse, 200);
    } else {
      element.style.transform = originalScale;
    }
  };

  pulse();
}

/**
 * Fade in
 */
export function fadeIn(element, duration = UI_CONFIG.animations.fadeIn) {
  if (!element) return;

  element.style.opacity = '0';
  element.style.display = 'block';

  requestAnimationFrame(() => {
    element.style.transition = `opacity ${duration} ease`;
    element.style.opacity = '1';
  });
}

/**
 * Fade out
 */
export function fadeOut(element, duration = UI_CONFIG.animations.fadeOut, callback = null) {
  if (!element) return;

  element.style.transition = `opacity ${duration} ease`;
  element.style.opacity = '0';

  setTimeout(() => {
    element.style.display = 'none';
    if (callback) callback();
  }, parseFloat(duration) * 1000);
}

/**
 * Feedback de sucesso
 */
export function showSuccessFeedback(element, message = '') {
  if (!element) return;

  const originalBg = element.style.backgroundColor;
  element.style.backgroundColor = 'var(--success-color)';
  element.style.color = 'white';
  element.style.transition = 'all 0.3s ease';

  setTimeout(() => {
    element.style.backgroundColor = originalBg;
    element.style.color = '';
  }, 1000);

}

// ============================================
// 6. SISTEMA DE TOASTS/NOTIFICAÇÕES
// ============================================

/**
 * Mostra notificação toast
 */
export function showToast(message, type = 'info', duration = 3000) {
  // Remove toasts anteriores
  const existingToasts = document.querySelectorAll('.toast-notification');
  existingToasts.forEach(toast => toast.remove());

  // Cria novo toast
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${getToastIcon(type)}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="Fechar notificação">×</button>
    </div>
  `;

  // Adiciona ao DOM
  document.body.appendChild(toast);

  // Anima entrada
  setTimeout(() => toast.classList.add('show'), 10);

  // Configura fechamento automático
  const closeTimeout = setTimeout(() => hideToast(toast), duration);

  // Evento de fechar manual
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    clearTimeout(closeTimeout);
    hideToast(toast);
  });

  // Função para esconder toast
  function hideToast(toastElement) {
    toastElement.classList.remove('show');
    setTimeout(() => {
      if (toastElement.parentNode) {
        toastElement.parentNode.removeChild(toastElement);
      }
    }, 300);
  }
}

/**
 * Retorna ícone apropriado para o tipo de toast
 */
function getToastIcon(type) {
  switch (type) {
    case 'success': return '✓';
    case 'error': return '✕';
    case 'warning': return '⚠';
    case 'info':
    default: return 'ℹ';
  }
}

// ============================================
// 7. SISTEMA DE TOOLTIPS
// ============================================

/**
 * Cria tooltip para elemento
 */
export function createTooltip(element, text, options = {}) {
  if (!element) return null;

  const config = {
    position: options.position || 'top',
    delay: options.delay || 300,
    duration: options.duration || 2000,
    ...options
  };

  let tooltip = null;
  let showTimeout = null;
  let hideTimeout = null;

  function createTooltipElement() {
    if (tooltip) return tooltip;

    tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    tooltip.style.cssText = `
      position: absolute;
      background: var(--bg-secondary);
      color: var(--text-primary);
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-size: 0.875rem;
      box-shadow: var(--shadow-lg);
      z-index: ${UI_CONFIG.zIndex.tooltip};
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
      white-space: nowrap;
      border: 1px solid var(--border-color);
    `;

    document.body.appendChild(tooltip);
    return tooltip;
  }

  function positionTooltip() {
    if (!tooltip) return;

    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top, left;

    switch (config.position) {
      case 'top':
        top = rect.top - tooltipRect.height - 8;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = rect.bottom + 8;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.left - tooltipRect.width - 8;
        break;
      case 'right':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.right + 8;
        break;
    }

    // Ajusta para manter dentro da tela
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 8) left = 8;
    if (left + tooltipRect.width > viewportWidth - 8) {
      left = viewportWidth - tooltipRect.width - 8;
    }
    if (top < 8) top = 8;
    if (top + tooltipRect.height > viewportHeight - 8) {
      top = viewportHeight - tooltipRect.height - 8;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  }

  function showTooltip() {
    clearTimeout(hideTimeout);
    showTimeout = setTimeout(() => {
      createTooltipElement();
      positionTooltip();
      tooltip.style.opacity = '1';

      if (config.duration > 0) {
        hideTimeout = setTimeout(hideTooltip, config.duration);
      }
    }, config.delay);
  }

  function hideTooltip() {
    clearTimeout(showTimeout);
    if (tooltip) {
      tooltip.style.opacity = '0';
      setTimeout(() => {
        if (tooltip && tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
          tooltip = null;
        }
      }, 200);
    }
  }

  // Eventos
  element.addEventListener('mouseenter', showTooltip);
  element.addEventListener('mouseleave', hideTooltip);
  element.addEventListener('focus', showTooltip);
  element.addEventListener('blur', hideTooltip);

  // Cleanup
  const destroy = () => {
    clearTimeout(showTimeout);
    clearTimeout(hideTimeout);
    hideTooltip();
    element.removeEventListener('mouseenter', showTooltip);
    element.removeEventListener('mouseleave', hideTooltip);
    element.removeEventListener('focus', showTooltip);
    element.removeEventListener('blur', hideTooltip);
  };

  return { show: showTooltip, hide: hideTooltip, destroy };
}

// ============================================
// 8. UTILITÁRIOS DE TEMAS
// ============================================

/**
 * Aplica classes de tema
 */
export function applyThemeClasses() {
  const isDark = themeManager.isDark();
  document.documentElement.classList.toggle('theme-dark', isDark);
  document.documentElement.classList.toggle('theme-light', !isDark);
}

/**
 * Atualiza elementos sensíveis ao tema
 */
export function updateThemeSensitiveElements() {
  // Atualiza meta theme-color
  themeManager.updateMetaThemeColor();

  // Atualiza elementos com data-theme-icon
  const iconElements = document.querySelectorAll('[data-theme-icon]');
  iconElements.forEach(el => {
    const iconType = el.dataset.themeIcon;
    el.textContent = themeManager.getIcon(iconType);
  });
}

// ============================================
// UTILITÁRIOS AUXILIARES
// ============================================

/**
 * Cria input de arquivo invisível
 */
function createFileInput(id, config) {
  const input = document.createElement('input');
  input.type = 'file';
  input.id = `${id}-input`;
  input.multiple = config.maxFiles > 1;
  input.accept = config.accept.join(',');
  input.style.display = 'none';
  return input;
}

/**
 * Formata tamanho de arquivo
 */
function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '—';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Retorna largura máxima do modal
 */
function getModalMaxWidth(size) {
  switch (size) {
    case 'sm': return '400px';
    case 'md': return '600px';
    case 'lg': return '800px';
    case 'xl': return '1000px';
    default: return '600px';
  }
}

// ============================================
// 9. INICIALIZAÇÃO
// ============================================

/**
 * Inicializa o sistema de UI render
 */
export function initUIRender() {
  // Aplica tema inicial
  applyThemeClasses();
  updateThemeSensitiveElements();

  // Escuta mudanças de tema
  themeManager.on('themeChanged', () => {
    applyThemeClasses();
    updateThemeSensitiveElements();
  });

  // Configura tooltips globais
  setupGlobalTooltips();

  // Adiciona estilos dinâmicos
  addDynamicStyles();

  console.log('🎨 UI Render inicializado');
}

/**
 * Configura tooltips globais
 */
function setupGlobalTooltips() {
  // Tooltips automáticos para elementos com data-tooltip
  const tooltipElements = document.querySelectorAll('[data-tooltip]');
  tooltipElements.forEach(el => {
    createTooltip(el, el.dataset.tooltip);
  });
}

/**
 * Adiciona estilos dinâmicos
 */
function addDynamicStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* Estilos dinâmicos para UI Render */

    /* Tooltips */
    .tooltip {
      font-family: inherit;
    }

    /* Modals */
    .modal {
      font-family: inherit;
    }

    /* Empty states */
    .empty-state {
      text-align: center;
      padding: 3rem 2rem;
      color: var(--text-muted);
    }

    .empty-state-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
      display: block;
    }

    .empty-state-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
      color: var(--text-primary);
    }

    .empty-state-text {
      font-size: 0.875rem;
      margin: 0;
    }

    /* Estados visuais */
    .state-hover {
      border-color: var(--primary-color) !important;
    }

    .state-active {
      background-color: var(--primary-color) !important;
      color: white !important;
    }

    .state-error {
      border-color: var(--error-color) !important;
      background-color: rgba(239, 68, 68, 0.05) !important;
    }

    .state-success {
      border-color: var(--success-color) !important;
      background-color: rgba(16, 185, 129, 0.05) !important;
    }

    .state-loading {
      position: relative;
      pointer-events: none;
    }

    .state-loading::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 1rem;
      height: 1rem;
      margin: -0.5rem 0 0 -0.5rem;
      border: 2px solid transparent;
      border-top: 2px solid currentColor;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Responsividade */
    @media (max-width: 768px) {
      .modal {
        padding: 0.5rem;
      }

      .modal-dialog {
        max-height: 95vh;
      }

      .empty-state {
        padding: 2rem 1rem;
      }

      .toast-notification {
        margin: 1rem;
        min-width: calc(100vw - 2rem);
      }
    }

    /* Toast Notifications */
    .toast-notification {
      position: fixed;
      top: 1rem;
      right: 1rem;
      min-width: 300px;
      max-width: 500px;
      padding: 0;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      transform: translateX(100%);
      transition: transform 0.3s ease, opacity 0.3s ease;
      opacity: 0;
      font-family: inherit;
    }

    .toast-notification.show {
      transform: translateX(0);
      opacity: 1;
    }

    .toast-content {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
    }

    .toast-icon {
      font-size: 1.25rem;
      font-weight: bold;
      flex-shrink: 0;
    }

    .toast-success .toast-icon {
      color: var(--success-color);
    }

    .toast-error .toast-icon {
      color: var(--error-color);
    }

    .toast-warning .toast-icon {
      color: var(--warning-color);
    }

    .toast-info .toast-icon {
      color: var(--info-color);
    }

    .toast-message {
      flex: 1;
      font-size: 0.875rem;
      line-height: 1.4;
      color: var(--text-primary);
    }

    .toast-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      line-height: 1;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0;
      width: 1.5rem;
      height: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .toast-close:hover {
      background-color: var(--bg-hover);
      color: var(--text-primary);
    }

    /* Tema escuro para toasts */
    [data-theme="dark"] .toast-notification {
      background: var(--bg-secondary);
      border-color: var(--border-color);
    }

    [data-theme="dark"] .toast-message {
      color: var(--text-primary);
    }

    [data-theme="dark"] .toast-close {
      color: var(--text-muted);
    }

    [data-theme="dark"] .toast-close:hover {
      background-color: var(--bg-hover);
    }
  `;
  document.head.appendChild(style);
}

// Inicialização automática
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUIRender);
  } else {
    initUIRender();
  }
}
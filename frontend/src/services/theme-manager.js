// frontend/src/services/theme-manager.js
/**
 * Theme Manager - DocHub
 *
 * Gerencia temas (dark/light/auto) da aplicação
 * Persiste preferências, aplica ao DOM, fornece utilitários
 */

// ============================================
// 1. CONSTANTES E CONFIGURAÇÕES
// ============================================
const THEMES = {
  DARK: 'dark',
  LIGHT: 'light',
  AUTO: 'auto'
};

const STORAGE_KEY = 'dochub-theme';
const THEME_ATTR = 'data-theme';

// Ícones para cada tema
const ICONS = {
  sun: { dark: '☀️', light: '☀️', auto: '🤖' },
  moon: { dark: '🌙', light: '🌙', auto: '🌓' },
  theme: { dark: '🌙', light: '☀️', auto: '🤖' },
  contrast: { dark: '⚫', light: '⚪', auto: '⚫' }
};

// Eventos personalizados
const THEME_EVENTS = {
  CHANGED: 'themeChanged',
  LOADED: 'themeLoaded',
  ERROR: 'themeError',
  SYSTEM_CHANGED: 'systemThemeChanged'
};

// ============================================
// 2. CLASSE PRINCIPAL
// ============================================
class ThemeManager {
  constructor() {
    this.currentTheme = THEMES.DARK;
    this.systemTheme = THEMES.DARK;
    this.mediaQuery = null;
    this.initialized = false;
    this.eventListeners = {};

    this._addHelperMethods();
  }

  // ============================================
  // 3. MÉTODOS AUXILIARES
  // ============================================
  _addHelperMethods() {
    // Método para verificar se estamos no navegador
    this._isBrowser = () => typeof window !== 'undefined';

    // Método para verificar se localStorage está disponível
    this._hasStorage = () => {
      try {
        if (!this._isBrowser()) return false;
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      } catch {
        return false;
      }
    };

    // Método para obter o tema do sistema
    this._getSystemTheme = () => {
      if (!this._isBrowser()) return THEMES.DARK;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT;
    };

    // Método para aplicar o tema ao documento
    this._applyThemeToDocument = (theme) => {
      if (!this._isBrowser()) return;

      const resolvedTheme = theme === THEMES.AUTO ? this._getSystemTheme() : theme;
      document.documentElement.setAttribute(THEME_ATTR, resolvedTheme);
      this.currentTheme = theme;
      this.systemTheme = this._getSystemTheme();
    };

    // Método para atualizar elementos da UI
    this._updateUIElements = () => {
      if (!this._isBrowser()) return;

      const themeIcon = document.getElementById('theme-icon');
      const themeLabel = document.getElementById('theme-label');

      if (themeIcon) {
        themeIcon.textContent = this.getThemeIcon();
      }

      if (themeLabel) {
        themeLabel.textContent = this.getThemeLabel();
      }
    };
  }

  // ============================================
  // 4. INICIALIZAÇÃO
  // ============================================
  init() {
    if (this.initialized || !this._isBrowser()) return;

    try {
      this._applyFallbackTheme();
      this.setupSystemDetection();
      this.loadSavedTheme();
      this._updateUIElements();

      this.initialized = true;
      this.dispatchEvent(THEME_EVENTS.LOADED, { theme: this.currentTheme });

      console.log('🎨 Theme Manager inicializado:', this.currentTheme);
    } catch (error) {
      console.error('Erro ao inicializar Theme Manager:', error);
      this.dispatchEvent(THEME_EVENTS.ERROR, { error });
    }
  }

  _applyFallbackTheme() {
    // Aplica tema escuro como fallback
    this._applyThemeToDocument(THEMES.DARK);
  }

  // ============================================
  // 5. CONFIGURAÇÃO DO SISTEMA
  // ============================================
  setupSystemDetection() {
    if (!this._isBrowser()) return;

    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = (e) => {
      const newSystemTheme = e.matches ? THEMES.DARK : THEMES.LIGHT;
      this.systemTheme = newSystemTheme;

      // Só atualiza automaticamente se estiver no modo auto
      if (this.currentTheme === THEMES.AUTO) {
        this._applyThemeToDocument(THEMES.AUTO);
        this._updateUIElements();
        this.dispatchEvent(THEME_EVENTS.SYSTEM_CHANGED, {
          systemTheme: newSystemTheme,
          appliedTheme: this.getResolvedTheme()
        });
      }
    };

    // Listener moderno
    if (this.mediaQuery.addEventListener) {
      this.mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else {
      // Fallback para navegadores antigos
      this.mediaQuery.addListener(handleSystemThemeChange);
    }
  }

  // ============================================
  // 6. GERENCIAMENTO DE TEMA
  // ============================================
  setTheme(theme) {
    if (!Object.values(THEMES).includes(theme)) {
      console.warn('Tema inválido:', theme);
      return false;
    }

    try {
      this._applyThemeToDocument(theme);
      this.saveTheme();
      this._updateUIElements();
      this.dispatchEvent(THEME_EVENTS.CHANGED, {
        theme,
        resolvedTheme: this.getResolvedTheme()
      });

      return true;
    } catch (error) {
      console.error('Erro ao definir tema:', error);
      this.dispatchEvent(THEME_EVENTS.ERROR, { error, theme });
      return false;
    }
  }

  getTheme() {
    return this.currentTheme;
  }

  toggleTheme() {
    const currentResolved = this.getResolvedTheme();
    const newTheme = currentResolved === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    return this.setTheme(newTheme);
  }

  cycleTheme() {
    const themes = Object.values(THEMES);
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    return this.setTheme(themes[nextIndex]);
  }

  // ============================================
  // 7. APLICAÇÃO NO DOM
  // ============================================
  applyTheme() {
    this._applyThemeToDocument(this.currentTheme);
  }

  applyReducedMotion() {
    if (!this._isBrowser()) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      document.documentElement.style.setProperty('--transition-duration', '0s');
    }
  }

  updateMetaThemeColor() {
    if (!this._isBrowser()) return;

    const resolvedTheme = this.getResolvedTheme();
    const themeColor = resolvedTheme === THEMES.DARK ? '#0f172a' : '#ffffff';

    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = themeColor;
  }

  // ============================================
  // 8. PERSISTÊNCIA
  // ============================================
  loadSavedTheme() {
    if (!this._hasStorage()) {
      this.currentTheme = THEMES.DARK;
      return;
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && Object.values(THEMES).includes(saved)) {
        this.currentTheme = saved;
      } else {
        this.currentTheme = THEMES.DARK;
      }
      this._applyThemeToDocument(this.currentTheme);
    } catch (error) {
      console.warn('Erro ao carregar tema salvo:', error);
      this.currentTheme = THEMES.DARK;
    }
  }

  saveTheme() {
    if (!this._hasStorage()) return;

    try {
      localStorage.setItem(STORAGE_KEY, this.currentTheme);
    } catch (error) {
      console.warn('Erro ao salvar tema:', error);
    }
  }

  saveThemeToCookie() {
    if (!this._isBrowser()) return;

    try {
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1);
      document.cookie = `${STORAGE_KEY}=${this.currentTheme};expires=${expires.toUTCString()};path=/`;
    } catch (error) {
      console.warn('Erro ao salvar tema no cookie:', error);
    }
  }

  // ============================================
  // 9. UTILITÁRIOS
  // ============================================
  isDark() {
    return this.getResolvedTheme() === THEMES.DARK;
  }

  isLight() {
    return this.getResolvedTheme() === THEMES.LIGHT;
  }

  isAuto() {
    return this.currentTheme === THEMES.AUTO;
  }

  getResolvedTheme() {
    return this.currentTheme === THEMES.AUTO ? this._getSystemTheme() : this.currentTheme;
  }

  getIcon(iconName = 'theme') {
    const resolvedTheme = this.getResolvedTheme();
    return ICONS[iconName]?.[resolvedTheme] || ICONS[iconName]?.[THEMES.DARK];
  }

  getThemeIcon() {
    return this.getIcon('theme');
  }

  getContrastIcon() {
    return this.getIcon('contrast');
  }

  getThemeLabel() {
    switch (this.currentTheme) {
      case THEMES.DARK: return 'Tema escuro';
      case THEMES.LIGHT: return 'Tema claro';
      case THEMES.AUTO: return 'Tema automático';
      default: return 'Tema';
    }
  }

  getContrastColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string') return '#000000';

    // Remove # se existir
    const color = hexColor.replace('#', '');

    // Converte para RGB
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);

    // Calcula luminância
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  generateThemeShades(baseColor, isDark = this.isDark()) {
    if (!baseColor || typeof baseColor !== 'string') return {};

    return {
      50: this._lightenColor(baseColor, 0.9),
      100: this._lightenColor(baseColor, 0.8),
      200: this._lightenColor(baseColor, 0.6),
      300: this._lightenColor(baseColor, 0.4),
      400: this._lightenColor(baseColor, 0.2),
      500: baseColor,
      600: this._darkenColor(baseColor, 0.2),
      700: this._darkenColor(baseColor, 0.4),
      800: this._darkenColor(baseColor, 0.6),
      900: this._darkenColor(baseColor, 0.8)
    };
  }

  _lightenColor(hex, percent) {
    if (!hex || typeof hex !== 'string') return hex;

    try {
      const color = hex.replace('#', '');
      const num = parseInt(color, 16);
      const amt = Math.round(2.55 * percent * 100);
      const R = (num >> 16) + amt;
      const G = (num >> 8 & 0x00FF) + amt;
      const B = (num & 0x0000FF) + amt;

      return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    } catch {
      return hex;
    }
  }

  _darkenColor(hex, percent) {
    if (!hex || typeof hex !== 'string') return hex;

    try {
      const color = hex.replace('#', '');
      const num = parseInt(color, 16);
      const amt = Math.round(2.55 * percent * 100);
      const R = (num >> 16) - amt;
      const G = (num >> 8 & 0x00FF) - amt;
      const B = (num & 0x0000FF) - amt;

      return '#' + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
        (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
        (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
    } catch {
      return hex;
    }
  }

  // ============================================
  // 10. EVENTOS
  // ============================================
  on(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }

  off(eventName, callback) {
    if (!this.eventListeners[eventName]) return;

    const index = this.eventListeners[eventName].indexOf(callback);
    if (index > -1) {
      this.eventListeners[eventName].splice(index, 1);
    }
  }

  once(eventName, callback) {
    const onceCallback = (...args) => {
      callback(...args);
      this.off(eventName, onceCallback);
    };
    this.on(eventName, onceCallback);
  }

  dispatchEvent(eventName, data) {
    if (!this._isBrowser() || !this.eventListeners[eventName]) return;

    const event = new CustomEvent(eventName, {
      detail: data,
      bubbles: true,
      cancelable: true
    });

    document.dispatchEvent(event);

    // Chama callbacks registrados
    this.eventListeners[eventName].forEach(callback => {
      try {
        callback(data, event);
      } catch (error) {
        console.error('Erro no callback do evento:', error);
      }
    });
  }

  // ============================================
  // 11. DESTRUIÇÃO
  // ============================================
  destroy() {
    if (!this._isBrowser()) return;

    // Remove listeners
    if (this.mediaQuery) {
      if (this.mediaQuery.removeEventListener) {
        this.mediaQuery.removeEventListener('change', this._handleSystemThemeChange);
      } else {
        this.mediaQuery.removeListener(this._handleSystemThemeChange);
      }
    }

    // Limpa listeners de eventos
    this.eventListeners = {};

    // Remove atributos do DOM
    document.documentElement.removeAttribute(THEME_ATTR);

    this.initialized = false;
    console.log('🗑️ Theme Manager destruído');
  }
}

// ============================================
// 12. INSTÂNCIA SINGLETON GLOBAL
// ============================================
const themeManager = new ThemeManager();

// ============================================
// 13. INICIALIZAÇÃO AUTOMÁTICA
// ============================================
function initializeThemeManager() {
  if (typeof document !== 'undefined') {
    // Espera o DOM estar pronto
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        themeManager.init();
      });
    } else {
      themeManager.init();
    }
  }
}

// Inicializar automaticamente
initializeThemeManager();

// ============================================
// 14. EXPORTS E DISPONIBILIZAÇÃO GLOBAL
// ============================================
export default themeManager;
export { ThemeManager, THEMES, THEME_EVENTS };

// Disponibilizar globalmente para fácil acesso
if (typeof window !== 'undefined') {
  window.themeManager = themeManager;

  // Funções globais convenientes
  window.setTheme = (theme) => themeManager.setTheme(theme);
  window.toggleTheme = () => themeManager.toggleTheme();
  window.cycleTheme = () => themeManager.cycleTheme();
}

// ============================================
// 15. ADICIONAR ESTILOS GLOBAIS
// ============================================
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    /* Transições suaves para mudanças de tema */
    * {
      transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
    }

    /* Tema claro */
    :root {
      --primary-color: #2563eb;
      --primary-hover: #1d4ed8;
      --secondary-color: #64748b;
      --secondary-hover: #475569;
      --success-color: #10b981;
      --warning-color: #f59e0b;
      --error-color: #ef4444;
      --info-color: #3b82f6;
      --bg-primary: #ffffff;
      --bg-secondary: #f8fafc;
      --bg-tertiary: #f1f5f9;
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;
      --border-color: #e2e8f0;
      --shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    }

    /* Tema escuro */
    [data-theme="dark"] {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --text-primary: #f8fafc;
      --text-secondary: #cbd5e1;
      --text-muted: #64748b;
      --border-color: #334155;
      --shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
    }

    /* Reduzir movimento para acessibilidade */
    @media (prefers-reduced-motion: reduce) {
      * {
        transition: none !important;
        animation: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}
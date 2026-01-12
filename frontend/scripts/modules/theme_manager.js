// frontend/scripts/modules/theme_manager.js
/**
 * Gus Docs - Theme Manager
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

const STORAGE_KEY = 'gus-docs-theme';
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
    this.theme = THEMES.AUTO;
    this.resolvedTheme = THEMES.DARK; // Tema realmente aplicado
    this.isInitialized = false;
    this.listeners = new Map();
    this.mediaQuery = null;
    this.motionQuery = null;
    
    // Estados do sistema
    this.systemPrefersDark = false;
    this.systemPrefersLight = false;
    this.systemPrefersReducedMotion = false;
    
    // Adicionar métodos auxiliares ao construtor
    this._addHelperMethods();
  }
  
  // ============================================
  // 3. MÉTODOS AUXILIARES
  // ============================================
  _addHelperMethods() {
    // Adicionar métodos diretamente à instância
    this.enableSmoothTransitions = () => {
      document.body.classList.add('theme-transition');
      setTimeout(() => {
        document.body.classList.remove('theme-transition');
      }, 350);
      return this;
    };
    
    this.needsContrastAdjustment = (element) => {
      if (!element) return false;
      const bgColor = window.getComputedStyle(element).backgroundColor;
      const isTransparent = bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)';
      return isTransparent;
    };
    
    this.getOptimalTextColor = (backgroundColor) => {
      return this.isDark() ? '#ffffff' : '#000000';
    };
    
    this.updateThemeSensitiveImages = () => {
      document.querySelectorAll('[data-theme-sensitive]').forEach(img => {
        const darkSrc = img.getAttribute('data-dark-src');
        const lightSrc = img.getAttribute('data-light-src');
        
        if (this.isDark() && darkSrc) {
          img.src = darkSrc;
        } else if (this.isLight() && lightSrc) {
          img.src = lightSrc;
        }
      });
      return this;
    };
  }
  
  // ============================================
  // 4. INICIALIZAÇÃO
  // ============================================
  init() {
    if (this.isInitialized) {
      console.warn('ThemeManager já inicializado');
      return this;
    }
    
    try {
      // Adicionar classe para prevenir flashes
      document.body.classList.add('theme-loading');
      
      // 1. Configurar detecção do sistema
      this.setupSystemDetection();
      
      // 2. Carregar tema salvo ou detectar
      this.loadSavedTheme();
      
      // 3. Aplicar tema ao DOM
      this.applyTheme();
      
      // 4. Marcar como inicializado
      this.isInitialized = true;
      
      // 5. Disparar evento
      this.dispatchEvent(THEME_EVENTS.LOADED, {
        theme: this.theme,
        resolvedTheme: this.resolvedTheme
      });
      
      console.log(`✅ ThemeManager inicializado: ${this.theme} (${this.resolvedTheme})`);
      
      // Remover classe após carregar
      setTimeout(() => {
        document.body.classList.remove('theme-loading');
      }, 50);
      
    } catch (error) {
      console.error('❌ Erro ao inicializar ThemeManager:', error);
      this.dispatchEvent(THEME_EVENTS.ERROR, { error });
      
      // Tentar fallback básico
      this._applyFallbackTheme();
    }
    
    return this;
  }
  
  _applyFallbackTheme() {
    try {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.resolvedTheme = prefersDark ? THEMES.DARK : THEMES.LIGHT;
      document.body.setAttribute(THEME_ATTR, this.resolvedTheme);
      console.log(`🎨 Tema fallback aplicado: ${this.resolvedTheme}`);
    } catch (fallbackError) {
      console.error('❌ Fallback também falhou:', fallbackError);
    }
  }
  
  // ============================================
  // 5. CONFIGURAÇÃO DO SISTEMA
  // ============================================
  setupSystemDetection() {
    // Media query para dark/light mode
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemPrefersDark = this.mediaQuery.matches;
    this.systemPrefersLight = !this.systemPrefersDark;
    
    // Media query para reduced motion
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.systemPrefersReducedMotion = this.motionQuery.matches;
    
    // Ouvir mudanças no sistema
    this._handleSystemChange = (e) => {
      this.systemPrefersDark = e.matches;
      this.systemPrefersLight = !e.matches;
      
      // Se estiver em modo AUTO, atualizar tema
      if (this.theme === THEMES.AUTO) {
        this.applyTheme();
      }
      
      this.dispatchEvent(THEME_EVENTS.SYSTEM_CHANGED, {
        prefersDark: this.systemPrefersDark,
        prefersLight: this.systemPrefersLight
      });
    };
    
    this._handleMotionChange = (e) => {
      this.systemPrefersReducedMotion = e.matches;
      this.applyReducedMotion();
    };
    
    this.mediaQuery.addEventListener('change', this._handleSystemChange);
    this.motionQuery.addEventListener('change', this._handleMotionChange);
  }
  
  // ============================================
  // 6. GERENCIAMENTO DE TEMA
  // ============================================
  setTheme(theme) {
    // Validar tema
    if (!Object.values(THEMES).includes(theme)) {
      console.warn(`Tema inválido: "${theme}". Usando ${THEMES.AUTO}`);
      theme = THEMES.AUTO;
    }
    
    const oldTheme = this.theme;
    const oldResolvedTheme = this.resolvedTheme;
    
    // Atualizar tema
    this.theme = theme;
    
    // Salvar preferência
    this.saveTheme();
    
    // Aplicar ao DOM
    this.applyTheme();
    
    // Disparar evento se houve mudança
    if (oldTheme !== theme || oldResolvedTheme !== this.resolvedTheme) {
      this.dispatchEvent(THEME_EVENTS.CHANGED, {
        theme: this.theme,
        resolvedTheme: this.resolvedTheme,
        oldTheme,
        oldResolvedTheme
      });
      
      console.log(`🎨 Tema alterado: ${oldTheme} → ${theme} (resolved: ${this.resolvedTheme})`);
    }
    
    return this;
  }
  
  getTheme() {
    return {
      theme: this.theme,
      resolvedTheme: this.resolvedTheme,
      systemPrefersDark: this.systemPrefersDark,
      systemPrefersLight: this.systemPrefersLight,
      systemPrefersReducedMotion: this.systemPrefersReducedMotion
    };
  }
  
  toggleTheme() {
    // Se estiver em AUTO, vai para DARK
    if (this.theme === THEMES.AUTO) {
      return this.setTheme(THEMES.DARK);
    }
    
    // Alternar entre DARK e LIGHT
    const newTheme = this.resolvedTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    return this.setTheme(newTheme);
  }
  
  cycleTheme() {
    // Alternar entre AUTO → DARK → LIGHT → AUTO
    const themeCycle = [THEMES.AUTO, THEMES.DARK, THEMES.LIGHT];
    const currentIndex = themeCycle.indexOf(this.theme);
    const nextIndex = (currentIndex + 1) % themeCycle.length;
    return this.setTheme(themeCycle[nextIndex]);
  }
  
  // ============================================
  // 7. APLICAÇÃO NO DOM
  // ============================================
  applyTheme() {
    // Determinar tema a ser aplicado
    let themeToApply;
    
    if (this.theme === THEMES.AUTO) {
      themeToApply = this.systemPrefersDark ? THEMES.DARK : THEMES.LIGHT;
    } else {
      themeToApply = this.theme;
    }
    
    this.resolvedTheme = themeToApply;
    
    // Aplicar transições suaves
    this.enableSmoothTransitions();
    
    // Aplicar ao body
    document.body.setAttribute(THEME_ATTR, themeToApply);
    
    // Aplicar reduced motion se necessário
    this.applyReducedMotion();
    
    // Atualizar meta tag (para browsers/apps externos)
    this.updateMetaThemeColor();
    
    // Atualizar imagens sensíveis ao tema
    this.updateThemeSensitiveImages();
    
    return this;
  }
  
  applyReducedMotion() {
    if (this.systemPrefersReducedMotion) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }
    return this;
  }
  
  updateMetaThemeColor() {
    // Atualizar meta tag theme-color para browsers mobile
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    
    const color = this.resolvedTheme === THEMES.DARK ? '#121212' : '#f8fafc';
    metaThemeColor.setAttribute('content', color);
    
    return this;
  }
  
  // ============================================
  // 8. PERSISTÊNCIA
  // ============================================
  loadSavedTheme() {
    try {
      // Tentar localStorage primeiro
      const saved = localStorage.getItem(STORAGE_KEY);
      
      if (saved && Object.values(THEMES).includes(saved)) {
        this.theme = saved;
        console.log(`📁 Tema carregado do storage: ${saved}`);
      } else {
        // Se não houver salvo, usar preferência do sistema
        this.theme = THEMES.AUTO;
        console.log('📁 Nenhum tema salvo encontrado, usando AUTO');
      }
    } catch (error) {
      console.warn('⚠️ Não foi possível carregar tema salvo:', error);
      this.theme = THEMES.AUTO;
    }
  }
  
  saveTheme() {
    try {
      localStorage.setItem(STORAGE_KEY, this.theme);
      console.log(`💾 Tema salvo: ${this.theme}`);
    } catch (error) {
      console.warn('⚠️ Não foi possível salvar tema no localStorage:', error);
      // Fallback para cookies se localStorage falhar
      this.saveThemeToCookie();
    }
  }
  
  saveThemeToCookie() {
    try {
      const date = new Date();
      date.setFullYear(date.getFullYear() + 1); // Expira em 1 ano
      
      document.cookie = `${STORAGE_KEY}=${this.theme}; expires=${date.toUTCString()}; path=/; SameSite=Strict`;
      console.log(`🍪 Tema salvo em cookie: ${this.theme}`);
    } catch (error) {
      console.error('❌ Não foi possível salvar tema em cookie:', error);
    }
  }
  
  // ============================================
  // 9. UTILITÁRIOS
  // ============================================
  isDark() {
    return this.resolvedTheme === THEMES.DARK;
  }
  
  isLight() {
    return this.resolvedTheme === THEMES.LIGHT;
  }
  
  isAuto() {
    return this.theme === THEMES.AUTO;
  }
  
  getIcon(iconName = 'theme') {
    const iconSet = ICONS[iconName];
    if (!iconSet) {
      console.warn(`Ícone não encontrado: "${iconName}". Usando tema padrão.`);
      return this.getThemeIcon();
    }
    
    return iconSet[this.resolvedTheme] || iconSet.dark;
  }
  
  getThemeIcon() {
    return this.getIcon('theme');
  }
  
  getContrastIcon() {
    return this.getIcon('contrast');
  }
  
  getContrastColor(hexColor) {
    // Função simples para determinar cor de contraste
    if (!hexColor || !hexColor.startsWith('#')) return '#ffffff';
    
    try {
      // Converter hex para RGB
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      
      // Calcular luminância (fórmula WCAG)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      
      // Retornar branco para cores escuras, preto para claras
      return luminance > 0.5 ? '#000000' : '#ffffff';
    } catch (error) {
      console.warn('Erro ao calcular contraste:', error);
      return this.isDark() ? '#ffffff' : '#000000';
    }
  }
  
  generateThemeShades(baseColor, isDark = this.isDark()) {
    // Gerar paleta de cores baseada no tema
    const shades = {};
    
    if (isDark) {
      shades.primary = baseColor;
      shades.lighter = this._lightenColor(baseColor, 20);
      shades.darker = this._darkenColor(baseColor, 20);
      shades.background = this._darkenColor(baseColor, 40);
      shades.surface = this._darkenColor(baseColor, 30);
      shades.text = '#ffffff';
      shades.border = this._lightenColor(baseColor, 15);
    } else {
      shades.primary = baseColor;
      shades.lighter = this._lightenColor(baseColor, 30);
      shades.darker = this._darkenColor(baseColor, 10);
      shades.background = this._lightenColor(baseColor, 45);
      shades.surface = '#ffffff';
      shades.text = '#000000';
      shades.border = this._darkenColor(baseColor, 20);
    }
    
    return shades;
  }
  
  _lightenColor(hex, percent) {
    // Implementação básica de clarear cor
    try {
      let r = parseInt(hex.slice(1, 3), 16);
      let g = parseInt(hex.slice(3, 5), 16);
      let b = parseInt(hex.slice(5, 7), 16);
      
      r = Math.min(255, r + (255 - r) * (percent / 100));
      g = Math.min(255, g + (255 - g) * (percent / 100));
      b = Math.min(255, b + (255 - b) * (percent / 100));
      
      return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
    } catch (error) {
      console.warn('Erro ao clarear cor:', error);
      return hex;
    }
  }
  
  _darkenColor(hex, percent) {
    // Implementação básica de escurecer cor
    try {
      let r = parseInt(hex.slice(1, 3), 16);
      let g = parseInt(hex.slice(3, 5), 16);
      let b = parseInt(hex.slice(5, 7), 16);
      
      r = Math.max(0, r * (1 - percent / 100));
      g = Math.max(0, g * (1 - percent / 100));
      b = Math.max(0, b * (1 - percent / 100));
      
      return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
    } catch (error) {
      console.warn('Erro ao escurecer cor:', error);
      return hex;
    }
  }
  
  // ============================================
  // 10. EVENTOS
  // ============================================
  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(callback);
    return this;
  }
  
  off(eventName, callback) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).delete(callback);
    }
    return this;
  }
  
  once(eventName, callback) {
    const onceCallback = (data) => {
      callback(data);
      this.off(eventName, onceCallback);
    };
    this.on(eventName, onceCallback);
    return this;
  }
  
  dispatchEvent(eventName, data) {
    // Disparar para listeners internos
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Erro no listener do evento ${eventName}:`, error);
        }
      });
    }
    
    // Disparar também CustomEvent no documento
    const event = new CustomEvent(`theme:${eventName}`, { detail: data });
    document.dispatchEvent(event);
    
    return this;
  }
  
  // ============================================
  // 11. DESTRUIÇÃO
  // ============================================
  destroy() {
    // Remover listeners do sistema
    if (this.mediaQuery && this._handleSystemChange) {
      this.mediaQuery.removeEventListener('change', this._handleSystemChange);
    }
    
    if (this.motionQuery && this._handleMotionChange) {
      this.motionQuery.removeEventListener('change', this._handleMotionChange);
    }
    
    // Limpar listeners personalizados
    this.listeners.clear();
    
    this.isInitialized = false;
    
    console.log('♻️ ThemeManager destruído');
    
    return this;
  }
  
  // ============================================
  // 12. MÉTODOS ESTÁTICOS/UTILITÁRIOS
  // ============================================
  static getAvailableThemes() {
    return Object.values(THEMES);
  }
  
  static detectSystemTheme() {
    try {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return isDark ? THEMES.DARK : THEMES.LIGHT;
    } catch (error) {
      console.warn('Erro ao detectar tema do sistema:', error);
      return THEMES.DARK;
    }
  }
  
  static getContrastRatio(color1, color2) {
    // Implementação simplificada de cálculo de contraste WCAG
    try {
      // Converter cores para luminância relativa
      const getLuminance = (color) => {
        const rgb = color.startsWith('#') 
          ? [
              parseInt(color.slice(1, 3), 16) / 255,
              parseInt(color.slice(3, 5), 16) / 255,
              parseInt(color.slice(5, 7), 16) / 255
            ]
          : [0.5, 0.5, 0.5]; // Fallback
        
        const [r, g, b] = rgb.map(c => 
          c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
        );
        
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      
      const l1 = getLuminance(color1);
      const l2 = getLuminance(color2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      
      return (lighter + 0.05) / (darker + 0.05);
    } catch (error) {
      console.warn('Erro ao calcular contraste:', error);
      return 4.5; // Valor padrão WCAG AA
    }
  }
  
  static isAccessibleContrast(color1, color2, level = 'AA') {
    const ratio = this.getContrastRatio(color1, color2);
    const minRatios = {
      'AA': 4.5,
      'AA-Large': 3.0,
      'AAA': 7.0,
      'AAA-Large': 4.5
    };
    
    return ratio >= (minRatios[level] || 4.5);
  }
}

// ============================================
// 13. INSTÂNCIA SINGLETON GLOBAL
// ============================================
const themeManager = new ThemeManager();

// ============================================
// 14. INICIALIZAÇÃO AUTOMÁTICA
// ============================================
function initializeThemeManager() {
  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('📄 DOM carregado, inicializando ThemeManager...');
      themeManager.init();
    });
  } else {
    // DOM já carregado, inicializar imediatamente
    console.log('📄 DOM já carregado, inicializando ThemeManager...');
    setTimeout(() => themeManager.init(), 0);
  }
}

// Inicializar automaticamente
initializeThemeManager();

// ============================================
// 15. EXPORTS E DISPONIBILIZAÇÃO GLOBAL
// ============================================
export default themeManager;
export { ThemeManager, THEMES, THEME_EVENTS };

// Disponibilizar globalmente para fácil acesso
if (typeof window !== 'undefined') {
  window.gusThemeManager = themeManager;
  window.THEMES = THEMES;
  
  // Adicionar atalho global
  if (!window.gus) window.gus = {};
  window.gus.theme = themeManager;
}

// ============================================
// 16. ADICIONAR ESTILOS GLOBAIS
// ============================================
if (typeof document !== 'undefined') {
  // Adicionar estilos CSS para transições de tema
  const style = document.createElement('style');
  style.id = 'gus-theme-styles';
  style.textContent = `
    .theme-transition * {
      transition: background-color 0.3s ease, 
                  border-color 0.3s ease, 
                  color 0.3s ease,
                  opacity 0.3s ease !important;
    }
    
    .theme-loading {
      visibility: hidden;
    }
    
    .reduced-motion * {
      animation-duration: 0.001ms !important;
      transition-duration: 0.001ms !important;
    }
    
    [data-theme="dark"] {
      color-scheme: dark;
    }
    
    [data-theme="light"] {
      color-scheme: light;
    }
  `;
  
  document.head.appendChild(style);
}
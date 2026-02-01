import { Router } from './router.js';
import { StateManager } from './state-manager.js';
import { EventBus } from './event-bus.js';
import { ErrorBoundary } from './error-boundary.js';

class App {
  constructor() {
    this.router = new Router();
    this.stateManager = new StateManager();
    this.eventBus = new EventBus();
    this.errorBoundary = new ErrorBoundary();
    this.init();
  }

  init() {
    this.router.init();
    this.bindEvents();
  }

  bindEvents() {
    // Bind events
  }
}

new App();

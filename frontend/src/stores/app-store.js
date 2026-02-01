export class AppStore {
  constructor() {
    this.state = { currentView: 'home' };
  }

  setView(view) {
    this.state.currentView = view;
  }
}

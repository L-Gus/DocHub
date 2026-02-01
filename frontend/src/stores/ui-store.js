export class UiStore {
  constructor() {
    this.ui = { modalOpen: false };
  }

  openModal() {
    this.ui.modalOpen = true;
  }
}

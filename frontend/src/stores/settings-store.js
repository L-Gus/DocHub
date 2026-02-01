export class SettingsStore {
  constructor() {
    this.settings = { theme: 'light' };
  }

  setSetting(key, value) {
    this.settings[key] = value;
  }
}

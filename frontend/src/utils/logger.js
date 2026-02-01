export class Logger {
  static log(message) {
    console.log(`[DocHub] ${message}`);
  }

  static error(message) {
    console.error(`[DocHub] ${message}`);
  }
}

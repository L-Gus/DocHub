export class ErrorBoundary {
  constructor() {
    this.errors = [];
  }

  catch(error) {
    this.errors.push(error);
    console.error(error);
  }
}

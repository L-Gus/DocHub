export class MockApi {
  static getData() {
    return Promise.resolve({ data: 'mock' });
  }
}

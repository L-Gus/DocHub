export class PdfApi {
  static merge(files) {
    // Call Rust
    return Promise.resolve({ success: true });
  }

  static split(file, ranges) {
    // Call Rust
    return Promise.resolve({ success: true });
  }
}

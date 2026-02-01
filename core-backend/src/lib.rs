pub mod api;
pub mod processors;
pub mod types;
pub mod utils;

use serde_json::Value;

pub fn process_command(action: String, data: Value) -> Value {
    match action.as_str() {
        "merge" => processors::pdf_merger::merge_pdfs(data),
        "split" => processors::pdf_splitter::split_pdf(data),
        _ => Value::String("Unknown action".to_string()),
    }
}

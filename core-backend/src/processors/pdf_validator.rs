use lopdf::Document;
use serde_json::Value;

pub fn validate_pdf(data: Value) -> Value {
    let file = data["file"].as_str().unwrap();
    match Document::load(file) {
        Ok(_) => Value::Bool(true),
        Err(_) => Value::Bool(false),
    }
}

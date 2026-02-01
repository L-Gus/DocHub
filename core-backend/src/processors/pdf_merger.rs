use lopdf::Document;
use serde_json::Value;
use std::fs;

pub fn merge_pdfs(data: Value) -> Value {
    let files = data["files"].as_array().unwrap();
    let output = data["output"].as_str().unwrap();

    let mut doc = Document::with_version("1.5");

    for file in files {
        let path = file.as_str().unwrap();
        let mut input_doc = Document::load(path).unwrap();
        doc.merge(&mut input_doc);
    }

    doc.save(output).unwrap();
    Value::String("Merged successfully".to_string())
}

use lopdf::Document;
use serde_json::Value;

pub fn merge_pdfs(data: Value) -> Value {
    let files = data["files"].as_array().unwrap();
    let output = data["output"].as_str().unwrap();

    let mut merged_doc = Document::with_version("1.5");

    for file in files {
        let path = file.as_str().unwrap();
        let doc = Document::load(path).unwrap();
        let pages = doc.get_pages();

        for (page_num, page_id) in pages {
            let page = doc.get_object(page_id).unwrap();
            merged_doc.objects.insert(page_id, page.clone());
        }
    }

    merged_doc.save(output).unwrap();
    Value::String("Merged successfully".to_string())
}

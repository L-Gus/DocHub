use lopdf::Document;
use serde_json::Value;

pub fn split_pdf(data: Value) -> Value {
    let file = data["file"].as_str().unwrap();
    let ranges = data["ranges"].as_array().unwrap();
    let output_dir = data["output_dir"].as_str().unwrap();

    let doc = Document::load(file).unwrap();

    for (i, range) in ranges.iter().enumerate() {
        let start = range[0].as_u64().unwrap() as u32;
        let end = range[1].as_u64().unwrap() as u32;

        let mut new_doc = Document::with_version("1.5");
        for page_num in start..=end {
            if let Some(page) = doc.get_page(page_num) {
                new_doc.add_page(page);
            }
        }

        let output_path = format!("{}/split_{}.pdf", output_dir, i + 1);
        new_doc.save(&output_path).unwrap();
    }

    Value::String("Split successfully".to_string())
}

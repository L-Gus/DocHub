use crate::processors::pdf_validator;
use serde_json::Value;

pub fn handle_validate(data: Value) -> Value {
    pdf_validator::validate_pdf(data)
}

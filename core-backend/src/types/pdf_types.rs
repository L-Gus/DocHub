use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct PdfInfo {
    pub page_count: u32,
    pub size: u64,
}

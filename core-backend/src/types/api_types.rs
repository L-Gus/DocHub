use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct MergeRequest {
    pub files: Vec<String>,
    pub output: String,
}

#[derive(Serialize, Deserialize)]
pub struct SplitRequest {
    pub file: String,
    pub ranges: Vec<(u32, u32)>,
    pub output_dir: String,
}

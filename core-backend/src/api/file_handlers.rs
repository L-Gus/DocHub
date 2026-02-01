use std::fs;
use std::path::Path;

pub fn file_exists(path: &str) -> bool {
    Path::new(path).exists()
}

pub fn create_dir(path: &str) {
    fs::create_dir_all(path).unwrap();
}

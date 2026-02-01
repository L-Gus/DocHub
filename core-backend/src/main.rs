use std::io::{self, BufRead};
use serde::{Deserialize, Serialize};
use dochub_backend::process_command;

#[derive(Serialize, Deserialize)]
struct Command {
    action: String,
    data: serde_json::Value,
}

fn main() {
    let stdin = io::stdin();
    for line in stdin.lines() {
        let line = line.unwrap();
        let cmd: Command = serde_json::from_str(&line).unwrap();
        let result = process_command(cmd.action, cmd.data);
        println!("{}", serde_json::to_string(&result).unwrap());
    }
}

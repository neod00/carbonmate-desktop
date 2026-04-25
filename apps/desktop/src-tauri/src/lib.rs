use std::fs;
use rfd::FileDialog;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 프로젝트를 .carbonmate 파일로 저장
/// content: JSON 문자열 (프론트에서 직렬화한 프로젝트 데이터)
/// 반환: 저장된 파일 경로 (취소 시 빈 문자열)
#[tauri::command]
fn save_project_file(content: String, default_name: String) -> Result<String, String> {
    let path = FileDialog::new()
        .set_title("프로젝트 저장")
        .set_file_name(&default_name)
        .add_filter("CarbonMate 프로젝트", &["carbonmate"])
        .save_file();

    match path {
        Some(p) => {
            fs::write(&p, content).map_err(|e| e.to_string())?;
            Ok(p.to_string_lossy().to_string())
        }
        None => Ok(String::new()), // 취소
    }
}

/// .carbonmate 파일 불러오기
/// 반환: JSON 문자열 (취소 시 빈 문자열)
#[tauri::command]
fn load_project_file() -> Result<String, String> {
    let path = FileDialog::new()
        .set_title("프로젝트 열기")
        .add_filter("CarbonMate 프로젝트", &["carbonmate"])
        .pick_file();

    match path {
        Some(p) => {
            let content = fs::read_to_string(&p).map_err(|e| e.to_string())?;
            Ok(content)
        }
        None => Ok(String::new()), // 취소
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            save_project_file,
            load_project_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

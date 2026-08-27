use std::path::PathBuf;

use crate::api::voice_dir;
use crate::utils::path::validate_path_in_base;

/// 获取 TTS 语音文件的绝对路径，前端用 convertFileSrc 播放。
#[tauri::command]
pub fn get_voice_audio(file_name: String) -> Result<String, String> {
    let base = voice_dir();
    let resolved = base.join(&file_name);
    validate_path_in_base(&resolved, &base)?;
    if !resolved.exists() {
        return Err(format!("语音文件不存在: {}", file_name));
    }
    let canon = resolved
        .canonicalize()
        .map_err(|e| format!("路径解析失败: {}", e))?;
    Ok(canon.to_string_lossy().into_owned())
}

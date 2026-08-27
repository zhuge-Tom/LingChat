use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

use crate::ai_service::types::CharacterSettings;
use crate::config;
use crate::db::entities::role::RoleType;
use crate::db::managers::role_repo::RoleRepo;
use crate::utils::system::open_folder;
use crate::AppState;

use super::{characters_dir, data_dir, game_data_dir};

const LEGACY_VOICE_MODEL_FIELDS: &[&str] = &[
    "sva_speaker_id",
    "sbv2_name",
    "sbv2_speaker_id",
    "bv2_speaker_id",
    "sbv2api_name",
    "sbv2api_speaker_id",
    "gsv_voice_text",
    "gsv_voice_filename",
    "gsv_gpt_model_name",
    "gsv_sovits_model_name",
    "aivis_model_uuid",
    "opentts_voice",
    "fish_s2_voice",
];

fn remove_legacy_voice_model_fields(settings: &mut CharacterSettings) {
    for key in LEGACY_VOICE_MODEL_FIELDS {
        settings.extra.remove(*key);
    }
}

// ========== 响应类型 ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ClothesItem {
    pub title: String,
    /// 绝对文件系统路径
    pub avatar: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CharacterListItem {
    pub character_id: i32,
    pub title: String,
    pub name: String,
    pub sub_name: String,
    pub info: String,
    pub avatar_path: String,
    pub clothes: Vec<ClothesItem>,
    pub adventure_count: i32,
    pub total_adventures: i32,
    pub resource_folder: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CharacterPageResult {
    pub items: Vec<CharacterListItem>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
    pub total_pages: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct RoleInfoResponse {
    pub character_id: i32,
    pub ai_name: String,
    pub ai_subtitle: String,
    pub thinking_message: String,
    pub scale: f64,
    pub offset_x: f64,
    pub offset_y: f64,
    pub scale_p: f64,
    pub offset_x_p: f64,
    pub offset_y_p: f64,
    pub bubble_top: i32,
    pub bubble_left: i32,
    pub clothes: Option<Vec<HashMap<String, String>>>,
    pub clothes_name: String,
    pub body_part: Option<HashMap<String, JsonValue>>,
    pub character_folder: String,
}

// ========== 辅助函数 ==========

/// 读取某个角色的 settings.yml，失败时返回默认值
pub(crate) fn read_character_settings(resource_folder: &str) -> CharacterSettings {
    let yaml_path = characters_dir().join(resource_folder).join("settings.yml");
    if !yaml_path.exists() {
        tracing::warn!("角色设置文件不存在: {:?}", yaml_path);
        let mut s = CharacterSettings::default();
        s.character_folder = resource_folder.to_string();
        return s;
    }
    match fs::read_to_string(&yaml_path) {
        Ok(content) => match serde_yaml::from_str::<CharacterSettings>(&content) {
            Ok(mut settings) => {
                settings.character_folder = resource_folder.to_string();
                settings
            }
            Err(e) => {
                tracing::error!("解析 {:?} 失败: {}", yaml_path, e);
                let mut s = CharacterSettings::default();
                s.character_folder = resource_folder.to_string();
                s
            }
        },
        Err(e) => {
            tracing::error!("读取 {:?} 失败: {}", yaml_path, e);
            let mut s = CharacterSettings::default();
            s.character_folder = resource_folder.to_string();
            s
        }
    }
}

/// 在指定目录中查找头像文件（名为"头像"的图片）
fn find_avatar_in_dir(dir: &PathBuf) -> Option<PathBuf> {
    if !dir.exists() {
        return None;
    }
    for ext in &["png", "webp", "jpg", "jpeg", "gif", "bmp"] {
        let path = dir.join(format!("头像.{}", ext));
        if path.exists() {
            return Some(path);
        }
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with("头像") && !entry.file_type().map(|t| t.is_dir()).unwrap_or(true)
            {
                return Some(entry.path());
            }
        }
    }
    None
}

/// 扫描角色头像目录，返回衣服列表（每项包含头像文件的绝对路径）
fn scan_clothes(resource_folder: &str) -> Vec<ClothesItem> {
    let allowed_extensions = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];

    let avatar_dir = characters_dir().join(resource_folder).join("avatar");
    if !avatar_dir.exists() {
        return vec![ClothesItem {
            title: "默认".to_string(),
            avatar: String::new(),
        }];
    }

    let mut clothes: Vec<ClothesItem> = Vec::new();

    let root_avatar = find_emotion_file(&avatar_dir, "正常", &allowed_extensions)
        .map(|p| p.to_string_lossy().into_owned());
    if let Some(avatar_path) = root_avatar {
        clothes.push(ClothesItem {
            title: "默认".to_string(),
            avatar: avatar_path,
        });
    }

    if let Ok(entries) = fs::read_dir(&avatar_dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let name = entry.file_name().to_string_lossy().into_owned();
                let subdir = entry.path();
                let avatar_path = find_emotion_file(&subdir, "正常", &allowed_extensions)
                    .map(|p| p.to_string_lossy().into_owned())
                    .unwrap_or_default();
                clothes.push(ClothesItem {
                    title: name,
                    avatar: avatar_path,
                });
            }
        }
    }

    if clothes.is_empty() {
        let default_path = find_avatar_in_dir(&avatar_dir)
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_default();
        clothes.push(ClothesItem {
            title: "默认".to_string(),
            avatar: default_path,
        });
    }

    clothes
}

/// 获取角色默认头像的绝对路径
fn default_avatar_path(resource_folder: &str) -> String {
    let avatar_dir = characters_dir().join(resource_folder).join("avatar");
    for ext in &["png", "webp", "jpg", "jpeg", "gif", "bmp"] {
        let path = avatar_dir.join(format!("头像.{}", ext));
        if path.exists() {
            return path.to_string_lossy().into_owned();
        }
    }
    if let Ok(entries) = fs::read_dir(&avatar_dir) {
        for entry in entries.flatten() {
            let fname = entry.file_name();
            let name = fname.to_string_lossy();
            if name.starts_with("头像") && !entry.file_type().map(|t| t.is_dir()).unwrap_or(true)
            {
                return entry.path().to_string_lossy().into_owned();
            }
        }
    }
    avatar_dir.to_string_lossy().into_owned()
}

fn is_safe_component(s: &str) -> bool {
    !s.is_empty() && !s.contains("..") && !s.contains('/') && !s.contains('\\')
}

fn avatar_path_cache() -> &'static Mutex<HashMap<String, String>> {
    static CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// 在目录中查找文件名（不含扩展名）匹配的图片文件
pub(crate) fn find_emotion_file(dir: &PathBuf, stem: &str, extensions: &[&str]) -> Option<PathBuf> {
    for ext in extensions {
        let path = dir.join(format!("{stem}.{ext}"));
        if path.is_file() {
            return Some(path);
        }
    }
    None
}

// ========== Tauri 命令 ==========

#[tauri::command]
pub async fn get_character_list(
    app: AppHandle,
    page: i32,
    page_size: i32,
) -> Result<CharacterPageResult, String> {
    let state = app.state::<AppState>();
    let db = &state.db;

    let (page_roles, total) = RoleRepo::get_main_roles_page(db, page, page_size)
        .await
        .map_err(|e| format!("查询角色列表失败: {}", e))?;
    let total = total as i64;
    let total_pages = ((total as f64) / (page_size.max(1) as f64)).ceil() as i32;

    let (prepared, all_keys) = {
        let service = state.ai_service.lock().await;
        let mut prepared = Vec::new();
        let mut all_keys = Vec::new();
        for role in &page_roles {
            let folder = role.resource_folder.clone().unwrap_or_default();
            let keys: Vec<String> = service
                .script_manager
                .get_character_adventures(&folder)
                .into_iter()
                .map(|adv| adv.folder_key.clone())
                .collect();
            let total_adventures = keys.len() as i32;
            all_keys.extend(keys.iter().cloned());
            prepared.push((folder, keys, total_adventures));
        }
        (prepared, all_keys)
    };

    let unlocked = crate::adventures::manager::AdventureManager::unlocked_set(db, &all_keys)
        .await
        .unwrap_or_default();

    let mut items = Vec::new();
    for (role, (folder, adventure_keys, total_adventures)) in
        page_roles.into_iter().zip(prepared)
    {
        let settings = read_character_settings(&folder);
        let adventure_count = adventure_keys
            .iter()
            .filter(|k| unlocked.contains(*k))
            .count() as i32;

        items.push(CharacterListItem {
            character_id: role.id,
            title: role.name.clone(),
            name: settings.ai_name,
            sub_name: settings.ai_subtitle.unwrap_or_default(),
            info: settings.info.unwrap_or_default(),
            avatar_path: default_avatar_path(&folder),
            clothes: scan_clothes(&folder),
            adventure_count,
            total_adventures,
            resource_folder: folder,
        });
    }

    Ok(CharacterPageResult {
        items,
        total,
        page,
        page_size,
        total_pages,
    })
}

#[tauri::command]
pub async fn get_role_info(app: AppHandle, role_id: i32) -> Result<RoleInfoResponse, String> {
    let state = app.state::<AppState>();
    let db = &state.db;

    let role = RoleRepo::get_role_by_id(db, role_id)
        .await
        .map_err(|e| format!("查询角色失败: {}", e))?
        .ok_or_else(|| format!("角色 {} 不存在", role_id))?;

    let folder = role.resource_folder.clone().unwrap_or_default();
    let settings = read_character_settings(&folder);

    Ok(RoleInfoResponse {
        character_id: role.id,
        ai_name: settings.ai_name,
        ai_subtitle: settings.ai_subtitle.unwrap_or_default(),
        thinking_message: settings.thinking_message,
        scale: settings.scale,
        offset_x: settings.offset_x,
        offset_y: settings.offset_y,
        scale_p: settings.scale_p,
        offset_x_p: settings.offset_x_p,
        offset_y_p: settings.offset_y_p,
        bubble_top: settings.bubble_top,
        bubble_left: settings.bubble_left,
        clothes: settings.clothes,
        clothes_name: settings.clothes_name.unwrap_or_default(),
        body_part: settings.body_part,
        character_folder: folder,
    })
}

#[tauri::command]
pub async fn get_role_settings(app: AppHandle, role_id: i32) -> Result<CharacterSettings, String> {
    let state = app.state::<AppState>();
    let db = &state.db;

    RoleRepo::get_role_settings_by_id(db, &data_dir(), role_id)
        .await
        .map_err(|e| format!("读取角色配置失败: {}", e))?
        .ok_or_else(|| format!("角色 {} 不存在或其配置不可用", role_id))
}

#[tauri::command]
pub fn get_character_file(file_path: String) -> Result<String, String> {
    let base = characters_dir();
    let resolved = base.join(&file_path);

    crate::utils::path::validate_path_in_base(&resolved, &base)?;

    if !resolved.exists() {
        return Err(format!("角色文件不存在: {}", file_path));
    }

    let canon = resolved
        .canonicalize()
        .map_err(|e| format!("路径解析失败: {}", e))?;
    Ok(canon.to_string_lossy().into_owned())
}

/// Enumerate every script package directory on disk.
///
/// Mirrors the three layouts `ScriptManager::scan_scripts` accepts:
/// `scripts/character/<角色>/<剧本>/`, `scripts/standalone/<剧本>/` and the
/// legacy flat `scripts/<剧本>/`. The avatar lookup used to only walk one level,
/// so a script NPC living under the two-level `character/<角色>/<剧本>/` layout —
/// which is what every 羁绊冒险 uses — could never have its portrait found.
fn script_package_dirs() -> Vec<PathBuf> {
    let scripts_dir = game_data_dir().join("scripts");
    let mut out = Vec::new();

    let Ok(level1) = fs::read_dir(&scripts_dir) else {
        return out;
    };

    for entry in level1.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        match name.as_str() {
            // scripts/character/<角色>/<剧本>/ —— 需要再下钻两级
            "character" => {
                if let Ok(roles) = fs::read_dir(&path) {
                    for role in roles.flatten() {
                        if !role.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                            continue;
                        }
                        if let Ok(scripts) = fs::read_dir(role.path()) {
                            for s in scripts.flatten() {
                                if s.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                                    out.push(s.path());
                                }
                            }
                        }
                    }
                }
            }
            // scripts/standalone/<剧本>/ —— 再下钻一级
            "standalone" => {
                if let Ok(scripts) = fs::read_dir(&path) {
                    for s in scripts.flatten() {
                        if s.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                            out.push(s.path());
                        }
                    }
                }
            }
            // scripts/<剧本>/ —— 兼容布局，目录本身就是剧本包
            _ => out.push(path),
        }
    }

    out
}

#[tauri::command]
pub fn get_avatar_file(
    character_folder: String,
    emotion: String,
    clothes_name: String,
) -> Result<String, String> {
    if !is_safe_component(&character_folder) || !is_safe_component(&emotion) {
        return Err("非法角色或情绪路径".into());
    }
    if !clothes_name.is_empty()
        && clothes_name != "default"
        && !is_safe_component(&clothes_name)
    {
        return Err("非法服装路径".into());
    }

    let cache_key = format!("{character_folder}|{emotion}|{clothes_name}");
    if let Ok(cache) = avatar_path_cache().lock() {
        if let Some(p) = cache.get(&cache_key) {
            if Path::new(p).is_file() {
                return Ok(p.clone());
            }
        }
    }

    let allowed_extensions = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];

    let clothes_subdir = if clothes_name.is_empty() || clothes_name == "default" {
        String::new()
    } else {
        clothes_name.clone()
    };

    let try_dir = |base: &PathBuf| -> Option<PathBuf> {
        let search_dir = if clothes_subdir.is_empty() {
            base.clone()
        } else {
            base.join(&clothes_subdir)
        };
        if !search_dir.exists() {
            return None;
        }
        if let Some(found) = find_emotion_file(&search_dir, &emotion, &allowed_extensions) {
            return Some(found);
        }
        if emotion == "平静" {
            return find_emotion_file(&search_dir, "正常", &allowed_extensions);
        }
        None
    };

    let main_avatar = characters_dir().join(&character_folder).join("avatar");
    let mut found = if main_avatar.exists() {
        try_dir(&main_avatar)
    } else {
        None
    };

    if found.is_none() {
        for script_dir in script_package_dirs() {
            let npc_avatar = script_dir
                .join("characters")
                .join(&character_folder)
                .join("avatar");
            if npc_avatar.exists() {
                if let Some(p) = try_dir(&npc_avatar) {
                    found = Some(p);
                    break;
                }
            }
        }
    }

    let found = found.ok_or_else(|| {
        format!(
            "未找到角色头像: folder={}, emotion={}, clothes={}",
            character_folder, emotion, clothes_name
        )
    })?;
    let result = found
        .canonicalize()
        .map_err(|e| format!("路径解析失败: {}", e))?
        .to_string_lossy()
        .into_owned();
    if let Ok(mut cache) = avatar_path_cache().lock() {
        cache.insert(cache_key, result.clone());
    }
    Ok(result)
}

#[tauri::command]
pub async fn select_clothes(
    app: AppHandle,
    role_id: i32,
    clothes_name: String,
) -> Result<serde_json::Value, String> {
    let state = app.state::<AppState>();
    let service = state.ai_service.lock().await;

    let db = &state.db;

    // 持久化该角色的服装选择（按角色 ID 存储）
    if let Ok(store) = app.store(config::STORE_FILE) {
        let key = config::session::last_clothes_key(role_id);
        store.set(key, JsonValue::String(clothes_name.clone()));
        let _ = store.save();
    }

    // 在游戏内记录服装方便复原
    service
        .game_status
        .lock()
        .await
        .role_manager
        .set_character_clothes_override(role_id, clothes_name.clone());

    // 委托给 GameStatus 统一处理换装逻辑（去重 + 旁白生成）
    let switched = service
        .game_status
        .lock()
        .await
        .on_character_change_clothes(db, role_id, &clothes_name)
        .await
        .map_err(|e| format!("切换服装失败: {}", e))?;

    if switched {
        Ok(serde_json::json!({"success": true, "message": "衣服更换成功"}))
    } else {
        Ok(serde_json::json!({"success": true, "message": "当前衣服已经是选中状态"}))
    }
}

#[tauri::command]
pub async fn update_role_settings(
    app: AppHandle,
    role_id: i32,
    settings: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let state = app.state::<AppState>();
    let db = &state.db;

    let role = RoleRepo::get_role_by_id(db, role_id)
        .await
        .map_err(|e| format!("查询角色失败: {}", e))?
        .ok_or_else(|| format!("角色 {} 不存在", role_id))?;

    let folder = role
        .resource_folder
        .clone()
        .ok_or_else(|| format!("角色 {} 资源不存在", role_id))?;

    let base_path = match role.role_type {
        RoleType::Main => characters_dir().join(&folder),
        RoleType::Npc => {
            let script_key = role
                .script_key
                .clone()
                .ok_or_else(|| format!("角色 {} 缺少剧本关联", role_id))?;
            game_data_dir()
                .join("scripts")
                .join(&script_key)
                .join("characters")
                .join(&folder)
        }
        RoleType::System | RoleType::User => {
            return Err("系统角色不允许修改配置".to_string());
        }
    };

    if !base_path.exists() {
        return Err(format!("角色目录不存在: {:?}", base_path));
    }

    let mut validated: CharacterSettings =
        serde_json::from_value(settings).map_err(|e| format!("配置验证失败: {}", e))?;
    remove_legacy_voice_model_fields(&mut validated);

    let mut save_data =
        serde_json::to_value(&validated).map_err(|e| format!("配置规范化失败: {}", e))?;
    if let Some(obj) = save_data.as_object_mut() {
        obj.remove("character_id");
        obj.remove("resource_path");
        obj.remove("script_key");
        obj.remove("script_role_key");
    }

    let yaml_path = base_path.join("settings.yml");
    let yaml_str = serde_yaml::to_string(&save_data).map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&yaml_path, yaml_str).map_err(|e| format!("保存失败: {}", e))?;

    let runtime_updated = {
        let service = state.ai_service.lock().await;
        let mut gs = service.game_status.lock().await;
        gs.role_manager
            .update_role_voice_settings(role_id, &validated)
    };

    tracing::info!(
        "角色 {} 配置已保存到 {:?}, runtime_updated={}",
        role_id,
        yaml_path,
        runtime_updated,
    );
    Ok(serde_json::json!({
        "success": true,
        "message": "设置已保存",
        "runtime_updated": runtime_updated,
    }))
}

#[tauri::command]
pub fn open_characters_folder() -> Result<(), String> {
    let char_dir = characters_dir();
    if !char_dir.exists() {
        fs::create_dir_all(&char_dir).map_err(|e| format!("创建角色目录失败: {}", e))?;
    }

    let path_str = char_dir.to_string_lossy().into_owned();
    open_folder(&path_str)
}

// ========== 角色删除 ==========

/// 删除一个 main 类型角色（含关联存档、记忆、对话历史、物理资源目录）。
///
/// 校验链：
/// 1. 角色存在
/// 2. 不在系统保护列表（id ∈ {0, 1, 2}）
/// 3. role_type == Main（NPC 由剧本管，system/user 不允许删）
/// 4. 不在场（game_status.present_role_ids / current_role_id / main_role_id / onstage_role_ids 任一命中即拒绝）
///
/// 删除顺序：先物理资源（可选，用户确认），再 DB 级联（事务）。若失败：
/// - 物理失败：整体放弃，DB 不动
/// - DB 失败：物理已删但下次 rescan 会重新入库（可恢复）
#[tauri::command]
pub async fn delete_character(
    app: AppHandle,
    role_id: i32,
    delete_resource_folder: bool,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let db = &state.db;

    // ---- 1. 角色存在性 ----
    let role = RoleRepo::get_role_by_id(db, role_id)
        .await
        .map_err(|e| format!("查询角色失败: {}", e))?
        .ok_or_else(|| format!("角色 {} 不存在", role_id))?;

    // ---- 2. 系统保护 ----
    if RoleRepo::is_system_protected_role(role_id) {
        return Err("无法删除".to_string());
    }

    // ---- 3. 角色类型校验 ----
    if role.role_type != RoleType::Main {
        return Err("只能删除 main 类型的主角色".to_string());
    }

    // ---- 4. 在场校验（后端权威） ----
    {
        let service = state.ai_service.lock().await;
        let gs = service.game_status.lock().await;
        let onstage = gs.present_role_ids.contains(&role_id)
            || gs.current_role_id == Some(role_id)
            || gs.main_role_id == Some(role_id)
            || gs.onstage_role_ids.contains(&role_id);
        if onstage {
            return Err(format!("角色「{}」正在对话中，无法删除", role.name));
        }
    }

    // ---- 5. 先删物理资源（可选） ----
    if delete_resource_folder {
        if let Some(folder) = &role.resource_folder {
            let base = characters_dir();
            let target = base.join(folder);
            // 路径穿越防护
            crate::utils::path::validate_path_in_base(&target, &base)?;
            if target.exists() {
                if let Err(e) = fs::remove_dir_all(&target) {
                    return Err(format!("删除资源目录失败: {}", e));
                }
            }
        }
    }

    // ---- 6. DB 级联删除（事务） ----
    let deleted = RoleRepo::delete_main_role(db, role_id)
        .await
        .map_err(|e| format!("删除角色失败: {}", e))?;
    if !deleted {
        return Err(format!("角色 {} 不存在或已被删除", role_id));
    }

    // ---- 7. 广播角色列表更新事件 ----
    let _ = app.emit("role:list-updated", ());

    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmotionUpload {
    pub name: String,
    pub file_name: String,
    pub data: Vec<u8>,
}

fn file_ext(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    if lower.ends_with(".png") {
        "png"
    } else if lower.ends_with(".webp") {
        "webp"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "jpg"
    } else if lower.ends_with(".gif") {
        "gif"
    } else {
        "png"
    }
}

#[tauri::command]
pub async fn create_character(
    app: AppHandle,
    resource_folder: String,
    settings_json: String,
    avatar_file_name: String,
    avatar_data: Vec<u8>,
    emotions: Vec<EmotionUpload>,
) -> Result<serde_json::Value, String> {
    if !is_safe_component(&resource_folder) {
        return Err("非法角色目录名".into());
    }
    let base = characters_dir();
    let folder = base.join(&resource_folder);
    if folder.exists() {
        return Err(format!("角色目录已存在: {}", resource_folder));
    }
    let avatar_dir = folder.join("avatar");
    fs::create_dir_all(&avatar_dir).map_err(|e| format!("创建角色目录失败: {e}"))?;

    let mut settings_val: serde_json::Value =
        serde_json::from_str(&settings_json).map_err(|e| format!("设置 JSON 无效: {e}"))?;
    if let Some(obj) = settings_val.as_object_mut() {
        if !obj.contains_key("offset_y") {
            if let Some(offset) = obj.get("offset").cloned() {
                obj.insert("offset_y".into(), offset);
            }
        }
        obj.remove("offset");
        obj.insert(
            "character_folder".into(),
            serde_json::Value::String(resource_folder.clone()),
        );
    }

    let mut settings: CharacterSettings =
        serde_json::from_value(settings_val).map_err(|e| format!("设置校验失败: {e}"))?;
    remove_legacy_voice_model_fields(&mut settings);
    settings.character_folder = resource_folder.clone();

    let mut save_data =
        serde_json::to_value(&settings).map_err(|e| format!("配置规范化失败: {e}"))?;
    if let Some(obj) = save_data.as_object_mut() {
        obj.remove("character_id");
        obj.remove("resource_path");
        obj.remove("script_key");
        obj.remove("script_role_key");
    }
    let yaml = serde_yaml::to_string(&save_data).map_err(|e| format!("序列化失败: {e}"))?;
    fs::write(folder.join("settings.yml"), yaml).map_err(|e| format!("写入 settings.yml 失败: {e}"))?;

    let avatar_path = avatar_dir.join(format!("头像.{}", file_ext(&avatar_file_name)));
    fs::write(&avatar_path, avatar_data).map_err(|e| format!("写入头像失败: {e}"))?;

    for emo in emotions {
        if !is_safe_component(&emo.name) {
            let _ = fs::remove_dir_all(&folder);
            return Err(format!("非法表情名: {}", emo.name));
        }
        let path = avatar_dir.join(format!("{}.{}", emo.name, file_ext(&emo.file_name)));
        if let Err(e) = fs::write(&path, emo.data) {
            let _ = fs::remove_dir_all(&folder);
            return Err(format!("写入表情 {} 失败: {e}", emo.name));
        }
    }

    let data_dir = data_dir();
    let state = app.state::<AppState>();
    crate::init::role_sync::sync_roles_from_folder(&state.db, &data_dir)
        .await
        .map_err(|e| {
            let _ = fs::remove_dir_all(&folder);
            format!("同步角色失败: {e}")
        })?;

    let role = RoleRepo::get_all_main_roles(&state.db)
        .await
        .map_err(|e| format!("查询新角色失败: {e}"))?
        .into_iter()
        .find(|r| r.resource_folder.as_deref() == Some(resource_folder.as_str()))
        .ok_or_else(|| "角色已写入但未能入库".to_string())?;

    let _ = app.emit("role:list-updated", ());
    Ok(serde_json::json!({
        "success": true,
        "data": {
            "character_id": role.id,
            "title": role.name,
            "resource_folder": resource_folder,
        }
    }))
}

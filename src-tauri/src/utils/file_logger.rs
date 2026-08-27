//! 文件日志模块
//!
//! 将 tracing 日志写入 `data/log/app/{启动时间}.log` 文件。
//! 支持通过全局开关控制是否写入，以及自动清理 N 天前的旧日志。

use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};

use chrono::Local;
use tracing_subscriber::fmt::MakeWriter;

/// 全局日志开关（由设置控制）
pub static LOG_ENABLED: AtomicBool = AtomicBool::new(true);

/// 日志文件路径（setup 阶段初始化）
static LOG_FILE_PATH: OnceLock<std::path::PathBuf> = OnceLock::new();
/// 长驻文件句柄，避免每条日志都重新 open
static LOG_FILE: OnceLock<Mutex<Option<File>>> = OnceLock::new();

/// 日志目录（setup 阶段初始化，供清理使用）
static LOG_DIR: OnceLock<std::path::PathBuf> = OnceLock::new();

/// 初始化日志系统（在 app setup 阶段调用）
///
/// 创建日志目录并记录日志文件路径。`enable` 为 `false` 时仍会初始化目录结构
/// 以便后续清理，但不会创建实际日志文件。
pub fn init_logging(data_dir: &Path, enable: bool) {
    let log_dir = data_dir.join("log").join("app");
    let _ = fs::create_dir_all(&log_dir);

    let timestamp = Local::now().format("%Y%m%d_%H%M%S");
    let log_file = log_dir.join(format!("{timestamp}.log"));

    LOG_FILE_PATH.set(log_file.clone()).ok();
    LOG_DIR.set(log_dir).ok();
    LOG_ENABLED.store(enable, Ordering::Release);
    let handle = if enable {
        OpenOptions::new().create(true).append(true).open(&log_file).ok()
    } else {
        None
    };
    LOG_FILE.set(Mutex::new(handle)).ok();
}

/// tracing-subscriber 的 MakeWriter 实现
pub struct LogFileWriter;

impl<'a> MakeWriter<'a> for LogFileWriter {
    type Writer = LogFile;

    fn make_writer(&'a self) -> Self::Writer {
        LogFile
    }
}

/// 单个日志文件句柄（写入全局长驻文件）
pub struct LogFile;

impl Write for LogFile {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        if !LOG_ENABLED.load(Ordering::Acquire) {
            return Ok(buf.len());
        }
        if let Some(slot) = LOG_FILE.get() {
            if let Ok(mut guard) = slot.lock() {
                if let Some(f) = guard.as_mut() {
                    return f.write(buf);
                }
            }
        }
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        if let Some(slot) = LOG_FILE.get() {
            if let Ok(mut guard) = slot.lock() {
                if let Some(f) = guard.as_mut() {
                    return f.flush();
                }
            }
        }
        Ok(())
    }
}

/// 删除日志目录中超过 `retention_days` 天的旧 `.log` 文件
pub fn cleanup_old_logs(retention_days: u32) {
    let Some(log_dir) = LOG_DIR.get() else { return };
    let cutoff = Local::now() - chrono::Duration::days(retention_days as i64);

    if let Ok(entries) = fs::read_dir(log_dir) {
        let mut deleted = 0u32;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("log") {
                continue;
            }
            if let Ok(metadata) = path.metadata() {
                if let Ok(modified) = metadata.modified() {
                    let modified: chrono::DateTime<Local> = modified.into();
                    if modified < cutoff {
                        if fs::remove_file(&path).is_ok() {
                            deleted += 1;
                        }
                    }
                }
            }
        }
        if deleted > 0 {
            tracing::info!("已清理 {} 个过期日志文件（超过 {} 天）", deleted, retention_days);
        }
    }
}

#include "../include/SessionLogger.h"
#include <iostream>
#include <stdexcept>
#include <ctime>

// ── Constructor ────────────────────────────────────────────────────
SessionLogger::SessionLogger(const std::string& path)
    : filepath(path) {
    logFile.open(path, std::ios::app);   // Append mode — never overwrites
    if (!logFile.is_open())
        throw std::runtime_error("SessionLogger: cannot open \"" + path + "\"");

    logFile << "\n[" << currentTimestamp() << "] === SESSION STARTED ===\n";
    logFile.flush();
}

// ── Destructor ─────────────────────────────────────────────────────
SessionLogger::~SessionLogger() {
    if (logFile.is_open()) {
        logFile << "[" << currentTimestamp() << "] === SESSION ENDED ===\n";
        logFile.close();
    }
}

// ── Log ────────────────────────────────────────────────────────────
void SessionLogger::log(const std::string& message) {
    if (!logFile.is_open()) return;     // Silently skip if file closed
    logFile << "[" << currentTimestamp() << "] " << message << "\n";
    logFile.flush();                    // Ensure write even if app crashes
}

// ── Timestamp helper ───────────────────────────────────────────────
std::string SessionLogger::currentTimestamp() {
    std::time_t t = std::time(nullptr);
    char buf[32];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S",
                  std::localtime(&t));
    return std::string(buf);
}
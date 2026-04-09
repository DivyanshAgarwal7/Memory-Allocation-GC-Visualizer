#pragma once
#include <fstream>
#include <string>

/**
 * SessionLogger
 * -------------
 * Appends timestamped operation records to a log file.
 * Uses RAII — file is opened in constructor, closed in destructor.
 * All methods are no-throw (errors go to stderr, never crash sim).
 */
class SessionLogger {
public:
    /**
     * Opens `filepath` in append mode.
     * Throws std::runtime_error if the file cannot be opened.
     */
    explicit SessionLogger(const std::string& filepath);
    ~SessionLogger();

    // Disable copy; allow move
    SessionLogger(const SessionLogger&)            = delete;
    SessionLogger& operator=(const SessionLogger&) = delete;

    /**
     * Write a single log entry with a timestamp prefix.
     * Thread-safe: single-threaded sim, so no mutex needed here.
     */
    void log(const std::string& message);

    bool isOpen() const { return logFile.is_open(); }

private:
    std::ofstream logFile;
    std::string   filepath;

    static std::string currentTimestamp();
};
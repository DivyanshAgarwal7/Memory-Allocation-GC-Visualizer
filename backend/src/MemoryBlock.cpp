#include "../include/MemoryBlock.h"
#include <sstream>
#include <vector>
#include <stdexcept>

// ── Serialize ──────────────────────────────────────────────────────
std::string MemoryBlock::serialize() const {
    std::ostringstream oss;
    oss << startAddress << ","
        << size         << ","
        << (isFree  ? 1 : 0) << ","
        << (marked  ? 1 : 0) << ","
        << objectId;
    return oss.str();
}

// ── Deserialize ────────────────────────────────────────────────────
MemoryBlock MemoryBlock::deserialize(const std::string& line) {
    std::istringstream ss(line);
    std::string token;
    std::vector<std::string> tokens;

    while (std::getline(ss, token, ','))
        tokens.push_back(token);

    if (tokens.size() != 5)
        throw std::runtime_error(
            "Malformed block entry (expected 5 fields): \"" + line + "\"");

    MemoryBlock b(
        std::stoul(tokens[0]),   // startAddress
        std::stoul(tokens[1]),   // size
        std::stoi (tokens[4])    // objectId
    );
    b.isFree = (tokens[2] == "1");
    b.marked = (tokens[3] == "1");
    return b;
}
#pragma once
#include <string>
#include <vector>
#include <stdexcept>

/**
 * MemoryBlock
 * -----------
 * Represents one contiguous segment of the virtual heap.
 * Tracks address, size, allocation state, GC mark flag,
 * and a numeric object ID for identification.
 */
struct MemoryBlock {
    size_t startAddress;   // Byte offset from heap start
    size_t size;           // Size of this block in bytes
    bool   isFree;         // true = available for allocation
    bool   marked;         // true = reachable during GC mark phase
    int    objectId;       // -1 = free block, else unique object ID

    // ── Constructors ────────────────────────────────────────────────
    MemoryBlock(size_t addr, size_t sz, int id = -1)
        : startAddress(addr), size(sz),
          isFree(true), marked(false), objectId(id) {}

    // ── Serialization (for file save/load) ──────────────────────────
    // Format: startAddress,size,isFree,marked,objectId
    std::string serialize() const;

    // Throws std::runtime_error on malformed input
    static MemoryBlock deserialize(const std::string& line);
};
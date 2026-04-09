#include "../include/VirtualHeap.h"
#include <fstream>
#include <sstream>
#include <iostream>
#include <iomanip>
#include <algorithm>
#include <stdexcept>

// ── Constructor ────────────────────────────────────────────────────
VirtualHeap::VirtualHeap(size_t size,
                         std::shared_ptr<AllocationStrategy> strat)
    : totalSize(size), strategy(std::move(strat)) {
    if (size == 0)
        throw std::invalid_argument("Heap size must be > 0.");
    blocks.emplace_back(0, size);  // One big free block to start
}

// ── Private: Coalesce adjacent free blocks ─────────────────────────
void VirtualHeap::coalesce() {
    auto it = blocks.begin();
    while (it != blocks.end()) {
        auto next = std::next(it);
        if (next != blocks.end() && it->isFree && next->isFree) {
            // Merge next into current
            it->size += next->size;
            blocks.erase(next);
            // Don't advance — check if the new next is also free
        } else {
            ++it;
        }
    }
}

// ── Allocate ───────────────────────────────────────────────────────
int VirtualHeap::allocate(size_t request) {
    if (request == 0)
        throw std::invalid_argument("Cannot allocate 0 bytes.");
    if (request > totalSize)
        throw std::invalid_argument(
            "Request (" + std::to_string(request) +
            ") exceeds total heap size (" +
            std::to_string(totalSize) + ").");

    auto it = strategy->findBlock(blocks, request);
    if (it == blocks.end())
        return -1;  // Out of memory

    size_t remaining = it->size - request;
    it->isFree   = false;
    it->size     = request;
    it->objectId = nextObjectId++;

    // Split: if leftover space exists, create a new free block
    if (remaining > 0) {
        blocks.insert(std::next(it),
            MemoryBlock(it->startAddress + request, remaining));
    }
    return it->objectId;
}

// ── Free ───────────────────────────────────────────────────────────
bool VirtualHeap::freeObject(int id) {
    for (auto& b : blocks) {
        if (!b.isFree && b.objectId == id) {
            b.isFree   = true;
            b.marked   = false;
            b.objectId = -1;
            coalesce();
            return true;
        }
    }
    return false;
}

// ── GC: Mark Phase ─────────────────────────────────────────────────
void VirtualHeap::markObjects(const std::vector<int>& reachableIds) {
    // First, unmark everything
    for (auto& b : blocks) b.marked = false;

    // Then mark only the reachable objects
    for (auto& b : blocks) {
        if (!b.isFree) {
            b.marked = std::find(
                reachableIds.begin(),
                reachableIds.end(),
                b.objectId
            ) != reachableIds.end();
        }
    }
}

// ── GC: Sweep Phase ────────────────────────────────────────────────
int VirtualHeap::sweep() {
    int collected = 0;
    for (auto& b : blocks) {
        if (!b.isFree && !b.marked) {
            b.isFree   = true;
            b.objectId = -1;
            ++collected;
        }
    }
    if (collected > 0) coalesce();
    return collected;
}

// ── Analytics ──────────────────────────────────────────────────────
size_t VirtualHeap::usedMemory() const {
    size_t used = 0;
    for (const auto& b : blocks)
        if (!b.isFree) used += b.size;
    return used;
}

size_t VirtualHeap::freeMemory() const {
    return totalSize - usedMemory();
}

double VirtualHeap::fragmentationRatio() const {
    size_t totalFree = freeMemory();
    if (totalFree == 0) return 0.0;

    size_t largestFree = 0;
    for (const auto& b : blocks)
        if (b.isFree && b.size > largestFree)
            largestFree = b.size;

    // 0 = no fragmentation, 1 = fully fragmented
    return 1.0 - (static_cast<double>(largestFree) / totalFree);
}

// ── Display ────────────────────────────────────────────────────────
void VirtualHeap::displayStatus(std::ostream& out) const {
    const int BAR_WIDTH = 60;

    out << "\n┌─ Heap Status ─────────────────────────────────────────────┐\n";
    out << "│  Strategy : " << strategy->name() << "\n";
    out << "│  Total    : " << totalSize << " bytes"
        << "   Used: "      << usedMemory()
        << "   Free: "      << freeMemory()
        << "   Blocks: "    << blockCount() << "\n";
    out << "│  Fragmentation: "
        << std::fixed << std::setprecision(1)
        << (fragmentationRatio() * 100) << "%\n";
    out << "│\n│  Visual Map  [.]=Free  [#]=Used  [M]=Marked\n│  ";

    // Scale blocks to BAR_WIDTH characters
    for (const auto& b : blocks) {
        int width = std::max(1,
            static_cast<int>((static_cast<double>(b.size) / totalSize) * BAR_WIDTH));
        char fill = b.isFree ? '.' : (b.marked ? 'M' : '#');
        out << std::string(width, fill);
    }
    out << "\n│\n│  Block Detail:\n";

    int idx = 1;
    for (const auto& b : blocks) {
        out << "│   " << std::setw(3) << idx++
            << "  " << (b.isFree ? "FREE" : "USED")
            << "  addr=" << std::setw(6) << b.startAddress
            << "  size=" << std::setw(6) << b.size;
        if (!b.isFree) {
            out << "  obj#" << std::setw(3) << b.objectId;
            if (b.marked) out << " [MARKED]";
        }
        out << "\n";
    }
    out << "└───────────────────────────────────────────────────────────┘\n";
}

// ── Save State ─────────────────────────────────────────────────────
void VirtualHeap::saveState(const std::string& filepath) const {
    std::ofstream f(filepath);
    if (!f.is_open())
        throw std::runtime_error("Cannot write to file: " + filepath);

    f << "# Memory Simulator — Heap Snapshot\n";
    f << "TOTAL_SIZE=" << totalSize      << "\n";
    f << "STRATEGY="   << strategy->name() << "\n";
    f << "NEXT_ID="    << nextObjectId   << "\n";
    f << "# startAddress,size,isFree,marked,objectId\n";

    for (const auto& b : blocks)
        f << b.serialize() << "\n";

    std::cout << "  Heap state saved → " << filepath << "\n";
}

// ── Load State ─────────────────────────────────────────────────────
void VirtualHeap::loadState(const std::string& filepath) {
    std::ifstream f(filepath);
    if (!f.is_open())
        throw std::runtime_error("Cannot open file: " + filepath);

    blocks.clear();
    std::string line;
    bool readingBlocks = false;

    while (std::getline(f, line)) {
        if (line.empty() || line[0] == '#') continue;

        if (line.rfind("TOTAL_SIZE=", 0) == 0) {
            totalSize = std::stoul(line.substr(11));
        } else if (line.rfind("NEXT_ID=", 0) == 0) {
            nextObjectId = std::stoi(line.substr(8));
        } else if (line.rfind("STRATEGY=", 0) == 0) {
            readingBlocks = true;   // Next non-comment lines are block data
        } else if (readingBlocks) {
            blocks.push_back(MemoryBlock::deserialize(line));
        }
    }

    std::cout << "  Heap state loaded ← " << filepath << "\n";
}

// ── Change Strategy ────────────────────────────────────────────────
void VirtualHeap::changeStrategy(
        std::shared_ptr<AllocationStrategy> newStrategy) {
    strategy = std::move(newStrategy);
    // Reset heap to a clean single free block
    blocks.clear();
    blocks.emplace_back(0, totalSize);
    nextObjectId = 1;
}
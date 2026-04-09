#include "../include/AllocationStrategy.h"
#include <climits>

// ── First Fit ──────────────────────────────────────────────────────
std::list<MemoryBlock>::iterator
FirstFit::findBlock(std::list<MemoryBlock>& blocks, size_t req) {
    for (auto it = blocks.begin(); it != blocks.end(); ++it)
        if (it->isFree && it->size >= req)
            return it;          // Return immediately on first match
    return blocks.end();
}

// ── Best Fit ───────────────────────────────────────────────────────
std::list<MemoryBlock>::iterator
BestFit::findBlock(std::list<MemoryBlock>& blocks, size_t req) {
    auto   best     = blocks.end();
    size_t bestSize = SIZE_MAX;

    for (auto it = blocks.begin(); it != blocks.end(); ++it) {
        if (it->isFree && it->size >= req && it->size < bestSize) {
            best     = it;
            bestSize = it->size;
        }
    }
    return best;
}

// ── Worst Fit ──────────────────────────────────────────────────────
std::list<MemoryBlock>::iterator
WorstFit::findBlock(std::list<MemoryBlock>& blocks, size_t req) {
    auto   worst     = blocks.end();
    size_t worstSize = 0;

    for (auto it = blocks.begin(); it != blocks.end(); ++it) {
        if (it->isFree && it->size >= req && it->size > worstSize) {
            worst     = it;
            worstSize = it->size;
        }
    }
    return worst;
}
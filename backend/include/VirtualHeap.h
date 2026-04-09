#pragma once
#include <list>
#include <vector>
#include <string>
#include <memory>
#include <ostream>
#include "MemoryBlock.h"
#include "AllocationStrategy.h"

/**
 * VirtualHeap
 * -----------
 * Core simulation engine. Manages a linked list of MemoryBlocks,
 * delegates allocation strategy via polymorphism, implements
 * Mark & Sweep GC, coalescing, analytics, and file persistence.
 */
class VirtualHeap {
public:
    // ── Construction ────────────────────────────────────────────────
    VirtualHeap(size_t totalSize,
                std::shared_ptr<AllocationStrategy> strategy);

    // ── Allocation / Deallocation ────────────────────────────────────
    /**
     * Allocate `request` bytes.
     * Returns the new object's ID (>= 1) on success, -1 if OOM.
     * Throws std::invalid_argument for bad sizes.
     */
    int  allocate(size_t request);

    /**
     * Free the block with the given object ID.
     * Automatically coalesces adjacent free blocks.
     * Returns true on success, false if ID not found.
     */
    bool freeObject(int objectId);

    // ── Garbage Collection ───────────────────────────────────────────
    /**
     * MARK phase: iterate all blocks; mark those whose objectId
     * appears in `reachableIds`. Unmarks everything else first.
     */
    void markObjects(const std::vector<int>& reachableIds);

    /**
     * SWEEP phase: free every used-but-unmarked block.
     * Calls coalesce() afterward.
     * Returns the number of objects collected.
     */
    int sweep();

    // ── Analytics ────────────────────────────────────────────────────
    size_t usedMemory()        const;
    size_t freeMemory()        const;
    size_t getTotalSize()      const { return totalSize; }
    size_t blockCount()        const { return blocks.size(); }
    std::string strategyName() const { return strategy->name(); }

    /**
     * External fragmentation ratio [0.0 – 1.0].
     * 0 = perfectly contiguous free space.
     * 1 = free space is maximally fragmented.
     */
    double fragmentationRatio() const;

    // ── Display ──────────────────────────────────────────────────────
    void displayStatus(std::ostream& out = std::cout) const;

    // ── File Persistence ─────────────────────────────────────────────
    void saveState(const std::string& filepath) const;
    void loadState(const std::string& filepath);

    // ── Strategy hot-swap (resets heap) ─────────────────────────────
    void changeStrategy(std::shared_ptr<AllocationStrategy> newStrategy);

    // ── Read-only access to blocks (for frontend / testing) ─────────
    const std::list<MemoryBlock>& getBlocks() const { return blocks; }

private:
    size_t totalSize;
    std::list<MemoryBlock> blocks;
    std::shared_ptr<AllocationStrategy> strategy;
    int nextObjectId = 1;

    // Merges adjacent free blocks to reduce external fragmentation
    void coalesce();
};
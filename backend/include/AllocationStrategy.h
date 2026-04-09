#pragma once
#include <list>
#include <string>
#include "MemoryBlock.h"

/**
 * AllocationStrategy  (Abstract Base Class)
 * ------------------------------------------
 * Defines the interface every allocation policy must satisfy.
 * Demonstrates the Strategy Pattern + Polymorphism.
 */
class AllocationStrategy {
public:
    virtual ~AllocationStrategy() = default;

    /**
     * Scan `blocks` and return an iterator to the best
     * candidate block for `requestedSize` bytes.
     * Returns blocks.end() if no suitable block exists.
     */
    virtual std::list<MemoryBlock>::iterator
        findBlock(std::list<MemoryBlock>& blocks,
                  size_t requestedSize) = 0;

    virtual std::string name() const = 0;
};

// ── Concrete Strategy: First Fit ────────────────────────────────────
/**
 * Scans from the beginning and returns the FIRST block
 * that is large enough. Fast but can cause early fragmentation.
 */
class FirstFit : public AllocationStrategy {
public:
    std::list<MemoryBlock>::iterator
        findBlock(std::list<MemoryBlock>& blocks,
                  size_t requestedSize) override;
    std::string name() const override { return "First Fit"; }
};

// ── Concrete Strategy: Best Fit ─────────────────────────────────────
/**
 * Scans the entire list and returns the SMALLEST block
 * that still fits. Minimises wasted space per allocation
 * but can create many tiny unusable fragments.
 */
class BestFit : public AllocationStrategy {
public:
    std::list<MemoryBlock>::iterator
        findBlock(std::list<MemoryBlock>& blocks,
                  size_t requestedSize) override;
    std::string name() const override { return "Best Fit"; }
};

// ── Concrete Strategy: Worst Fit ────────────────────────────────────
/**
 * Returns the LARGEST free block available.
 * Leaves bigger leftovers, reducing tiny-fragment buildup.
 */
class WorstFit : public AllocationStrategy {
public:
    std::list<MemoryBlock>::iterator
        findBlock(std::list<MemoryBlock>& blocks,
                  size_t requestedSize) override;
    std::string name() const override { return "Worst Fit"; }
};
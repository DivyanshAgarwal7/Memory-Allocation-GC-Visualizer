/**
 * main.cpp — Memory Allocation & GC Simulator
 * Entry point: interactive CLI menu
 */
#include <iostream>
#include <sstream>
#include <vector>
#include <memory>
#include <stdexcept>
#include <algorithm>
#include <iomanip>

#include "../include/VirtualHeap.h"
#include "../include/AllocationStrategy.h"
#include "../include/SessionLogger.h"

// ── ANSI color codes (degrade gracefully on Windows) ───────────────
#ifdef _WIN32
  #define CLR_RESET  ""
  #define CLR_GREEN  ""
  #define CLR_RED    ""
  #define CLR_YELLOW ""
  #define CLR_CYAN   ""
  #define CLR_BOLD   ""
#else
  #define CLR_RESET  "\033[0m"
  #define CLR_GREEN  "\033[32m"
  #define CLR_RED    "\033[31m"
  #define CLR_YELLOW "\033[33m"
  #define CLR_CYAN   "\033[36m"
  #define CLR_BOLD   "\033[1m"
#endif

// ── Portable directory creation (replaces std::filesystem) ─────────
static void createDirectories() {
#ifdef _WIN32
    system("mkdir snapshots 2>nul");
    system("mkdir logs 2>nul");
#else
    system("mkdir -p snapshots");
    system("mkdir -p logs");
#endif
}

// ── Helpers ────────────────────────────────────────────────────────
static void printBanner() {
    std::cout << CLR_CYAN << CLR_BOLD
        << "╔══════════════════════════════════════════════════╗\n"
        << "║   Memory Allocation & GC Simulator  v2.0        ║\n"
        << "║   OOP C++17  |  Mark-Sweep GC  |  File I/O      ║\n"
        << "╚══════════════════════════════════════════════════╝\n"
        << CLR_RESET;
}

static void printMenu() {
    std::cout << CLR_BOLD
        << "\n┌─ Commands ───────────────────────────────────────┐\n"
        << "│  1. Allocate memory                              │\n"
        << "│  2. Free object (by ID)                          │\n"
        << "│  3. Run Garbage Collection (Mark & Sweep)        │\n"
        << "│  4. Display heap status                          │\n"
        << "│  5. Save heap snapshot                           │\n"
        << "│  6. Load heap snapshot                           │\n"
        << "│  7. Change allocation strategy (resets heap)     │\n"
        << "│  8. Show analytics summary                       │\n"
        << "│  0. Exit                                         │\n"
        << "└──────────────────────────────────────────────────┘\n"
        << CLR_RESET
        << "  Choice: ";
}

static std::shared_ptr<AllocationStrategy> pickStrategy() {
    std::cout << "\n  Allocation strategies:\n"
              << "    1. First Fit  — fast, scans from start\n"
              << "    2. Best Fit   — smallest suitable block\n"
              << "    3. Worst Fit  — largest available block\n"
              << "  Choose [1-3]: ";
    int c = 1;
    std::cin >> c; std::cin.ignore();
    switch (c) {
        case 2:  return std::make_shared<BestFit>();
        case 3:  return std::make_shared<WorstFit>();
        default: return std::make_shared<FirstFit>();
    }
}

static size_t promptHeapSize() {
    std::cout << "  Heap size in bytes [8 - 1,000,000]: ";
    size_t s = 200;
    std::cin >> s; std::cin.ignore();
    if (s < 8 || s > 1000000)
        throw std::invalid_argument(
            "Heap size must be between 8 and 1,000,000 bytes.");
    return s;
}

// ── Main ───────────────────────────────────────────────────────────
int main() {
    printBanner();

    // Ensure output directories exist
    createDirectories();

    // ── Initialise heap ───────────────────────────────────────────
    size_t heapSize = 0;
    try {
        heapSize = promptHeapSize();
    } catch (const std::exception& e) {
        std::cerr << CLR_RED << "  Error: " << e.what() << CLR_RESET << "\n";
        return 1;
    }

    auto strategy = pickStrategy();
    auto heap = std::make_unique<VirtualHeap>(heapSize, strategy);

    // ── Session logger ────────────────────────────────────────────
    std::unique_ptr<SessionLogger> logger;
    try {
        logger = std::make_unique<SessionLogger>("logs/session.log");
        logger->log("INIT heap=" + std::to_string(heapSize)
                    + " strategy=" + heap->strategyName());
    } catch (const std::exception& e) {
        std::cerr << CLR_YELLOW
                  << "  Warning: Logging disabled — " << e.what()
                  << CLR_RESET << "\n";
    }

    // Track IDs returned from allocate() to help GC demo
    std::vector<int> liveIds;

    heap->displayStatus();

    // ── Menu loop ─────────────────────────────────────────────────
    int choice = -1;
    while (choice != 0) {
        printMenu();

        if (!(std::cin >> choice)) {
            std::cin.clear();
            std::cin.ignore(1000, '\n');
            continue;
        }
        std::cin.ignore();

        try {

            // ── 1. Allocate ─────────────────────────────────────
            if (choice == 1) {
                std::cout << "  Bytes to allocate: ";
                size_t req; std::cin >> req; std::cin.ignore();

                int id = heap->allocate(req);
                if (id == -1) {
                    std::cout << CLR_RED
                              << "  X Out of memory — cannot allocate "
                              << req << " bytes.\n" << CLR_RESET;
                    if (logger) logger->log("ALLOC_FAIL size=" + std::to_string(req));
                } else {
                    liveIds.push_back(id);
                    std::cout << CLR_GREEN
                              << "  + Allocated " << req
                              << " bytes -> Object #" << id << "\n"
                              << CLR_RESET;
                    if (logger)
                        logger->log("ALLOC size=" + std::to_string(req)
                                    + " id=" + std::to_string(id));
                    heap->displayStatus();
                }
            }

            // ── 2. Free ─────────────────────────────────────────
            else if (choice == 2) {
                if (liveIds.empty()) {
                    std::cout << CLR_YELLOW
                              << "  No live objects to free.\n" << CLR_RESET;
                    continue;
                }
                std::cout << "  Live object IDs: ";
                for (int id : liveIds) std::cout << "#" << id << " ";
                std::cout << "\n  Object ID to free: ";
                int id; std::cin >> id; std::cin.ignore();

                if (heap->freeObject(id)) {
                    liveIds.erase(
                        std::remove(liveIds.begin(), liveIds.end(), id),
                        liveIds.end());
                    std::cout << CLR_GREEN
                              << "  + Freed object #" << id << "\n"
                              << CLR_RESET;
                    if (logger) logger->log("FREE id=" + std::to_string(id));
                    heap->displayStatus();
                } else {
                    std::cout << CLR_RED
                              << "  X Object #" << id << " not found.\n"
                              << CLR_RESET;
                }
            }

            // ── 3. Garbage Collection ───────────────────────────
            else if (choice == 3) {
                std::cout << "  Live object IDs: ";
                for (int id : liveIds) std::cout << "#" << id << " ";
                std::cout << "\n";

                std::cout << "  Enter REACHABLE (root) IDs"
                             " (space-separated, Enter for none):\n  > ";
                std::string line; std::getline(std::cin, line);

                std::vector<int> roots;
                std::istringstream iss(line);
                int rid;
                while (iss >> rid) roots.push_back(rid);

                // Mark phase
                heap->markObjects(roots);
                std::cout << CLR_CYAN
                          << "  [Mark] " << roots.size()
                          << " object(s) marked as reachable.\n"
                          << CLR_RESET;
                heap->displayStatus();

                // Sweep phase
                int collected = heap->sweep();
                std::cout << CLR_GREEN
                          << "  [Sweep] Collected " << collected
                          << " unreachable object(s).\n" << CLR_RESET;

                // Keep liveIds in sync
                liveIds = roots;

                if (logger)
                    logger->log("GC roots=" + std::to_string(roots.size())
                                + " collected=" + std::to_string(collected));
                heap->displayStatus();
            }

            // ── 4. Display ──────────────────────────────────────
            else if (choice == 4) {
                heap->displayStatus();
            }

            // ── 5. Save ─────────────────────────────────────────
            else if (choice == 5) {
                std::cout << "  Filename (in snapshots/, e.g. heap1): ";
                std::string fname; std::getline(std::cin, fname);
                if (fname.empty()) fname = "heap";
                std::string path = "snapshots/" + fname + ".snapshot";
                heap->saveState(path);
                if (logger) logger->log("SAVE path=" + path);
            }

            // ── 6. Load ─────────────────────────────────────────
            else if (choice == 6) {
                std::cout << "  Filename (in snapshots/, e.g. heap1): ";
                std::string fname; std::getline(std::cin, fname);
                if (fname.empty()) {
                    std::cout << CLR_YELLOW
                              << "  Filename cannot be empty.\n" << CLR_RESET;
                    continue;
                }
                std::string path = "snapshots/" + fname + ".snapshot";
                heap->loadState(path);
                liveIds.clear();   // Reset after load; user must re-enter if needed
                if (logger) logger->log("LOAD path=" + path);
                heap->displayStatus();
            }

            // ── 7. Change Strategy ──────────────────────────────
            else if (choice == 7) {
                auto newStrat = pickStrategy();
                heap->changeStrategy(newStrat);
                liveIds.clear();
                std::cout << CLR_YELLOW
                          << "  Strategy changed. Heap reset.\n" << CLR_RESET;
                if (logger)
                    logger->log("STRATEGY_CHANGE to=" + heap->strategyName());
                heap->displayStatus();
            }

            // ── 8. Analytics ────────────────────────────────────
            else if (choice == 8) {
                std::cout << "\n  ╔═ Analytics ══════════════════════════════╗\n";
                std::cout << "  ║  Total Size   : " << heap->getTotalSize()   << " bytes\n";
                std::cout << "  ║  Used Memory  : " << heap->usedMemory()     << " bytes ("
                          << std::fixed << std::setprecision(1)
                          << (100.0 * heap->usedMemory() / heap->getTotalSize()) << "%)\n";
                std::cout << "  ║  Free Memory  : " << heap->freeMemory()     << " bytes\n";
                std::cout << "  ║  Block Count  : " << heap->blockCount()     << "\n";
                std::cout << "  ║  Fragmentation: "
                          << (heap->fragmentationRatio() * 100.0) << "%\n";
                std::cout << "  ║  Strategy     : " << heap->strategyName()   << "\n";
                std::cout << "  ║  Live Objects : " << liveIds.size()         << "\n";
                std::cout << "  ╚══════════════════════════════════════════╝\n";
            }

            else if (choice == 0) {
                std::cout << CLR_CYAN
                          << "\n  Goodbye! Session saved to logs/session.log\n"
                          << CLR_RESET;
            } else {
                std::cout << CLR_YELLOW
                          << "  Unknown option.\n" << CLR_RESET;
            }

        } catch (const std::invalid_argument& e) {
            std::cerr << CLR_RED
                      << "  Input error: " << e.what() << CLR_RESET << "\n";
        } catch (const std::runtime_error& e) {
            std::cerr << CLR_RED
                      << "  Runtime error: " << e.what() << CLR_RESET << "\n";
        }
    }

    return 0;
}
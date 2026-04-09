# Memory Allocation & GC Simulator

A production-level C++ simulation of heap memory management with an optional browser-based visualizer.

## Project Structure

```
memory-simulator/
├── backend/
│   ├── include/
│   │   ├── MemoryBlock.h          # Data model for heap segments
│   │   ├── AllocationStrategy.h   # Abstract base + First/Best/Worst Fit
│   │   ├── VirtualHeap.h          # Core heap engine
│   │   └── SessionLogger.h        # File-based activity logger (RAII)
│   ├── src/
│   │   ├── MemoryBlock.cpp
│   │   ├── AllocationStrategy.cpp
│   │   ├── VirtualHeap.cpp
│   │   ├── SessionLogger.cpp
│   │   └── main.cpp               # Interactive CLI entry point
│   └── CMakeLists.txt
├── frontend/
│   ├── index.html                 # Browser visualizer
│   ├── style.css
│   └── simulator.js               # JS mirror of C++ logic
├── snapshots/                     # Auto-created: heap save files
├── logs/                          # Auto-created: session.log
└── README.md
```

## Build & Run (C++ Backend)

### Prerequisites
- CMake >= 3.16
- GCC >= 9 or Clang >= 10 or MSVC 2019+

### Steps
```bash
cd backend
mkdir build && cd build
cmake ..
cmake --build .
./memory_sim          # Linux / macOS
memory_sim.exe        # Windows
```

### Quick build without CMake
```bash
cd backend
g++ -std=c++17 -Wall -o memory_sim \
    src/main.cpp src/MemoryBlock.cpp \
    src/AllocationStrategy.cpp \
    src/VirtualHeap.cpp src/SessionLogger.cpp \
    -Iinclude
./memory_sim
```

## Frontend Visualizer

No server needed — open directly in any modern browser:
```bash
open frontend/index.html        # macOS
xdg-open frontend/index.html   # Linux
start frontend/index.html       # Windows
```

The JS visualizer mirrors the C++ logic exactly. Save/Load snapshots
are compatible between the browser and C++ backend.

## OOP Concepts Demonstrated

| Concept | Where |
|---|---|
| Encapsulation | `MemoryBlock` bundles all block data |
| Abstraction | `AllocationStrategy` defines pure virtual interface |
| Inheritance | `FirstFit`, `BestFit`, `WorstFit` extend base class |
| Polymorphism | `VirtualHeap` calls `strategy->findBlock()` at runtime |
| RAII | `SessionLogger` opens/closes file in ctor/dtor |
| Smart Pointers | `shared_ptr<AllocationStrategy>`, `unique_ptr<VirtualHeap>` |

## Features

- **3 allocation strategies**: First Fit, Best Fit, Worst Fit
- **Deallocation** with automatic coalescing of adjacent free blocks
- **Mark & Sweep GC**: interactive root marking + unreachable object sweep
- **Fragmentation analytics**: external fragmentation ratio reported live
- **File persistence**: save/load heap state as `.snapshot` files
- **Session logging**: every operation appended to `logs/session.log`
- **ANSI color CLI** with structured menu

## Snapshot File Format

```
# Memory Simulator — Heap Snapshot
TOTAL_SIZE=200
STRATEGY=First Fit
NEXT_ID=5
# startAddress,size,isFree,marked,objectId
0,20,0,0,1
20,30,0,0,2
50,150,1,0,-1
```
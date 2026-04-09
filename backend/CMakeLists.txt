cmake_minimum_required(VERSION 3.16)
project(MemorySimulator VERSION 2.0 LANGUAGES CXX)

# ── Require C++17 (for std::filesystem) ─────────────────────────────
set(CMAKE_CXX_STANDARD          17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS        OFF)

# ── Compiler warnings ────────────────────────────────────────────────
if(MSVC)
    add_compile_options(/W4 /WX)
else()
    add_compile_options(-Wall -Wextra -Wpedantic -Werror)
endif()

# ── Source files ─────────────────────────────────────────────────────
set(SOURCES
    src/main.cpp
    src/MemoryBlock.cpp
    src/AllocationStrategy.cpp
    src/VirtualHeap.cpp
    src/SessionLogger.cpp
)

# ── Executable ───────────────────────────────────────────────────────
add_executable(memory_sim ${SOURCES})

# ── Include path ─────────────────────────────────────────────────────
target_include_directories(memory_sim PRIVATE include)

# ── Link std::filesystem on GCC < 9 ─────────────────────────────────
if(CMAKE_CXX_COMPILER_ID STREQUAL "GNU" AND
   CMAKE_CXX_COMPILER_VERSION VERSION_LESS "9.0")
    target_link_libraries(memory_sim PRIVATE stdc++fs)
endif()

# ── Build type defaults ──────────────────────────────────────────────
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

message(STATUS "Build type : ${CMAKE_BUILD_TYPE}")
message(STATUS "C++ standard: ${CMAKE_CXX_STANDARD}")
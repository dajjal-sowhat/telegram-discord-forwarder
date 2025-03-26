#!/bin/bash
ts-node src/watcher.ts
while true; do
    ts-node src/watcher.ts
done

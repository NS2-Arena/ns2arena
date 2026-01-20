#!/usr/bin/env bash

rm -rf dist

functions=$(ls -d functions/*)

for func in $functions; do
  funcName=$(basename $func)
  echo "Building $funcName"

  esbuild functions/$funcName/index.ts \
    --bundle \
    --platform=node \
    --target=node18 \
    --outfile=dist/$funcName/index.js \
    --minify \
    --tree-shaking=true
done

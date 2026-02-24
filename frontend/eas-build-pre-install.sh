#!/bin/bash

# Add polyfill for toReversed before any npm/yarn commands run
echo "Adding Array.prototype.toReversed polyfill..."

# Create a global polyfill that gets loaded by Node.js
mkdir -p ~/.node_modules

cat > ~/.node_modules/array-polyfills.js << 'POLYFILL'
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function() {
    return this.slice().reverse();
  };
}
if (!Array.prototype.toSorted) {
  Array.prototype.toSorted = function(compareFn) {
    return this.slice().sort(compareFn);
  };
}
if (!Array.prototype.toSpliced) {
  Array.prototype.toSpliced = function(start, deleteCount, ...items) {
    const copy = this.slice();
    copy.splice(start, deleteCount, ...items);
    return copy;
  };
}
console.log('Array polyfills loaded via NODE_OPTIONS');
POLYFILL

# Set NODE_OPTIONS to require the polyfill
export NODE_OPTIONS="--require $HOME/.node_modules/array-polyfills.js"

echo "Polyfills configured. NODE_OPTIONS=$NODE_OPTIONS"

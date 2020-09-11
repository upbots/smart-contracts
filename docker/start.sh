#!/bin/bash
set -u
set -e

echo "[*] Starting deploiement to $1"

FILE=.secret
if test -f "$FILE"; then
    node utils/wallet.js $1

    npx truffle migrate --network $1
else
    echo "$FILE has not been found. Please generate a 24 words mnemonic code and write it to a $FILE file"
    ls -lah
fi



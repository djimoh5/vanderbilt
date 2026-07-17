#!/bin/bash
export NODE_OPTIONS=--max_old_space_size=4096

set -e
export NG_CLI_ANALYTICS="false"
if [ "$2" = "--no-build" ] || [ "$3" = "--no-build" ]
then
    echo "Skipping Build"
else
    sh ./ui.build.sh $1
fi
cd ../server

npx ts-node --project tsconfig.json jobs/deploy.app.ts --$1

cd ./ui

if [ $1 != 'release' ]
then
    rm -r dist
fi
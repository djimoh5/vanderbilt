#!/bin/bash
skipFlag="${2:-noSkip}"
sh ./version.build.sh build-versions/build-version-$1.txt ui $skipFlag
if [ $1 = 'release' ]
then
    UI_BUILD='release'
elif [ $1 = 'sprint' ]
then
    UI_BUILD='sprint'
elif [ $1 = 'qa' ]
then
    UI_BUILD='qa'
elif [ $1 = 'demo' ]
then
    UI_BUILD='demo'
fi
cd ../ui
#npm install
npm run $UI_BUILD

version="${1:-dev}"
if [ "$1" = '--no-install' ] || [ "$1" = '--skip-install' ]
then
    echo "Missing Version Name"
    exit 1
else
    echo "Version $version"
fi

sh ./npm-install.sh

#update version numbers
cd deploy
skipFlag="${3:-noSkip}"
sh ./version.build.sh build-versions/build-version-$version.txt core $skipFlag
cd ../

echo "Cleaning previous build..."
rm -rf build

echo "Transpiling started..."
tsc -p server
status=$?
if [ $status -ne 0 ]; then
    echo "Transpiling failed, aborting build"
    exit 1
fi
echo "Transpiling complete"

cp --parents server/package.json build
cp --parents server/config/secure.config.json build
cp --parents server/config/app_secret_private.pem build
cp --parents server/config/app_secret_public.pem build
cp --parents server/lib/*.js build

cd build
npm install --production
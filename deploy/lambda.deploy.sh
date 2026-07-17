#tsc -p core
echo "Start Lambda Deploy"
mkdir -p ../build/lambda

cp lambda/* ../build/lambda
cp lambda/serverless.$1.yml ../build/serverless.yml

cp ../server/package.json ../build

cd ../build
npm install --production

serverless deploy --aws-profile veillance

status=$?

[ $status -eq 0 ] || exit 1

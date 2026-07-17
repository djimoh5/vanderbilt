#!/bin/sh
angularVersionNumber=18

increment_version() {
  local delimiter=.
  local array=($(echo "$1" | tr $delimiter '\n'))
  array[$2]=$((array[$2]+1))
  if [ $array -ne $angularVersionNumber ] && [ $2 -eq $((1)) ] 
  then
    array[0]=$((angularVersionNumber))
    array[$2]=0
  fi
  echo $(local IFS=$delimiter ; echo "${array[*]}")
}

mkdir -p build-versions

# pass the version file in args
currentVersionFile="./$1"

#if the version file doesn't exist start at 14.1
if [ ! -f $currentVersionFile ]; then
    mkdir -p "$(dirname "$currentVersionFile")"
    /bin/echo -n "${angularVersionNumber}.0" > "$currentVersionFile"
fi

#get the current version out of the file
currentVersion=$(cat "$currentVersionFile")

#increment if not part of the build script
if [ "$3" = 'static-build-number' ]
then
   newVersion=$currentVersion
else
   newVersion=$(increment_version $currentVersion 1)
fi

echo $newVersion
#write the new version back to the version file
/bin/echo -n "$newVersion" > "$currentVersionFile"

if [ "$2" = 'core' ]
then
  #write the new value to ts file for compiling into core
  versionFile="../config/version.ts"
  printf "//THIS IS AN AUTO-GENERATED FILE DO NOT MODIFY OR CHECK-IN\r" > "$versionFile"
  printf "export const CoreVersion = '${newVersion}';" >> "$versionFile"
elif [ "$2" = 'ui' ]
then
  #write the new value to ts file for compiling into ui
  versionFile="./../ui/src/app/config/version.ts"
  printf "//THIS IS AN AUTO-GENERATED FILE DO NOT MODIFY OR CHECK-IN\r" > "$versionFile"
  printf "export const Version = '${newVersion}';" >> "$versionFile"
else
  #write the new value to ts file for compiling into ui
  versionFile="./../ui/src/app/config/version.ts"
  printf "//THIS IS AN AUTO-GENERATED FILE DO NOT MODIFY OR CHECK-IN\r" > "$versionFile"
  printf "export const Version = '${newVersion}';" >> "$versionFile"

  #write the new value to ts file for compiling into core
  versionFile="./../src/app/config/version.ts"
  printf "//THIS IS AN AUTO-GENERATED FILE DO NOT MODIFY OR CHECK-IN\r" > "$versionFile"
  printf "export const CoreVersion = '${newVersion}';" >> "$versionFile"
fi



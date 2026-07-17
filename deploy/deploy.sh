#!/bin/bash
export NODE_OPTIONS=--max_old_space_size=4096
#sh ./git.update.sh
sh ./core.deploy.sh $1
sh ./ui.deploy.sh $1 static-build-number $2
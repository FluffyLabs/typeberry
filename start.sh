#!/bin/sh
# Start script for Docker container
# Forwards all arguments to npm start

exec npm start -- "$@"

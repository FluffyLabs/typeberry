#!/bin/sh
# Start script for Docker container
# Forwards all arguments to bun run start

exec bun run start -- "$@"

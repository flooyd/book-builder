#!/usr/bin/env bash
# A throwaway Postgres for Book Builder, so tests never touch the user's Neon database.
#
#   scratch-db.sh start <data-dir>   create it the first time, start it, build the current schema
#   scratch-db.sh stop <data-dir>    stop it (the data stays for next time)
#   scratch-db.sh url                print the DATABASE_URL to run the app with
#
# Run from the repo root (drizzle-kit reads drizzle.config.ts there), in Git Bash or any bash.
# PG_BIN (default: PostgreSQL 18 on Windows) and PORT (default 54329) can be overridden. The
# user's own Postgres service on 5432 is never touched.
set -euo pipefail

PG_BIN=${PG_BIN:-"/c/Program Files/PostgreSQL/18/bin"}
PORT=${PORT:-54329}
URL="postgres://bb@localhost:$PORT/bookbuilder"

usage() {
	sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
	exit 2
}

case "${1:-}" in
url)
	echo "$URL"
	;;
start)
	dir=${2:-}
	[ -n "$dir" ] || usage
	if [ ! -f "$dir/PG_VERSION" ]; then
		mkdir -p "$dir"
		"$PG_BIN/initdb" -D "$dir" -U bb -A trust -E UTF8 --locale=C >"$dir.initdb.log"
	fi
	if ! "$PG_BIN/pg_ctl" -D "$dir" status >/dev/null 2>&1; then
		# Detach every stream: on Windows the server inherits them, and anything reading this
		# script's output through a pipe would then wait on the server forever.
		"$PG_BIN/pg_ctl" -D "$dir" -l "$dir.log" -o "-p $PORT" -w start </dev/null >/dev/null 2>&1
	fi
	"$PG_BIN/createdb" -h localhost -p "$PORT" -U bb bookbuilder 2>/dev/null || true
	# The schema as the code has it now. --force accepts drizzle-kit's questions; this database
	# is disposable.
	if ! DATABASE_URL="$URL" npx drizzle-kit push --force >"$dir.push.log" 2>&1; then
		cat "$dir.push.log"
		exit 1
	fi
	tail -n 1 "$dir.push.log"
	echo "ready: DATABASE_URL=$URL"
	;;
stop)
	dir=${2:-}
	[ -n "$dir" ] || usage
	"$PG_BIN/pg_ctl" -D "$dir" stop -m fast
	;;
*)
	usage
	;;
esac

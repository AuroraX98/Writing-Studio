#!/bin/sh
cd -- "$(dirname -- "$0")" || exit 1
for task_python in python3 python; do
  if command -v "$task_python" >/dev/null 2>&1 && "$task_python" -c 'import sys; sys.exit(sys.version_info < (3, 8))' >/dev/null 2>&1; then
    exec "$task_python" launch.py "$@"
  fi
done
printf '%s\n' 'Python 3.8 or newer is needed for automatic folder backups.' 'You can still open Writing Studio.html and use Back up projects to save copies.'
if [ -f 'Writing Studio.html' ]; then
  open 'Writing Studio.html'
fi
printf '%s' 'Press Return to close this window. '
read task_answer

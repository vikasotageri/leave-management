#!/bin/bash
# Start all 3 LeaveFlow server instances
BASE_DIR="$(cd "$(dirname "$0")" && pwd)/backend"
echo "Starting LeaveFlow servers..."
setsid nohup env PORT=8001 python3 "$BASE_DIR/main.py" > /tmp/server8001.log 2>&1 &
setsid nohup env PORT=8002 python3 "$BASE_DIR/main.py" > /tmp/server8002.log 2>&1 &
setsid nohup env PORT=8003 python3 "$BASE_DIR/main.py" > /tmp/server8003.log 2>&1 &
sleep 2
echo ""
echo "✅ All servers started!"
echo ""
echo "  Role       | Dashboard                           | Login Page                          | Port"
echo "  -----------|-------------------------------------|-------------------------------------|------"
echo "  Employee   | http://localhost:8001/employee      | http://localhost:8001/employee/login | 8001"
echo "  Manager    | http://localhost:8002/manager        | http://localhost:8002/manager/login  | 8002"
echo "  HR         | http://localhost:8003/hr             | http://localhost:8003/hr/login       | 8003"
echo ""

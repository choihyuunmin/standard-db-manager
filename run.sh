#!/bin/bash

# ==============================================================================
# GovData Standard DB Manager - 통합 실행 스크립트
# ==============================================================================

# 원격 OpenSearch 서버를 사용하려면 아래 두 환경변수를 설정하고 주석을 해제하거나,
# 스크립트 실행 시 환경변수로 전달하세요.
# 예: OPENSEARCH_HOST=192.168.1.10 OPENSEARCH_PORT=9200 ./run.sh
# export OPENSEARCH_HOST="your-remote-host-ip"
# export OPENSEARCH_PORT="9200"

echo "========================================"
echo "🚀 Starting GovData Standard DB Manager"
echo "========================================"

# 1. OpenSearch 확인 및 실행
if [ -z "$OPENSEARCH_HOST" ]; then
    echo "ℹ️ OPENSEARCH_HOST 환경변수가 설정되지 않았습니다. 로컬(localhost)을 기본값으로 사용합니다."
    echo "🐳 로컬 OpenSearch(Docker Compose)를 시작합니다..."
    docker-compose up -d
else
    echo "🌐 원격 OpenSearch 서버를 사용합니다: $OPENSEARCH_HOST:$OPENSEARCH_PORT"
fi

echo "========================================"

# 2. 백엔드 실행 (FastAPI)
echo "🐍 백엔드 서버 (FastAPI) 시작 중..."
cd backend
# 가상환경이 존재하면 활성화
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi
python main.py &
BACKEND_PID=$!
cd ..

# 3. 프론트엔드 실행 (React/Vite)
echo "⚛️ 프론트엔드 서버 (React) 시작 중..."
cd frontend
# 모듈이 설치되어 있지 않으면 자동 설치
if [ ! -d "node_modules" ]; then
    echo "📦 프론트엔드 의존성(npm install)을 설치합니다..."
    npm install
fi
npm run dev &
FRONTEND_PID=$!
cd ..

echo "========================================"
echo "✅ 모든 서비스가 백그라운드에서 실행 중입니다!"
echo "➡️ 백엔드 포트: 8000 / PID: $BACKEND_PID"
echo "➡️ 프론트엔드 포트: 17701 / PID: $FRONTEND_PID"
if [ -z "$OPENSEARCH_HOST" ]; then
    echo "➡️ 오픈서치 포트: 9200 (Docker)"
fi
echo ""
echo "종료하시려면 [CTRL+C] 를 누르세요."
echo "========================================"

# Ctrl+C 입력 시 안전하게 백그라운드 프로세스 모두 종료
trap "echo -e '\n🛑 서비스를 종료합니다...'; kill $BACKEND_PID; kill $FRONTEND_PID; exit" INT TERM
wait

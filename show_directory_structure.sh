#!/bin/bash

# 디렉토리 구조를 표시하는 스크립트
# 무시할 파일들을 제외하고 지정된 디렉토리 구조를 보여줍니다
# 사용법: ./show_directory_structure.sh [디렉토리1,디렉토리2,...]
# 예시: ./show_directory_structure.sh backend,frontend
#       ./show_directory_structure.sh backend
#       ./show_directory_structure.sh (모든 디렉토리)

# 무시할 패턴들 정의
IGNORE_PATTERNS=(
    "node_modules"
    ".pytest_cache"
    ".git"
    ".next"
    "dist"
    "build"
    ".cache"
    "coverage"
    ".nyc_output"
    "*.log"
    ".env*"
    ".DS_Store"
    "Thumbs.db"
    "*.tmp"
    "*.temp"
    "__pycache__"
    "*.pyc"
    ".pytest_cache"
    ".venv"
    "venv"
    ".idea"
    ".vscode"
    "*.swp"
    "*.swo"
    "*~"
)

# 기본 디렉토리들
DEFAULT_DIRS=("apps/backend" "apps/frontend" "docs" "infra" "scripts")

# 인자 처리
if [ $# -eq 0 ]; then
    # 인자가 없으면 모든 기본 디렉토리 사용
    DIRS=("${DEFAULT_DIRS[@]}")
else
    # 첫 번째 인자를 콤마로 분리
    IFS=',' read -ra DIRS <<< "$1"
fi

# tree 명령어가 있는지 확인
if command -v tree >/dev/null 2>&1; then
    echo "=== 디렉토리 구조 (tree 사용) ==="
    
    # 무시할 패턴들을 -I 옵션으로 전달
    IGNORE_STRING=$(IFS='|'; echo "${IGNORE_PATTERNS[*]}")
    
    for dir in "${DIRS[@]}"; do
        # 공백 제거
        dir=$(echo "$dir" | xargs)
        
        if [ -d "$dir" ]; then
            echo ""
            echo "📁 $dir/"
            echo "────────────────────────────────────────"
            tree "$dir" -I "$IGNORE_STRING" --dirsfirst -a
        else
            echo ""
            echo "📁 $dir/ (존재하지 않음)"
        fi
    done
else
    echo "=== 디렉토리 구조 (find 사용) ==="
    
    # find를 사용한 대안
    for dir in "${DIRS[@]}"; do
        # 공백 제거
        dir=$(echo "$dir" | xargs)
        
        if [ -d "$dir" ]; then
            echo ""
            echo "📁 $dir/"
            echo "────────────────────────────────────────"
            
            # find 명령어로 파일과 디렉토리 찾기 (무시할 패턴 제외)
            find "$dir" -type f -o -type d | \
            grep -v -E "($(IFS='|'; echo "${IGNORE_PATTERNS[*]}" | sed 's/\*/\.\*/g'))" | \
            sort | \
            sed "s|^$dir/||" | \
            sed 's|^|  |'
        else
            echo ""
            echo "📁 $dir/ (존재하지 않음)"
        fi
    done
fi

echo ""
echo "완료! 지정된 디렉토리들의 구조가 표시되었습니다."
echo "표시된 디렉토리: ${DIRS[*]}"

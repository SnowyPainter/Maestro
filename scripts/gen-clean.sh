# scripts/gen-clean.sh
#!/usr/bin/env bash
set -o pipefail

CMD="$@"

# 표준출력/표준에러 라인을 실시간 필터링
# -v: 매칭된 라인은 제거. 여러 패턴을 ERE로 OR 매칭
# 필요시 패턴 추가/수정 가능
$CMD 2>&1 | grep -v -E \
'(#/components/schemas/.*must have required property '\''\$ref'\''|must match exactly one schema in oneOf|anyOf/.*/type must be equal to one of the allowed values)' 

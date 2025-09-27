#apps.backend.src.modules.mail.mail_parser.py
from typing import Tuple
from apps.backend.src.modules.drafts.schemas import DraftIR, BlockText, BlockImage, BlockVideo
from apps.backend.src.modules.mail.schemas import EmailMetadata

def extract_pipeline_id(subject: str) -> str | None:
    """
    이메일 제목에서 pipeline_id를 추출합니다.
    [PIPELINE #pipeline_id] 패턴을 찾습니다.
    """
    import re
    # 영문자, 숫자, 특수문자를 모두 포함하는 패턴으로 변경
    match = re.search(r'\[PIPELINE\s*#([a-zA-Z0-9]+[a-zA-Z0-9]*)\]', subject)
    return match.group(1) if match else None

def parse_email_metadata(text: str, subject: str | None = None) -> EmailMetadata:
    import re

    metadata = {"settings": {}}
    raw_text = text
    content = raw_text.strip()

    # 설정세팅 파싱 (coworker@key:"value" 형식)
    settings_pattern = r'coworker@(\w+):"([^"]*)"'
    settings_matches = re.findall(settings_pattern, content)
    for key, value in settings_matches:
        metadata["settings"][key] = value
        # 설정세팅 라인을 제거
        content = re.sub(rf'coworker@{key}:"{re.escape(value)}"', '', content)

    # settings에서 우선적으로 메타데이터 추출
    metadata["title"] = metadata["settings"].get("title", "Untitled Email")
    metadata["tags"] = metadata["settings"].get("tags",
        [tag.strip() for tag in metadata["settings"].get("tags", "").split(",") if tag.strip()] if metadata["settings"].get("tags") else [])

    # pipeline_id는 제목 토큰에서 우선 추출, 없으면 settings에서 fallback
    pipeline_id = (extract_pipeline_id(subject) if isinstance(subject, str) and subject else None) or metadata["settings"].get("pipeline_id")
    metadata["pipeline_id"] = pipeline_id or "default"

    return EmailMetadata(**metadata)

def parse_mail_body(text: str, *, subject: str | None = None, paragraph_split: str = "\n\n") -> Tuple[DraftIR, EmailMetadata]:
    """
    이메일 텍스트를 파싱하여 DraftIR로 변환합니다.
    
    마크다운 문법을 지원하며, 이미지와 비디오 블록도 처리합니다.
    - ![alt](url) 형식은 BlockImage로 변환
    - 비디오 URL이 포함된 경우 BlockVideo로 변환
    - 나머지는 BlockText로 변환
    """
    import re
    metadata = parse_email_metadata(text, subject=subject)
    
    blocks = []
    if paragraph_split.startswith("#"):
        header_pattern = rf'^{re.escape(paragraph_split)}+'
        paragraphs = re.split(header_pattern, text, flags=re.MULTILINE)
        if paragraphs and not paragraphs[0].strip():
            paragraphs = paragraphs[1:]
    else:
        paragraphs = text.split(paragraph_split)
    
    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue
            
        image_pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
        image_match = re.search(image_pattern, paragraph)
        
        if image_match:
            alt_text = image_match.group(1)
            image_url = image_match.group(2)
            blocks.append(BlockImage(
                type="image", 
                props={
                    "url": image_url,
                    "alt": alt_text if alt_text else None
                }
            ))
            continue
        
        video_pattern = r'(https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/|vimeo\.com/)[\w-]+)'
        video_match = re.search(video_pattern, paragraph)
        
        if video_match:
            video_url = video_match.group(1)
            alt_text = re.sub(video_pattern, '', paragraph).strip()
            blocks.append(BlockVideo(
                type="video",
                props={
                    "url": video_url,
                    "alt": alt_text if alt_text else None,
                }
            ))
            continue
        
        blocks.append(BlockText(
            type="text", 
            props={"markdown": paragraph}
        ))
    
    return DraftIR(blocks=blocks), metadata

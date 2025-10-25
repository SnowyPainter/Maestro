const recommendedAvatars = [
  // 48개 아바타 (3x3 그리드로는 5.33페이지, 6페이지로 구성)
  { name: "Professional Woman", url: "https://randomuser.me/api/portraits/women/1.jpg" },
  { name: "Young Professional", url: "https://randomuser.me/api/portraits/men/2.jpg" },
  { name: "Creative Woman", url: "https://randomuser.me/api/portraits/women/3.jpg" },
  { name: "Tech Professional", url: "https://randomuser.me/api/portraits/men/4.jpg" },
  { name: "Business Woman", url: "https://randomuser.me/api/portraits/women/5.jpg" },
  { name: "Entrepreneur", url: "https://randomuser.me/api/portraits/men/6.jpg" },
  { name: "Designer", url: "https://randomuser.me/api/portraits/women/7.jpg" },
  { name: "Developer", url: "https://randomuser.me/api/portraits/men/8.jpg" },
  { name: "Artist", url: "https://randomuser.me/api/portraits/women/9.jpg" },
  { name: "Manager", url: "https://randomuser.me/api/portraits/men/10.jpg" },
  { name: "Consultant", url: "https://randomuser.me/api/portraits/women/11.jpg" },
  { name: "Analyst", url: "https://randomuser.me/api/portraits/men/12.jpg" },
  { name: "Marketing Expert", url: "https://randomuser.me/api/portraits/women/13.jpg" },
  { name: "Sales Professional", url: "https://randomuser.me/api/portraits/men/14.jpg" },
  { name: "HR Manager", url: "https://randomuser.me/api/portraits/women/15.jpg" },
  { name: "Project Manager", url: "https://randomuser.me/api/portraits/men/16.jpg" },
  { name: "Content Creator", url: "https://randomuser.me/api/portraits/women/17.jpg" },
  { name: "Social Media Manager", url: "https://randomuser.me/api/portraits/men/18.jpg" },
  { name: "Brand Strategist", url: "https://randomuser.me/api/portraits/women/19.jpg" },
  { name: "Digital Marketer", url: "https://randomuser.me/api/portraits/men/20.jpg" },
  { name: "UX Designer", url: "https://randomuser.me/api/portraits/women/21.jpg" },
  { name: "Product Manager", url: "https://randomuser.me/api/portraits/men/22.jpg" },
  { name: "Data Scientist", url: "https://randomuser.me/api/portraits/women/23.jpg" },
  { name: "Business Analyst", url: "https://randomuser.me/api/portraits/men/24.jpg" },
  { name: "Creative Director", url: "https://randomuser.me/api/portraits/women/25.jpg" },
  { name: "Startup Founder", url: "https://randomuser.me/api/portraits/men/26.jpg" },
  { name: "Fashion Designer", url: "https://randomuser.me/api/portraits/women/27.jpg" },
  { name: "Software Engineer", url: "https://randomuser.me/api/portraits/men/28.jpg" },
  { name: "Graphic Designer", url: "https://randomuser.me/api/portraits/women/29.jpg" },
  { name: "Marketing Director", url: "https://randomuser.me/api/portraits/men/30.jpg" },
  { name: "PR Specialist", url: "https://randomuser.me/api/portraits/women/31.jpg" },
  { name: "Business Owner", url: "https://randomuser.me/api/portraits/men/32.jpg" },
  { name: "Art Director", url: "https://randomuser.me/api/portraits/women/33.jpg" },
  { name: "Tech Lead", url: "https://randomuser.me/api/portraits/men/34.jpg" },
  { name: "Brand Manager", url: "https://randomuser.me/api/portraits/women/35.jpg" },
  { name: "Sales Director", url: "https://randomuser.me/api/portraits/men/36.jpg" },
  { name: "Content Strategist", url: "https://randomuser.me/api/portraits/women/37.jpg" },
  { name: "Operations Manager", url: "https://randomuser.me/api/portraits/men/38.jpg" },
  { name: "Social Media Influencer", url: "https://randomuser.me/api/portraits/women/39.jpg" },
  { name: "Product Designer", url: "https://randomuser.me/api/portraits/men/40.jpg" },
  { name: "Growth Hacker", url: "https://randomuser.me/api/portraits/women/41.jpg" },
  { name: "Innovation Manager", url: "https://randomuser.me/api/portraits/men/42.jpg" },
  { name: "Customer Success", url: "https://randomuser.me/api/portraits/women/43.jpg" },
  { name: "Strategy Consultant", url: "https://randomuser.me/api/portraits/men/44.jpg" },
  { name: "Creative Producer", url: "https://randomuser.me/api/portraits/women/45.jpg" },
  { name: "Technical Writer", url: "https://randomuser.me/api/portraits/men/46.jpg" },
  { name: "Community Manager", url: "https://randomuser.me/api/portraits/women/47.jpg" },
  { name: "DevOps Engineer", url: "https://randomuser.me/api/portraits/men/48.jpg" },
];

import { useState, useCallback, useMemo, memo, useRef } from "react";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { useUploadFileApiFilesFilesPost } from "@/lib/api/generated";
import { toast } from "sonner";

interface AvatarSelectorProps {
  selectedAvatarUrl: string;
  onAvatarSelect: (url: string) => void;
}

export function AvatarSelector({
  selectedAvatarUrl,
  onAvatarSelect
}: AvatarSelectorProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFileApiFilesFilesPost({
    request: { headers: {} },
    mutation: {
      onSuccess: (data) => {
        setUploadedUrl(data.url);
        onAvatarSelect(data.url);
      },
      onError: (error) => {
        console.error('File upload failed:', error);
        toast.error('Failed to upload file. Please try again.');
      },
    }
  });

  // 3x3 그리드 형태로 아바타들을 그룹화 (첫 번째 셀은 업로드 버튼, 나머지 8개는 아바타)
  const groupedAvatars = useMemo(() => {
    const groups = [];
    for (let i = 0; i < recommendedAvatars.length; i += 8) {
      groups.push(recommendedAvatars.slice(i, i + 8));
    }
    return groups;
  }, []);

  const totalPages = groupedAvatars.length;

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  }, [totalPages]);

  const handlePrevPage = useCallback(() => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  }, [totalPages]);

  const handleGoToPage = useCallback((pageIndex: number) => {
    setCurrentPage(pageIndex);
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 파일 크기 제한 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }

      // 이미지 파일만 허용
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      try {
        // API를 사용해서 파일 업로드
        await uploadFile({ data: { file } });
      } catch (error) {
        // 에러는 mutation의 onError에서 처리됨
        console.error('Upload error:', error);
      }
    }
  }, [uploadFile]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const currentGroup = groupedAvatars[currentPage] || [];

  return (
    <div className="grid gap-3">
      <div className="relative">
        {/* 3x3 그리드 캐로셀 */}
        <div className="flex items-center justify-center gap-2">
          {/* 이전 버튼 */}
          <button
            onClick={handlePrevPage}
            type="button"
            className="flex-shrink-0 p-1 rounded-full hover:bg-muted transition-colors"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* 3x3 그리드 */}
          <div className="grid grid-cols-3 gap-2 w-48">
            {/* 첫 번째 셀: 파일 업로드 버튼 또는 업로드된 이미지 미리보기 */}
            <div className="relative aspect-square">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              {uploadedUrl && uploadedUrl === selectedAvatarUrl ? (
                // 업로드된 이미지가 선택된 경우: 이미지 미리보기 표시
                <button
                  type="button"
                  onClick={handleUploadClick}
                  disabled={isUploading}
                  className="relative w-full h-full rounded-md overflow-hidden border-2 border-primary bg-primary/10 ring-2 ring-primary/30"
                  title="Uploaded avatar - click to change"
                >
                  <img
                    src={uploadedUrl}
                    alt="Uploaded avatar"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // 이미지 로드 실패 시 업로드 버튼으로 돌아감
                      setUploadedUrl(null);
                    }}
                  />
                  <div className="absolute inset-0 bg-primary/15 flex items-center justify-center">
                    <div className="w-3 h-3 bg-primary rounded-full border-2 border-background flex items-center justify-center">
                      <div className="w-1 h-1 bg-background rounded-full" />
                    </div>
                  </div>
                  {/* 호버 시 변경 아이콘 표시 */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                </button>
              ) : (
                // 업로드 버튼 표시
                <button
                  type="button"
                  onClick={handleUploadClick}
                  disabled={isUploading}
                  className={`relative w-full h-full rounded-md overflow-hidden border-2 transition-all flex flex-col items-center justify-center p-2 border-muted hover:border-primary/50 hover:bg-muted/30 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Upload your own avatar"
                >
                  {isUploading ? (
                    <div className="animate-spin w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full mb-1" />
                  ) : (
                    <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                  )}
                  <span className="text-xs text-muted-foreground leading-tight">
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </span>
                </button>
              )}
            </div>

            {/* 나머지 8개 셀: 추천 아바타들 */}
            {currentGroup.map((avatar, index) => (
              <button
                key={currentPage * 8 + index}
                type="button"
                onClick={() => onAvatarSelect(avatar.url)}
                className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${
                  selectedAvatarUrl === avatar.url
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                    : 'border-muted hover:border-primary/50 hover:bg-muted/30'
                }`}
                title={avatar.name}
              >
                <img
                  src={avatar.url}
                  alt={avatar.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {selectedAvatarUrl === avatar.url && (
                  <div className="absolute inset-0 bg-primary/15 flex items-center justify-center">
                    <div className="w-3 h-3 bg-primary rounded-full border-2 border-background flex items-center justify-center">
                      <div className="w-1 h-1 bg-background rounded-full" />
                    </div>
                  </div>
                )}
              </button>
            ))}

            {/* 빈 셀들로 그리드 유지 (업로드 버튼 제외하고 총 8개 셀) */}
            {Array.from({ length: 8 - currentGroup.length }).map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}
          </div>

          {/* 다음 버튼 */}
          <button
            onClick={handleNextPage}
            type="button"
            className="flex-shrink-0 p-1 rounded-full hover:bg-muted transition-colors"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 페이지 인디케이터 */}
        <div className="flex justify-center gap-1 mt-2">
          {groupedAvatars.map((_, index) => (
            <button
              key={index}
              onClick={() => handleGoToPage(index)}
              type="button"
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentPage ? 'bg-primary' : 'bg-muted'
              }`}
              title={`Go to page ${index + 1}`}
            />
          ))}
        </div>

        <p className="text-xs text-center text-muted-foreground mt-1">
          Choose your avatar • Page {currentPage + 1} of {totalPages}
        </p>
      </div>
    </div>
  );
}

export default memo(AvatarSelector);

export const parsePastedText = (text: string): string[] => {
    if (!text) return [];
  
    // Normalize newlines + NBSP, trim only line-end spaces
    const normalized = text
      .replace(/\r\n?/g, "\n")
      .replace(/\u00A0/g, " ");
  
    const lines = normalized.split("\n");
  
    // ATX heading: up to 3 leading spaces, 1-6 #, a space, then text; optional closing #s
    const isAtxHeading = (line: string): boolean => {
      return /^(?: {0,3})(#{1,6})\s+\S/.test(line);
    };
  
    // Indented code line (legacy): ≥4 leading spaces or a tab
    const isIndentedCode = (line: string): boolean => {
      return /^(?: {4,}|\t)/.test(line);
    };
  
    // Blockquote line
    const isBlockquote = (line: string): boolean => {
      return /^ {0,3}>\s?/.test(line);
    };
  
    // Fence open/close: ``` or ~~~ (optionally with language)
    const fenceRe = /^ {0,3}(```|~~~)/;
  
    // First pass: decide whether we need special parsing at all
    let foundDoubleBlank = false;
    let foundHeading = false;
    {
      let blankRun = 0;
      let inFence = false;
      for (const raw of lines) {
        const line = raw; // keep original spacing for output
        if (fenceRe.test(line)) inFence = !inFence;
  
        if (!inFence) {
          if (line.trim() === "") {
            blankRun++;
            if (blankRun >= 2) foundDoubleBlank = true;
          } else {
            blankRun = 0;
            // treat headings only outside fences, not in blockquotes/indented code
            if (!isBlockquote(line) && !isIndentedCode(line) && isAtxHeading(line)) {
              foundHeading = true;
            }
          }
        }
        if (foundDoubleBlank || foundHeading) break;
      }
    }
  
    if (!foundDoubleBlank && !foundHeading) {
      // No special parsing needed; let default paste happen
      return [];
    }
  
    // Second pass: build blocks
    const blocks: string[] = [];
    let buf: string[] = [];
    let inFence = false;
    let consecutiveBlank = 0;
  
    const flushBuf = () => {
      // rtrim each line and trim trailing blank lines
      while (buf.length && buf[buf.length - 1].trim() === "") buf.pop();
      if (buf.length) blocks.push(buf.map(l => l.replace(/[ \t]+$/g, "")).join("\n"));
      buf = [];
    };
  
    for (const raw of lines) {
      const line = raw;
  
      if (fenceRe.test(line)) {
        // toggle fence and keep the fence line in buffer
        inFence = !inFence;
        consecutiveBlank = 0;
        buf.push(line);
        continue;
      }
  
      if (inFence) {
        // inside fenced code: copy verbatim
        buf.push(line);
        consecutiveBlank = (line.trim() === "") ? consecutiveBlank + 1 : 0;
        continue;
      }
  
      // Outside fences
      if (line.trim() === "") {
        consecutiveBlank++;
        buf.push(line);
        // paragraph split on >=2 consecutive blanks (outside fences)
        if (consecutiveBlank >= 2) {
          flushBuf();
          consecutiveBlank = 0;
        }
        continue;
      } else {
        consecutiveBlank = 0;
      }
  
      // If the line is blockquote or indented code, treat as normal content
      if (isBlockquote(line) || isIndentedCode(line)) {
        buf.push(line);
        continue;
      }
  
      // If heading, close current block (if any), emit heading as its own block
      if (isAtxHeading(line)) {
        flushBuf();
        // Keep original spacing for headings, but trim right spaces
        blocks.push(line.replace(/[ \t]+$/g, ""));
        continue;
      }
  
      // Default: append to current buffer
      buf.push(line);
    }
  
    flushBuf();
    // Remove any accidental empties
    return blocks.filter(b => b.trim().length > 0);
  };
  
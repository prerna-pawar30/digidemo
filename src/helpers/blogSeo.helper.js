import slugify from "slugify";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else",
  "for", "to", "of", "in", "on", "at", "by", "with", "from",
  "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "it", "its", "as",
  "about", "into", "over", "after", "before", "under",
  "again", "further", "than", "once", "your", "our", "their",
  "will", "can", "could", "should", "would", "how", "what",
  "why", "when", "where", "which"
]);

const cleanText = (text = "") => {
  return String(text)
    .replace(/<[^>]*>/g, " ")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const toLowerClean = (text = "") => cleanText(text).toLowerCase();

const truncateText = (text = "", maxLength = 160) => {
  const clean = cleanText(text);
  if (!clean) return "";
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength - 3).trimEnd() + "...";
};

const extractTextFromContent = (content = []) => {
  if (!Array.isArray(content)) return "";

  const parts = [];

  for (const block of content) {
    if (!block || typeof block !== "object") continue;

    if (["heading", "paragraph", "quote"].includes(block.type) && block.text) {
      parts.push(block.text);
    }

    if (block.type === "list" && Array.isArray(block.listItems)) {
      parts.push(block.listItems.join(" "));
    }
  }

  return cleanText(parts.join(" "));
};

const extractHeadingTexts = (content = []) => {
  if (!Array.isArray(content)) return [];

  return content
    .filter((block) => block?.type === "heading" && block?.text)
    .map((block) => cleanText(block.text))
    .filter(Boolean);
};

const extractParagraphTexts = (content = []) => {
  if (!Array.isArray(content)) return [];

  return content
    .filter((block) => block?.type === "paragraph" && block?.text)
    .map((block) => cleanText(block.text))
    .filter(Boolean);
};

const extractWords = (text = "") => {
  return toLowerClean(text)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
};

const uniqueStrings = (items = []) => {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const value = toLowerClean(item);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
};

const detectIntent = ({ title = "", tags = [] }) => {
  const haystack = `${title} ${Array.isArray(tags) ? tags.join(" ") : ""}`.toLowerCase();

  if (/\b(buy|price|deal|shop|purchase|book|order)\b/.test(haystack)) {
    return "transactional";
  }

  if (/\b(best|top|vs|versus|review|comparison)\b/.test(haystack)) {
    return "commercial";
  }

  if (/\b(official|login|website|homepage|brand)\b/.test(haystack)) {
    return "navigational";
  }

  return "informational";
};

const extractPrimaryKeyword = ({ title = "", tags = [] }) => {
  const cleanTitle = toLowerClean(title);
  if (cleanTitle) return cleanTitle;

  if (Array.isArray(tags) && tags.length > 0) {
    const firstTag = toLowerClean(tags[0]);
    if (firstTag) return firstTag;
  }

  return "";
};

const extractSecondaryKeywords = ({ title = "", tags = [], content = [] }) => {
  const collected = [];

  if (Array.isArray(tags)) {
    collected.push(...tags);
  }

  collected.push(...extractHeadingTexts(content));
  collected.push(title);

  const text = extractTextFromContent(content);
  const words = extractWords(text);

  const freqMap = {};
  for (const word of words) {
    freqMap[word] = (freqMap[word] || 0) + 1;
  }

  const topWords = Object.entries(freqMap)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  collected.push(...topWords);

  return uniqueStrings(collected).slice(0, 8);
};

const buildMetaTitle = ({ title = "", brandName = "" }) => {
  const raw = brandName ? `${cleanText(title)} | ${cleanText(brandName)}` : cleanText(title);
  return truncateText(raw, 60);
};

const buildMetaDescription = ({ shortDescription = "", content = "", primaryKeyword = "" }) => {
  const base = cleanText(shortDescription) || cleanText(content) || primaryKeyword;
  return truncateText(base, 160);
};

const buildKeywords = ({ primaryKeyword = "", secondaryKeywords = [] }) => {
  return uniqueStrings([primaryKeyword, ...secondaryKeywords]).slice(0, 10);
};

const pickOgImage = ({ bannerImage = "", content = [] }) => {
  if (bannerImage) return bannerImage;

  const firstImageBlock = Array.isArray(content)
    ? content.find((block) => block?.type === "image" && block?.image)
    : null;

  return firstImageBlock?.image || "";
};

const calculateSeoScore = ({
  title = "",
  shortDescription = "",
  primaryKeyword = "",
  secondaryKeywords = [],
  content = [],
  bannerImage = "",
}) => {
  let score = 0;

  const cleanTitle = toLowerClean(title);
  const cleanShort = toLowerClean(shortDescription);
  const contentText = toLowerClean(extractTextFromContent(content));
  const headings = extractHeadingTexts(content).map((item) => item.toLowerCase());

  if (primaryKeyword && cleanTitle.includes(primaryKeyword)) score += 20;
  if (primaryKeyword && cleanShort.includes(primaryKeyword)) score += 15;
  if (primaryKeyword && contentText.includes(primaryKeyword)) score += 15;
  if (headings.some((heading) => heading.includes(primaryKeyword))) score += 10;
  if (secondaryKeywords.length >= 3) score += 10;
  if (Array.isArray(content) && content.length >= 5) score += 10;
  if (extractParagraphTexts(content).length >= 2) score += 10;
  if (bannerImage || pickOgImage({ bannerImage, content })) score += 5;
  if (cleanShort.length >= 120 && cleanShort.length <= 300) score += 5;

  return Math.min(score, 100);
};

export const generateSEOContent = ({
  title = "",
  shortDescription = "",
  content = [],
  tags = [],
  slug = "",
  bannerImage = "",
  baseUrl = "",
  brandName = "",
}) => {
  const fullText = extractTextFromContent(content);
  const searchIntent = detectIntent({ title, tags });
  const primaryKeyword = extractPrimaryKeyword({ title, tags });
  const secondaryKeywords = extractSecondaryKeywords({ title, tags, content });
  const seoTitle = buildMetaTitle({ title, brandName });
  const metaDescription = buildMetaDescription({
    shortDescription,
    content: fullText,
    primaryKeyword,
  });
  const keywords = buildKeywords({ primaryKeyword, secondaryKeywords });
  const ogImage = pickOgImage({ bannerImage, content });

  const canonicalUrl =
    baseUrl && slug
      ? `${String(baseUrl).replace(/\/$/, "")}/blogs/${slug}`
      : "";

  const seoScore = calculateSeoScore({
    title,
    shortDescription,
    primaryKeyword,
    secondaryKeywords,
    content,
    bannerImage: ogImage,
  });

  return {
    seo: {
      metaTitle: seoTitle,
      metaDescription,
      keywords,
      canonicalUrl,
      ogImage,
    },
    seoAnalysis: {
      primaryKeyword,
      secondaryKeywords,
      searchIntent,
      seoScore,
    },
  };
};

export const makeSeoSlug = (value = "") => {
  return slugify(value, { lower: true, strict: true, trim: true });
};
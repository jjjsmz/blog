import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { slug as githubSlug } from 'github-slugger';
import matter from 'gray-matter';

// トップページ・記事・一覧ページで priority を出し分ける
// (Google は priority を無視するが，Bing 等は参照する)
const PRIORITY_HOME = 1.0;
const PRIORITY_POST = 0.8;
const PRIORITY_LIST = 0.3;

// ページネーション (/2/, /3/, ...) とタグ一覧
const LIST_PAGE = /^\/(\d+|tags)\//;

function toIso(val) {
  if (val == null) return null;
  // Allow Date object or string
  if (val instanceof Date && !Number.isNaN(val.getTime()))
    return val.toISOString();
  const s = String(val).trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  try {
    if (dateOnly.test(s)) return new Date(`${s}T00:00:00Z`).toISOString();
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  } catch {}
  return null;
}

// Astro の glob loader (getContentEntryIdAndSlug) と同じ規則で URL を組み立てる．
// パスの各セグメントを githubSlug に通すため，FY2023.md は /blog/2024/fy2023/ になる．
// ファイルパスをそのまま使うと大文字を含む記事でキーが一致しない．
function toUrlPath(relPath) {
  const slug = relPath
    .replace(/\.(md|mdx)$/i, '')
    .split(path.sep)
    .map((segment) => githubSlug(segment))
    .join('/')
    .replace(/\/index$/, '');
  return `/blog/${slug}/`;
}

function collectBlogLastmodMap() {
  const baseDir = path.resolve(process.cwd(), 'src/content/blog');
  const map = new Map();

  function walk(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const name = ent.name;
      if (name === 'draft' || name === 'assets') continue;
      const fp = path.join(dir, name);
      if (ent.isDirectory()) {
        walk(fp);
        continue;
      }
      if (!/\.(md|mdx)$/.test(name)) continue;

      const { data } = matter(readFileSync(fp, 'utf8'));
      if (data?.draft === true) continue;

      const lastmod = toIso(data?.updatedDate) ?? toIso(data?.pubDate);
      if (lastmod === null) continue;
      map.set(toUrlPath(path.relative(baseDir, fp)), lastmod);
    }
  }

  try {
    walk(baseDir);
  } catch {}
  return map;
}

function createBlogLastmodSerialize() {
  const MAP = collectBlogLastmodMap();

  return function serialize(item) {
    let pathName;
    try {
      const u = new URL(item.url);
      pathName = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
    } catch {
      return item;
    }

    // 記事以外に lastmod は付けない．ビルド時刻を入れると毎デプロイで
    // 全ページが「更新された」と主張することになり，Google は sitemap 全体の
    // lastmod を無視するようになる．
    const lastmod = MAP.get(pathName);
    if (lastmod) item.lastmod = lastmod;
    else delete item.lastmod;

    if (pathName === '/') item.priority = PRIORITY_HOME;
    else if (LIST_PAGE.test(pathName)) item.priority = PRIORITY_LIST;
    else if (lastmod) item.priority = PRIORITY_POST;

    return item;
  };
}

export const blogLastmodSerialize = createBlogLastmodSerialize();

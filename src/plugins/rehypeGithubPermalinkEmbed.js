import { codeToHast } from 'shiki';
import { visit } from 'unist-util-visit';

const GITHUB_PERMALINK_RE =
  /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)#L(\d+)(?:-L?(\d+))?$/;
const MAX_SNIPPET_LINES = 200;
const rawFileCache = new Map();
const SHIKI_THEME = 'github-dark-dimmed';

const parseGithubPermalink = (href) => {
  const matched = href.match(GITHUB_PERMALINK_RE);
  if (!matched) {
    return null;
  }

  const [, owner, repo, ref, pathRaw, startLineRaw, endLineRaw] = matched;
  let path;
  try {
    path = decodeURIComponent(pathRaw);
  } catch {
    path = pathRaw;
  }
  const startLine = Number(startLineRaw);
  const requestedEndLine = endLineRaw ? Number(endLineRaw) : startLine;

  if (Number.isNaN(startLine) || Number.isNaN(requestedEndLine)) {
    return null;
  }

  return {
    owner,
    repo,
    ref,
    path,
    href,
    startLine,
    requestedEndLine,
  };
};

const buildRawUrl = ({ owner, repo, ref, path }) => {
  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${encodedPath}`;
};

const getFileContent = async (rawUrl) => {
  if (!rawFileCache.has(rawUrl)) {
    rawFileCache.set(
      rawUrl,
      fetch(rawUrl).then((res) => {
        if (!res.ok) {
          throw new Error(`failed to fetch ${rawUrl}: ${res.status}`);
        }
        return res.text();
      }),
    );
  }

  return rawFileCache.get(rawUrl);
};

const getShortRef = (ref) => {
  if (typeof ref !== 'string' || ref.length === 0) {
    return '';
  }

  return ref.slice(0, 7);
};

const detectLanguageFromPath = (path) => {
  const fileName = path.split('/').pop() || '';
  if (fileName === 'Dockerfile') {
    return 'docker';
  }

  const ext = fileName.includes('.')
    ? fileName.split('.').pop().toLowerCase()
    : '';

  if (ext === 'h') {
    return 'c';
  } else if (ext === 'hpp') {
    return 'cpp';
  }

  return ext || 'text';
};

const extractLineNodes = (root) => {
  const pre = root?.children?.find(
    (child) => child.type === 'element' && child.tagName === 'pre',
  );
  const code = pre?.children?.find(
    (child) => child.type === 'element' && child.tagName === 'code',
  );

  if (!code?.children) {
    return null;
  }

  const lineNodes = code.children.filter(
    (child) => child.type === 'element' && child.tagName === 'span',
  );

  return lineNodes.length > 0 ? lineNodes : null;
};

const withLineClassName = (lineNode, currentLine) => {
  const props = lineNode.properties || {};
  const existing = new Set();

  if (typeof props.class === 'string') {
    for (const className of props.class.split(/\s+/)) {
      if (className) {
        existing.add(className);
      }
    }
  }

  if (typeof props.className === 'string') {
    for (const className of props.className.split(/\s+/)) {
      if (className) {
        existing.add(className);
      }
    }
  }

  if (Array.isArray(props.className)) {
    for (const className of props.className) {
      if (typeof className === 'string' && className) {
        existing.add(className);
      }
    }
  }

  existing.add('github-permalink-embed-line');

  return {
    ...lineNode,
    properties: {
      ...props,
      className: Array.from(existing),
      'data-line': String(currentLine),
    },
  };
};

const createPlainLineNodes = (snippet) => {
  return snippet.split('\n').map((line) => ({
    type: 'element',
    tagName: 'span',
    properties: {},
    children: [{ type: 'text', value: line }],
  }));
};

const createHighlightedCodeNode = async ({ snippet, path, startLine }) => {
  const detectedLanguage = detectLanguageFromPath(path);
  let lineNodes = null;

  try {
    const root = await codeToHast(snippet, {
      lang: detectedLanguage,
      theme: SHIKI_THEME,
    });
    lineNodes = extractLineNodes(root);
  } catch (_error) {
    lineNodes = null;
  }

  const normalizedLines = (lineNodes || createPlainLineNodes(snippet)).map(
    (lineNode, index) => withLineClassName(lineNode, startLine + index),
  );

  return {
    type: 'element',
    tagName: 'code',
    properties: {
      className: ['github-permalink-embed-code'],
    },
    children: normalizedLines,
  };
};

const formatLineRange = (startLine, requestedEndLine) => {
  if (startLine === requestedEndLine) {
    return `L${startLine}`;
  }
  return `L${startLine}-L${requestedEndLine}`;
};

const createEmbedNode = ({
  owner,
  repo,
  path,
  href,
  shortRef,
  startLine,
  requestedEndLine,
  codeNode,
}) => {
  const lineRange = formatLineRange(startLine, requestedEndLine);
  return {
    type: 'element',
    tagName: 'figure',
    properties: {
      className: ['github-permalink-embed'],
    },
    children: [
      {
        type: 'element',
        tagName: 'figcaption',
        properties: {
          className: ['github-permalink-embed-caption'],
        },
        children: [
          {
            type: 'element',
            tagName: 'a',
            properties: {
              href,
              target: '_blank',
              rel: ['noopener', 'noreferrer'],
            },
            children: [
              {
                type: 'text',
                value: `${owner}/${repo}/${path}`,
              },
            ],
          },
          {
            type: 'element',
            tagName: 'span',
            properties: {
              className: ['github-permalink-embed-meta'],
            },
            children: [
              {
                type: 'text',
                value: `${shortRef} ${lineRange}`,
              },
            ],
          },
        ],
      },
      {
        type: 'element',
        tagName: 'pre',
        properties: {
          className: ['github-permalink-embed-pre'],
        },
        children: [codeNode],
      },
    ],
  };
};

const rehypeGithubPermalinkEmbed = () => {
  return async (tree) => {
    const targets = [];

    visit(tree, 'element', (node, index, parent) => {
      if (!parent || index == null) {
        return;
      }

      if (node.tagName !== 'a') {
        return;
      }

      const props = node.properties || {};
      if (props['data-github-permalink-embed'] !== 'true') {
        return;
      }

      const href = Array.isArray(props.href) ? props.href[0] : props.href;
      if (typeof href !== 'string') {
        return;
      }

      targets.push({ node, parent, index, href });
    });

    const replacementJobs = targets.map(async (target) => {
      const parsed = parseGithubPermalink(target.href);
      if (!parsed) {
        return null;
      }

      try {
        const rawUrl = buildRawUrl(parsed);
        const content = await getFileContent(rawUrl);
        const lines = content.split(/\r?\n/);

        if (parsed.startLine < 1 || parsed.startLine > lines.length) {
          return null;
        }

        const naturalEndLine = Math.min(parsed.requestedEndLine, lines.length);
        const endLine = Math.min(
          naturalEndLine,
          parsed.startLine + MAX_SNIPPET_LINES - 1,
        );
        const snippet = lines.slice(parsed.startLine - 1, endLine).join('\n');

        if (!snippet) {
          return null;
        }

        const codeNode = await createHighlightedCodeNode({
          snippet,
          path: parsed.path,
          startLine: parsed.startLine,
        });

        return {
          ...target,
          replacement: createEmbedNode({
            ...parsed,
            shortRef: getShortRef(parsed.ref),
            codeNode,
          }),
        };
      } catch (_error) {
        return null;
      }
    });

    const replacements = await Promise.all(replacementJobs);

    for (const item of replacements) {
      if (!item?.replacement) {
        continue;
      }

      item.parent.children[item.index] = item.replacement;
    }
  };
};

export default rehypeGithubPermalinkEmbed;

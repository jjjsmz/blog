async function initMermaid() {
  const mermaidBlocks = document.querySelectorAll(
    'pre code[class*="language-mermaid"]',
  );

  if (mermaidBlocks.length === 0) return;

  try {
    const { default: mermaid } = await import(
      'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'
    );

    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        lineColor: '#5f83be', // --color-accent-tertiary
        textColor: '#c8ced9', // --text-color
        fontFamily:
          "'ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'", // --font-mono
      },
    });

    mermaidBlocks.forEach(async (block, index) => {
      const code = block.textContent;
      const id = `mermaid-${index}`;

      try {
        const { svg } = await mermaid.render(id, code);
        const preElement = block.closest('pre');
        if (preElement) {
          const container = document.createElement('div');
          container.className = 'mermaid-container';
          container.innerHTML = svg;
          preElement.parentNode.replaceChild(container, preElement);

          const svgEle = container.querySelector('svg');
          if (svgEle) {
            svgEle.setAttribute('role', 'img');
            svgEle.setAttribute('aria-label', 'mermaid diagram');
          }

          document.dispatchEvent(new CustomEvent('mermaid-rendered'));
        }
      } catch (error) {
        console.error(`Mermaid rendering error for block ${index}:`, error);
      }
    });
  } catch (error) {
    console.error('Failed to load Mermaid:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMermaid);
} else {
  initMermaid();
}

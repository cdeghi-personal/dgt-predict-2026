'use client'

// Renderizador seguro de Markdown para o Diário da Daisy.
// React-markdown NÃO renderiza HTML bruto por padrão — sem risco de injeção.
// Não usar rehype-raw; manter apenas remarkGfm para formatação estendida.

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-dark mt-8 mb-3 first:mt-0 pb-2 border-b border-light-gray">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold text-dark mt-6 mb-2 flex items-center gap-2">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-dark mt-4 mb-1">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-dark leading-relaxed mb-4 text-[15px]">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-5 space-y-1 mb-4 text-dark">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-5 space-y-1 mb-4 text-dark">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-dark leading-relaxed text-[15px]">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-dark">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-mid-gray">{children}</em>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary pl-4 my-4 bg-primary/5 py-2 pr-3 rounded-r-xl">
      <div className="text-dark italic text-sm leading-relaxed">{children}</div>
    </blockquote>
  ),
  hr: () => <hr className="border-light-gray my-6" />,
  // Links: abrir em nova aba, sem expor URLs não confiáveis
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2 hover:opacity-80"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  // Código inline
  code: ({ children }) => (
    <code className="bg-background px-1.5 py-0.5 rounded text-sm font-mono text-dark">
      {children}
    </code>
  ),
}

interface DaisyMarkdownProps {
  content: string
  className?: string
}

export function DaisyMarkdown({ content, className }: DaisyMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

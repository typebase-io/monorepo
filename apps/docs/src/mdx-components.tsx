import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

import { File, Files, Folder } from '#components/docs/files.tsx';
import { TodoItem, TodoList } from '#components/docs/todo-list.tsx';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Files,
    Folder,
    File,
    TodoList,
    TodoItem,
    ...components,
  };
}

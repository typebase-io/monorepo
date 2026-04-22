export function Line({ indent = 0, children }: { indent?: number; children?: React.ReactNode }) {
  return (
    <div>
      {indent > 0 && <span>{'  '.repeat(indent)}</span>}
      {children ?? '\u00A0'}
    </div>
  );
}

export function ErrorPanel({ title, message }: { title: string; message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <strong>{title}:</strong> {message}
    </section>
  );
}

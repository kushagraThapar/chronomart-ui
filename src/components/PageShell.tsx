import { ReactNode } from "react";
import { useCapabilities } from "../hooks/useCapabilities";

interface Props {
  title: string;
  feature?: string;
  children?: ReactNode;
}

export function PageShell({ title, feature, children }: Props) {
  const { data } = useCapabilities();
  const featureValue = feature ? data?.features?.[feature] : undefined;
  const supported = feature ? featureValue === true || (typeof featureValue === "string" && featureValue !== "none") : true;

  return (
    <section>
      <header className="mb-4 flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {feature && (
          <span className={`text-xs rounded-full px-2 py-0.5 ${supported ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {supported ? `${feature} ✓` : `${feature} unsupported`}
          </span>
        )}
      </header>
      {children ?? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-slate-500">
          <p>Phase-0 placeholder for <strong>{title}</strong>.</p>
          <p className="text-sm mt-2">
            This page will render real data once the selected backend (<code>{data?.sdk ?? "?"}</code>) implements
            the corresponding endpoints.
          </p>
        </div>
      )}
    </section>
  );
}

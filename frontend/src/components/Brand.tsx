export function Brand({ className = "" }: { className?: string }) {
  return (
    <img
      src="/brand/behindthemark-logo.png"
      alt="BehindTheMark"
      width={2048}
      height={683}
      className={["brand-logo", className].filter(Boolean).join(" ")}
    />
  );
}

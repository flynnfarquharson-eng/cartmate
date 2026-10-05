/* eslint-disable @next/next/no-img-element -- artwork comes from thousands of different hosts */
export function PodcastArt({
  src,
  alt,
  size = 56,
}: {
  src: string | null | undefined;
  alt: string;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (!src) {
    return (
      <div
        style={style}
        className="shrink-0 rounded-xl bg-accent-soft text-accent grid place-items-center text-lg font-semibold"
        aria-hidden
      >
        {alt.slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      style={style}
      className="shrink-0 rounded-xl object-cover bg-border"
    />
  );
}

interface BackgroundArtProps {
  /** base name in public/assets/bg, e.g. "mission_background_10" */
  name: string;
  alt?: string;
  className?: string;
}

/** Responsive zone artwork (AVIF → WebP) produced by the asset pipeline. */
export function BackgroundArt({ name, alt = '', className = '' }: BackgroundArtProps) {
  return (
    <picture>
      <source
        type="image/avif"
        srcSet={`/assets/bg/${name}-1280.avif 1280w, /assets/bg/${name}-1920.avif 1920w`}
      />
      <img
        src={`/assets/bg/${name}-1280.webp`}
        srcSet={`/assets/bg/${name}-640.webp 640w, /assets/bg/${name}-1280.webp 1280w, /assets/bg/${name}-1920.webp 1920w`}
        sizes="(max-width: 1024px) 100vw, 900px"
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover ${className}`}
      />
    </picture>
  );
}

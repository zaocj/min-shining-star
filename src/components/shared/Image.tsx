import { useState, type ImgHTMLAttributes } from 'react';

export default function Image({ alt = '', className, width, height, style, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div role={alt ? 'img' : undefined} aria-label={alt ? `${alt}（暂时无法加载）` : undefined} aria-hidden={!alt || undefined}
    className={className} style={{ ...style, aspectRatio: width && height ? `${width}/${height}` : undefined, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
    {alt && <span className="p-4 text-center text-sm">照片暂时无法加载</span>}
  </div>;
  return <img {...props} alt={alt} className={className} width={width} height={height} style={style} onError={(event) => { setFailed(true); props.onError?.(event); }} />;
}

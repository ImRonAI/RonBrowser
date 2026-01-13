import { cn } from "@/lib/utils";


export type ImageProps = {
  base64?: string;
  mediaType?: string;
  uint8Array?: Uint8Array;
  className?: string;
  alt?: string;
  src?: string;
};

export const Image = ({
  base64,
  uint8Array,
  mediaType,
  src,
  ...props
}: ImageProps) => {
  const imageSrc = src || (base64 && mediaType ? `data:${mediaType};base64,${base64}` : '');
  
  if (!imageSrc) return null;

  return (
    <img
      {...props}
      alt={props.alt}
      className={cn(
        "h-auto max-w-full overflow-hidden rounded-md",
        props.className
      )}
      src={imageSrc}
    />
  );
};

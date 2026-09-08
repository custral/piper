import {cn} from "@/lib/utils";

interface PiedPiperLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export function PiedPiperLogo({size = 32, className, ...props}: PiedPiperLogoProps): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-piper", className)}
      {...props}
    >
      <rect x="2" y="2" width="60" height="60" rx="12" fill="currentColor" />
      <path
        d="M22 18 H36 a10 10 0 0 1 0 20 H30 v8 H22 Z M30 26 v4 h6 a2 2 0 0 0 0 -4 Z"
        fill="hsl(var(--piper-foreground))"
      />
    </svg>
  );
}

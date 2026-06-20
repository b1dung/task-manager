import { cn } from '@/lib/utils'

interface IconProps {
  size?: number
  className?: string
}

export function TaskIcon({ size = 14, className }: IconProps) {
  return (
    <svg
      fill="none"
      height={size}
      width={size}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 text-accent', className)}
    >
      <path
        clipRule="evenodd"
        d="m1 3c0-1.10457.89543-2 2-2h10c1.1046 0 2 .89543 2 2v10c0 1.1046-.8954 2-2 2h-10c-1.10457 0-2-.8954-2-2zm2-.5c-.27614 0-.5.22386-.5.5v10c0 .2761.22386.5.5.5h10c.2761 0 .5-.2239.5-.5v-10c0-.27614-.2239-.5-.5-.5zm9.3262 2.98014-5.00003 5.99996c-.1425.171-.35359.2699-.57617.2699s-.43367-.0989-.57617-.2699l-2.5-2.99996 1.15234-.96028 1.92383 2.3086 4.4238-5.3086z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  )
}

export function SubtaskIcon({ size = 14, className }: IconProps) {
  return (
    <svg
      fill="none"
      height={size}
      width={size}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 text-accent', className)}
    >
      <path
        clipRule="evenodd"
        d="m1 3c0-1.10457.89543-2 2-2h3.75c1.10457 0 2 .89543 2 2v4.25h4.25c1.1046 0 2 .89543 2 2v3.75c0 1.1046-.8954 2-2 2h-3.75c-1.10457 0-2-.8954-2-2v-4.25h-4.25c-1.10457 0-2-.89543-2-2zm6.25 4.25v-4.25c0-.27614-.22386-.5-.5-.5h-3.75c-.27614 0-.5.22386-.5.5v3.75c0 .27614.22386.5.5.5zm1.5 1.5v4.25c0 .2761.22386.5.5.5h3.75c.2761 0 .5-.2239.5-.5v-3.75c0-.27614-.2239-.5-.5-.5z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  )
}

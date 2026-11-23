// Small line icons for buttons, drawn in the text colour (so they follow
// the button's colour, hover included).

type Props = { className?: string }

function Icon({ d, className }: Props & { d: string }) {
  return (
    <svg
      aria-hidden
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className ?? ""}`}
    >
      <path d={d} />
    </svg>
  )
}

// a label tag
export const TagIcon = (p: Props) => (
  <Icon {...p} d="M2.5 2.5h5l6 6-5 5-6-6v-5ZM5.5 5.5h.01" />
)

// plus
export const PlusIcon = (p: Props) => <Icon {...p} d="M8 3v10M3 8h10" />

// two lines joining into one
export const MergeIcon = (p: Props) => (
  <Icon {...p} d="M4 2.5v3c0 2 4 3 4 5.5v2.5M12 2.5v3c0 2-4 3-4 5.5" />
)

// a bin
export const TrashIcon = (p: Props) => (
  <Icon
    {...p}
    d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 8.5h6.6l.7-8.5M6.8 7v4M9.2 7v4"
  />
)

// a list with an arrow into it: jump to one
export const JumpIcon = (p: Props) => (
  <Icon {...p} d="M6 4h7.5M6 8h7.5M6 12h7.5M1.5 5.5 4 8l-2.5 2.5" />
)

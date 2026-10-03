import { Cauldron } from './Cauldron'

export function RightRail({ children }: { children?: React.ReactNode }): React.JSX.Element {
  return (
    <aside className="rail">
      {children}
      <Cauldron />
    </aside>
  )
}

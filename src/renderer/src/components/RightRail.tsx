import { useSettings } from '../store/settings'
import { Cauldron } from './Cauldron'
import { SpotifyCard } from './Spotify'

export function RightRail(): React.JSX.Element {
  const presence = useSettings((s) => s.settings.spotify)
  return (
    <aside className="rail">
      {presence === 'card' && <SpotifyCard />}
      <Cauldron />
    </aside>
  )
}

import { useHashRoute } from './lib/useHashRoute'
import { PlayerProvider } from './player/PlayerContext'
import { Layout } from './components/Layout'
import { PlayerBar } from './components/PlayerBar'
import { TracksView } from './views/TracksView'
import { TrackView } from './views/TrackView'
import { TypesView } from './views/TypesView'

export default function App() {
  const route = useHashRoute()

  return (
    <PlayerProvider>
      <Layout route={route}>
        {route.name === 'track' && <TrackView trackId={route.trackId} />}
        {route.name === 'types' && <TypesView />}
        {route.name === 'tracks' && <TracksView />}
      </Layout>
      <PlayerBar />
    </PlayerProvider>
  )
}

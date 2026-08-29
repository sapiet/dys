import { useHashRoute } from './lib/useHashRoute'
import { PlayerProvider } from './player/PlayerContext'
import { Layout } from './components/Layout'
import { PlayerBar } from './components/PlayerBar'
import { TracksView } from './views/TracksView'
import { TrackView } from './views/TrackView'
import { MediaView } from './views/MediaView'

export default function App() {
  const route = useHashRoute()

  return (
    <PlayerProvider>
      <Layout route={route}>
        {route.name === 'track' && <TrackView trackId={route.trackId} />}
        {route.name === 'tracks' && <TracksView />}
        {route.name === 'media' && <MediaView />}
      </Layout>
      <PlayerBar />
    </PlayerProvider>
  )
}

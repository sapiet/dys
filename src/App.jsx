import { useHashRoute } from './lib/useHashRoute'
import { PlayerProvider } from './player/PlayerContext'
import { Layout } from './components/Layout'
import { PlayerBar } from './components/PlayerBar'
import { UnlockDialog } from './components/UnlockDialog'
import { TracksView } from './views/TracksView'
import { TrackView } from './views/TrackView'
import { MediaView } from './views/MediaView'
import { TabView } from './views/TabView'

export default function App() {
  const route = useHashRoute()

  return (
    <PlayerProvider>
      <Layout route={route}>
        {route.name === 'tab' && <TabView trackId={route.trackId} />}
        {route.name === 'track' && <TrackView trackId={route.trackId} groupId={route.groupId} />}
        {route.name === 'tracks' && <TracksView />}
        {route.name === 'media' && <MediaView route={route} />}
      </Layout>
      <PlayerBar />
      <UnlockDialog />
    </PlayerProvider>
  )
}

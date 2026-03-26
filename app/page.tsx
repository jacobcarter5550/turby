import dynamic from 'next/dynamic'
import { Folders } from './components/Folders'
import { getHousemates } from './lib/notion'

const TurbineScene = dynamic(() => import('./components/TurbineScene'))

export default async function Home() {
  const housemates = await getHousemates()

  return (
    <main style={{ display: 'grid', width: '100vw', height: '100vh' }}>
      {/* canvas fills the grid cell */}
      <div style={{ gridArea: '1 / 1' }}>
        <TurbineScene />
      </div>

      {/* UI layer — same grid cell, on top */}
      <div style={{
        gridArea: '1 / 1',
        position: 'relative',
        pointerEvents: 'none',
        zIndex: 1,
      }}>
        {/* top-right title */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '2rem 2.5rem',
        }}>
          <h1 style={{
            margin: 0,
            color: '#ffffff',
            fontSize: '2rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}>
            Turbine
          </h1>
        </div>

        <Folders housemates={housemates} />
      </div>
    </main>
  )
}

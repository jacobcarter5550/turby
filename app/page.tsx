import dynamic from 'next/dynamic'
import { Folders } from './components/Folders'
import { getHousemates, getHappenings } from './lib/notion'

const TurbineScene = dynamic(() => import('./components/TurbineScene'))

export default async function Home() {
  const [housemates, happenings] = await Promise.all([getHousemates(), getHappenings()])

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
          padding: '.75rem 5rem',
          color: "#FFFDF1",
          justifyContent: 'space-between',
          alignItems: "center",
        }}>
          <h1 className="font-ivy-headline m-0 text-[4rem] tracking-wider">
            TURBINE
            <hr className="w-full border-white/20 " />
          </h1>
          <aside className='text-right mx-6 align-baseline h-fit font-ivy-displaycoo'>
            <h3>Who are we? <hr /></h3>

          </aside>
        </div>

        <Folders housemates={housemates} happenings={happenings} />

        {/* Corner brackets */}
        {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(corner => {
          const top    = corner.startsWith('top')
          const left   = corner.endsWith('left')
          return (
            <div key={corner} style={{
              position: 'absolute',
              width: 28, height: 28,
              [top    ? 'top'    : 'bottom']: 28,
              [left   ? 'left'   : 'right' ]: 28,
              borderTop:    top  ? '1.5px solid rgba(255,253,241,0.45)' : undefined,
              borderBottom: !top ? '1.5px solid rgba(255,253,241,0.45)' : undefined,
              borderLeft:   left ? '1.5px solid rgba(255,253,241,0.45)' : undefined,
              borderRight:  !left? '1.5px solid rgba(255,253,241,0.45)' : undefined,
            }} />
          )
        })}
      </div>
    </main>
  )
}

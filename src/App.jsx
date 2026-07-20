
import './App.css'
import TitleBar from './components/TitleBar'
import SubmarineDashboard from './components/SubmarineDashboard'


function App() {
  return (
    <div className="bg-black font-sans text-white h-screen w-screen overflow-hidden flex flex-col selection:bg-white selection:text-black pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <TitleBar/>
      <SubmarineDashboard/>
    </div>
  )
}

export default App

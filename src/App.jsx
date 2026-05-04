
import './App.css'
import TitleBar from './components/TitleBar'
import SubmarineDashboard from './components/SubmarineDashboard'


function App() {
  return (
    <div className="bg-black font-sans text-white h-screen w-screen overflow-hidden flex flex-col selection:bg-white selection:text-black">
      <TitleBar/>
      <SubmarineDashboard/>
    </div>
  )
}

export default App

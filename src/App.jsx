import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import TitleBar from './components/TitleBar'
import Tester from './components/Tester'


function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <TitleBar/>
      <Tester></Tester>
    </>
  )
}

export default App

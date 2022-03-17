import React, { lazy, Suspense } from "react"
import { Grommet } from "grommet"
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect
} from "react-router-dom"
import Header from "./components/Header"
import theme from "./theme"

const Home = lazy(() => import("./pages/Home"))
const Play = lazy(() => import("./pages/Play"))
const Test = lazy(() => import("./pages/Test"))

function App() {
  return (
    <Grommet theme={theme}>
      <Suspense fallback="Sloading...">
        <Router>
          <Header />
          <Switch>
            <Route path="/" exact component={Home}></Route>
            <Redirect exact from="/play" to="/play/1"></Redirect>
            <Route path="/play/:bot" component={Play}></Route>
            <Route path="/test" component={Test}></Route>
          </Switch>
        </Router>
      </Suspense>
    </Grommet>
  )
}

export default App

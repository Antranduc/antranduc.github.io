import { Link } from "gatsby"
import React from "react"

import "../styles/styles.scss"

const Header = ({ siteTitle }) => (
  <header>
    <div className="container">
      <div className="inner-header">
        <div className="logo"> <Link to="/">Anthony Tranduc</Link></div>
        <div className="navigation">
          <nav>
            <h1>Things:</h1>
            <Link to="/projects">I Made</Link>
            <Link to="/about">I Like</Link>
            <Link to="/contact">About Me</Link>
          </nav>
        </div>
      </div>
    </div>
  </header>
)

export default Header

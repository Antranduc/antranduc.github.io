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
            <h1>Things</h1>
            <Link to="/made">I Made</Link>
            <Link to="/like">I Like</Link>
            <Link to="/about">About Me</Link>
          </nav>
        </div>
      </div>
    </div>
  </header>
)

export default Header

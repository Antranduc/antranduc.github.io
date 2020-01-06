import { Link } from "gatsby"
import React from "react"
import { SocialIcon } from 'react-social-icons';

import "../styles/styles.scss"

const Footer = () => (
  <footer>
    <div className="container">
      <div className="inner-footer">
        <div className="social-media">
            <SocialIcon className="social-icon" url="https://linkedin.com/in/anthonytranduc" />
            <SocialIcon className="social-icon" url="https://github.com/antranduc" />
        </div>
      </div>
    </div>
  </footer>
)

export default Footer
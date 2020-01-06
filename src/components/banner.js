import React from "react"
import { useStaticQuery, graphql } from "gatsby"
import Img from "gatsby-image"

const Banner = () => {
    const data = useStaticQuery(graphql`
    query {
      helloSticker: file(relativePath: { eq: "hello2.png" }) {
        childImageSharp {
          fluid(maxWidth: 300) {
            ...GatsbyImageSharpFluid
          }
        }
      }
    }
  `)

    return(
        <div className="banner">
            <div className="main-image">
                <Img fluid={data.helloSticker.childImageSharp.fluid} />
            </div>
        </div>
    )
}

export default Banner
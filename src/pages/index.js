import React from "react"
import { Link } from "gatsby"

import Layout from "../components/layout"
import Image from "../components/image"
import SEO from "../components/seo"
import Banner from "../components/banner"

const IndexPage = () => (
  <Layout>
    <SEO title="Home" />
    <Banner />
  </Layout>
)

export default IndexPage

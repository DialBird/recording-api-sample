import React from 'react'
import { AppProps } from 'next/app'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'src/styles/globals.css'

const MyApp = ({ Component, pageProps }: AppProps) => {
  return <Component {...pageProps} />
}

export default MyApp

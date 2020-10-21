import React, { useEffect } from 'react'
import { AppProps } from 'next/app'

import 'bootstrap/dist/css/bootstrap.min.css'

import { Recording } from 'src/services/indexDB'
import 'src/styles/globals.css'

const MyApp = ({ Component, pageProps }: AppProps) => {
  useEffect(() => {
    Recording.deleteExpiredData()
  }, [])

  return <Component {...pageProps} />
}

export default MyApp

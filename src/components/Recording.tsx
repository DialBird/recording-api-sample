import React, { memo, useEffect, useState } from 'react'
import Button from 'react-bootstrap/Button'
import { v4 as uuidv4 } from 'uuid'

import { IRecording, RecordingDB } from 'src/services/indexDB'

const RecordingRaw = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<any>()
  const [recordings, setRecordings] = useState<IRecording[]>([])

  useEffect(() => {
    RecordingDB.getList().then((list) => setRecordings(list))
  }, [])

  const inactivateStream = (stream: MediaStream) => {
    if (!stream.active) return

    stream.getTracks().forEach((track) => track.stop())
  }

  const media = async () => {
    if (!navigator.mediaDevices) return null

    return navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => stream)
      .catch((err) => {
        if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
          console.log('getDeviseMedia error: ', err)
        }
        return null
      })
  }

  const setupMediaRecorder = (recordingId: string, stream: MediaStream) => {
    /**
     * NOTE: VP8 widely support browser.
     * and when recording popup, resolution wont change.
     * using VP9 cause kind of resolution problem when recording popup
     */
    const mimeType = 'video/webm;codecs="vp8,opus"'

    // @ts-ignore
    const mRecorder = new MediaRecorder(stream, { mimeType })
    mRecorder.ondataavailable = (e: any) => {
      if (e.data && e.data.size > 0) {
        RecordingDB.update(recordingId, e.data)
      }
    }
    mRecorder.onstop = () => {
      setIsRecording(false)
      inactivateStream(stream)
      setMediaRecorder(undefined)
    }

    stream.getVideoTracks()[0].onended = () => {
      if (mRecorder.state === 'recording') {
        mRecorder.stop()
      }
    }
    stream.getAudioTracks()[0].onended = () => {
      if (mRecorder.state === 'recording') {
        mRecorder.stop()
      }
    }

    return mRecorder
  }

  const startRecording = async () => {
    try {
      const stream = await media()
      if (!stream) return

      const recordingId = `${new Date().getTime()}--${uuidv4()}`
      const mRecorder = setupMediaRecorder(recordingId, stream)

      if (!mRecorder) {
        inactivateStream(stream)
        console.log('failed to get media recorder')
        return
      }

      await RecordingDB.create(recordingId)

      setMediaRecorder(mRecorder)
      setIsRecording(true)
      // NOTE: set timespan every 5 sec
      mRecorder.start(5 * 1000)

      console.log('Start recording')
    } catch (err) {
      console.log(err)
    }
  }

  const stopRecording = () => {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') return

    mediaRecorder.stop()
    console.log('Stop recording')
  }

  const downloadRecording = (id: string) => {
    RecordingDB.downloadData(id)
  }

  return (
    <div className="container">
      <h1>Recording Sample</h1>
      {isRecording ? (
        <Button onClick={stopRecording} variant="danger">
          Record Stop
        </Button>
      ) : (
        <Button onClick={startRecording} variant="primary">
          Record Start
        </Button>
      )}
      <ul>
        {recordings.map((recording) => (
          <li key={recording.id}>
            <Button
              onClick={() => downloadRecording(recording.id)}
              variant="primary"
            >
              Download {recording.id}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const Recording = memo(RecordingRaw)

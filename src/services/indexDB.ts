import Dexie from 'dexie'
import * as ebml from 'ts-ebml'

import { formatTimestamp } from 'src/utils/format'

const RECORDING_SAVED_DAYS = 30

// REFERENCE SOURCE: https://dexie.org/docs/Typescript

type IRecordingFragment = {
  id?: number
  blob: Blob
  recordingId: string
}

export type IRecording = {
  id: string
  finishAt?: number // talk end time milliseconds
  saveAt?: number // save time milliseconds
  size: number
  startAt?: number // talk start time milliseconds
}

class CustomDexie extends Dexie {
  recordingFragments: Dexie.Table<IRecordingFragment, number>
  recordings: Dexie.Table<IRecording, string>

  constructor() {
    super('recording_sample')

    this.version(1).stores({
      recordingFragments: '++id, recordingId',
      recordings: 'id, finishAt',
    })
    this.recordingFragments = this.table('recordingFragments')
    this.recordings = this.table('recordings')
  }
}

const db = new CustomDexie()

class RecordingFragmentDB {
  static create(recordingId: string, blob: Blob) {
    return db
      .transaction('rw', db.recordingFragments, () => {
        db.recordingFragments.add({
          blob,
          recordingId,
        })

        return true
      })
      .catch(() => false)
  }

  static getBlobFromFragments(recordingId: string) {
    return db
      .transaction('rw', db.recordingFragments, async () => {
        const fragments = await db.recordingFragments
          .where('recordingId')
          .equals(recordingId)
          .toArray()
        return new Blob(fragments.map((fragment) => fragment.blob))
      })
      .catch(() => new Blob())
  }

  static getSeekableBlobFromFragments(recordingId: string) {
    return this.getBlobFromFragments(recordingId).then(async (blob) => {
      const recBuf = await blob.arrayBuffer()
      const decoder = new ebml.Decoder()
      const ebmlElms = decoder.decode(recBuf)
      const reader = new ebml.Reader()
      for (const elm of ebmlElms) {
        await reader.read(elm)
      }
      const seekableArrayBuf = ebml.tools.makeMetadataSeekable(
        reader.metadatas,
        reader.duration,
        reader.cues,
      )
      const bodyArrayBuf = recBuf.slice(reader.metadataSize)
      return new Blob([seekableArrayBuf, bodyArrayBuf])
    })
  }

  static deleteFragments(recordingId: string) {
    db.recordingFragments.where('recordingId').equals(recordingId).delete()
  }
}

export class RecordingDB {
  static getList() {
    return db.recordings.orderBy('finishAt').reverse().toArray()
  }

  static create(id: string) {
    return db
      .transaction('rw', db.recordings, () => {
        db.recordings.add({
          id,
          size: 0,
          startAt: new Date().getTime(),
        })

        return true
      })
      .catch(() => false)
  }

  static update(id: string, blob: Blob) {
    return db
      .transaction('rw', db.recordingFragments, db.recordings, async () => {
        await RecordingFragmentDB.create(id, blob)

        const blobSize = (await RecordingFragmentDB.getBlobFromFragments(id))
          .size

        db.recordings
          .update(id, {
            finishAt: new Date().getTime(),
            size: blobSize,
          })
          .then((updated) => {
            if (!updated) throw new Error('Recording upload failed')
          })

        return true
      })
      .catch(() => false)
  }

  static delete(id: string) {
    return db
      .transaction('rw', db.recordingFragments, db.recordings, async () => {
        await db.recordingFragments.where('recordingId').equals(id).delete()
        await db.recordings.where('id').equals(id).delete()
        return true
      })
      .catch(() => false)
  }

  /**
   * NOTE: data expires when 10 days passed from finishing
   */
  static deleteExpiredData(expireDateSpan = RECORDING_SAVED_DAYS) {
    return db
      .transaction('rw', db.recordingFragments, db.recordings, async () => {
        await db.recordings
          .where('finishAt')
          .belowOrEqual(
            new Date().getTime() - 1000 * 60 * 60 * 24 * expireDateSpan,
          )
          .each((recording) => {
            RecordingFragmentDB.deleteFragments(recording.id)
          })

        await db.recordings
          .where('finishAt')
          .belowOrEqual(
            new Date().getTime() - 1000 * 60 * 60 * 24 * expireDateSpan,
          )
          .delete()
          .then((count) => {
            if (count > 0) console.log(count, 'recordings deleted')
          })

        return true
      })
      .catch(() => false)
  }

  static downloadData(id: string) {
    return db
      .transaction('rw', db.recordingFragments, db.recordings, async () => {
        const recording = await db.recordings.get(id)
        if (!recording) throw new Error('invalid recording ID')

        if (!recording.saveAt) {
          db.recordings
            .update(id, {
              saveAt: new Date().getTime(),
            })
            .then((updated) => {
              if (!updated) throw new Error('Recording download failed')
            })
        }

        const fileName = `${formatTimestamp(
          new Date(recording.finishAt!),
          'YYYYMMDDhhmm',
        )}_sample.webm`

        const blob = await RecordingFragmentDB.getSeekableBlobFromFragments(
          recording.id,
        )
        const objectURL = window.URL.createObjectURL(blob)
        const downLoadLink = document.createElement('a')
        downLoadLink.href = objectURL
        downLoadLink.download = fileName
        downLoadLink.click()
        downLoadLink.remove()

        return true
      })
      .catch(() => false)
  }
}

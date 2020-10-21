export const formatTimestamp = (date: Date, format = 'YYYY/MM/DD hh:mm a') => {
  format = format.replace(/YYYY/g, date.getFullYear().toString())
  format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2))
  format = format.replace(/DD/g, ('0' + date.getDate()).slice(-2))
  format = format.replace(/hh/g, ('0' + (date.getHours() % 12)).slice(-2))
  format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2))
  format = format.replace(/a/g, date.getHours() >= 12 ? 'PM' : 'AM')
  if (format.match(/S/g)) {
    let milliSeconds = ('00' + date.getMilliseconds()).slice(-3)
    const matches = format.match(/S/g)
    if (matches) {
      for (let i = 0; i < matches.length; i++) {
        format = format.replace(/S/, milliSeconds.substring(i, i + 1))
      }
    }
  }
  return format
}

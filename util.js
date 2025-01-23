export async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function sleepUntil(date) {
    const timeToWait = Math.max(0, date.getTime() - Date.now())
    return sleep(timeToWait)
}

// Given a date and a timezone, return the date in YYYY-MM-DD format
// 
// Example: new Date(), "America/Los_Angeles" -> "2025-01-23"
export function yyyymmddLocalTimezone(date, timezone) {
    if (!(date instanceof Date)) {
        date = new Date(date)
    }
    
    const parts = date.toLocaleString('en-US', { 
        timeZone: timezone, 
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit' 
    })
    .split(',')[0]
    .split('/')

    // parts are in MM/DD/YYYY format
    const [month, day, year] = parts
    return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`
}

// Given 2025-01-23 and 2025-01-25, return [2025-01-23, 2025-01-24, 2025-01-25]
export function daysBetweenYyymmdd(startDateStr, endDateStr) {
    const days = []
    const currentDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)

    while (currentDate <= endDate) {
        days.push(currentDate.toISOString().split('T')[0])
        currentDate.setDate(currentDate.getDate() + 1)
    }

    return days
}